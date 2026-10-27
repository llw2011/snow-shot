import { useContext, useMemo } from "react";
import { GlobalShortcutContext } from "@/components/globalShortcut";
import {
	PLUGIN_ID_AI_CHAT,
	PLUGIN_ID_GLM_OCR,
	PLUGIN_ID_RAPID_OCR,
	PLUGIN_ID_TRANSLATE,
} from "@/constants/pluginService";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { usePlatform } from "@/hooks/usePlatform";
import { AppFunction } from "@/types/components/appFunction";
import type { WorkbenchIconName } from "./icons";

/**
 * - action: runs a native capture/desktop function; detail = shortcut + its settings
 * - tool: a full working surface rendered in the detail pane
 * - settings: preferences that are not owned by a single action
 */
export type WorkbenchItemKind = "action" | "tool" | "settings";
export type WorkbenchSection = "capture" | "language" | "desktop" | "settings";

export type WorkbenchItem = {
	id: string;
	kind: WorkbenchItemKind;
	section: WorkbenchSection;
	icon: WorkbenchIconName;
	titleId: string;
	descriptionId: string;
	appFunction?: AppFunction;
	/** Route of a tool item; every other item lives at /w/$itemId. */
	to?: "/tools/translation" | "/tools/chat" | "/tools/captureHistory";
	/** Message id prefixes whose text makes this item searchable. */
	searchPrefixes?: string[];
};

export const WORKBENCH_SECTIONS: WorkbenchSection[] = [
	"capture",
	"language",
	"desktop",
	"settings",
];

export const DEFAULT_WORKBENCH_ITEM_ID = "screenshot";

const action = (
	id: string,
	section: WorkbenchSection,
	icon: WorkbenchIconName,
	appFunction: AppFunction,
	searchPrefixes?: string[],
): WorkbenchItem => ({
	id,
	kind: "action",
	section,
	icon,
	titleId: `workbench.item.${id}`,
	descriptionId: `workbench.item.${id}.desc`,
	appFunction,
	searchPrefixes,
});

const settings = (
	id: string,
	icon: WorkbenchIconName,
	searchPrefixes?: string[],
): WorkbenchItem => ({
	id,
	kind: "settings",
	section: "settings",
	icon,
	titleId: `workbench.item.${id}`,
	descriptionId: `workbench.item.${id}.desc`,
	searchPrefixes,
});

export const WORKBENCH_ITEMS: WorkbenchItem[] = [
	action("screenshot", "capture", "capture", AppFunction.Screenshot, [
		"settings.functionSettings.screenshotSettings",
		"draw.doubleClickAction",
		"draw.copyImageFileToClipboard",
	]),
	action(
		"screenshotFocusedWindow",
		"capture",
		"window",
		AppFunction.ScreenshotFocusedWindow,
	),
	action(
		"screenshotFullScreen",
		"capture",
		"monitor",
		AppFunction.ScreenshotFullScreen,
	),
	action("screenshotDelay", "capture", "timer", AppFunction.ScreenshotDelay),
	action("screenshotFixed", "capture", "pin", AppFunction.ScreenshotFixed, [
		"settings.functionSettings.fixedContentSettings",
		"settings.fixedContentSettings",
	]),
	action("screenshotOcr", "capture", "scanText", AppFunction.ScreenshotOcr, [
		"settings.functionSettings.ocrSettings",
		"settings.systemSettings.screenshotSettings.ocrModel",
	]),
	action(
		"screenshotOcrTranslate",
		"capture",
		"translate",
		AppFunction.ScreenshotOcrTranslate,
	),
	action("screenshotCopy", "capture", "copy", AppFunction.ScreenshotCopy),
	{
		id: "translation",
		kind: "tool",
		section: "language",
		icon: "translate",
		titleId: "workbench.item.translation",
		descriptionId: "workbench.item.translation.desc",
		appFunction: AppFunction.Translation,
		to: "/tools/translation",
	},
	action(
		"translationSelectText",
		"language",
		"textCursor",
		AppFunction.TranslationSelectText,
	),
	{
		id: "chat",
		kind: "tool",
		section: "language",
		icon: "chat",
		titleId: "workbench.item.chat",
		descriptionId: "workbench.item.chat.desc",
		appFunction: AppFunction.Chat,
		to: "/tools/chat",
	},
	action(
		"chatSelectText",
		"language",
		"textCursor",
		AppFunction.ChatSelectText,
	),
	action("videoRecord", "desktop", "record", AppFunction.VideoRecord, [
		"settings.functionSettings.videoRecordSettings",
	]),
	action(
		"videoRecordCopy",
		"desktop",
		"recordCopy",
		AppFunction.VideoRecordCopy,
	),
	action("fullScreenDraw", "desktop", "pen", AppFunction.FullScreenDraw, [
		"settings.functionSettings.fullScreenDrawSettings",
	]),
	action("fixedContent", "desktop", "clipboard", AppFunction.FixedContent),
	action("topWindow", "desktop", "layers", AppFunction.TopWindow),
	{
		id: "captureHistory",
		kind: "tool",
		section: "desktop",
		icon: "history",
		titleId: "workbench.item.captureHistory",
		descriptionId: "workbench.item.captureHistory.desc",
		appFunction: AppFunction.OpenCaptureHistory,
		to: "/tools/captureHistory",
	},
	action(
		"openImageSaveFolder",
		"desktop",
		"folder",
		AppFunction.OpenImageSaveFolder,
	),
	action(
		"showOrHideMainWindow",
		"desktop",
		"app",
		AppFunction.ShowOrHideMainWindow,
	),
	settings("modelServices", "spark", [
		"settings.functionSettings.chatSettings.apiConfig",
		"settings.functionSettings.translationSettings.apiConfig",
		"workbench.models",
	]),
	settings("translationPreferences", "translate", [
		"settings.functionSettings.translationSettings",
		"tools.translation.sourceLanguage",
		"tools.translation.targetLanguage",
		"tools.translation.domain",
	]),
	settings("chatPreferences", "chat", [
		"settings.functionSettings.chatSettings.autoCreateNewSession",
		"settings.chatSettings",
	]),
	settings("ocr", "scanText", [
		"settings.functionSettings.ocrSettings",
		"settings.systemSettings.screenshotSettings.ocrModel",
	]),
	settings("captureInterface", "palette", [
		"settings.commonSettings.screenshotSettings",
		"settings.controlNode",
		"settings.disableAnimation",
		"settings.selectRectMaskColor",
		"settings.fullScreenAuxiliaryLineColor",
		"settings.monitorCenterAuxiliaryLineColor",
		"settings.colorPickerCenterAuxiliaryLineColor",
		"settings.customToolbarToolList",
		"settings.commonSettings.draw",
		"settings.functionSettings.drawSettings",
		"settings.functionSettings.screenshotSettings.lockDrawTool",
		"settings.functionSettings.screenshotSettings.colorPickerShowMode",
		"settings.functionSettings.screenshotSettings.hotKeyTipOpacity",
		"settings.systemSettings.scrollScreenshotSettings",
	]),
	settings("output", "download", ["settings.functionSettings.outputSettings"]),
	settings("shortcuts", "keyboard", [
		"settings.hotKeySettings",
		"settings.drawingHotKey",
		"settings.functionSettings.globalShortcutSettings",
		"draw.",
	]),
	settings("general", "sliders", [
		"settings.language",
		"settings.theme",
		"settings.systemSettings.commonSettings",
		"settings.commonSettings.trayIconSettings",
		"settings.functionSettings.trayIconSettings",
		"settings.systemSettings.networkSettings",
	]),
	settings("system", "chip", [
		"settings.systemSettings.screenshotSettings",
		"settings.systemSettings.coreSettings",
		"settings.systemSettings.dataFile",
		"settings.systemSettings.dataDirectory",
		"settings.systemSettings.appLogFilePath",
		"settings.systemSettings.macosPermissionsSettings",
	]),
	settings("plugins", "plug", ["plugin."]),
	settings("about", "info", ["about."]),
];

export const getWorkbenchItem = (id: string | undefined) =>
	WORKBENCH_ITEMS.find((item) => item.id === id);

/** Map an application path to the navigator item it belongs to. */
export const getWorkbenchItemIdByPath = (pathname: string) => {
	if (pathname === "/" || pathname === "") {
		return DEFAULT_WORKBENCH_ITEM_ID;
	}

	const detailMatch = pathname.match(/^\/w\/([^/?#]+)/);
	if (detailMatch) {
		return decodeURIComponent(detailMatch[1]);
	}

	return WORKBENCH_ITEMS.find((item) => item.to && pathname.startsWith(item.to))
		?.id;
};

/** Items whose plugin, platform and OCR requirements are met. */
export const useVisibleWorkbenchItems = () => {
	const { defaultAppFunctionComponentGroupConfigs } = useContext(
		GlobalShortcutContext,
	);
	const { isReadyStatus } = usePluginServiceContext();
	const [currentPlatform] = usePlatform();

	return useMemo(() => {
		const availableFunctions = new Set(
			Object.values(defaultAppFunctionComponentGroupConfigs ?? {})
				.flat()
				.map((config) => config.configKey),
		);
		const translateReady = !!isReadyStatus?.(PLUGIN_ID_TRANSLATE);
		const chatReady = !!isReadyStatus?.(PLUGIN_ID_AI_CHAT);
		const glmOcrReady = !!isReadyStatus?.(PLUGIN_ID_GLM_OCR);
		const rapidOcrReady = !!isReadyStatus?.(PLUGIN_ID_RAPID_OCR);

		return WORKBENCH_ITEMS.filter((item) => {
			if (item.appFunction) {
				if (
					item.appFunction === AppFunction.TopWindow &&
					currentPlatform === "macos"
				) {
					return false;
				}

				return availableFunctions.has(item.appFunction);
			}

			switch (item.id) {
				case "modelServices":
					return translateReady || chatReady || glmOcrReady;
				case "translationPreferences":
					return translateReady;
				case "chatPreferences":
					return chatReady;
				case "ocr":
					return glmOcrReady || rapidOcrReady;
				default:
					return true;
			}
		});
	}, [currentPlatform, defaultAppFunctionComponentGroupConfigs, isReadyStatus]);
};
