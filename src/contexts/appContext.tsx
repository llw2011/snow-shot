import type { Window as AppWindow } from "@tauri-apps/api/window";
import { createContext, type RefObject } from "react";
import { AppSettingsTheme } from "@/types/appSettings";

export type AppContextType = {
	appWindowRef: RefObject<AppWindow | undefined>;
	currentTheme: AppSettingsTheme;
};

export const AppContext = createContext<AppContextType>({
	appWindowRef: { current: undefined },
	currentTheme: AppSettingsTheme.Light,
});
