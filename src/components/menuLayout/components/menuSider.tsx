import { Layout, Menu, theme } from "antd";
import React, {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

const { Sider } = Layout;

import * as tauriOs from "@tauri-apps/plugin-os";
import type { ItemType, MenuItemType } from "antd/es/menu/interface";
import RSC from "react-scrollbars-custom";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";

type MenuItem = ItemType<MenuItemType>;

const findOpenAncestor = (
	items: MenuItem[],
	pathname: string,
): string | undefined => {
	for (const item of items) {
		if (!item || !("children" in item)) {
			continue;
		}

		const children = item.children as MenuItem[] | undefined;
		if (!children?.length) {
			continue;
		}

		if (children.some((child) => child && child.key?.toString() === pathname)) {
			return item.key?.toString();
		}
	}

	return undefined;
};

const MenuSiderCore: React.FC<{
	menuItems: MenuItem[];
	pathname: string;
}> = ({ menuItems, pathname }) => {
	const { token } = theme.useToken();
	const [collapsed, setCollapsed] = useState(false);
	const activeAncestor = useMemo(
		() => findOpenAncestor(menuItems, pathname),
		[menuItems, pathname],
	);
	const [openKeys, setOpenKeys] = useState<string[]>(() =>
		activeAncestor ? [activeAncestor] : [],
	);

	useEffect(() => {
		if (!collapsed) {
			setOpenKeys(activeAncestor ? [activeAncestor] : []);
		}
	}, [activeAncestor, collapsed]);

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
			width={200}
			collapsedWidth={64}
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
				<RSC className="menu-sider-scroll">
					<Menu
						aria-label="Snow Shot"
						className="menu-sider-menu"
						selectedKeys={[pathname]}
						mode="inline"
						items={menuItems}
						inlineIndent={16}
						openKeys={openKeys}
						onOpenChange={(keys) => {
							if (collapsed) {
								return;
							}
							const nextKey = keys.find((key) => !openKeys.includes(key));
							setOpenKeys(nextKey ? [nextKey] : []);
						}}
					/>
				</RSC>
			</div>
			<style jsx>{`
                .logo-wrap {
					position: relative;
                    min-height: 60px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 14px 14px 10px;
                    color: var(--snow-shot-ink);
                    user-select: none;
                }

				.logo-wrap::after {
					content: "";
					position: absolute;
					inset-inline: 14px;
					bottom: 0;
					height: 1px;
					background: var(--snow-shot-hairline-soft);
				}

                .logo-wrap.collapsed {
                    justify-content: center;
                    padding-inline: 0;
                }

				.logo-wrap.collapsed::after {
					inset-inline: 10px;
				}

                .logo-mark {
                    position: relative;
                    width: 30px;
                    height: 30px;
                    flex: 0 0 auto;
                    border: 1px solid var(--snow-shot-hairline-strong);
                    border-radius: var(--snow-shot-radius-sm);
					background: var(--snow-shot-surface-card);
					box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
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
                    width: 12px;
                    height: 12px;
                    border-right: 0;
                    border-bottom: 0;
                    border-radius: 3px 0 0 0;
                }

                .logo-mark::after {
                    right: 7px;
                    bottom: 7px;
                    width: 12px;
                    height: 12px;
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
					background: var(--snow-shot-primary);
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
                    height: 40px;
                }

                .menu-sider-wrap {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }

				.menu-sider-wrap :global(.menu-sider-scroll) {
					flex: 1 1 auto;
					min-height: 0;
				}

                .menu-sider-wrap :global(.ScrollbarsCustom-Wrapper) {
                    inset: 0 0 0 0 !important;
                }

				.menu-sider-wrap :global(.menu-sider-menu.ant-menu-inline) {
					padding: 8px 0 ${token.padding + 44}px;
                }

				.menu-sider-wrap :global(.menu-sider-menu .ant-menu-item),
				.menu-sider-wrap :global(.menu-sider-menu .ant-menu-submenu-title) {
					position: relative;
					min-height: 40px !important;
					border: 1px solid transparent;
					border-radius: var(--snow-shot-radius-sm) !important;
					line-height: 38px !important;
					transition:
						background-color 140ms ease,
						border-color 140ms ease,
						color 140ms ease;
				}

				.menu-sider-wrap :global(.menu-sider-menu .ant-menu-item:hover),
				.menu-sider-wrap :global(.menu-sider-menu .ant-menu-submenu-title:hover) {
					border-color: var(--snow-shot-hairline-soft);
				}

				.menu-sider-wrap :global(.menu-sider-menu .ant-menu-item-selected) {
					border-color: var(--snow-shot-hairline-strong);
					background: var(--snow-shot-surface-elevated) !important;
					box-shadow: inset 2px 0 0 var(--snow-shot-primary);
				}

				.menu-sider-wrap :global(.menu-sider-menu .ant-menu-submenu-selected > .ant-menu-submenu-title) {
					color: var(--snow-shot-ink);
				}

				.menu-sider-wrap :global(.menu-sider-menu .ant-menu-item::after) {
					display: none;
				}

				.menu-sider-wrap :global(.menu-sider-menu .ant-menu-sub) {
					border-inline-start-color: var(--snow-shot-hairline-soft);
				}
            `}</style>
		</Sider>
	);
};

export const MenuSider = React.memo(MenuSiderCore);
