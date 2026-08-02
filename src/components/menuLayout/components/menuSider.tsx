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
	pathname: string;
}> = ({ menuItems, pathname }) => {
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
			className="snow-shot-sider"
			collapsed={collapsed}
			width={212}
			collapsedWidth={72}
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
					<div
						data-tauri-drag-region
						className="macos-title-bar-margin app-tauri-drag-region"
					></div>
				)}

				{currentPlatform !== "macos" && (
					<div
						data-tauri-drag-region
						className={`logo-wrap app-tauri-drag-region ${collapsed ? "collapsed" : ""}`}
					>
						<div
							data-tauri-drag-region
							className="logo-mark"
							aria-hidden="true"
						>
							<div data-tauri-drag-region className="logo-mark-core" />
						</div>
						{!collapsed && (
							<div data-tauri-drag-region className="logo-text">
								Snow Shot
							</div>
						)}
					</div>
				)}
				<RSC>
					<Menu
						defaultSelectedKeys={[menuItems[0]?.key?.toString() ?? "/"]}
						selectedKeys={[pathname]}
						mode="inline"
						items={menuItems}
						defaultOpenKeys={menuItems
							.map((item) => item?.key as string)
							.filter((key) => !!key)}
					/>
				</RSC>
			</div>
			<style jsx>{`
                .logo-wrap {
                    min-height: 58px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 14px 16px 10px;
                    color: var(--snow-shot-ink);
                    user-select: none;
                }

                .logo-wrap.collapsed {
                    justify-content: center;
                    padding-inline: 0;
                }

                .logo-mark {
                    position: relative;
                    width: 30px;
                    height: 30px;
                    flex: 0 0 auto;
                    border: 1px solid var(--snow-shot-hairline-strong);
                    border-radius: 8px;
                    background: var(--snow-shot-logo-bg);
                    box-shadow:
                        inset 0 1px 0 rgba(255, 255, 255, 0.08),
                        var(--snow-shot-glow);
                }

                .logo-mark::before,
                .logo-mark::after {
                    content: "";
                    position: absolute;
                    border: 1px solid var(--snow-shot-ink);
                    opacity: 0.86;
                }

                .logo-mark::before {
                    top: 7px;
                    left: 7px;
                    width: 11px;
                    height: 11px;
                    border-right: 0;
                    border-bottom: 0;
                    border-radius: 3px 0 0 0;
                }

                .logo-mark::after {
                    right: 7px;
                    bottom: 7px;
                    width: 11px;
                    height: 11px;
                    border-left: 0;
                    border-top: 0;
                    border-radius: 0 0 3px 0;
                }

                .logo-mark-core {
                    position: absolute;
                    left: 12px;
                    top: 12px;
                    width: 6px;
                    height: 6px;
                    border-radius: 999px;
                    background: var(--snow-shot-ink);
                    box-shadow:
                        -6px -4px 0 -2px color-mix(in srgb, var(--snow-shot-ink) 62%, transparent),
                        6px 4px 0 -2px color-mix(in srgb, var(--snow-shot-ink) 42%, transparent);
                }

                .logo-wrap .logo-text {
                    color: var(--snow-shot-ink);
                    font-size: 15px;
                    font-weight: 600;
                    letter-spacing: 0;
                    line-height: 1;
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

                .menu-sider-wrap :global(.ant-menu-inline) {
                    padding-bottom: ${token.padding}px;
                }

                .menu-wrap {
                    overflow: auto;
                }
            `}</style>
		</Sider>
	);
};

export const MenuSider = React.memo(MenuSiderCore);
