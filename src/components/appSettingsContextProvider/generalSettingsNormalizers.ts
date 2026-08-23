import { defaultAppFunctionConfigs } from "@/constants/appFunction";
import { defaultAppSettingsData } from "@/constants/appSettings";
import { defaultCommonKeyEventSettings } from "@/constants/commonKeyEvent";
import { defaultDrawToolbarKeyEventSettings } from "@/constants/drawToolbarKeyEvent";
import {
	PLUGIN_ID_GLM_OCR,
	PLUGIN_ID_RAPID_OCR,
} from "@/constants/pluginService";
import { isAppThemePreset } from "@/constants/themePresets";
import {
	AppSettingsControlNode,
	type AppSettingsData,
	AppSettingsGroup,
	AppSettingsLanguage,
	AppSettingsTheme,
	ExtraToolList,
	MainWindowSizeTier,
} from "@/types/appSettings";
import type {
	AppFunction,
	AppFunctionConfig,
} from "@/types/components/appFunction";
import {
	DrawToolbarKeyEventKey,
	type DrawToolbarKeyEventValue,
} from "@/types/components/drawToolbar";
import type {
	CommonKeyEventKey,
	CommonKeyEventValue,
} from "@/types/core/commonKeyEvent";
import { DrawState } from "@/types/draw";
import { ImageFormat } from "@/types/utils/file";
import { canUseOcr } from "@/utils/ocr";
import { normalizeChatModel } from "./apiConfigNormalizers";

const isAppSettingsTheme = (value: unknown): value is AppSettingsTheme =>
	value === AppSettingsTheme.Light ||
	value === AppSettingsTheme.Dark ||
	value === AppSettingsTheme.System;

type IsPluginReady = ((pluginId: string) => boolean) | undefined;

export const normalizeGeneralSettingsGroup = (
	group: AppSettingsGroup,
	inputSettings: Partial<AppSettingsData[typeof group]>,
	currentSettings: AppSettingsData,
	isReady: IsPluginReady,
): AppSettingsData[typeof group] | undefined => {
	let newSettings = inputSettings;
	let settings: AppSettingsData[typeof group];

	if (group === AppSettingsGroup.Common) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;
		settings = {
			theme: isAppSettingsTheme(newSettings?.theme)
				? newSettings.theme
				: (prevSettings?.theme ?? defaultAppSettingsData[group].theme),
			themePreset: isAppThemePreset(newSettings?.themePreset)
				? newSettings.themePreset
				: (prevSettings?.themePreset ??
					defaultAppSettingsData[group].themePreset),
			mainWindowSizeTier: (() => {
				switch (newSettings?.mainWindowSizeTier) {
					case MainWindowSizeTier.Compact:
					case MainWindowSizeTier.Standard:
					case MainWindowSizeTier.Large:
						return newSettings.mainWindowSizeTier;
					default:
						return (
							prevSettings?.mainWindowSizeTier ??
							defaultAppSettingsData[group].mainWindowSizeTier
						);
				}
			})(),
			language: (() => {
				switch (newSettings?.language) {
					case "zh-Hans":
						return AppSettingsLanguage.ZHHans;
					case "zh-Hant":
						return AppSettingsLanguage.ZHHant;
					case "en":
						return AppSettingsLanguage.EN;
					default:
						return prevSettings?.language ?? AppSettingsLanguage.EN;
				}
			})(),
			browserLanguage:
				typeof newSettings?.browserLanguage === "string"
					? newSettings.browserLanguage
					: (prevSettings?.browserLanguage ?? ""),
		};

		window.__APP_ACCEPT_LANGUAGE__ = settings.language.startsWith("en")
			? "en-US"
			: "zh-CN";
	} else if (group === AppSettingsGroup.ThemeSkin) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;
		settings = {
			skinPath:
				typeof newSettings?.skinPath === "string"
					? newSettings.skinPath
					: (prevSettings?.skinPath ?? defaultAppSettingsData[group].skinPath),
			skinOpacity:
				typeof newSettings?.skinOpacity === "number"
					? Math.min(Math.max(newSettings.skinOpacity, 0), 100)
					: (prevSettings?.skinOpacity ??
						defaultAppSettingsData[group].skinOpacity),
			skinPosition:
				typeof newSettings?.skinPosition === "string"
					? newSettings.skinPosition
					: (prevSettings?.skinPosition ??
						defaultAppSettingsData[group].skinPosition),
			skinBlur:
				typeof newSettings?.skinBlur === "number"
					? Math.min(Math.max(newSettings.skinBlur, 0), 32)
					: (prevSettings?.skinBlur ?? defaultAppSettingsData[group].skinBlur),
			skinImageSize:
				typeof newSettings?.skinImageSize === "string"
					? newSettings.skinImageSize
					: (prevSettings?.skinImageSize ??
						defaultAppSettingsData[group].skinImageSize),
			skinMixBlendMode:
				typeof newSettings?.skinMixBlendMode === "string"
					? newSettings.skinMixBlendMode
					: (prevSettings?.skinMixBlendMode ??
						defaultAppSettingsData[group].skinMixBlendMode),
			customCss:
				typeof newSettings?.customCss === "string"
					? newSettings.customCss
					: (prevSettings?.customCss ?? ""),
			skinMaskBlur:
				typeof newSettings?.skinMaskBlur === "number"
					? Math.min(Math.max(newSettings.skinMaskBlur, 0), 32)
					: (prevSettings?.skinMaskBlur ??
						defaultAppSettingsData[group].skinMaskBlur),
			skinMaskOpacity:
				typeof newSettings?.skinMaskOpacity === "number"
					? Math.min(Math.max(newSettings.skinMaskOpacity, 0), 100)
					: (prevSettings?.skinMaskOpacity ??
						defaultAppSettingsData[group].skinMaskOpacity),
		};
	} else if (group === AppSettingsGroup.Cache) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		let prevSelectRect = newSettings?.prevSelectRect ??
			prevSettings?.prevSelectRect ?? {
				min_x: 0,
				min_y: 0,
				max_x: 0,
				max_y: 0,
			};
		prevSelectRect = {
			min_x:
				typeof prevSelectRect.min_x === "number" ? prevSelectRect.min_x : 0,
			min_y:
				typeof prevSelectRect.min_y === "number" ? prevSelectRect.min_y : 0,
			max_x:
				typeof prevSelectRect.max_x === "number" ? prevSelectRect.max_x : 0,
			max_y:
				typeof prevSelectRect.max_y === "number" ? prevSelectRect.max_y : 0,
		};

		settings = {
			menuCollapsed:
				typeof newSettings?.menuCollapsed === "boolean"
					? newSettings.menuCollapsed
					: (prevSettings?.menuCollapsed ?? false),
			chatModel: normalizeChatModel(
				(() => {
					const chatModel =
						typeof newSettings?.chatModel === "string"
							? newSettings.chatModel
							: (prevSettings?.chatModel ??
								defaultAppSettingsData[group].chatModel);

					return chatModel;
				})(),
				currentSettings[AppSettingsGroup.FunctionChat].chatApiConfigList,
			),
			chatModelEnableThinking:
				typeof newSettings?.chatModelEnableThinking === "boolean"
					? newSettings.chatModelEnableThinking
					: (prevSettings?.chatModelEnableThinking ??
						defaultAppSettingsData[group].chatModelEnableThinking),
			colorPickerColorFormatIndex:
				typeof newSettings?.colorPickerColorFormatIndex === "number"
					? newSettings.colorPickerColorFormatIndex
					: (prevSettings?.colorPickerColorFormatIndex ?? 0),
			prevImageFormat:
				typeof newSettings?.prevImageFormat === "string"
					? newSettings.prevImageFormat
					: (prevSettings?.prevImageFormat ?? ImageFormat.PNG),
			prevSelectRect,
			enableMicrophone:
				typeof newSettings?.enableMicrophone === "boolean"
					? newSettings.enableMicrophone
					: (prevSettings?.enableMicrophone ?? false),
			enableLockDrawTool:
				typeof newSettings?.enableLockDrawTool === "boolean"
					? newSettings.enableLockDrawTool
					: (prevSettings?.enableLockDrawTool ?? false),
			disableArrowPicker:
				typeof newSettings?.disableArrowPicker === "boolean"
					? newSettings.disableArrowPicker
					: (prevSettings?.disableArrowPicker ?? true),
			selectRectRadius:
				typeof newSettings?.selectRectRadius === "number"
					? Math.min(Math.max(newSettings.selectRectRadius, 0), 256)
					: (prevSettings?.selectRectRadius ??
						defaultAppSettingsData[group].selectRectRadius),
			selectRectShadowWidth:
				typeof newSettings?.selectRectShadowWidth === "number"
					? Math.min(Math.max(newSettings.selectRectShadowWidth, 0), 32)
					: (prevSettings?.selectRectShadowWidth ??
						defaultAppSettingsData[group].selectRectShadowWidth),
			selectRectShadowColor:
				typeof newSettings?.selectRectShadowColor === "string"
					? newSettings.selectRectShadowColor
					: (prevSettings?.selectRectShadowColor ??
						defaultAppSettingsData[group].selectRectShadowColor),
			lastRectTool:
				typeof newSettings?.lastRectTool === "number"
					? newSettings.lastRectTool
					: (prevSettings?.lastRectTool ?? DrawState.Rect),
			lastArrowTool:
				typeof newSettings?.lastArrowTool === "number"
					? newSettings.lastArrowTool
					: (prevSettings?.lastArrowTool ?? DrawState.Arrow),
			lastFilterTool:
				typeof newSettings?.lastFilterTool === "number"
					? newSettings.lastFilterTool
					: (prevSettings?.lastFilterTool ?? DrawState.Blur),
			lastWatermarkText:
				typeof newSettings?.lastWatermarkText === "string"
					? newSettings.lastWatermarkText
					: (prevSettings?.lastWatermarkText ?? ""),
			lastExtraTool:
				typeof newSettings?.lastExtraTool === "number"
					? newSettings.lastExtraTool
					: (prevSettings?.lastExtraTool ?? ExtraToolList.None),
			lastDrawExtraTool:
				typeof newSettings?.lastDrawExtraTool === "number"
					? newSettings.lastDrawExtraTool
					: (prevSettings?.lastDrawExtraTool ?? DrawState.Idle),
			delayScreenshotSeconds:
				typeof newSettings?.delayScreenshotSeconds === "number"
					? newSettings.delayScreenshotSeconds
					: (prevSettings?.delayScreenshotSeconds ??
						defaultAppSettingsData[group].delayScreenshotSeconds),
			lockDragAspectRatio:
				typeof newSettings?.lockDragAspectRatio === "number"
					? Math.min(Math.max(newSettings.lockDragAspectRatio, 0), 100)
					: (prevSettings?.lockDragAspectRatio ??
						defaultAppSettingsData[group].lockDragAspectRatio),
			enableTabFindChildrenElements:
				typeof newSettings?.enableTabFindChildrenElements === "boolean"
					? newSettings.enableTabFindChildrenElements
					: (prevSettings?.enableTabFindChildrenElements ??
						defaultAppSettingsData[group].enableTabFindChildrenElements),
		};
	} else if (group === AppSettingsGroup.Screenshot) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		let controlNode =
			prevSettings?.controlNode ?? AppSettingsControlNode.Polyline;
		if (newSettings?.controlNode) {
			if (newSettings.controlNode === AppSettingsControlNode.Circle) {
				controlNode = AppSettingsControlNode.Circle;
			} else if (newSettings.controlNode === AppSettingsControlNode.Polyline) {
				controlNode = AppSettingsControlNode.Polyline;
			}
		}

		settings = {
			uiScale:
				typeof newSettings?.uiScale === "number"
					? Math.min(Math.max(newSettings.uiScale, 25), 100)
					: (prevSettings?.uiScale ?? defaultAppSettingsData[group].uiScale),
			toolbarUiScale:
				typeof newSettings?.toolbarUiScale === "number"
					? Math.min(Math.max(newSettings.toolbarUiScale, 25), 100)
					: (prevSettings?.toolbarUiScale ??
						defaultAppSettingsData[group].toolbarUiScale),
			controlNode,
			disableAnimation:
				typeof newSettings?.disableAnimation === "boolean"
					? newSettings.disableAnimation
					: (prevSettings?.disableAnimation ?? false),
			colorPickerShowMode:
				typeof newSettings?.colorPickerShowMode === "number"
					? newSettings.colorPickerShowMode
					: (prevSettings?.colorPickerShowMode ??
						defaultAppSettingsData[group].colorPickerShowMode),
			beyondSelectRectElementOpacity:
				typeof newSettings?.beyondSelectRectElementOpacity === "number"
					? Math.min(
							Math.max(newSettings.beyondSelectRectElementOpacity, 0),
							100,
						)
					: (prevSettings?.beyondSelectRectElementOpacity ??
						defaultAppSettingsData[group].beyondSelectRectElementOpacity),
			selectRectMaskColor:
				typeof newSettings?.selectRectMaskColor === "string"
					? newSettings.selectRectMaskColor
					: (prevSettings?.selectRectMaskColor ??
						defaultAppSettingsData[group].selectRectMaskColor),
			hotKeyTipOpacity:
				typeof newSettings?.hotKeyTipOpacity === "number"
					? Math.min(Math.max(newSettings.hotKeyTipOpacity, 0), 100)
					: (prevSettings?.hotKeyTipOpacity ??
						defaultAppSettingsData[group].hotKeyTipOpacity),
			fullScreenAuxiliaryLineColor:
				typeof newSettings?.fullScreenAuxiliaryLineColor === "string"
					? newSettings.fullScreenAuxiliaryLineColor
					: (prevSettings?.fullScreenAuxiliaryLineColor ?? "#00000000"),
			monitorCenterAuxiliaryLineColor:
				typeof newSettings?.monitorCenterAuxiliaryLineColor === "string"
					? newSettings.monitorCenterAuxiliaryLineColor
					: (prevSettings?.monitorCenterAuxiliaryLineColor ?? "#00000000"),
			colorPickerCenterAuxiliaryLineColor:
				typeof newSettings?.colorPickerCenterAuxiliaryLineColor === "string"
					? newSettings.colorPickerCenterAuxiliaryLineColor
					: (prevSettings?.colorPickerCenterAuxiliaryLineColor ?? "#00000000"),
			toolbarHiddenToolList:
				typeof newSettings?.toolbarHiddenToolList === "object"
					? newSettings.toolbarHiddenToolList
					: (prevSettings?.toolbarHiddenToolList ??
						defaultAppSettingsData[group].toolbarHiddenToolList),
		};
	} else if (group === AppSettingsGroup.FunctionDraw) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		settings = {
			lockDrawTool:
				typeof newSettings?.lockDrawTool === "boolean"
					? newSettings.lockDrawTool
					: (prevSettings?.lockDrawTool ??
						defaultAppSettingsData[group].lockDrawTool),
			disableQuickSelectElementToolList: Array.isArray(
				newSettings?.disableQuickSelectElementToolList,
			)
				? newSettings.disableQuickSelectElementToolList
				: (prevSettings?.disableQuickSelectElementToolList ??
					defaultAppSettingsData[group].disableQuickSelectElementToolList),
			enableSliderChangeWidth:
				typeof newSettings?.enableSliderChangeWidth === "boolean"
					? newSettings.enableSliderChangeWidth
					: (prevSettings?.enableSliderChangeWidth ??
						defaultAppSettingsData[group].enableSliderChangeWidth),
			toolIndependentStyle:
				typeof newSettings?.toolIndependentStyle === "boolean"
					? newSettings.toolIndependentStyle
					: (prevSettings?.toolIndependentStyle ??
						defaultAppSettingsData[group].toolIndependentStyle),
		};
	} else if (group === AppSettingsGroup.FixedContent) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		settings = {
			borderColor:
				typeof newSettings?.borderColor === "string"
					? newSettings.borderColor
					: (prevSettings?.borderColor ??
						defaultAppSettingsData[group].borderColor),
		};
	} else if (group === AppSettingsGroup.DrawToolbarKeyEvent) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		const settingsKeySet = new Set<string>();
		const settingKeys: DrawToolbarKeyEventKey[] = Object.keys(
			defaultDrawToolbarKeyEventSettings,
		).filter((key) => {
			if (
				key === DrawToolbarKeyEventKey.OcrDetectTool ||
				key === DrawToolbarKeyEventKey.OcrTranslateTool
			) {
				return canUseOcr(
					currentSettings,
					isReady?.(PLUGIN_ID_GLM_OCR),
					isReady?.(PLUGIN_ID_RAPID_OCR),
				);
			}

			return true;
		}) as DrawToolbarKeyEventKey[];
		settingKeys.forEach((key) => {
			const keyEventSettings = newSettings as Record<
				DrawToolbarKeyEventKey,
				DrawToolbarKeyEventValue
			>;

			let keyEventSettingsKey =
				typeof keyEventSettings[key]?.hotKey === "string"
					? keyEventSettings[key].hotKey
					: (prevSettings?.[key]?.hotKey ??
						defaultDrawToolbarKeyEventSettings[key].hotKey);

			// 格式化处理下
			keyEventSettingsKey = keyEventSettingsKey
				.split(",")
				.map((item) => item.trim())
				.filter((val) => {
					if (settingsKeySet.has(val)) {
						return false;
					}

					if (defaultDrawToolbarKeyEventSettings[key].unique) {
						settingsKeySet.add(val);
					}

					return true;
				})
				.join(", ");

			keyEventSettings[key] = {
				hotKey: keyEventSettingsKey,
			};
		});

		settings = {
			...defaultDrawToolbarKeyEventSettings,
			...newSettings,
		};
	} else if (group === AppSettingsGroup.CommonKeyEvent) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		const settingsKeySet = new Set<string>();
		const settingKeys: CommonKeyEventKey[] = Object.keys(
			defaultCommonKeyEventSettings,
		) as CommonKeyEventKey[];
		settingKeys.forEach((key) => {
			const keyEventSettings = newSettings as Record<
				CommonKeyEventKey,
				CommonKeyEventValue
			>;

			let keyEventSettingsKey =
				typeof keyEventSettings[key]?.hotKey === "string"
					? keyEventSettings[key].hotKey
					: (prevSettings?.[key]?.hotKey ??
						defaultCommonKeyEventSettings[key].hotKey);

			// 格式化处理下
			keyEventSettingsKey = keyEventSettingsKey
				.split(",")
				.map((item) => item.trim())
				.filter((val) => {
					if (settingsKeySet.has(val)) {
						return false;
					}

					if (defaultCommonKeyEventSettings[key].unique) {
						settingsKeySet.add(val);
					}

					return true;
				})
				.join(", ");

			keyEventSettings[key] = {
				hotKey: keyEventSettingsKey,
				group: defaultCommonKeyEventSettings[key].group,
			};
		});

		settings = {
			...defaultCommonKeyEventSettings,
			...newSettings,
		};
	} else if (group === AppSettingsGroup.AppFunction) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		const settingsKeySet = new Set<string>();
		const settingKeys: AppFunction[] = Object.keys(
			defaultAppFunctionConfigs,
		) as AppFunction[];
		settingKeys.forEach((key) => {
			const keyEventSettings = newSettings as Record<
				AppFunction,
				AppFunctionConfig
			>;

			let keyEventSettingsKey =
				typeof keyEventSettings[key]?.shortcutKey === "string"
					? keyEventSettings[key].shortcutKey
					: (prevSettings?.[key]?.shortcutKey ??
						defaultAppFunctionConfigs[key].shortcutKey);

			// 格式化处理下
			keyEventSettingsKey = keyEventSettingsKey
				.split(",", 1) // 快捷键不支持多个键，这里也限制下
				.map((item) => item.trim())
				.filter((val) => !settingsKeySet.has(val))
				.join(", ");

			settingsKeySet.add(keyEventSettingsKey);

			keyEventSettings[key] = {
				shortcutKey: keyEventSettingsKey,
				group: defaultAppFunctionConfigs[key].group,
			};
		});

		settings = {
			...defaultAppFunctionConfigs,
			...newSettings,
		};
	} else {
		return undefined;
	}

	return settings;
};
