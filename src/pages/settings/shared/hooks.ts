import { useState } from "react";
import {
	PLUGIN_ID_GLM_OCR,
	PLUGIN_ID_RAPID_OCR,
} from "@/constants/pluginService";
import { AppSettingsPublisher } from "@/contexts/appSettingsActionContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import type { AppSettingsData } from "@/types/appSettings";
import { canUseOcr } from "@/utils/ocr";

/** The latest settings snapshot, re-rendering on every change. */
export const useAppSettingsSnapshot = () => {
	const [settings, setSettings] = useState<AppSettingsData>();
	useStateSubscriber(AppSettingsPublisher, setSettings);
	return settings;
};

/** Whether the currently selected OCR engine is installed and usable. */
export const useOcrReady = () => {
	const settings = useAppSettingsSnapshot();
	const { isReadyStatus } = usePluginServiceContext();
	return settings
		? canUseOcr(
				settings,
				isReadyStatus?.(PLUGIN_ID_GLM_OCR),
				isReadyStatus?.(PLUGIN_ID_RAPID_OCR),
			)
		: false;
};
