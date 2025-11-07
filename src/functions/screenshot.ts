import { emit } from "@tauri-apps/api/event";
import * as tauriLog from "@tauri-apps/plugin-log";
import { captureFocusedWindow } from "@/commands/screenshot";
import { FOCUS_WINDOW_APP_NAME_ENV_VARIABLE } from "@/constants/components/chat";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";
import { getCorrectHdrColorAlgorithm } from "@/utils/appSettings";
import { playCameraShutterSound } from "@/utils/audio";
import { getImagePathFromSettings } from "@/utils/file";
import { appError } from "@/utils/log";
import { ScreenshotType } from "@/utils/types";

export const executeScreenshot = async (
	type: ScreenshotType = ScreenshotType.Default,
	windowLabel?: string,
	captureHistoryId?: string,
) => {
	await emit("execute-screenshot", {
		type,
		windowLabel,
		captureHistoryId,
	});
};

export const executeScreenshotFocusedWindow = async (
	appSettings: AppSettingsData,
) => {
	const imagePath = await getImagePathFromSettings(
		appSettings,
		"focused-window",
	);
	if (!imagePath) {
		tauriLog.error(
			"[executeScreenshotFocusedWindow] Failed to get image path from settings",
		);

		return;
	}

	try {
		const captureFocusedWindowPromise = captureFocusedWindow(
			imagePath.filePath,
			appSettings[AppSettingsGroup.FunctionScreenshot]
				.focusedWindowCopyToClipboard,
			FOCUS_WINDOW_APP_NAME_ENV_VARIABLE,
			getCorrectHdrColorAlgorithm(appSettings),
		);
		playCameraShutterSound();
		await captureFocusedWindowPromise;
	} catch (error) {
		appError(
			"[executeScreenshotFocusedWindow] Failed to capture focused window",
			error,
		);
	}
};

export const finishScreenshot = async () => {
	await emit("finish-screenshot");
};

export const releaseDrawPage = async (force: boolean = false) => {
	await emit("release-draw-page", {
		force,
	});
};

export const onCaptureHistoryChange = async () => {
	await emit("on-capture-history-change");
};
