import { Layout, Menu, theme } from "antd";
import React, { useCallback, useContext, useEffect, useState } from "react";

const { Sider } = Layout;

import * as tauriOs from "@tauri-apps/plugin-os";
import type { ItemType, MenuItemType } from "antd/es/menu/interface";
import RSC from "react-scrollbars-custom";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";

type MenuItem = ItemType<MenuItemType>;

const MenuSiderCore: React.FC<{
	menuItems: MenuItem[];
	darkMode: boolean;
	pathname: string;
}> = ({ menuItems, darkMode, pathname }) => {
	const { token } = theme.useToken();
	const [collapsed, setCollapsed] = useState(false);
	useAppSettingsLoad(
		useCallback((settings: AppSettingsData) => {
			setCollapsed(settings[AppSettingsGroup.Cache].menuCollapsed);
		}, []),
	);
	const { updateAppSettings } = useContext(AppSettingsActionContext);

	useEffect(() => {
		if (process.env.NODE_ENV === "development") {
			return;
		}

		window.oncontextmenu = (e) => {
			e.preventDefault();
			e.stopPropagation();
		};

		return () => {
			window.oncontextmenu = null;
		};
	}, []);

	const [currentPlatform, setCurrentPlatform] = useState<
		tauriOs.Platform | undefined
	>(undefined);
	useEffect(() => {
		setCurrentPlatform(tauriOs.platform());
	}, []);

	return (
		<Sider
			theme={darkMode ? "dark" : "light"}
			collapsed={collapsed}
			collapsible
			onCollapse={(value) => {
				setCollapsed(value);
				updateAppSettings(
					AppSettingsGroup.Cache,
					{ menuCollapsed: value },
					true,
					true,
					false,
				);
			}}
		>
			<div className="menu-sider-wrap">
				{currentPlatform === "macos" && (
					<div className="macos-title-bar-margin app-tauri-drag-region"></div>
				)}

				{currentPlatform !== "macos" && (
					<div className="logo-wrap">
						<div className="logo-text">
							{collapsed ? (
								<>
									<div className="logo-text-highlight">S</div>
									<div>now</div>
								</>
							) : (
								<>
									<div className="logo-text-highlight">Snow</div>
									<div>Shot</div>
								</>
							)}
						</div>
					</div>
				)}
				<RSC>
					<Menu
						defaultSelectedKeys={[menuItems[0]?.key?.toString() ?? "/"]}
						selectedKeys={[pathname]}
						mode="inline"
						theme={darkMode ? "dark" : "light"}
						items={menuItems}
						defaultOpenKeys={menuItems
							.map((item) => item?.key as string)
							.filter((key) => !!key)}
					/>
				</RSC>
			</div>
			<style jsx>{`
                .logo-wrap {
                    margin-top: 16px;
                    margin-bottom: 10px;
                    font-weight: 600;
                    font-size: 21px;
                    text-align: center;
                    font-style: italic;
                }

                .logo-wrap .logo-text {
                    color: var(--snow-shot-text-color);
                    display: inline-block;
                    padding: 0px 12px;
                }

                :global(body) {
                    --snow-shot-purple-color: ${darkMode ? token["purple-7"] : token["purple-5"]};
                    --snow-shot-text-color: ${darkMode ? "#fff" : "#000"};
                }

                .logo-wrap .logo-text .logo-text-highlight {
                    color: var(--snow-shot-purple-color);
                }

                .logo-wrap .logo-text div {
                    display: inline;
                }

                .macos-title-bar-margin {
                    width: 100%;
                    height: 32px;
                }

                .menu-sider-wrap {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }

                .menu-sider-wrap :global(.ScrollbarsCustom-Wrapper) {
                    inset: 0 0 0 0 !important;
                }

                .menu-wrap {
                    overflow: auto;
                }
            `}</style>
		</Sider>
	);
};

export const MenuSider = React.memo(MenuSiderCore);
