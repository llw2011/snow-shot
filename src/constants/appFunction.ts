import {
	AppFunction,
	type AppFunctionConfig,
	AppFunctionGroup,
} from "@/types/components/appFunction";

export const defaultAppFunctionConfigs: Record<AppFunction, AppFunctionConfig> =
	{
		[AppFunction.Screenshot]: {
			shortcutKey: "F1",
			group: AppFunctionGroup.Screenshot,
		},
		[AppFunction.ScreenshotDelay]: {
			shortcutKey: "",
			group: AppFunctionGroup.Screenshot,
		},
		[AppFunction.ScreenshotFixed]: {
			shortcutKey: "",
			group: AppFunctionGroup.Screenshot,
		},
		[AppFunction.ScreenshotOcr]: {
			shortcutKey: "",
			group: AppFunctionGroup.Screenshot,
		},
		[AppFunction.ScreenshotOcrTranslate]: {
			shortcutKey: "",
			group: AppFunctionGroup.Screenshot,
		},
		[AppFunction.ScreenshotCopy]: {
			shortcutKey: "",
			group: AppFunctionGroup.Screenshot,
		},
		[AppFunction.ScreenshotFullScreen]: {
			shortcutKey: "",
			group: AppFunctionGroup.Screenshot,
		},
		[AppFunction.ScreenshotFocusedWindow]: {
			shortcutKey: "",
			group: AppFunctionGroup.Screenshot,
		},
		[AppFunction.ChatSelectText]: {
			shortcutKey: "",
			group: AppFunctionGroup.Chat,
		},
		[AppFunction.Chat]: {
			shortcutKey: "",
			group: AppFunctionGroup.Chat,
		},
		[AppFunction.TranslationSelectText]: {
			shortcutKey: "",
			group: AppFunctionGroup.Translation,
		},
		[AppFunction.Translation]: {
			shortcutKey: "",
			group: AppFunctionGroup.Translation,
		},
		[AppFunction.VideoRecord]: {
			shortcutKey: "",
			group: AppFunctionGroup.VideoRecord,
		},
		[AppFunction.VideoRecordCopy]: {
			shortcutKey: "",
			group: AppFunctionGroup.VideoRecord,
		},
		[AppFunction.FixedContent]: {
			shortcutKey: "",
			group: AppFunctionGroup.Other,
		},
		[AppFunction.TopWindow]: {
			shortcutKey: "",
			group: AppFunctionGroup.Other,
		},
		[AppFunction.FullScreenDraw]: {
			shortcutKey: "",
			group: AppFunctionGroup.Other,
		},
		[AppFunction.ShowOrHideMainWindow]: {
			shortcutKey: "",
			group: AppFunctionGroup.Other,
		},
		[AppFunction.OpenImageSaveFolder]: {
			shortcutKey: "",
			group: AppFunctionGroup.Other,
		},
		[AppFunction.OpenCaptureHistory]: {
			shortcutKey: "",
			group: AppFunctionGroup.Other,
		},
	};
