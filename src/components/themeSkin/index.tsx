import { convertFileSrc } from "@tauri-apps/api/core";
import { theme } from "antd";
import Color from "color";
import { useCallback, useContext, useMemo, useState } from "react";
import { AppContext } from "@/contexts/appContext";
import { AppSettingsPublisher } from "@/contexts/appSettingsActionContext";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import {
	type AppSettingsData,
	AppSettingsGroup,
	AppSettingsTheme,
} from "@/types/appSettings";

export const ThemeSkin = () => {
	const { token } = theme.useToken();
	const [themeSkinSettings, setThemeSkinSettings] = useState<
		AppSettingsData[AppSettingsGroup.ThemeSkin] | undefined
	>(undefined);
	const { currentTheme } = useContext(AppContext);
	useStateSubscriber(
		AppSettingsPublisher,
		useCallback((appSettings: AppSettingsData) => {
			setThemeSkinSettings(appSettings[AppSettingsGroup.ThemeSkin]);
		}, []),
	);

	const isDarkMode = useMemo(() => {
		return currentTheme === AppSettingsTheme.Dark;
	}, [currentTheme]);

	const backgroundImageUrl = useMemo(() => {
		if (!themeSkinSettings?.skinPath) {
			return null;
		}

		return convertFileSrc(themeSkinSettings.skinPath);
	}, [themeSkinSettings?.skinPath]);

	const backgroundPosition = useMemo(() => {
		if (!themeSkinSettings) {
			return "center";
		}
		return themeSkinSettings.skinPosition;
	}, [themeSkinSettings]);

	const opacity = useMemo(() => {
		if (!themeSkinSettings) {
			return 0.5;
		}
		return themeSkinSettings.skinOpacity / 100;
	}, [themeSkinSettings]);

	const blur = useMemo(() => {
		if (!themeSkinSettings) {
			return 0;
		}
		return themeSkinSettings.skinBlur;
	}, [themeSkinSettings]);

	const backgroundSize = useMemo(() => {
		if (!themeSkinSettings) {
			return "cover";
		}
		return themeSkinSettings.skinImageSize;
	}, [themeSkinSettings]);

	const customCss = useMemo(() => {
		if (!themeSkinSettings) {
			return "";
		}
		return themeSkinSettings.customCss;
	}, [themeSkinSettings]);

	const maskBlur = useMemo(() => {
		if (!themeSkinSettings) {
			return 0;
		}
		return themeSkinSettings.skinMaskBlur;
	}, [themeSkinSettings]);

	const maskOpacity = useMemo(() => {
		if (!themeSkinSettings) {
			return 0.5;
		}
		return themeSkinSettings.skinMaskOpacity / 100;
	}, [themeSkinSettings]);

	const siderMenuBackgroundColor = useMemo(() => {
		if (!themeSkinSettings) {
			return "transparent";
		}

		let backgroundColor = token.colorBgContainer;
		if (isDarkMode) {
			backgroundColor = "#001529";
		}

		return Color(backgroundColor)
			.alpha(0.83 * maskOpacity)
			.toString();
	}, [themeSkinSettings, token.colorBgContainer, maskOpacity, isDarkMode]);

	const levelOneBackgroundColor = useMemo(() => {
		if (!themeSkinSettings) {
			return "transparent";
		}

		return Color(token.colorBgContainer)
			.alpha(0.83 * maskOpacity)
			.toString();
	}, [themeSkinSettings, token.colorBgContainer, maskOpacity]);

	const levelTwoBackgroundColor = useMemo(() => {
		if (!themeSkinSettings) {
			return "transparent";
		}

		return Color(token.colorBgContainer)
			.alpha(0.42 * maskOpacity)
			.toString();
	}, [themeSkinSettings, token.colorBgContainer, maskOpacity]);

	const menuItemBackgroundColor = useMemo(() => {
		if (!themeSkinSettings) {
			return "transparent";
		}
		return Color(token.colorPrimaryBg)
			.alpha(0.64 * maskOpacity)
			.toString();
	}, [themeSkinSettings, token.colorPrimaryBg, maskOpacity]);

	// 如果没有设置皮肤路径，不显示任何内容
	if (!backgroundImageUrl) {
		return null;
	}

	return (
		<div
			className="global-skin-container"
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
			}}
		>
			<div
				className="global-skin"
				style={{
					width: "100%",
					height: "100%",
					backgroundImage: `url(${backgroundImageUrl})`,
					backgroundSize: backgroundSize,
					backgroundPosition: backgroundPosition,
					backgroundRepeat: "no-repeat",
					opacity: opacity,
					pointerEvents: "none",
					filter: `blur(${blur}px)`,
					zIndex: 0,
				}}
			/>

			{/** biome-ignore lint/security/noDangerouslySetInnerHtml: 提供自定义 CSS */}
			{customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}

			<style jsx global>
				{`

                    .global-skin-container {
                        background-color: ${token.colorBgLayout};
                    }
                        

					.ant-app .menu-layout-wrap .ant-layout {
						background-color: transparent;
					}

                    .ant-app .menu-layout-wrap .ant-layout-header {
                        background-color: ${levelOneBackgroundColor} !important;
                        backdrop-filter: blur(${maskBlur}px);
                    }

                    .ant-app .menu-layout-wrap .ant-layout-sider {
                        background-color: ${siderMenuBackgroundColor};
                        backdrop-filter: blur(${maskBlur}px);
                    }

                    .ant-app .menu-layout-wrap .content-wrap>.center {
                        background-color: ${levelOneBackgroundColor} !important;
                        backdrop-filter: blur(${maskBlur}px);
                    }

                    .ant-app .menu-layout-wrap .ant-layout-sider .menu-sider-wrap .ant-menu.ant-menu-root {
                        background-color: transparent;
                    }
                    
                    .ant-app .menu-layout-wrap .ant-layout-sider .menu-sider-wrap .ant-menu.ant-menu-root .ant-menu-item-selected {
                        background-color: ${menuItemBackgroundColor} !important;
                    }

                    .ant-app .menu-layout-wrap .ant-layout-sider .ant-menu-sub.ant-menu-inline {
                        background-color: ${isDarkMode ? "rgba(0, 0, 0, 0.16)" : "rgba(0, 0, 0, 0.02)"} !important;
                    }

                    .ant-app .menu-layout-wrap .ant-layout-sider-trigger {
                        background-color: transparent;
                    }

                    .ant-app .ant-select-underlined .ant-select-selector {
                        background-color: transparent !important;
                    }

                    .ant-app .menu-layout-wrap .ant-layout .ant-btn-color-default,
                    .ant-app .menu-layout-wrap .ant-layout .ant-btn-default.ant-btn-variant-dashed,
                    .ant-app .menu-layout-wrap .ant-layout .ant-color-picker-trigger,
                    .ant-app .menu-layout-wrap .ant-layout .ant-input-affix-wrapper,
                    .ant-app .menu-layout-wrap .ant-layout .ant-select-outlined .ant-select-selector,
                    .ant-app .menu-layout-wrap .ant-layout .ant-input-outlined,
                    .ant-app .menu-layout-wrap .ant-layout .ant-input-number {
                        background-color: ${levelTwoBackgroundColor};
                    }

                    .ant-app .menu-layout-wrap .ant-layout .ant-pro-table .ant-pro-card {
                        background-color: transparent;
                    }
				`}
			</style>
		</div>
	);
};
