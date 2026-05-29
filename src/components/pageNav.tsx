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

type PageNavAnchor = {
	key: string;
	index: number;
	clickScrollTop: number;
};

const SCROLL_BOTTOM_TOLERANCE = 1;
const NON_BOTTOM_TARGET_GAP = 4;
const NEXT_SECTION_OFFSET = 1;

const clampScrollTop = (value: number, maxScrollTop: number) =>
	Math.min(Math.max(value, 0), maxScrollTop);

const getNonBottomMaxScrollTop = (maxScrollTop: number) => {
	if (maxScrollTop <= 0) {
		return 0;
	}

	return Math.max(0, maxScrollTop - NON_BOTTOM_TARGET_GAP);
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

	const isAtBottom = useCallback(
		(scrollTop: number, maxScrollTop: number) =>
			maxScrollTop > 0 && scrollTop >= maxScrollTop - SCROLL_BOTTOM_TOLERANCE,
		[],
	);

	const getAnchorList = useCallback(
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
			const nonBottomMaxScrollTop = getNonBottomMaxScrollTop(maxScrollTop);

			const rawAnchorList = (tabItemsRef.current ?? [])
				.map((item, index) => {
					const key = item.key?.toString();
					if (!key) {
						return undefined;
					}

					const element = document.getElementById(key);
					if (!element) {
						return undefined;
					}

					const rawScrollTop =
						scrollerRect && scrollerElement
							? scrollTop +
								element.getBoundingClientRect().top -
								scrollerRect.top
							: element.offsetTop;

					return {
						key,
						index,
						rawScrollTop,
					};
				})
				.filter(
					(
						item,
					): item is { key: string; index: number; rawScrollTop: number } =>
						!!item,
				);

			return rawAnchorList
				.map((anchor, anchorIndex): PageNavAnchor => {
					const isLastAnchor = anchorIndex === rawAnchorList.length - 1;
					const maxTargetScrollTop = isLastAnchor
						? maxScrollTop
						: nonBottomMaxScrollTop;

					return {
						key: anchor.key,
						index: anchor.index,
						clickScrollTop: clampScrollTop(
							anchor.rawScrollTop,
							maxTargetScrollTop,
						),
					};
				})
				.sort(
					(a, b) => a.clickScrollTop - b.clickScrollTop || a.index - b.index,
				);
		},
		[getMaxScrollTop, scrollbarRef],
	);

	const getActiveKey = useCallback(
		(scrollTop: number, anchorList: PageNavAnchor[], maxScrollTop: number) => {
			if (anchorList.length === 0) {
				return undefined;
			}

			if (anchorList.length === 1 || maxScrollTop <= 0) {
				return anchorList[0].key;
			}

			if (isAtBottom(scrollTop, maxScrollTop)) {
				return anchorList[anchorList.length - 1].key;
			}

			const candidateList = anchorList.slice(0, -1);
			let targetKey = candidateList[0].key;
			const nonBottomMaxScrollTop = getNonBottomMaxScrollTop(maxScrollTop);
			for (let index = 1; index < candidateList.length; index++) {
				const currentAnchor = candidateList[index];
				const previousAnchor = candidateList[index - 1];
				const isLastCandidate = index === candidateList.length - 1;
				const activationScrollTop =
					isLastCandidate &&
					currentAnchor.clickScrollTop >= nonBottomMaxScrollTop
						? previousAnchor.clickScrollTop + NEXT_SECTION_OFFSET
						: currentAnchor.clickScrollTop;

				if (scrollTop >= activationScrollTop) {
					targetKey = currentAnchor.key;
				} else {
					break;
				}
			}

			return targetKey;
		},
		[isAtBottom],
	);

	const updateActiveKey = useCallback(
		(scrollTop: number, metrics?: PageNavScrollMetrics) => {
			const anchorList = getAnchorList(metrics);
			const targetKey = getActiveKey(
				scrollTop,
				anchorList,
				getMaxScrollTop(metrics),
			);
			if (!targetKey) {
				return;
			}

			setActiveKey((prevKey) => {
				if (prevKey === targetKey) {
					return prevKey;
				}

				return targetKey;
			});
		},
		[getActiveKey, getAnchorList, getMaxScrollTop],
	);

	const scrollToKey = useCallback(
		(key: string) => {
			const anchor = getAnchorList().find((item) => item.key === key);
			const scrollbar = scrollbarRef.current;
			const scrollerElement = scrollbar?.scrollerElement;
			if (!anchor || !scrollbar) {
				return false;
			}

			if (scrollerElement) {
				scrollerElement.scrollTo({
					top: anchor.clickScrollTop,
					behavior: "smooth",
				});
			} else {
				scrollbar.scrollTop = anchor.clickScrollTop;
			}

			return true;
		},
		[getAnchorList, scrollbarRef],
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
