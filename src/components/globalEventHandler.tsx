import { useRouter } from "@tanstack/react-router";
import { openPath } from "@tauri-apps/plugin-opener";
import React, { useContext, useEffect } from "react";
import {
	createFixedContentWindow,
	createFullScreenDrawWindow,
	getSelectedText,
} from "@/commands/core";
import { getCaptureState } from "@/commands/globalSate";
import {
	nativeActionAck,
	nativeMainRuntimeProbeAck,
} from "@/commands/nativeAction";
import { showMainWindow } from "@/commands/videoRecord";
import { EventListenerContext } from "@/components/eventListener";
import { AppSettingsPublisher } from "@/contexts/appSettingsActionContext";
import {
	executeScreenshot,
	executeScreenshotFocusedWindow,
} from "@/functions/screenshot";
import {
	executeChat,
	executeChatSelectedText,
	executeTranslate,
	executeTranslateSelectedText,
	openCaptureHistory,
	openImageSaveFolder,
	showOrHideMainWindow,
} from "@/functions/tools";
import { startOrCopyVideo } from "@/functions/videoRecord";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { AppFunction } from "@/types/components/appFunction";
import { encodeParamsValue } from "@/utils/base64";
import { getImageSaveDirectory } from "@/utils/file";
import { appError, appWarn } from "@/utils/log";
import { ScreenshotType } from "@/utils/types";
import { showWindow } from "@/utils/window";

type NativeActionRequest = {
	requestId: number;
	documentId: string;
	action: AppFunction;
	source: string;
	drawWindowLabel?: string;
};

const GlobalEventHandlerCore: React.FC = () => {
	const router = useRouter();

	const { addListener, removeListener } = useContext(EventListenerContext);
	const [getAppSettings] = useStateSubscriber(AppSettingsPublisher, undefined);

	useEffect(() => {
		const listenerIdList: number[] = [];
		listenerIdList.push(
			addListener("native-main-runtime-probe", (args) => {
				const { probeId, documentId } = (
					args as {
						payload: { probeId: number; documentId: string };
					}
				).payload;
				void nativeMainRuntimeProbeAck(probeId, documentId).catch((error) => {
					appError("[GlobalEventHandler] main runtime probe ack failed", error);
				});
			}),
			addListener("execute-native-action", async (args) => {
				const { requestId, documentId, action, source, drawWindowLabel } = (
					args as { payload: NativeActionRequest }
				).payload;
				try {
					if (!(await nativeActionAck(requestId, documentId))) {
						appWarn(
							`[GlobalEventHandler] ignored expired native action ${requestId}`,
						);
						return;
					}
				} catch (error) {
					appError("[GlobalEventHandler] native action ack failed", error);
					return;
				}

				try {
					const executeDrawScreenshot = (type?: ScreenshotType) =>
						executeScreenshot(type, undefined, undefined, drawWindowLabel);
					switch (action) {
						case AppFunction.Screenshot:
							await executeDrawScreenshot();
							break;
						case AppFunction.ScreenshotDelay:
							await executeDrawScreenshot(ScreenshotType.Delay);
							break;
						case AppFunction.ScreenshotFixed:
							await executeDrawScreenshot(ScreenshotType.Fixed);
							break;
						case AppFunction.ScreenshotOcr:
							await executeDrawScreenshot(ScreenshotType.OcrDetect);
							break;
						case AppFunction.ScreenshotOcrTranslate:
							await executeDrawScreenshot(ScreenshotType.OcrTranslate);
							break;
						case AppFunction.ScreenshotCopy:
							await executeDrawScreenshot(ScreenshotType.Copy);
							break;
						case AppFunction.ScreenshotFullScreen:
							await executeDrawScreenshot(ScreenshotType.CaptureFullScreen);
							break;
						case AppFunction.ScreenshotFocusedWindow:
							await executeScreenshotFocusedWindow(getAppSettings());
							break;
						case AppFunction.Chat:
							await executeChat();
							break;
						case AppFunction.ChatSelectText:
							await executeChatSelectedText();
							break;
						case AppFunction.Translation:
							await executeTranslate();
							break;
						case AppFunction.TranslationSelectText:
							await executeTranslateSelectedText();
							break;
						case AppFunction.FixedContent:
							if (
								source === "shortcut" &&
								(await getCaptureState()).capturing
							) {
								break;
							}
							await createFixedContentWindow();
							break;
						case AppFunction.VideoRecord:
							await executeDrawScreenshot(ScreenshotType.VideoRecord);
							break;
						case AppFunction.VideoRecordCopy:
							await startOrCopyVideo();
							break;
						case AppFunction.TopWindow:
							await executeDrawScreenshot(ScreenshotType.TopWindow);
							break;
						case AppFunction.FullScreenDraw:
							await createFullScreenDrawWindow();
							break;
						case AppFunction.ShowOrHideMainWindow:
							await showOrHideMainWindow();
							break;
						case AppFunction.OpenImageSaveFolder:
							await openImageSaveFolder();
							break;
						case AppFunction.OpenCaptureHistory:
							await openCaptureHistory();
							break;
					}
				} catch (error) {
					appError(
						`[GlobalEventHandler] native action ${action} failed`,
						error,
					);
				}
			}),
			addListener("execute-chat", () => {
				showWindow();
				router.navigate({ to: `/tools/chat?t=${Date.now()}` });
			}),
			addListener("execute-chat-selected-text", async () => {
				const text = (await getSelectedText()).substring(0, 10000);
				await showWindow();
				router.navigate({
					to: `/tools/chat?selectText=${encodeParamsValue(text)}&t=${Date.now()}`,
				});
			}),
			addListener("execute-translate", () => {
				showWindow();
				router.navigate({ to: `/tools/translation?t=${Date.now()}` });
			}),
			addListener("execute-translate-selected-text", async () => {
				const text = (await getSelectedText()).substring(0, 10000);
				await showWindow();
				router.navigate({
					to: `/tools/translation?selectText=${encodeParamsValue(text)}&t=${Date.now()}`,
				});
			}),
			addListener("show-or-hide-main-window", () => {
				showMainWindow(true);
			}),
			addListener("open-image-save-folder", async () => {
				const saveFileDirectory = await getImageSaveDirectory(getAppSettings());
				openPath(saveFileDirectory);
			}),
			addListener("open-capture-history", async () => {
				await showWindow();
				router.navigate({
					to: `/tools/captureHistory`,
				});
			}),
		);

		return () => {
			listenerIdList.forEach((id) => {
				removeListener(id);
			});
		};
	}, [addListener, removeListener, router, getAppSettings]);

	return undefined;
};

export const GlobalEventHandler = React.memo(GlobalEventHandlerCore);
