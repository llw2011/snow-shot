import { getCurrentWindow } from "@tauri-apps/api/window";
import React, { useContext, useEffect } from "react";
import { EventListenerContext } from "@/components/eventListener";
import {
	FIXED_CONTENT_FOCUS_MODE_CLOSE_ALL_WINDOW,
	FIXED_CONTENT_FOCUS_MODE_CLOSE_OTHER_WINDOW,
	FIXED_CONTENT_FOCUS_MODE_HIDE_OTHER_WINDOW,
	FIXED_CONTENT_FOCUS_MODE_SHOW_ALL_WINDOW,
} from "@/functions/fixedContent";

const HandleFocusModeCore: React.FC<{ disabled?: boolean }> = ({
	disabled,
}) => {
	const { addListener, removeListener } = useContext(EventListenerContext);

	useEffect(() => {
		if (disabled) {
			return;
		}

		const currentWindow = getCurrentWindow();

		const showAllWindowListenerId = addListener(
			FIXED_CONTENT_FOCUS_MODE_SHOW_ALL_WINDOW,
			() => {
				currentWindow.show();
			},
		);
		const hideOtherWindowListenerId = addListener(
			FIXED_CONTENT_FOCUS_MODE_HIDE_OTHER_WINDOW,
			(args) => {
				const payload = (args as { payload: { windowLabel: string } }).payload;

				if (payload.windowLabel === currentWindow.label) {
					return;
				}
				currentWindow.hide();
			},
		);
		const closeOtherWindowListenerId = addListener(
			FIXED_CONTENT_FOCUS_MODE_CLOSE_OTHER_WINDOW,
			(args) => {
				const payload = (args as { payload: { windowLabel: string } }).payload;

				if (payload.windowLabel === currentWindow.label) {
					return;
				}
				currentWindow.close();
			},
		);
		const closeAllWindowListenerId = addListener(
			FIXED_CONTENT_FOCUS_MODE_CLOSE_ALL_WINDOW,
			() => {
				currentWindow.close();
			},
		);

		return () => {
			removeListener(showAllWindowListenerId);
			removeListener(hideOtherWindowListenerId);
			removeListener(closeOtherWindowListenerId);
			removeListener(closeAllWindowListenerId);
		};
	}, [addListener, removeListener, disabled]);

	return undefined;
};

export const HandleFocusMode = React.memo(HandleFocusModeCore);
