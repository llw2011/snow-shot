import type { EventCallback, UnlistenFn } from "@tauri-apps/api/event";
import {
	type Window as AppWindow,
	getCurrentWindow,
} from "@tauri-apps/api/window";
import { attachConsole } from "@tauri-apps/plugin-log";
import { debounce } from "es-toolkit";
import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
} from "react";
import {
	listenKeyStop,
	listenKeyStopByWindowLabel,
	listenMouseStopByWindowLabel,
} from "@/commands/listenKey";
import { ocrRelease } from "@/commands/ocr";
import {
	LISTEN_KEY_SERVICE_KEY_DOWN_EMIT_KEY,
	LISTEN_KEY_SERVICE_KEY_UP_EMIT_KEY,
	LISTEN_KEY_SERVICE_MOUSE_DOWN_EMIT_KEY,
	LISTEN_KEY_SERVICE_MOUSE_STOP_EMIT_KEY,
	LISTEN_KEY_SERVICE_MOUSE_UP_EMIT_KEY,
	LISTEN_KEY_SERVICE_STOP_EMIT_KEY,
} from "@/constants/eventListener";
import { PLUGIN_EVENT_PLUGIN_STATUS_CHANGE } from "@/constants/pluginService";
import { AntdContext } from "@/contexts/antdContext";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import {
	FIXED_CONTENT_FOCUS_MODE_CLOSE_ALL_WINDOW,
	FIXED_CONTENT_FOCUS_MODE_CLOSE_OTHER_WINDOW,
	FIXED_CONTENT_FOCUS_MODE_HIDE_OTHER_WINDOW,
	FIXED_CONTENT_FOCUS_MODE_SHOW_ALL_WINDOW,
} from "@/functions/fixedContent";
import { usePathname } from "@/hooks/usePathname";
import {
	ListenKeyCode,
	type ListenKeyDownEvent,
	type ListenKeyUpEvent,
} from "@/types/commands/listenKey";
import { appLog, type LogMessageEvent } from "@/utils/appLog";
import { appError, appWarn } from "@/utils/log";
import { showWindow } from "@/utils/window";

type Listener = {
	event: string;
	// biome-ignore lint/suspicious/noExplicitAny: any is used to avoid type errors
	callback: EventCallback<any>;
};

export type EventListenerContextType = {
	addListener: (event: string, listener: (payload: unknown) => void) => number;
	removeListener: (id: number) => boolean;
};

export const EventListenerContext = createContext<EventListenerContextType>({
	addListener: () => 0,
	removeListener: () => false,
});
/**
 * 监听 tauri 的消息
 */
const EventListenerCore: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const { pathname, hasLayout } = usePathname();
	const appWindowRef = useRef<AppWindow | undefined>(undefined);
	useEffect(() => {
		appWindowRef.current = getCurrentWindow();
	}, []);

	const listenerCount = useRef<number>(0);
	const listenerMapRef = useRef<Map<number, Listener>>(new Map());
	const listenerEventMapRef = useRef<Map<string, Set<number>>>(new Map());
	const addListener = useCallback(
		(event: string, listener: (payload: unknown) => void) => {
			listenerCount.current++;
			const listenerId = listenerCount.current;
			listenerMapRef.current.set(listenerId, { event, callback: listener });

			let listenerList = listenerEventMapRef.current.get(event);
			if (!listenerList) {
				listenerList = new Set();
			}
			listenerList.add(listenerId);
			listenerEventMapRef.current.set(event, listenerList);

			return listenerId;
		},
		[],
	);
	const removeListener = useCallback((listenerId: number): boolean => {
		const listener = listenerMapRef.current.get(listenerId);
		if (!listener) {
			return false;
		}

		let res = true;
		res =
			(res &&
				listenerEventMapRef.current.get(listener.event)?.delete(listenerId)) ??
			false;
		res = res && listenerMapRef.current.delete(listenerId);

		return res;
	}, []);

	const { reloadAppSettings } = useContext(AppSettingsActionContext);
	const reloadAppSettingsRef = useRef(reloadAppSettings);
	useEffect(() => {
		reloadAppSettingsRef.current = reloadAppSettings;
	}, [reloadAppSettings]);

	const { message } = useContext(AntdContext);
	const messageRef = useRef(message);
	useEffect(() => {
		messageRef.current = message;
	}, [message]);

	const {
		isDrawPage,
		isFullScreenDraw,
		isFullScreenDrawSwitchMouseThrough,
		isVideoRecordPage,
		isIdlePage,
		isFixedContentPage,
		isVideoRecordToolbarPage,
	} = useMemo(() => {
		let isDrawPage = false;
		let isFullScreenDraw = false;
		let isFullScreenDrawSwitchMouseThrough = false;
		let isVideoRecordPage = false;
		let isVideoRecordToolbarPage = false;
		let isIdlePage = false;
		let isFixedContentPage = false;
		if (pathname === "/draw") {
			isDrawPage = true;
		} else if (pathname === "/fullScreenDraw") {
			isFullScreenDraw = true;
		} else if (pathname === "/fullScreenDrawSwitchMouseThrough") {
			isFullScreenDrawSwitchMouseThrough = true;
		} else if (pathname === "/videoRecord") {
			isVideoRecordPage = true;
		} else if (pathname === "/videoRecordToolbar") {
			isVideoRecordToolbarPage = true;
		} else if (pathname === "/idle") {
			isIdlePage = true;
		} else if (pathname === "/fixedContent") {
			isFixedContentPage = true;
		}

		return {
			isDrawPage,
			isFullScreenDraw,
			isFullScreenDrawSwitchMouseThrough,
			isVideoRecordPage,
			isVideoRecordToolbarPage,
			isIdlePage,
			isFixedContentPage,
		};
	}, [pathname]);

	const releaseOcrSessionAction = useMemo(() => {
		return debounce(async () => {
			await ocrRelease();
		}, 16 * 1000);
	}, []);

	const { refreshPluginStatusThrottle } = usePluginServiceContext();

	useEffect(() => {
		let detach: UnlistenFn;
		attachConsole().then((d) => {
			detach = d;
		});

		const unlistenList: Promise<UnlistenFn>[] = [];
		const defaultListener: Listener[] = [];

		const listenKeyCallback = (
			emitKey:
				| typeof LISTEN_KEY_SERVICE_KEY_DOWN_EMIT_KEY
				| typeof LISTEN_KEY_SERVICE_KEY_UP_EMIT_KEY,
		) => {
			let type = "keydown";
			if (emitKey === LISTEN_KEY_SERVICE_KEY_UP_EMIT_KEY) {
				type = "keyup";
			}

			return async ({
				payload,
			}: {
				payload: ListenKeyDownEvent | ListenKeyUpEvent;
			}) => {
				switch (payload.key) {
					case ListenKeyCode.RControl:
					case ListenKeyCode.LControl:
						document.dispatchEvent(
							new KeyboardEvent(type, {
								code: "ControlLeft",
								key: "Control",
								keyCode: 17,
								which: 17,
							}),
						);
						break;
					case ListenKeyCode.RShift:
					case ListenKeyCode.LShift:
						document.dispatchEvent(
							new KeyboardEvent(type, {
								code: "ShiftLeft",
								key: "Shift",
								keyCode: 16,
								which: 16,
							}),
						);
						break;
					case ListenKeyCode.Command:
					case ListenKeyCode.RCommand:
						document.dispatchEvent(
							new KeyboardEvent(type, {
								code: "MetaLeft",
								key: "Meta",
								keyCode: 224,
								which: 224,
							}),
						);
						break;
					case ListenKeyCode.LOption:
					case ListenKeyCode.ROption:
						document.dispatchEvent(
							new KeyboardEvent(type, {
								code: "AltLeft",
								key: "Alt",
								keyCode: 18,
								which: 18,
							}),
						);
						break;
					default:
						break;
				}
			};
		};

		defaultListener.push({
			event: LISTEN_KEY_SERVICE_KEY_DOWN_EMIT_KEY,
			callback: listenKeyCallback(LISTEN_KEY_SERVICE_KEY_DOWN_EMIT_KEY),
		});
		defaultListener.push({
			event: LISTEN_KEY_SERVICE_KEY_UP_EMIT_KEY,
			callback: listenKeyCallback(LISTEN_KEY_SERVICE_KEY_UP_EMIT_KEY),
		});

		defaultListener.push({
			event: PLUGIN_EVENT_PLUGIN_STATUS_CHANGE,
			callback: async () => {
				refreshPluginStatusThrottle();
			},
		});

		if (hasLayout) {
			defaultListener.push({
				event: "release-ocr-session",
				callback: async () => {
					releaseOcrSessionAction();
				},
			});
			defaultListener.push({
				event: "log-message",
				callback: ({ payload }: { payload: LogMessageEvent }) => {
					appLog(payload, undefined, "APP_TAURI");
				},
			});
			defaultListener.push({
				event: "execute-chat",
				callback: async () => {},
			});
			defaultListener.push({
				event: "execute-chat-selected-text",
				callback: async () => {},
			});
			defaultListener.push({
				event: "execute-translate",
				callback: async () => {},
			});
			defaultListener.push({
				event: "execute-translate-selected-text",
				callback: async () => {},
			});
			defaultListener.push({
				event: "main-window:send-error-message",
				callback: async ({ payload }: { payload: string }) => {
					showWindow();
					messageRef.current.error(payload);
				},
			});
			defaultListener.push({
				event: LISTEN_KEY_SERVICE_STOP_EMIT_KEY,
				callback: async ({ payload }: { payload: string }) => {
					listenKeyStopByWindowLabel(payload);
				},
			});
			defaultListener.push({
				event: "on-hide-main-window",
				callback: async () => {},
			});
			defaultListener.push({
				event: "show-or-hide-main-window",
				callback: async () => {},
			});
			defaultListener.push({
				event: "open-image-save-folder",
				callback: async () => {},
			});
			defaultListener.push({
				event: "open-capture-history",
				callback: async () => {},
			});
			defaultListener.push({
				event: "on-capture-history-change",
				callback: async () => {},
			});
		} else {
			defaultListener.push({
				event: FIXED_CONTENT_FOCUS_MODE_SHOW_ALL_WINDOW,
				callback: async () => {},
			});
			defaultListener.push({
				event: FIXED_CONTENT_FOCUS_MODE_HIDE_OTHER_WINDOW,
				callback: async () => {},
			});
			defaultListener.push({
				event: FIXED_CONTENT_FOCUS_MODE_CLOSE_OTHER_WINDOW,
				callback: async () => {},
			});
			defaultListener.push({
				event: FIXED_CONTENT_FOCUS_MODE_CLOSE_ALL_WINDOW,
				callback: async () => {},
			});

			defaultListener.push({
				event: "reload-app-settings",
				callback: async () => {
					reloadAppSettingsRef.current();
				},
			});

			if (isDrawPage) {
				defaultListener.push({
					event: "execute-screenshot",
					callback: async () => {},
				});
				defaultListener.push({
					event: "finish-screenshot",
					callback: async () => {},
				});
				defaultListener.push({
					event: "release-draw-page",
					callback: async () => {},
				});
				defaultListener.push({
					event: LISTEN_KEY_SERVICE_MOUSE_DOWN_EMIT_KEY,
					callback: async () => {},
				});
				defaultListener.push({
					event: LISTEN_KEY_SERVICE_MOUSE_UP_EMIT_KEY,
					callback: async () => {},
				});
				defaultListener.push({
					event: LISTEN_KEY_SERVICE_MOUSE_STOP_EMIT_KEY,
					callback: async ({ payload }: { payload: string }) => {
						listenMouseStopByWindowLabel(payload);
					},
				});
			}

			if (isFullScreenDraw || isFullScreenDrawSwitchMouseThrough) {
				defaultListener.push({
					event: "full-screen-draw-change-mouse-through",
					callback: async () => {},
				});
			}

			if (isVideoRecordPage || isVideoRecordToolbarPage) {
				defaultListener.push({
					event: "reload-video-record",
					callback: async () => {},
				});
				defaultListener.push({
					event: "start-or-copy-video",
					callback: async () => {},
				});
			}

			if (isVideoRecordPage) {
				defaultListener.push({
					event: "change-video-record-state",
					callback: async () => {},
				});
			}

			if (isIdlePage || isFixedContentPage) {
				defaultListener.push({
					event: "hot-load-page-route-push",
					callback: async () => {},
				});
			}

			if (isFixedContentPage || isDrawPage) {
				defaultListener.push({
					event: "resize-window-service:resize-window",
					callback: async () => {},
				});
				defaultListener.push({
					event: "free-drag-window-service:stop",
					callback: async () => {},
				});
			}
		}

		defaultListener
			.map((listener) => {
				const res: Listener = {
					event: listener.event,
					callback: (e) => {
						listener.callback(e);
						try {
							listenerEventMapRef.current.get(listener.event)?.forEach((id) => {
								listenerMapRef.current.get(id)?.callback(e);
							});
						} catch (error) {
							appError("[EventListenerCore] callback error", error);
						}
					},
				};
				return res;
			})
			.forEach((listener) => {
				if (!appWindowRef.current) {
					appWarn("[EventListenerCore] appWindowRef.current is not set");
					return;
				}

				unlistenList.push(
					appWindowRef.current.listen(listener.event, listener.callback),
				);
			});

		return () => {
			listenerEventMapRef.current = new Map();
			listenerMapRef.current = new Map();
			listenerCount.current = 0;

			listenKeyStop();

			unlistenList.forEach((unlisten) => {
				unlisten.then((unlisten) => {
					try {
						unlisten();
					} catch (error) {
						appError("[EventListenerCore] clear unlisten error", error);
					}
				});
			});

			detach?.();
		};
	}, [
		isDrawPage,
		isFullScreenDraw,
		isFullScreenDrawSwitchMouseThrough,
		isVideoRecordPage,
		isVideoRecordToolbarPage,
		releaseOcrSessionAction,
		refreshPluginStatusThrottle,
		isIdlePage,
		isFixedContentPage,
		hasLayout,
	]);

	const eventListenerContextValue = useMemo(() => {
		return {
			addListener,
			removeListener,
		};
	}, [addListener, removeListener]);
	return (
		<EventListenerContext.Provider value={eventListenerContextValue}>
			{children}
		</EventListenerContext.Provider>
	);
};

export const EventListener = React.memo(EventListenerCore);
