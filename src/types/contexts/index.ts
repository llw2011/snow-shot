import type { AppSettingsData, AppSettingsGroup } from "@/types/appSettings";

export type AppSettingsActionContextType = {
	updateAppSettings: (
		group: AppSettingsGroup,
		settings: Partial<AppSettingsData[typeof group]>,
		debounce: boolean,
		/** 是否保存到文件 */
		saveToFile: boolean,
		/** 是否同步到所有窗口 */
		syncAllWindow: boolean,
		/** 是否忽略状态更新 */
		ignoreState?: boolean,
		/** 是否忽略 publisher 更新 */
		ignorePublisher?: boolean,
	) => void;
	reloadAppSettings: () => void;
};
