import { CloseOutlined, MinusOutlined } from "@ant-design/icons";
import {
	type Window as AppWindow,
	getCurrentWindow,
} from "@tauri-apps/api/window";
import * as tauriOs from "@tauri-apps/plugin-os";
import { Button, Layout, Menu, Space } from "antd";
import { Header } from "antd/es/layout/layout";
import type { ItemType, MenuItemType } from "antd/es/menu/interface";
import React, {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import RSC, { type Scrollbar } from "react-scrollbars-custom";
import { MainWindowSizeControl } from "@/components/mainWindowSizeControl";
import { PageNav } from "@/components/pageNav";
import { SettingsWorkspace } from "@/components/settingsWorkspace";
import type { RouteMapItem } from "@/types/components/menuLayout";

const { Content } = Layout;

type MenuItem = ItemType<MenuItemType>;

const MenuContentCore: React.FC<{
	menuItems: MenuItem[];
	pathname: string;
	routeTabsMap: Record<string, RouteMapItem>;
	children: React.ReactNode;
}> = ({ menuItems, pathname, routeTabsMap, children }) => {
	const appWindowRef = useRef<AppWindow | undefined>(undefined);
	useEffect(() => {
		appWindowRef.current = getCurrentWindow();
	}, []);

	const tabItems = useMemo(() => {
		return routeTabsMap[pathname] ?? routeTabsMap["/"] ?? [];
	}, [pathname, routeTabsMap]);
	const usesSettingsWorkspace =
		tabItems.contentNavigation === "settings-workspace";

	const scrollbarRef = useRef<Scrollbar | null>(null);
	const setScrollbarRef = useCallback(
		(instance: Scrollbar | HTMLDivElement | null) => {
			scrollbarRef.current =
				instance && "getScrollState" in instance
					? (instance as Scrollbar)
					: null;
		},
		[],
	);

	const resetPageScroll = useCallback(() => {
		const scrollbar = scrollbarRef.current;
		if (!scrollbar) {
			return;
		}

		scrollbar.scrollTop = 0;
		scrollbar.update(true);
	}, []);

	useLayoutEffect(() => {
		if (pathname.length === 0) {
			return;
		}

		resetPageScroll();
		const frame = window.requestAnimationFrame(resetPageScroll);
		return () => window.cancelAnimationFrame(frame);
	}, [pathname, resetPageScroll]);

	const [currentPlatform, setCurrentPlatform] = useState<
		tauriOs.Platform | undefined
	>(undefined);
	useEffect(() => {
		setCurrentPlatform(tauriOs.platform());
	}, []);

	const pageContent = (
		<RSC className="app-page-scrollbar" ref={setScrollbarRef}>
			<main className="content-container app-page-content">{children}</main>
		</RSC>
	);

	return (
		<Layout>
			<Header
				data-tauri-drag-region
				className={`app-titlebar app-tauri-drag-region ${
					currentPlatform === "macos" ? "is-macos" : ""
				}`}
			>
				<div data-tauri-drag-region className="app-brand app-tauri-drag-region">
					<div
						data-tauri-drag-region
						className="app-brand-mark"
						aria-hidden="true"
					/>
					<span data-tauri-drag-region className="app-brand-name">
						Snow Shot
					</span>
				</div>

				<Menu
					aria-label="Snow Shot"
					className="app-global-nav"
					items={menuItems}
					mode="horizontal"
					selectedKeys={[pathname]}
					triggerSubMenuAction="click"
				/>

				<Space className="window-actions workbench-window-actions">
					<MainWindowSizeControl />
					{currentPlatform !== "macos" && (
						<>
							<Button
								className="window-command-button"
								type="text"
								size="small"
								icon={<MinusOutlined />}
								aria-label="Minimize"
								title="Minimize"
								onClick={() => {
									appWindowRef.current?.minimize();
								}}
							/>
							<Button
								className="window-command-button"
								type="text"
								size="small"
								icon={<CloseOutlined />}
								aria-label="Hide Snow Shot"
								title="Hide Snow Shot"
								onClick={() => {
									appWindowRef.current?.hide();
									appWindowRef.current?.emit("on-hide-main-window");
								}}
							/>
						</>
					)}
				</Space>
			</Header>
			<Content>
				<div className="content-wrap app-content-shell">
					<div className="center app-content-surface">
						{usesSettingsWorkspace ? (
							<SettingsWorkspace
								key={pathname}
								scrollbarRef={scrollbarRef}
								tabItems={tabItems}
							>
								{pageContent}
							</SettingsWorkspace>
						) : (
							<>
								<PageNav tabItems={tabItems} scrollbarRef={scrollbarRef} />
								{pageContent}
							</>
						)}
					</div>
				</div>
			</Content>

			<style jsx global>{`
				.app-titlebar {
					display: grid;
					grid-template-columns: auto minmax(0, 1fr) auto;
					grid-template-rows: 52px;
					align-items: center;
					height: 52px !important;
					line-height: normal !important;
					padding: 0 12px 0 16px !important;
					background: var(--snow-shot-header-bg) !important;
					border-bottom: 1px solid var(--snow-shot-hairline);
				}

				.app-titlebar.is-macos {
					padding-inline-start: 76px !important;
				}

				.app-brand {
					display: inline-flex;
					align-items: center;
					gap: 9px;
					min-width: 146px;
					height: 100%;
					padding-inline-end: 18px;
					color: var(--snow-shot-ink);
					font-size: 15px;
					font-weight: 600;
					user-select: none;
				}

				.app-brand-mark {
					position: relative;
					width: 26px;
					height: 26px;
					flex: 0 0 auto;
					border: 1px solid var(--snow-shot-ink);
					border-radius: 5px;
				}

				.app-brand-mark::before,
				.app-brand-mark::after {
					position: absolute;
					width: 8px;
					height: 8px;
					border: 1px solid currentColor;
					content: "";
				}

				.app-brand-mark::before {
					inset: 5px auto auto 5px;
					border-right: 0;
					border-bottom: 0;
				}

				.app-brand-mark::after {
					inset: auto 5px 5px auto;
					border-top: 0;
					border-left: 0;
				}

				.app-titlebar :global(.app-global-nav.ant-menu) {
					min-width: 0;
					height: 52px;
					line-height: 52px;
					background: transparent;
					border-bottom: 0;
					color: var(--snow-shot-muted);
				}

				.app-titlebar :global(.app-global-nav.ant-menu.ant-menu-overflow),
				.app-titlebar :global(.app-global-nav .ant-menu-overflow) {
					display: flex;
					align-items: center;
					gap: 2px;
					overflow: hidden;
				}

				.app-titlebar
					:global(.app-global-nav > .ant-menu-submenu:not(.ant-menu-overflow-item-rest)) {
					display: flex;
					align-items: center;
					height: 34px;
					margin: 0 !important;
					padding: 0 !important;
					line-height: normal !important;
					top: auto !important;
				}

				.app-titlebar :global(.app-global-nav .ant-menu-item),
				.app-titlebar :global(.app-global-nav .ant-menu-submenu-title) {
					display: inline-flex;
					align-items: center;
					height: 34px;
					margin: 0 !important;
					padding: 0 10px !important;
					border: 1px solid transparent;
					border-radius: var(--snow-shot-radius-sm);
					color: var(--snow-shot-muted) !important;
					font-size: 14px;
					line-height: 32px !important;
				}

				.app-titlebar :global(.app-global-nav > .ant-menu-item) {
					top: auto !important;
				}

				.app-titlebar :global(.app-global-nav .ant-menu-item::after),
				.app-titlebar :global(.app-global-nav .ant-menu-submenu::after) {
					display: none;
				}

				.app-titlebar :global(.app-global-nav .ant-menu-item:hover),
				.app-titlebar :global(.app-global-nav .ant-menu-submenu-title:hover),
				.app-titlebar :global(.app-global-nav .ant-menu-item-selected),
				.app-titlebar
					:global(.app-global-nav .ant-menu-submenu-selected > .ant-menu-submenu-title) {
					border-color: var(--snow-shot-hairline);
					background: var(--snow-shot-surface-elevated) !important;
					color: var(--snow-shot-ink) !important;
				}

				.app-titlebar :global(.workbench-window-actions) {
					display: flex;
					align-items: center;
					gap: 4px;
					margin: 0;
				}

				.app-titlebar :global(.window-actions .window-command-button) {
					width: 30px;
					height: 30px;
					border: 1px solid transparent;
					border-radius: var(--snow-shot-radius-sm);
					color: var(--snow-shot-muted);
					background: transparent;
				}

				.app-titlebar :global(.window-actions .window-command-button:hover) {
					border-color: var(--snow-shot-hairline);
					color: var(--snow-shot-ink);
					background: var(--snow-shot-surface-elevated);
				}

				.app-content-shell {
					display: grid;
					grid-template-columns: 12px minmax(0, 1fr) 12px;
					grid-template-rows: 12px minmax(0, 1fr) 12px;
					height: 100%;
					background: var(--snow-shot-canvas);
				}

				.app-content-shell .center {
					grid-column: 2;
					grid-row: 2;
					container-name: snow-app-content;
					container-type: inline-size;
					display: flex;
					min-width: 0;
					min-height: 0;
					overflow: hidden;
					border: 1px solid var(--snow-shot-hairline);
					border-radius: var(--snow-shot-radius-lg);
					background: var(--snow-shot-panel-bg);
				}

				.app-content-shell .center :global(.app-page-scrollbar) {
					flex: 1 1 auto;
					min-width: 0;
					min-height: 0;
				}

				.content-container {
					box-sizing: border-box;
					container-name: snow-content;
					container-type: inline-size;
					width: 100%;
					min-height: 100%;
					padding: 28px 32px 48px;
					overflow-x: hidden;
				}

				@media (max-width: 800px) {
					.app-brand {
						min-width: 46px;
						padding-inline-end: 12px;
					}

					.app-brand-name {
						display: none;
					}

					.content-container {
						padding: 22px 20px 40px;
					}
				}
			`}</style>
		</Layout>
	);
};

export const MenuContent = React.memo(MenuContentCore);
