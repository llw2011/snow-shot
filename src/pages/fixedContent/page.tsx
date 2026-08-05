"use client";

import { useRouter } from "@tanstack/react-router";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import extraClipboard from "tauri-plugin-clipboard-api";
import {
	getCurrentMonitorInfo,
	type MonitorInfo,
	readImageFromClipboard,
} from "@/commands/core";
import { setReadClipboardState } from "@/commands/globalSate";
import {
	scrollScreenshotClear,
	scrollScreenshotGetImageData,
} from "@/commands/scrollScreenshot";
import { useIdlePage } from "@/components/idlePageCore";
import { TextScaleFactorContextProvider } from "@/components/textScaleFactorContextProvider";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import {
	AppSettingsFixedContentInitialPosition,
	AppSettingsGroup,
} from "@/types/appSettings";
import { appWarn } from "@/utils/log";
import { setWindowRect, showWindow } from "@/utils/window";
import {
	getImageBufferFromSharedBuffer,
	type ImageSharedBufferData,
} from "../draw/tools";
import type { FixedContentActionType } from "./components/fixedContentCore";

type FixedContentCoreComponent =
	typeof import("./components/fixedContentCore")["FixedContentCore"];
type FixedContentInitParams = Parameters<FixedContentActionType["init"]>[0];
type FixedContentActivation = { targetUrl?: string };

const FixedContentActivePage: React.FC<{
	FixedContentCore: FixedContentCoreComponent;
	targetUrl?: string;
}> = ({ FixedContentCore, targetUrl }) => {
	const fixedContentActionRef = useRef<FixedContentActionType>(undefined);
	const initedRef = useRef(false);

	const [windowInitialPosition, setWindowInitialPosition] = useState<
		undefined | AppSettingsFixedContentInitialPosition
	>();
	useAppSettingsLoad(
		useCallback((settings) => {
			setWindowInitialPosition(
				settings[AppSettingsGroup.FunctionFixedContent].initialPosition,
			);
		}, []),
	);

	const initFixedContent = useCallback(
		async (params: FixedContentInitParams) => {
			const fixedContentAction = fixedContentActionRef.current;
			if (!fixedContentAction) {
				throw new Error("Fixed content action is not ready");
			}

			await fixedContentAction.init(params);
		},
		[],
	);

	const init = useCallback(
		async (targetUrl?: string) => {
			const urlParams = targetUrl
				? new URL(targetUrl, window.location.origin).searchParams
				: new URLSearchParams(window.location.search);

			if (urlParams.get("scroll_screenshot") === "true") {
				// 可能通过 SharedBuffer 传递
				const imageSharedBufferPromise = getImageBufferFromSharedBuffer(
					"scroll_screenshot",
				).catch((error) => {
					appWarn(
						"[FixedContentPage] read scroll screenshot shared buffer failed",
						error,
					);
					return undefined;
				});
				let imageData: ArrayBuffer | ImageSharedBufferData | undefined =
					await scrollScreenshotGetImageData();
				await scrollScreenshotClear();
				if (
					imageData &&
					imageData.byteLength === 1 &&
					new Uint8Array(imageData)[0] === 1
				) {
					imageData = await imageSharedBufferPromise;
				}

				if (!imageData) {
					await getCurrentWindow().close();
					return;
				}

				await initFixedContent({ imageContent: imageData });
				return;
			}

			let initParams: FixedContentInitParams | undefined;
			const imageSharedBufferPromise = getImageBufferFromSharedBuffer(
				"read_image_from_clipboard",
			).catch((error) => {
				appWarn(
					"[FixedContentPage] read clipboard shared buffer failed",
					error,
				);
				return undefined;
			});

			await setReadClipboardState(true);
			try {
				let imageData: ArrayBuffer | ImageSharedBufferData | undefined =
					await readImageFromClipboard().catch(() => undefined);
				if (
					imageData &&
					imageData.byteLength === 1 &&
					new Uint8Array(imageData)[0] === 1
				) {
					imageData = await imageSharedBufferPromise;
				}
				if (imageData) {
					initParams = { imageContent: imageData };
				}

				if (!initParams) {
					const htmlContent = await extraClipboard
						.readHtml()
						.catch(() => undefined);
					if (htmlContent !== undefined) {
						initParams = { htmlContent };
					}
				}

				if (!initParams) {
					const textContent = await extraClipboard
						.readText()
						.catch(() => undefined);
					if (textContent !== undefined) {
						initParams = { textContent };
					}
				}

				if (!initParams) {
					const fileUris = await extraClipboard
						.readFilesURIs()
						.catch(() => undefined);
					const imageFileUri = fileUris?.find(
						(fileUri) =>
							fileUri.endsWith(".png") ||
							fileUri.endsWith(".jpg") ||
							fileUri.endsWith(".jpeg") ||
							fileUri.endsWith(".webp"),
					);
					if (imageFileUri) {
						initParams = {
							imageContent: convertFileSrc(imageFileUri),
						};
					}
				}
			} finally {
				await setReadClipboardState(false).catch((error) => {
					appWarn(
						"[FixedContentPage] reset clipboard read state failed",
						error,
					);
				});
			}

			if (!initParams) {
				await getCurrentWindow().close();
				return;
			}

			await initFixedContent(initParams);
		},
		[initFixedContent],
	);

	useEffect(() => {
		if (initedRef.current) {
			return;
		}

		initedRef.current = true;
		void init(targetUrl).catch((error) => {
			appWarn("[FixedContentPage] initialize fixed content failed", error);
			void getCurrentWindow()
				.close()
				.catch((closeError) => {
					appWarn(
						"[FixedContentPage] close failed fixed content window failed",
						closeError,
					);
				});
		});
	}, [init, targetUrl]);

	const [loadParams, setLoadParams] = useState<
		| {
				container:
					| { width: number; height: number }
					| null
					| { naturalWidth: number; naturalHeight: number }
					| HTMLDivElement;
				monitorInfo?: MonitorInfo;
				initialScale?: number;
		  }
		| undefined
	>();
	const onHtmlTextImageLoad = useCallback(
		(
			container:
				| { width: number; height: number }
				| null
				| { naturalWidth: number; naturalHeight: number }
				| HTMLDivElement,
			monitorInfo?: MonitorInfo,
			initialScale?: number,
		) => {
			setLoadParams({ container, monitorInfo, initialScale });
		},
		[],
	);

	useEffect(() => {
		if (!loadParams || !windowInitialPosition) {
			return;
		}

		const updateWindow = async () => {
			const appWindow = getCurrentWindow();
			const { container } = loadParams;

			if (!container) {
				return;
			}

			const monitorInfo =
				loadParams.monitorInfo ?? (await getCurrentMonitorInfo());
			const initialScale = loadParams.initialScale ?? 1;

			let width = 0;
			let height = 0;
			if ("naturalWidth" in container) {
				width = container.naturalWidth;
				height = container.naturalHeight;
			} else if ("width" in container && "height" in container) {
				width = container.width;
				height = container.height;
			} else {
				width = container.clientWidth * window.devicePixelRatio;
				height = container.clientHeight * window.devicePixelRatio;
			}

			if (width > 0 && height > 0) {
				const windowWidth = Math.floor(width * initialScale);
				const windowHeight = Math.floor(height * initialScale);

				let targetX = monitorInfo.monitor_x + monitorInfo.mouse_x;
				let targetY = monitorInfo.monitor_y + monitorInfo.mouse_y;
				if (
					windowInitialPosition ===
					AppSettingsFixedContentInitialPosition.MonitorCenter
				) {
					targetX = monitorInfo.monitor_x + monitorInfo.monitor_width / 2;
					targetY = monitorInfo.monitor_y + monitorInfo.monitor_height / 2;
				}

				const windowX = Math.round(targetX - windowWidth / 2);
				const windowY = Math.round(targetY - windowHeight / 2);
				await setWindowRect(appWindow, {
					min_x: windowX,
					min_y: windowY,
					max_x: windowX + windowWidth,
					max_y: windowY + windowHeight,
				});
				await showWindow();
			} else {
				await appWindow.close();
			}
		};

		void updateWindow().catch((error) => {
			appWarn("[FixedContentPage] position fixed content window failed", error);
		});
	}, [loadParams, windowInitialPosition]);

	return (
		<TextScaleFactorContextProvider>
			<FixedContentCore
				actionRef={fixedContentActionRef}
				onHtmlLoad={onHtmlTextImageLoad}
				onTextLoad={onHtmlTextImageLoad}
				onImageLoad={onHtmlTextImageLoad}
			/>
		</TextScaleFactorContextProvider>
	);
};

const FixedContentActiveLoader: React.FC<FixedContentActivation> = ({
	targetUrl,
}) => {
	const [FixedContentCore, setFixedContentCore] =
		useState<FixedContentCoreComponent>();

	useEffect(() => {
		let disposed = false;

		void import("./components/fixedContentCore")
			.then((module) => {
				if (!disposed) {
					setFixedContentCore(() => module.FixedContentCore);
				}
			})
			.catch((error) => {
				if (disposed) {
					return;
				}

				appWarn("[FixedContentPage] load fixed content core failed", error);
				void getCurrentWindow()
					.close()
					.catch((closeError) => {
						appWarn(
							"[FixedContentPage] close unloaded fixed content window failed",
							closeError,
						);
					});
			});

		return () => {
			disposed = true;
		};
	}, []);

	if (!FixedContentCore) {
		return null;
	}

	return (
		<FixedContentActivePage
			FixedContentCore={FixedContentCore}
			targetUrl={targetUrl}
		/>
	);
};

const FixedContentIdleShell: React.FC<{
	onActivate: (targetUrl: string) => void;
}> = ({ onActivate }) => {
	const router = useRouter();
	useIdlePage(
		true,
		useCallback(
			(url) => {
				if (url.startsWith("/fixedContent")) {
					onActivate(url);
					return;
				}

				void router.navigate({ to: url }).catch((error) => {
					appWarn("[FixedContentPage] navigate hot load page failed", error);
				});
			},
			[onActivate, router],
		),
	);

	return null;
};

export const FixedContentPage: React.FC = () => {
	const [activation, setActivation] = useState<FixedContentActivation | null>(
		() =>
			new URLSearchParams(window.location.search).get("idle_page") === "true"
				? null
				: {},
	);
	const activate = useCallback((targetUrl: string) => {
		setActivation({ targetUrl });
	}, []);

	if (!activation) {
		return <FixedContentIdleShell onActivate={activate} />;
	}

	return <FixedContentActiveLoader targetUrl={activation.targetUrl} />;
};
