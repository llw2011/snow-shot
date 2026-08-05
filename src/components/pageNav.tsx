import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Scrollbar } from "react-scrollbars-custom";
import { revealSettingsSection } from "@/components/settingsSection";
import type { RouteMapItem } from "@/types/components/menuLayout";

const clampScrollTop = (value: number, maxScrollTop: number) =>
	Math.min(Math.max(value, 0), maxScrollTop);

const prefersReducedMotion = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const PageNav: React.FC<{
	tabItems: RouteMapItem;
	scrollbarRef: React.RefObject<Scrollbar | null>;
}> = ({ tabItems, scrollbarRef }) => {
	const [activeKey, setActiveKey] = useState<string | undefined>(
		tabItems.items?.[0]?.key?.toString(),
	);
	const buttonRefs = useRef(new Map<string, HTMLButtonElement>());

	const itemKeys = useMemo(
		() => (tabItems.items ?? []).map((item) => item.key.toString()),
		[tabItems.items],
	);
	const scrollToKey = useCallback(
		(key: string) => {
			revealSettingsSection(key);
			if (!document.getElementById(key) || !scrollbarRef.current) {
				return false;
			}

			window.requestAnimationFrame(() => {
				const target = document.getElementById(key);
				const scrollbar = scrollbarRef.current;
				const scrollerElement = scrollbar?.scrollerElement;
				if (!target || !scrollbar) {
					return;
				}

				const scrollState = scrollbar.getScrollState(true);
				const maxScrollTop = Math.max(
					0,
					scrollState.contentScrollHeight - scrollState.clientHeight,
				);
				const targetScrollTop = scrollerElement
					? scrollState.scrollTop +
						target.getBoundingClientRect().top -
						scrollerElement.getBoundingClientRect().top -
						8
					: target.offsetTop;
				const nextScrollTop = clampScrollTop(targetScrollTop, maxScrollTop);

				if (scrollerElement) {
					scrollerElement.scrollTo({
						top: nextScrollTop,
						behavior: prefersReducedMotion() ? "auto" : "smooth",
					});
				} else {
					scrollbar.scrollTop = nextScrollTop;
				}
			});

			return true;
		},
		[scrollbarRef],
	);

	useEffect(() => {
		const firstTabKey = itemKeys[0];
		if (!firstTabKey) {
			setActiveKey(undefined);
			return;
		}

		setActiveKey((prevKey) =>
			prevKey && itemKeys.includes(prevKey) ? prevKey : firstTabKey,
		);
	}, [itemKeys]);

	useEffect(() => {
		const scrollerElement = scrollbarRef.current?.scrollerElement;
		if (!scrollerElement || itemKeys.length === 0) {
			return;
		}

		const targets = itemKeys
			.map((key) => document.getElementById(key))
			.filter((target): target is HTMLElement => target !== null);
		if (targets.length === 0) {
			return;
		}

		const updateActiveKey = () => {
			const rootTop = scrollerElement.getBoundingClientRect().top + 8;
			const activeTarget =
				targets.find(
					(target) => target.getBoundingClientRect().bottom > rootTop,
				) ?? targets[targets.length - 1];
			if (activeTarget?.id) {
				setActiveKey(activeTarget.id);
			}
		};

		const observer = new IntersectionObserver(updateActiveKey, {
			root: scrollerElement,
			rootMargin: "-8px 0px -72% 0px",
			threshold: [0, 1],
		});

		for (const target of targets) {
			observer.observe(target);
		}
		scrollerElement.addEventListener("scroll", updateActiveKey, {
			passive: true,
		});
		updateActiveKey();
		return () => {
			observer.disconnect();
			scrollerElement.removeEventListener("scroll", updateActiveKey);
		};
	}, [itemKeys, scrollbarRef]);

	if (tabItems.hideTabs || itemKeys.length === 0) {
		return null;
	}

	return (
		<nav className="page-nav" aria-label="Page sections">
			<div className="page-nav-track">
				{(tabItems.items ?? []).map((item, index) => {
					const key = item.key.toString();
					const selected = activeKey === key;
					return (
						<button
							type="button"
							className={`page-nav-item${selected ? " is-active" : ""}`}
							key={key}
							aria-current={selected ? "location" : undefined}
							ref={(element) => {
								if (element) {
									buttonRefs.current.set(key, element);
								} else {
									buttonRefs.current.delete(key);
								}
							}}
							onClick={() => {
								if (scrollToKey(key)) {
									setActiveKey(key);
								}
							}}
							onKeyDown={(event) => {
								let nextIndex: number | undefined;
								if (event.key === "ArrowRight") {
									nextIndex = (index + 1) % itemKeys.length;
								} else if (event.key === "ArrowLeft") {
									nextIndex = (index - 1 + itemKeys.length) % itemKeys.length;
								} else if (event.key === "Home") {
									nextIndex = 0;
								} else if (event.key === "End") {
									nextIndex = itemKeys.length - 1;
								}

								if (nextIndex !== undefined) {
									event.preventDefault();
									buttonRefs.current.get(itemKeys[nextIndex])?.focus();
								}
							}}
						>
							{item.label}
						</button>
					);
				})}
			</div>

			<style jsx>{`
				.page-nav {
					position: relative;
					z-index: 2;
					flex: 0 0 auto;
					padding: 8px 14px 7px;
					border-bottom: 1px solid var(--snow-shot-hairline-soft);
					background: color-mix(
						in srgb,
						var(--snow-shot-panel-bg) 94%,
						transparent
					);
					backdrop-filter: var(--snow-shot-backdrop-filter);
				}

				.page-nav-track {
					display: flex;
					gap: 4px;
					overflow-x: auto;
					overflow-y: hidden;
					scrollbar-width: none;
				}

				.page-nav-track::-webkit-scrollbar {
					display: none;
				}

				.page-nav-item {
					flex: 0 0 auto;
					min-height: 30px;
					padding: 5px 10px;
					border: 0;
					border-radius: var(--snow-shot-radius-sm);
					background: transparent;
					color: var(--snow-shot-muted);
					font: inherit;
					font-size: 13px;
					font-weight: 500;
					line-height: 20px;
					white-space: nowrap;
					cursor: pointer;
				}

				.page-nav-item:hover {
					background: var(--snow-shot-surface-elevated);
					color: var(--snow-shot-ink);
				}

				.page-nav-item.is-active {
					background: var(--snow-shot-primary-soft);
					color: var(--snow-shot-ink);
				}

				.page-nav-item:focus-visible {
					outline: 2px solid var(--snow-shot-primary);
					outline-offset: -2px;
				}
			`}</style>
		</nav>
	);
};
