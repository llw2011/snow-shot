import { Tabs, theme } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Scrollbar } from "react-scrollbars-custom";
import type { RouteMapItem } from "@/types/components/menuLayout";

const clampScrollTop = (value: number, maxScrollTop: number) =>
	Math.min(Math.max(value, 0), maxScrollTop);

export const PageNav: React.FC<{
	tabItems: RouteMapItem;
	scrollbarRef: React.RefObject<Scrollbar | null>;
}> = ({ tabItems, scrollbarRef }) => {
	const { token } = theme.useToken();

	const [activeKey, setActiveKey] = useState<string | undefined>(
		tabItems.items?.[0]?.key,
	);

	const tabItemsKey = useMemo(
		() => (tabItems.items ?? []).map((item) => item.key).join("|"),
		[tabItems.items],
	);

	const scrollToKey = useCallback(
		(key: string) => {
			const target = document.getElementById(key);
			const scrollbar = scrollbarRef.current;
			const scrollerElement = scrollbar?.scrollerElement;
			if (!target || !scrollbar) {
				return false;
			}

			const scrollState = scrollbar.getScrollState(true);
			const maxScrollTop = Math.max(
				0,
				scrollState.contentScrollHeight - scrollState.clientHeight,
			);
			const targetScrollTop = scrollerElement
				? scrollState.scrollTop +
					target.getBoundingClientRect().top -
					scrollerElement.getBoundingClientRect().top
				: target.offsetTop;
			const nextScrollTop = clampScrollTop(targetScrollTop, maxScrollTop);

			if (scrollerElement) {
				scrollerElement.scrollTo({
					top: nextScrollTop,
					behavior: "smooth",
				});
			} else {
				scrollbar.scrollTop = nextScrollTop;
			}

			return true;
		},
		[scrollbarRef],
	);

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
	}, [tabItems.items]);

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
