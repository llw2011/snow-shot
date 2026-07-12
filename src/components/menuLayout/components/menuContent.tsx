import { CloseOutlined, MinusOutlined } from "@ant-design/icons";
import {
	type Window as AppWindow,
	getCurrentWindow,
} from "@tauri-apps/api/window";
import * as tauriOs from "@tauri-apps/plugin-os";
import { Button, Layout, Space, theme } from "antd";
import { Header } from "antd/es/layout/layout";
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import RSC, { type Scrollbar } from "react-scrollbars-custom";
import { PageNav } from "@/components/pageNav";
import type { RouteMapItem } from "@/types/components/menuLayout";

const { Content } = Layout;

const MenuContentCore: React.FC<{
	pathname: string;
	routeTabsMap: Record<string, RouteMapItem>;
	children: React.ReactNode;
}> = ({ pathname, routeTabsMap, children }) => {
	const { token } = theme.useToken();
	const appWindowRef = useRef<AppWindow | undefined>(undefined);
	useEffect(() => {
		appWindowRef.current = getCurrentWindow();
	}, []);

	const tabItems = useMemo(() => {
		return routeTabsMap[pathname] ?? routeTabsMap["/"] ?? [];
	}, [pathname, routeTabsMap]);

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

	const [currentPlatform, setCurrentPlatform] = useState<
		tauriOs.Platform | undefined
	>(undefined);
	useEffect(() => {
		setCurrentPlatform(tauriOs.platform());
	}, []);

	return (
		<Layout>
			<Header
				data-tauri-drag-region
				className="app-titlebar app-tauri-drag-region"
			>
				{currentPlatform !== "macos" && (
					<Space className="window-actions">
						<Button
							type="text"
							size="small"
							icon={<MinusOutlined />}
							onClick={() => {
								appWindowRef.current?.minimize();
							}}
						/>
						<Button
							type="text"
							size="small"
							icon={<CloseOutlined />}
							onClick={() => {
								appWindowRef.current?.hide();
								appWindowRef.current?.emit("on-hide-main-window");
							}}
						/>
					</Space>
				)}

				{currentPlatform === "macos" && (
					<div data-tauri-drag-region className="logo-text">
						<div data-tauri-drag-region className="logo-mark" />
						<div data-tauri-drag-region>Snow Shot</div>
					</div>
				)}
			</Header>
			<Content>
				<div className="content-wrap">
					<div data-tauri-drag-region className="app-tauri-drag-region"></div>
					<div data-tauri-drag-region className="app-tauri-drag-region"></div>
					<div data-tauri-drag-region className="app-tauri-drag-region"></div>
					<div data-tauri-drag-region className="app-tauri-drag-region"></div>
					<div className="center">
						<PageNav tabItems={tabItems} scrollbarRef={scrollbarRef} />
						<RSC ref={setScrollbarRef}>
							<div className="content-container">{children}</div>
						</RSC>
					</div>
					<div data-tauri-drag-region className="app-tauri-drag-region"></div>
					<div data-tauri-drag-region className="app-tauri-drag-region"></div>
					<div data-tauri-drag-region className="app-tauri-drag-region"></div>
					<div data-tauri-drag-region className="app-tauri-drag-region"></div>
				</div>
			</Content>

			<style jsx>{`
                .app-titlebar {
                    position: relative;
                    height: 32px !important;
                    background: var(--snow-shot-header-bg) !important;
                    border-bottom: 1px solid var(--snow-shot-hairline-soft);
                }

                .app-titlebar :global(.window-actions .ant-btn) {
                    color: var(--snow-shot-muted);
                    border-radius: 6px;
                }

                .app-titlebar :global(.window-actions .ant-btn:hover) {
                    color: var(--snow-shot-ink);
                    background: var(--snow-shot-surface-card);
                }

                .content-wrap {
                    display: grid;
                    grid-template-columns: ${token.paddingSM}px auto ${token.paddingSM}px;
                    grid-template-rows: ${token.paddingSM}px auto ${token.paddingSM}px;
                    height: 100%;
                    background: transparent;
                }

                .content-wrap .center {
                    grid-column: 2;
                    grid-row: 2;
                    overflow-y: hidden;
                    overflow-x: hidden;
                    border-radius: ${token.borderRadius}px;
                    background: var(--snow-shot-panel-bg);
                    border: 1px solid var(--snow-shot-hairline-soft);
                    box-shadow: var(--snow-shot-shadow);
                    backdrop-filter: var(--snow-shot-backdrop-filter);
                    padding: ${token.paddingSM}px ${token.paddingSM}px;
                    display: flex;
                    flex-direction: column;
                    transform: translateY(0px);
                }

                .content-wrap .center::-webkit-scrollbar {
                    display: none;
                }

                .content-container {
                    padding: 0 ${token.paddingSM}px;
                    width: 100%;
                    height: 100%;
                    overflow-x: hidden;
                }

                .logo-text {
                    position: absolute;
                    line-height: initial;
                    display: flex;
                    height: 32px;
                    gap: 8px;
                    align-items: center;
                    justify-content: center;
                    color: var(--snow-shot-text-color);
                    font-weight: 650;
                    user-select: none;
                    /* 对齐系统里的 title 位置 */
                    position: absolute;
                    left: 0;
                    right: 0;
                }

                .logo-mark {
                    width: 15px;
                    height: 15px;
                    border: 1px solid var(--snow-shot-hairline-strong);
                    border-radius: 5px;
                    background: var(--snow-shot-surface-card);
                    box-shadow: inset 0 0 0 3px var(--snow-shot-canvas);
                }
            `}</style>
		</Layout>
	);
};

export const MenuContent = React.memo(MenuContentCore);
