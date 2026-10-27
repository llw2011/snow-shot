import React, { useCallback, useContext, useEffect } from "react";
import { CheckEnvironment } from "@/components/checkEnvironment";
import { CheckVersion } from "@/components/checkVersion";
import { GlobalEventHandler } from "@/components/globalEventHandler";
import { GlobalShortcut } from "@/components/globalShortcut";
import { InitService } from "@/components/initService";
import {
	TrayIconLoader,
	TrayIconStatePublisher,
} from "@/components/trayIconLoader";
import { Workbench } from "@/components/workbench";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { withStatePublisher } from "@/hooks/useStatePublisher";
import { translatedMessages } from "@/messages/map";
import { zhHans } from "@/messages/zhHans";
import { AppSettingsGroup, AppSettingsLanguage } from "@/types/appSettings";

const useMissingMessageReport = () => {
	useEffect(() => {
		if (process.env.NODE_ENV !== "development") {
			return;
		}

		const zhHantKeys = new Set(Object.keys(translatedMessages["zh-Hant"]));
		const enKeys = new Set(Object.keys(translatedMessages.en));
		const missing = (keys: Set<string>) =>
			Object.fromEntries(
				Object.entries(zhHans).filter(([key]) => !keys.has(key)),
			);

		console.log("App zh-Hant missing messages: ", missing(zhHantKeys));
		console.log("App en missing messages: ", missing(enKeys));
	}, []);
};

/** Follow the system language until the user picks one explicitly. */
const useBrowserLanguageSync = () => {
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	useAppSettingsLoad(
		useCallback(
			(settings) => {
				const browserLanguage = navigator.language;
				if (
					settings[AppSettingsGroup.Common].browserLanguage === browserLanguage
				) {
					return;
				}

				let language = AppSettingsLanguage.EN;
				if (browserLanguage.startsWith("zh")) {
					language = browserLanguage.startsWith("zh-TW")
						? AppSettingsLanguage.ZHHant
						: AppSettingsLanguage.ZHHans;
				}

				updateAppSettings(
					AppSettingsGroup.Common,
					{ browserLanguage, language },
					false,
					true,
					true,
				);
			},
			[updateAppSettings],
		),
	);
};

const MenuLayoutCore: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	useMissingMessageReport();
	useBrowserLanguageSync();

	return (
		<>
			<TrayIconLoader />
			<GlobalEventHandler />
			<CheckEnvironment />
			<CheckVersion />
			<div className="menu-layout-wrap">
				<GlobalShortcut>
					<Workbench>{children}</Workbench>
				</GlobalShortcut>
			</div>
			<style jsx>{`
				.menu-layout-wrap {
					position: relative;
					z-index: 1;
					height: 100%;
					overflow: hidden;
				}
			`}</style>
		</>
	);
};

const ML = React.memo(
	withStatePublisher(MenuLayoutCore, TrayIconStatePublisher),
);

export const MenuLayout = ({ children }: { children: React.ReactNode }) => {
	return (
		<>
			<InitService />
			<div className="snow-shot-window-shell">
				<ML>{children}</ML>
			</div>
		</>
	);
};
