import { Tabs, type TabsProps, theme } from "antd";
import {
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import type { Scrollbar } from "react-scrollbars-custom";
import type { RouteMapItem } from "@/types/components/menuLayout";

export type PageNavActionType = {
	updateActiveKey: (scrollTop: number, metrics?: PageNavScrollMetrics) => void;
};

export type PageNavScrollMetrics = {
	scrollHeight?: number;
	contentScrollHeight?: number;
	clientHeight?: number;
};

export const PageNav: React.FC<{
	tabItems: RouteMapItem;
	actionRef: React.RefObject<PageNavActionType | null>;
	scrollbarRef: React.RefObject<Scrollbar | null>;
}> = ({ tabItems, actionRef, scrollbarRef }) => {
	const { token } = theme.useToken();

	const [activeKey, setActiveKey] = useState<string | undefined>(
		tabItems.items?.[0]?.key,
	);
	const tabItemsRef = useRef<TabsProps["items"]>(tabItems.items);
	useEffect(() => {
		tabItemsRef.current = tabItems.items;
	}, [tabItems]);

	const tabItemsKey = useMemo(
		() => (tabItems.items ?? []).map((item) => item.key).join("|"),
		[tabItems.items],
	);

	const getMaxScrollTop = useCallback(
		(metrics?: PageNavScrollMetrics) => {
			const scrollHeight =
				typeof metrics?.contentScrollHeight === "number"
					? metrics.contentScrollHeight
					: metrics?.scrollHeight;

			if (
				typeof scrollHeight === "number" &&
				typeof metrics?.clientHeight === "number"
			) {
				return Math.max(0, scrollHeight - metrics.clientHeight);
			}

			const scrollbar = scrollbarRef.current;
			if (!scrollbar) {
				return 0;
			}

			const scrollState = scrollbar.getScrollState(true);
			return Math.max(
				0,
				scrollState.contentScrollHeight - scrollState.clientHeight,
			);
		},
		[scrollbarRef],
	);

	const getAnchorScrollPositionList = useCallback(
		(metrics?: PageNavScrollMetrics) => {
			if (typeof document === "undefined") {
				return [];
			}

			const scrollbar = scrollbarRef.current;
			const scrollerElement = scrollbar?.scrollerElement;
			const scrollState = scrollbar?.getScrollState(true);
			const scrollerRect = scrollerElement?.getBoundingClientRect();
			const scrollTop = scrollState?.scrollTop ?? 0;
			const maxScrollTop = getMaxScrollTop(metrics);

			return (tabItemsRef.current ?? [])
				.map((item, index) => {
					const key = item.key?.toString();
					if (!key) {
						return undefined;
					}

					const element = document.getElementById(key);
					if (!element) {
						return undefined;
					}

					const targetScrollTop =
						scrollerRect && scrollerElement
							? scrollTop +
								element.getBoundingClientRect().top -
								scrollerRect.top
							: element.offsetTop;

					return {
						key,
						index,
						scrollTop:
							maxScrollTop > 0
								? Math.min(Math.max(targetScrollTop, 0), maxScrollTop)
								: Math.max(targetScrollTop, 0),
					};
				})
				.filter(
					(item): item is { key: string; index: number; scrollTop: number } =>
						!!item,
				)
				.sort((a, b) => a.scrollTop - b.scrollTop || a.index - b.index);
		},
		[getMaxScrollTop, scrollbarRef],
	);

	const updateActiveKey = useCallback(
		(scrollTop: number, metrics?: PageNavScrollMetrics) => {
			const anchorScrollPositionList = getAnchorScrollPositionList(metrics);
			if (anchorScrollPositionList.length === 0) {
				return;
			}

			let targetKey = anchorScrollPositionList[0].key;
			const boundaryOffset = 2;
			for (const anchor of anchorScrollPositionList) {
				if (anchor.scrollTop <= scrollTop + boundaryOffset) {
					targetKey = anchor.key;
				} else {
					break;
				}
			}

			setActiveKey((prevKey) => {
				if (prevKey === targetKey) {
					return prevKey;
				}

				return targetKey;
			});
		},
		[getAnchorScrollPositionList],
	);

	const scrollToKey = useCallback(
		(key: string) => {
			const anchor = getAnchorScrollPositionList().find(
				(item) => item.key === key,
			);
			const scrollbar = scrollbarRef.current;
			const scrollerElement = scrollbar?.scrollerElement;
			if (!anchor || !scrollbar) {
				return false;
			}

			if (scrollerElement) {
				scrollerElement.scrollTo({
					top: anchor.scrollTop,
					behavior: "smooth",
				});
			} else {
				scrollbar.scrollTop = anchor.scrollTop;
			}

			return true;
		},
		[getAnchorScrollPositionList, scrollbarRef],
	);

	const updateActiveKeyRafRef = useRef<number | undefined>(undefined);
	const updateActiveKeyScrollTopRef = useRef(0);
	const updateActiveKeyMetricsRef = useRef<PageNavScrollMetrics | undefined>(
		undefined,
	);
	const scheduleUpdateActiveKey = useCallback(
		(scrollTop: number, metrics?: PageNavScrollMetrics) => {
			updateActiveKeyScrollTopRef.current = scrollTop;
			updateActiveKeyMetricsRef.current = metrics;
			if (typeof window === "undefined") {
				updateActiveKey(scrollTop, metrics);
				return;
			}

			if (updateActiveKeyRafRef.current !== undefined) {
				return;
			}

			updateActiveKeyRafRef.current = window.requestAnimationFrame(() => {
				updateActiveKeyRafRef.current = undefined;
				updateActiveKey(
					updateActiveKeyScrollTopRef.current,
					updateActiveKeyMetricsRef.current,
				);
			});
		},
		[updateActiveKey],
	);

	useEffect(() => {
		return () => {
			if (
				typeof window !== "undefined" &&
				updateActiveKeyRafRef.current !== undefined
			) {
				window.cancelAnimationFrame(updateActiveKeyRafRef.current);
			}
		};
	}, []);

	useEffect(() => {
		const tabs = tabItems.items;
		const firstTabKey = tabs?.[0]?.key?.toString();
		if (!firstTabKey) {
			setActiveKey(undefined);
			return;
		}

		const tabKeys = new Set(tabs?.map((item) => item.key?.toString()));
		setActiveKey((prevKey) => {
			if (prevKey && tabKeys.has(prevKey)) {
				return prevKey;
			}

			return firstTabKey;
		});

		scheduleUpdateActiveKey(0);
	}, [tabItems.items, scheduleUpdateActiveKey]);

	useImperativeHandle(
		actionRef,
		() => ({
			updateActiveKey: scheduleUpdateActiveKey,
		}),
		[scheduleUpdateActiveKey],
	);

	return (
		<div
			className="page-nav"
			style={{ display: tabItems.hideTabs ? "none" : undefined }}
		>
			<Tabs
				key={`${tabItemsKey}:${activeKey ?? ""}`}
				activeKey={activeKey}
				items={tabItems.items}
				size="small"
				onChange={(key) => {
					if (scrollToKey(key)) {
						setActiveKey(key);
					}
				}}
			/>

			<style jsx>{`
                .page-nav :global(.ant-tabs) {
                    margin-top: -12px !important;
                    padding: 0 ${token.padding}px !important;
                }

                .page-nav :global(.ant-tabs-nav-wrap) {
                    height: 32px !important;
                }
            `}</style>
		</div>
	);
};
