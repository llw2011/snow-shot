import { createContext } from "react";
import { defaultAppSettingsData } from "@/constants/appSettings";
import { createPublisher } from "@/hooks/useStatePublisher";
import type { AppSettingsData } from "@/types/appSettings";
import type { AppSettingsActionContextType } from "@/types/contexts";

export const AppSettingsActionContext =
	createContext<AppSettingsActionContextType>({
		updateAppSettings: () => {},
		reloadAppSettings: () => {},
	});

export const AppSettingsPublisher = createPublisher<AppSettingsData>(
	defaultAppSettingsData,
);

export const AppSettingsLoadingPublisher = createPublisher<boolean>(true);
