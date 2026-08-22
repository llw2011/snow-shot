import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useIntl } from "react-intl";
import type { Scrollbar } from "react-scrollbars-custom";
import type { RouteMapItem } from "@/types/components/menuLayout";

export const REVEAL_SETTINGS_SECTION_EVENT =
	"snow-shot:reveal-settings-section";

export type RevealSettingsSectionDetail = {
	id: string;
};

export const getSettingsSectionPanelId = (sectionId: string) =>
	`${sectionId}-settings-panel`;

export const revealSettingsSection = (id: string) => {
	window.dispatchEvent(
		new CustomEvent<RevealSettingsSectionDetail>(
			REVEAL_SETTINGS_SECTION_EVENT,
			{
				detail: { id },
			},
		),
	);
};

type SettingsWorkspaceItem = {
	key: string;
	label: React.ReactNode;
	disabled: boolean;
};

type SettingsWorkspaceContextValue = {
	activeSectionId: string | undefined;
	selectSection: (sectionId: string) => boolean;
};

const SettingsWorkspaceContext =
	createContext<SettingsWorkspaceContextValue | null>(null);

export const useSettingsWorkspace = () => useContext(SettingsWorkspaceContext);

const prefersReducedMotion = () =>
	typeof window !== "undefined" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const getWorkspaceItems = (
	items: RouteMapItem["items"],
): SettingsWorkspaceItem[] => {
	return (items ?? []).flatMap((item) => {
		if (!item || item.key === undefined || item.key === null) {
			return [];
		}

		return [
			{
				key: item.key.toString(),
				label: item.label,
				disabled: Boolean(item.disabled),
			},
		];
	});
};

export const SettingsWorkspace: React.FC<{
	tabItems: RouteMapItem;
	scrollbarRef: React.RefObject<Scrollbar | null>;
	children: React.ReactNode;
}> = ({ tabItems, scrollbarRef, children }) => {
	const intl = useIntl();
	const workspaceItems = useMemo(
		() => getWorkspaceItems(tabItems.items),
		[tabItems.items],
	);
	const enabledItems = useMemo(
		() => workspaceItems.filter((item) => !item.disabled),
		[workspaceItems],
	);
	const hasSections = enabledItems.length > 0;
	const [activeSectionId, setActiveSectionId] = useState<string | undefined>(
		() => enabledItems[0]?.key,
	);
	const buttonRefs = useRef(new Map<string, HTMLButtonElement>());

	const scrollContentToTop = useCallback(() => {
		window.requestAnimationFrame(() => {
			const scrollbar = scrollbarRef.current;
			if (!scrollbar) {
				return;
			}

			if (scrollbar.scrollerElement) {
				scrollbar.scrollerElement.scrollTo({ top: 0, behavior: "auto" });
			} else {
				scrollbar.scrollTop = 0;
			}
		});
	}, [scrollbarRef]);

	const focusRailButton = useCallback((sectionId: string) => {
		const button = buttonRefs.current.get(sectionId);
		button?.focus();
		button?.scrollIntoView({
			block: "nearest",
			inline: "nearest",
			behavior: prefersReducedMotion() ? "auto" : "smooth",
		});
	}, []);

	const selectSection = useCallback(
		(sectionId: string) => {
			if (!enabledItems.some((item) => item.key === sectionId)) {
				return false;
			}

			const activeElement = document.activeElement;
			const currentPanel = activeSectionId
				? document.getElementById(getSettingsSectionPanelId(activeSectionId))
				: null;
			const focusMovesWithPanel = Boolean(
				activeElement && currentPanel?.contains(activeElement),
			);

			setActiveSectionId(sectionId);
			scrollContentToTop();

			if (focusMovesWithPanel) {
				window.requestAnimationFrame(() => {
					focusRailButton(sectionId);
				});
			}

			return true;
		},
		[activeSectionId, enabledItems, focusRailButton, scrollContentToTop],
	);

	useEffect(() => {
		const nextSectionId = enabledItems[0]?.key;
		if (!nextSectionId) {
			setActiveSectionId(undefined);
			return;
		}

		if (!enabledItems.some((item) => item.key === activeSectionId)) {
			selectSection(nextSectionId);
		}
	}, [activeSectionId, enabledItems, selectSection]);

	useEffect(() => {
		const reveal = (event: Event) => {
			const detail = (event as CustomEvent<RevealSettingsSectionDetail>).detail;
			if (detail?.id) {
				selectSection(detail.id);
			}
		};

		window.addEventListener(REVEAL_SETTINGS_SECTION_EVENT, reveal);
		return () => {
			window.removeEventListener(REVEAL_SETTINGS_SECTION_EVENT, reveal);
		};
	}, [selectSection]);

	const contextValue = useMemo<SettingsWorkspaceContextValue | null>(() => {
		if (!hasSections) {
			return null;
		}

		return {
			activeSectionId,
			selectSection,
		};
	}, [activeSectionId, hasSections, selectSection]);

	const handleRailKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
			let nextIndex: number | undefined;
			if (event.key === "ArrowDown") {
				nextIndex = (index + 1) % enabledItems.length;
			} else if (event.key === "ArrowUp") {
				nextIndex = (index - 1 + enabledItems.length) % enabledItems.length;
			} else if (event.key === "Home") {
				nextIndex = 0;
			} else if (event.key === "End") {
				nextIndex = enabledItems.length - 1;
			} else if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				selectSection(enabledItems[index].key);
				return;
			}

			if (nextIndex !== undefined) {
				event.preventDefault();
				focusRailButton(enabledItems[nextIndex].key);
			}
		},
		[enabledItems, focusRailButton, selectSection],
	);

	return (
		<SettingsWorkspaceContext.Provider value={contextValue}>
			<div className="settings-workspace">
				{hasSections && (
					<nav
						className="settings-workspace-rail"
						aria-label={intl.formatMessage({ id: "menu.settings" })}
					>
						<div className="settings-workspace-rail-list">
							{enabledItems.map((item, index) => {
								const selected = activeSectionId === item.key;
								return (
									<button
										type="button"
										className={`settings-workspace-rail-item${
											selected ? " is-active" : ""
										}`}
										key={item.key}
										aria-controls={getSettingsSectionPanelId(item.key)}
										aria-current={selected ? "page" : undefined}
										title={
											typeof item.label === "string" ? item.label : undefined
										}
										ref={(element) => {
											if (element) {
												buttonRefs.current.set(item.key, element);
											} else {
												buttonRefs.current.delete(item.key);
											}
										}}
										onClick={() => {
											selectSection(item.key);
										}}
										onKeyDown={(event) => {
											handleRailKeyDown(event, index);
										}}
									>
										{item.label}
									</button>
								);
							})}
						</div>
					</nav>
				)}

				<div className="settings-workspace-panel">
					{hasSections && (
						<label className="settings-workspace-compact-picker">
							<span>{intl.formatMessage({ id: "menu.settings" })}</span>
							<select
								value={activeSectionId ?? ""}
								onChange={(event) => {
									selectSection(event.target.value);
								}}
							>
								{enabledItems.map((item) => (
									<option key={item.key} value={item.key}>
										{item.label}
									</option>
								))}
							</select>
						</label>
					)}
					{children}
				</div>
			</div>

			<style jsx global>{`
				.settings-workspace {
					container-name: settings-workspace;
					container-type: inline-size;
					flex: 1 1 auto;
					display: grid;
					grid-template-columns: minmax(152px, 176px) minmax(0, 1fr);
					align-items: start;
					gap: 16px;
					width: 100%;
					min-width: 0;
					min-height: 0;
					height: 100%;
				}

				.settings-workspace-rail {
					position: sticky;
					top: 0;
					align-self: start;
					min-width: 0;
					padding: 8px;
					border: 1px solid var(--snow-shot-hairline-soft);
					border-radius: var(--snow-shot-radius-sm);
					background: var(--snow-shot-surface);
				}

				.settings-workspace-rail-list {
					display: flex;
					max-height: calc(100vh - 144px);
					flex-direction: column;
					gap: 4px;
					overflow-x: hidden;
					overflow-y: auto;
				}

				.settings-workspace-rail-item {
					position: relative;
					display: block;
					width: 100%;
					min-height: 38px;
					padding: 8px 10px 8px 12px;
					border: 1px solid transparent;
					border-inline-start-width: 2px;
					border-radius: var(--snow-shot-radius-sm);
					background: transparent;
					color: var(--snow-shot-muted);
					font: inherit;
					font-size: 14px;
					font-weight: 500;
					line-height: 20px;
					text-align: start;
					text-overflow: ellipsis;
					white-space: nowrap;
					overflow: hidden;
					cursor: pointer;
					transition:
						background-color var(--snow-shot-motion-fast) ease,
						border-color var(--snow-shot-motion-fast) ease,
						color var(--snow-shot-motion-fast) ease;
				}

				.settings-workspace-rail-item:hover {
					border-color: var(--snow-shot-hairline-soft);
					background: var(--snow-shot-surface-elevated);
					color: var(--snow-shot-ink);
				}

				.settings-workspace-rail-item.is-active {
					border-color: var(--snow-shot-hairline-strong);
					border-inline-start-color: var(--snow-shot-primary);
					background: var(--snow-shot-surface-elevated);
					color: var(--snow-shot-ink);
					font-weight: 600;
				}

				.settings-workspace-rail-item:focus-visible {
					z-index: 1;
					outline: 2px solid var(--snow-shot-primary);
					outline-offset: -2px;
				}

				.settings-workspace-panel {
					display: flex;
					min-height: 0;
					flex-direction: column;
					min-width: 0;
					height: 100%;
					padding: 18px 20px 32px;
					border: 1px solid var(--snow-shot-hairline-soft);
					border-radius: var(--snow-shot-radius-sm);
					background: var(--snow-shot-surface);
				}

				.settings-workspace-panel :global(.app-page-scrollbar) {
					flex: 1 1 auto;
					min-height: 0;
				}

				.settings-workspace-compact-picker {
					display: none;
				}

				@container snow-app-content (max-width: 880px) {
					.settings-workspace {
						display: block;
					}

					.settings-workspace-rail {
						display: none;
					}

					.settings-workspace-panel {
						padding: 16px;
					}

					.settings-workspace-compact-picker {
						display: grid;
						gap: 4px;
						margin-bottom: 12px;
						color: var(--snow-shot-muted);
						font-size: 14px;
						line-height: 20px;
					}

					.settings-workspace-compact-picker select {
						width: 100%;
						min-height: 40px;
						padding: 0 10px;
						border: 1px solid var(--snow-shot-hairline);
						border-radius: var(--snow-shot-radius-sm);
						background: var(--snow-shot-surface-elevated);
						color: var(--snow-shot-ink);
						font: inherit;
					}

					.settings-workspace-compact-picker select:focus-visible {
						outline: 2px solid var(--snow-shot-primary);
						outline-offset: 1px;
					}
				}

				@media (prefers-reduced-motion: reduce) {
					.settings-workspace-rail-item {
						transition: none;
					}
				}
			`}</style>
		</SettingsWorkspaceContext.Provider>
	);
};
