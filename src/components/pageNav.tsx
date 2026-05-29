import { Tabs, type TabsProps, theme } from "antd";
import {
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
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
}> = ({ tabItems, actionRef }) => {
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

	const getAnchorTopList = useCallback(() => {
		if (typeof document === "undefined") {
			return [];
		}

		return (tabItemsRef.current ?? [])
			.map((item) => {
				const key = item.key?.toString();
				if (!key) {
					return undefined;
				}

				const element = document.getElementById(key);
				if (!element) {
					return undefined;
				}

				return {
					key,
					offsetTop: element.offsetTop,
				};
			})
			.filter((item): item is { key: string; offsetTop: number } => !!item)
			.sort((a, b) => a.offsetTop - b.offsetTop);
	}, []);

	const updateActiveKey = useCallback(
		(scrollTop: number, metrics?: PageNavScrollMetrics) => {
			const anchorTopList = getAnchorTopList();
			if (anchorTopList.length === 0) {
				return;
			}

			let targetKey = anchorTopList[0].key;
			const scrollHeight =
				typeof metrics?.contentScrollHeight === "number"
					? metrics.contentScrollHeight
					: metrics?.scrollHeight;
			if (
				typeof scrollHeight === "number" &&
				typeof metrics?.clientHeight === "number" &&
				scrollHeight > metrics.clientHeight &&
				scrollTop >= scrollHeight - metrics.clientHeight - 2
			) {
				targetKey = anchorTopList[anchorTopList.length - 1].key;
			} else {
				const activeTop = scrollTop + 32;
				for (const anchor of anchorTopList) {
					if (anchor.offsetTop <= activeTop) {
						targetKey = anchor.key;
					} else {
						break;
					}
				}
			}

			setActiveKey((prevKey) => {
				if (prevKey === targetKey) {
					return prevKey;
				}

				return targetKey;
			});
		},
		[getAnchorTopList],
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
					const target = document.getElementById(key);
					if (!target) {
						return;
					}
					target.scrollIntoView({ behavior: "smooth" });
					setActiveKey(key);
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
