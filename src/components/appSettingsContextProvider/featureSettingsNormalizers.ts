import { defaultAppSettingsData } from "@/constants/appSettings";
import {
	type AppSettingsData,
	type AppSettingsFixedContentInitialPosition,
	AppSettingsGroup,
	type DoubleClickAction,
	type HdrColorAlgorithm,
	type HistoryValidDuration,
	OcrDetectAfterAction,
	type TrayIconClickAction,
	type TrayIconDefaultIcon,
	type VideoMaxSize,
} from "@/types/appSettings";
import { DrawState } from "@/types/draw";
import { ImageFormat } from "@/types/utils/file";

export const normalizeFeatureSettingsGroup = (
	group: AppSettingsGroup,
	inputSettings: Partial<AppSettingsData[typeof group]>,
	currentSettings: AppSettingsData,
): AppSettingsData[typeof group] | undefined => {
	let newSettings = inputSettings;
	let settings: AppSettingsData[typeof group];

	if (group === AppSettingsGroup.FunctionScreenshot) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		const findChildrenElements =
			typeof newSettings?.findChildrenElements === "boolean"
				? newSettings.findChildrenElements
				: (prevSettings?.findChildrenElements ??
					defaultAppSettingsData[group].findChildrenElements);

		settings = {
			findChildrenElements,
			shortcutCanleTip:
				typeof newSettings?.shortcutCanleTip === "boolean"
					? newSettings.shortcutCanleTip
					: (prevSettings?.shortcutCanleTip ??
						defaultAppSettingsData[group].shortcutCanleTip),
			autoSaveOnCopy:
				typeof newSettings?.autoSaveOnCopy === "boolean"
					? newSettings.autoSaveOnCopy
					: (prevSettings?.autoSaveOnCopy ?? false),
			fastSave:
				typeof newSettings?.fastSave === "boolean"
					? newSettings.fastSave
					: (prevSettings?.fastSave ?? false),
			doubleClickAction:
				typeof newSettings?.doubleClickAction === "string"
					? (newSettings.doubleClickAction as DoubleClickAction)
					: (prevSettings?.doubleClickAction ??
						defaultAppSettingsData[group].doubleClickAction),
			copyImageFileToClipboard:
				typeof newSettings?.copyImageFileToClipboard === "boolean"
					? newSettings.copyImageFileToClipboard
					: (prevSettings?.copyImageFileToClipboard ??
						defaultAppSettingsData[group].copyImageFileToClipboard),
			saveFileDirectory:
				typeof newSettings?.saveFileDirectory === "string"
					? newSettings.saveFileDirectory
					: (prevSettings?.saveFileDirectory ??
						defaultAppSettingsData[group].saveFileDirectory),
			saveFileFormat:
				typeof newSettings?.saveFileFormat === "string"
					? newSettings.saveFileFormat
					: (prevSettings?.saveFileFormat ?? ImageFormat.PNG),
			ocrAfterAction:
				typeof newSettings?.ocrAfterAction === "string"
					? (newSettings.ocrAfterAction as OcrDetectAfterAction)
					: (prevSettings?.ocrAfterAction ?? OcrDetectAfterAction.None),
			ocrCopyText:
				typeof newSettings?.ocrCopyText === "boolean"
					? newSettings.ocrCopyText
					: (prevSettings?.ocrCopyText ?? false),
			focusedWindowCopyToClipboard:
				typeof newSettings?.focusedWindowCopyToClipboard === "boolean"
					? newSettings.focusedWindowCopyToClipboard
					: (prevSettings?.focusedWindowCopyToClipboard ?? true),
			fullScreenCopyToClipboard:
				typeof newSettings?.fullScreenCopyToClipboard === "boolean"
					? newSettings.fullScreenCopyToClipboard
					: (prevSettings?.fullScreenCopyToClipboard ?? true),
			selectRectPresetList:
				typeof newSettings?.selectRectPresetList === "object"
					? newSettings.selectRectPresetList
					: (prevSettings?.selectRectPresetList ?? []),
		};
	} else if (group === AppSettingsGroup.FunctionOutput) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		settings = {
			manualSaveFileNameFormat:
				typeof newSettings?.manualSaveFileNameFormat === "string"
					? newSettings.manualSaveFileNameFormat
					: (prevSettings?.manualSaveFileNameFormat ??
						defaultAppSettingsData[group].manualSaveFileNameFormat),
			autoSaveFileNameFormat:
				typeof newSettings?.autoSaveFileNameFormat === "string"
					? newSettings.autoSaveFileNameFormat
					: (prevSettings?.autoSaveFileNameFormat ??
						defaultAppSettingsData[group].autoSaveFileNameFormat),
			fastSaveFileNameFormat:
				typeof newSettings?.fastSaveFileNameFormat === "string"
					? newSettings.fastSaveFileNameFormat
					: (prevSettings?.fastSaveFileNameFormat ??
						defaultAppSettingsData[group].fastSaveFileNameFormat),
			focusedWindowFileNameFormat:
				typeof newSettings?.focusedWindowFileNameFormat === "string"
					? newSettings.focusedWindowFileNameFormat
					: (prevSettings?.focusedWindowFileNameFormat ??
						defaultAppSettingsData[group].focusedWindowFileNameFormat),
			fullScreenFileNameFormat:
				typeof newSettings?.fullScreenFileNameFormat === "string"
					? newSettings.fullScreenFileNameFormat
					: (prevSettings?.fullScreenFileNameFormat ??
						defaultAppSettingsData[group].fullScreenFileNameFormat),
			videoRecordFileNameFormat:
				typeof newSettings?.videoRecordFileNameFormat === "string"
					? newSettings.videoRecordFileNameFormat
					: (prevSettings?.videoRecordFileNameFormat ??
						defaultAppSettingsData[group].videoRecordFileNameFormat),
		};
	} else if (group === AppSettingsGroup.FunctionFullScreenDraw) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		settings = {
			defaultTool:
				typeof newSettings?.defaultTool === "number"
					? newSettings.defaultTool
					: (prevSettings?.defaultTool ?? DrawState.Select),
		};
	} else if (group === AppSettingsGroup.SystemScrollScreenshot) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		settings = {
			imageFeatureThreshold:
				typeof newSettings?.imageFeatureThreshold === "number"
					? Math.min(Math.max(newSettings.imageFeatureThreshold, 0), 255)
					: (prevSettings?.imageFeatureThreshold ??
						defaultAppSettingsData[group].imageFeatureThreshold),
			minSide:
				typeof newSettings?.minSide === "number"
					? Math.min(Math.max(newSettings.minSide, 0), 1024)
					: (prevSettings?.minSide ?? defaultAppSettingsData[group].minSide),
			maxSide:
				typeof newSettings?.maxSide === "number"
					? Math.min(Math.max(newSettings.maxSide, 64), 1024)
					: (prevSettings?.maxSide ?? defaultAppSettingsData[group].maxSide),
			sampleRate:
				typeof newSettings?.sampleRate === "number"
					? Math.min(Math.max(newSettings.sampleRate, 0.1), 1)
					: (prevSettings?.sampleRate ??
						defaultAppSettingsData[group].sampleRate),
			imageFeatureDescriptionLength:
				typeof newSettings?.imageFeatureDescriptionLength === "number"
					? Math.min(
							Math.max(newSettings.imageFeatureDescriptionLength, 8),
							128,
						)
					: (prevSettings?.imageFeatureDescriptionLength ??
						defaultAppSettingsData[group].imageFeatureDescriptionLength),
			tryRollback:
				typeof newSettings?.tryRollback === "boolean"
					? newSettings.tryRollback
					: (prevSettings?.tryRollback ??
						defaultAppSettingsData[group].tryRollback),
		};
	} else if (group === AppSettingsGroup.FunctionTrayIcon) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		settings = {
			iconClickAction:
				typeof newSettings?.iconClickAction === "string"
					? (newSettings.iconClickAction as TrayIconClickAction)
					: (prevSettings?.iconClickAction ??
						defaultAppSettingsData[group].iconClickAction),
		};
	} else if (group === AppSettingsGroup.CommonTrayIcon) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		settings = {
			iconPath:
				typeof newSettings?.iconPath === "string"
					? newSettings.iconPath
					: (prevSettings?.iconPath ?? ""),
			defaultIcons:
				typeof newSettings?.defaultIcons === "string"
					? (newSettings.defaultIcons as TrayIconDefaultIcon)
					: (prevSettings?.defaultIcons ??
						defaultAppSettingsData[group].defaultIcons),
			enableTrayIcon:
				typeof newSettings?.enableTrayIcon === "boolean"
					? newSettings.enableTrayIcon
					: (prevSettings?.enableTrayIcon ??
						defaultAppSettingsData[group].enableTrayIcon),
			iconPathDark:
				typeof newSettings?.iconPathDark === "string"
					? newSettings.iconPathDark
					: (prevSettings?.iconPathDark ?? ""),
			defaultIconsDark:
				typeof newSettings?.defaultIconsDark === "string"
					? (newSettings.defaultIconsDark as TrayIconDefaultIcon)
					: (prevSettings?.defaultIconsDark ??
						defaultAppSettingsData[group].defaultIcons),
		};
	} else if (group === AppSettingsGroup.FunctionVideoRecord) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		settings = {
			enableExcludeFromCapture:
				typeof newSettings?.enableExcludeFromCapture === "boolean"
					? newSettings.enableExcludeFromCapture
					: (prevSettings?.enableExcludeFromCapture ??
						defaultAppSettingsData[group].enableExcludeFromCapture),
			saveDirectory:
				typeof newSettings?.saveDirectory === "string"
					? newSettings.saveDirectory
					: (prevSettings?.saveDirectory ?? ""),
			frameRate:
				typeof newSettings?.frameRate === "number"
					? Math.min(Math.max(newSettings.frameRate, 1), 120)
					: (prevSettings?.frameRate ??
						defaultAppSettingsData[group].frameRate),
			microphoneDeviceName:
				typeof newSettings?.microphoneDeviceName === "string"
					? newSettings.microphoneDeviceName
					: (prevSettings?.microphoneDeviceName ?? ""),
			hwaccel:
				typeof newSettings?.hwaccel === "boolean"
					? newSettings.hwaccel
					: (prevSettings?.hwaccel ?? defaultAppSettingsData[group].hwaccel),
			encoder:
				typeof newSettings?.encoder === "string"
					? newSettings.encoder
					: (prevSettings?.encoder ?? defaultAppSettingsData[group].encoder),
			encoderPreset:
				typeof newSettings?.encoderPreset === "string"
					? newSettings.encoderPreset
					: (prevSettings?.encoderPreset ??
						defaultAppSettingsData[group].encoderPreset),
			videoMaxSize:
				typeof newSettings?.videoMaxSize === "string"
					? (newSettings.videoMaxSize as VideoMaxSize)
					: (prevSettings?.videoMaxSize ??
						defaultAppSettingsData[group].videoMaxSize),
			gifFrameRate:
				typeof newSettings?.gifFrameRate === "number"
					? Math.min(Math.max(newSettings.gifFrameRate, 1), 24)
					: (prevSettings?.gifFrameRate ??
						defaultAppSettingsData[group].gifFrameRate),
			gifMaxSize:
				typeof newSettings?.gifMaxSize === "string"
					? (newSettings.gifMaxSize as VideoMaxSize)
					: (prevSettings?.gifMaxSize ??
						defaultAppSettingsData[group].gifMaxSize),
			gifFormat:
				typeof newSettings?.gifFormat === "string"
					? newSettings.gifFormat
					: (prevSettings?.gifFormat ??
						defaultAppSettingsData[group].gifFormat),
			keyDisplayFontSize:
				typeof newSettings?.keyDisplayFontSize === "number"
					? Math.min(Math.max(newSettings.keyDisplayFontSize, 8), 64)
					: (prevSettings?.keyDisplayFontSize ??
						defaultAppSettingsData[group].keyDisplayFontSize),
			keyDisplayBackgroundColor:
				typeof newSettings?.keyDisplayBackgroundColor === "string"
					? newSettings.keyDisplayBackgroundColor.trim()
					: (prevSettings?.keyDisplayBackgroundColor ??
						defaultAppSettingsData[group].keyDisplayBackgroundColor),
			keyDisplayTextColor:
				typeof newSettings?.keyDisplayTextColor === "string"
					? newSettings.keyDisplayTextColor.trim()
					: (prevSettings?.keyDisplayTextColor ??
						defaultAppSettingsData[group].keyDisplayTextColor),
			keyDisplayDuration:
				typeof newSettings?.keyDisplayDuration === "number"
					? Math.min(Math.max(newSettings.keyDisplayDuration, 100), 10000)
					: (prevSettings?.keyDisplayDuration ??
						defaultAppSettingsData[group].keyDisplayDuration),
			keyDisplayMergeDuration:
				typeof newSettings?.keyDisplayMergeDuration === "number"
					? Math.min(Math.max(newSettings.keyDisplayMergeDuration, 0), 2000)
					: (prevSettings?.keyDisplayMergeDuration ??
						defaultAppSettingsData[group].keyDisplayMergeDuration),
			keyDisplayDirection:
				typeof newSettings?.keyDisplayDirection === "string"
					? newSettings.keyDisplayDirection
					: (prevSettings?.keyDisplayDirection ??
						defaultAppSettingsData[group].keyDisplayDirection),
		};
	} else if (group === AppSettingsGroup.FunctionFixedContent) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		settings = {
			zoomWithMouse:
				typeof newSettings?.zoomWithMouse === "boolean"
					? newSettings.zoomWithMouse
					: (prevSettings?.zoomWithMouse ?? false),
			autoResizeWindow:
				typeof newSettings?.autoResizeWindow === "boolean"
					? newSettings.autoResizeWindow
					: (prevSettings?.autoResizeWindow ??
						defaultAppSettingsData[group].autoResizeWindow),
			autoOcr:
				typeof newSettings?.autoOcr === "boolean"
					? newSettings.autoOcr
					: (prevSettings?.autoOcr ?? defaultAppSettingsData[group].autoOcr),
			autoCopyToClipboard:
				typeof newSettings?.autoCopyToClipboard === "boolean"
					? newSettings.autoCopyToClipboard
					: (prevSettings?.autoCopyToClipboard ??
						defaultAppSettingsData[group].autoCopyToClipboard),
			initialPosition:
				typeof newSettings?.initialPosition === "string"
					? (newSettings.initialPosition as AppSettingsFixedContentInitialPosition)
					: (prevSettings?.initialPosition ??
						defaultAppSettingsData[group].initialPosition),
		};
	} else if (group === AppSettingsGroup.SystemScreenshot) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		settings = {
			ocrHotStart:
				typeof newSettings?.ocrHotStart === "boolean"
					? newSettings.ocrHotStart
					: (prevSettings?.ocrHotStart ??
						defaultAppSettingsData[group].ocrHotStart),
			ocrModelWriteToMemory:
				typeof newSettings?.ocrModelWriteToMemory === "boolean"
					? newSettings.ocrModelWriteToMemory
					: (prevSettings?.ocrModelWriteToMemory ??
						defaultAppSettingsData[group].ocrModelWriteToMemory),
			ocrDetectAngle:
				typeof newSettings?.ocrDetectAngle === "boolean"
					? newSettings.ocrDetectAngle
					: (prevSettings?.ocrDetectAngle ??
						defaultAppSettingsData[group].ocrDetectAngle),
			recordCaptureHistory:
				typeof newSettings?.recordCaptureHistory === "boolean"
					? newSettings.recordCaptureHistory
					: (prevSettings?.recordCaptureHistory ??
						defaultAppSettingsData[group].recordCaptureHistory),
			historyValidDuration:
				typeof newSettings?.historyValidDuration === "number"
					? (newSettings.historyValidDuration as HistoryValidDuration)
					: (prevSettings?.historyValidDuration ??
						defaultAppSettingsData[group].historyValidDuration),
			historySaveEditResult:
				typeof newSettings?.historySaveEditResult === "boolean"
					? newSettings.historySaveEditResult
					: (prevSettings?.historySaveEditResult ??
						defaultAppSettingsData[group].historySaveEditResult),
			correctColorFilter:
				typeof newSettings?.correctColorFilter === "boolean"
					? newSettings.correctColorFilter
					: (prevSettings?.correctColorFilter ??
						defaultAppSettingsData[group].correctColorFilter),
			tryWriteBitmapImageToClipboard:
				typeof newSettings?.tryWriteBitmapImageToClipboard === "boolean"
					? newSettings.tryWriteBitmapImageToClipboard
					: (prevSettings?.tryWriteBitmapImageToClipboard ??
						defaultAppSettingsData[group].tryWriteBitmapImageToClipboard),
			enableMultipleMonitor:
				typeof newSettings?.enableMultipleMonitor === "boolean"
					? newSettings.enableMultipleMonitor
					: (prevSettings?.enableMultipleMonitor ??
						defaultAppSettingsData[group].enableMultipleMonitor),
			correctHdrColor:
				typeof newSettings?.correctHdrColor === "boolean"
					? newSettings.correctHdrColor
					: (prevSettings?.correctHdrColor ??
						defaultAppSettingsData[group].correctHdrColor),
			correctHdrColorAlgorithm:
				typeof newSettings?.correctHdrColorAlgorithm === "string"
					? (newSettings.correctHdrColorAlgorithm as HdrColorAlgorithm)
					: (prevSettings?.correctHdrColorAlgorithm ??
						defaultAppSettingsData[group].correctHdrColorAlgorithm),
		};
	} else if (group === AppSettingsGroup.SystemCore) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		settings = {
			hotLoadPageCount:
				typeof newSettings?.hotLoadPageCount === "number"
					? Math.max(Math.min(3, newSettings.hotLoadPageCount), 0)
					: (prevSettings?.hotLoadPageCount ??
						defaultAppSettingsData[group].hotLoadPageCount),
		};
	} else if (group === AppSettingsGroup.FunctionGlobalShortcut) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		settings = {
			disableOnFocusedFullScreenWindow:
				typeof newSettings?.disableOnFocusedFullScreenWindow === "boolean"
					? newSettings.disableOnFocusedFullScreenWindow
					: (prevSettings?.disableOnFocusedFullScreenWindow ??
						defaultAppSettingsData[group].disableOnFocusedFullScreenWindow),
		};
	} else {
		return undefined;
	}

	return settings;
};
