import { defaultAppSettingsData } from "@/constants/appSettings";
import type { AppSettingsData, AppSettingsGroup } from "@/types/appSettings";
import { normalizeFeatureSettingsGroup } from "./featureSettingsNormalizers";
import { normalizeGeneralSettingsGroup } from "./generalSettingsNormalizers";
import { normalizeServiceSettingsGroup } from "./serviceSettingsNormalizers";

type IsPluginReady = ((pluginId: string) => boolean) | undefined;

export const normalizeAppSettingsGroup = (
	group: AppSettingsGroup,
	inputSettings: Partial<AppSettingsData[typeof group]>,
	currentSettings: AppSettingsData,
	isReady: IsPluginReady,
): AppSettingsData[typeof group] =>
	normalizeGeneralSettingsGroup(
		group,
		inputSettings,
		currentSettings,
		isReady,
	) ??
	normalizeServiceSettingsGroup(group, inputSettings, currentSettings) ??
	normalizeFeatureSettingsGroup(group, inputSettings, currentSettings) ??
	defaultAppSettingsData[group];
