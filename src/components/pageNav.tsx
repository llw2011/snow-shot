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
							title={typeof item.label === "string" ? item.label : undefined}
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
									const nextButton = buttonRefs.current.get(
										itemKeys[nextIndex],
									);
									nextButton?.focus();
									nextButton?.scrollIntoView({
										block: "nearest",
										inline: "nearest",
										behavior: prefersReducedMotion() ? "auto" : "smooth",
									});
								}
							}}
						>
							{item.label}
						</button>
					);
				})}
			</div>

			<style jsx global>{`
				.page-nav {
					position: relative;
					z-index: 2;
					display: flex;
					flex: 0 0 176px;
					min-width: 0;
					min-height: 0;
					padding: 18px 10px;
					border-inline-end: 1px solid var(--snow-shot-hairline);
					background: var(--snow-shot-surface);
				}

				.page-nav-track {
					display: flex;
					flex: 1 1 auto;
					flex-direction: column;
					gap: 3px;
					min-width: 0;
					min-height: 0;
					overflow-x: hidden;
					overflow-y: auto;
					scroll-padding-block: 2px;
					scrollbar-width: thin;
					-webkit-overflow-scrolling: touch;
				}

				.page-nav-track::-webkit-scrollbar {
					width: 4px;
				}

				.page-nav-track::-webkit-scrollbar-thumb {
					background: var(--snow-shot-hairline);
				}

				.page-nav-item {
					position: relative;
					display: block;
					width: 100%;
					min-height: 38px;
					padding: 8px 10px 8px 12px;
					border: 1px solid transparent;
					border-radius: var(--snow-shot-radius-sm);
					background: transparent;
					color: var(--snow-shot-muted);
					font: inherit;
					font-size: 14px;
					font-weight: 500;
					line-height: 20px;
					text-align: left;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					cursor: pointer;
					transition:
						background-color 140ms ease,
						border-color 140ms ease,
						color 140ms ease,
						transform 140ms ease;
				}

				.page-nav-item:hover {
					background: var(--snow-shot-surface-elevated);
					border-color: var(--snow-shot-hairline-soft);
					color: var(--snow-shot-ink);
				}

				.page-nav-item.is-active {
					border-color: var(--snow-shot-hairline-strong);
					background: var(--snow-shot-surface-elevated);
					color: var(--snow-shot-ink);
					font-weight: 600;
				}

				.page-nav-item.is-active::before {
					content: "";
					position: absolute;
					inset-block: 7px;
					inset-inline-start: -1px;
					width: 2px;
					border-radius: 1px;
					background: var(--snow-shot-primary);
				}

				.page-nav-item:active {
					transform: translateY(1px);
				}

				.page-nav-item:focus-visible {
					outline: 2px solid var(--snow-shot-primary);
					outline-offset: -2px;
				}

				@media (max-width: 800px) {
					.page-nav {
						flex-basis: 152px;
						padding-inline: 8px;
					}

					.page-nav-item {
						padding-inline: 10px;
					}
				}
			`}</style>
		</nav>
	);
};
