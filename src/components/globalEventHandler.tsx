import { useRouter } from "@tanstack/react-router";
import { openPath } from "@tauri-apps/plugin-opener";
import React, { useContext, useEffect } from "react";
import { getSelectedText } from "@/commands/core";
import { showMainWindow } from "@/commands/videoRecord";
import { EventListenerContext } from "@/components/eventListener";
import { AppSettingsPublisher } from "@/contexts/appSettingsActionContext";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { encodeParamsValue } from "@/utils/base64";
import { getImageSaveDirectory } from "@/utils/file";
import { showWindow } from "@/utils/window";

const GlobalEventHandlerCore: React.FC = () => {
	const router = useRouter();

	const { addListener, removeListener } = useContext(EventListenerContext);
	const [getAppSettings] = useStateSubscriber(AppSettingsPublisher, undefined);

	useEffect(() => {
		const listenerIdList: number[] = [];
		listenerIdList.push(
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
