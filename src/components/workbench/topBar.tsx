import { useRouter } from "@tanstack/react-router";
import {
	type Window as AppWindow,
	getCurrentWindow,
} from "@tauri-apps/api/window";
import * as tauriOs from "@tauri-apps/plugin-os";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useIntl } from "react-intl";
import { MainWindowSizeControl } from "@/components/mainWindowSizeControl";
import { useWorkbench } from "./context";
import { WorkbenchIcon } from "./icons";
import { getItemLink, useNavigatorResults } from "./navigator";

/** Brand, global search and native window controls. The bar is the drag handle. */
export const TopBar: React.FC = () => {
	const intl = useIntl();
	const router = useRouter();
	const {
		query,
		setQuery,
		navOpen,
		setNavOpen,
		highlightedId,
		setHighlightedId,
		searchInputRef,
	} = useWorkbench();
	const results = useNavigatorResults();

	const appWindowRef = useRef<AppWindow | undefined>(undefined);
	const [platform, setPlatform] = useState<tauriOs.Platform>();
	useEffect(() => {
		appWindowRef.current = getCurrentWindow();
		setPlatform(tauriOs.platform());
	}, []);

	useHotkeys(
		"mod+k",
		(event) => {
			event.preventDefault();
			searchInputRef.current?.focus();
			searchInputRef.current?.select();
		},
		{ enableOnFormTags: true, enableOnContentEditable: true },
	);

	const moveHighlight = (step: number) => {
		if (results.length === 0) {
			return;
		}
		const index = results.findIndex((item) => item.id === highlightedId);
		const next = (index + step + results.length) % results.length;
		setHighlightedId(results[next].id);
	};

	const openHighlighted = () => {
		const item =
			results.find((result) => result.id === highlightedId) ?? results[0];
		if (!item) {
			return;
		}
		router.navigate(getItemLink(item));
		setQuery("");
		setNavOpen(false);
		searchInputRef.current?.blur();
	};

	const isMacos = platform === "macos";
	const searchLabel = intl.formatMessage({
		id: "workbench.search.placeholder",
	});

	return (
		<header
			className={`wb-top${isMacos ? " is-macos" : ""}`}
			data-tauri-drag-region
		>
			<div className="wb-brand" data-tauri-drag-region>
				<button
					type="button"
					className="wb-icon-button wb-menu-button"
					aria-label={intl.formatMessage({ id: "workbench.navigator" })}
					aria-expanded={navOpen}
					onClick={() => setNavOpen(!navOpen)}
				>
					<WorkbenchIcon name="menu" />
				</button>
				<span className="wb-mark" aria-hidden="true" data-tauri-drag-region />
				<span className="wb-brand-name" data-tauri-drag-region>
					Snow Shot
				</span>
			</div>

			<label className="wb-search">
				<WorkbenchIcon name="search" />
				<input
					ref={searchInputRef}
					value={query}
					placeholder={searchLabel}
					aria-label={searchLabel}
					spellCheck={false}
					onChange={(event) => {
						setQuery(event.target.value);
						setNavOpen(true);
					}}
					onFocus={() => {
						if (query) {
							setNavOpen(true);
						}
					}}
					onKeyDown={(event) => {
						switch (event.key) {
							case "ArrowDown":
								event.preventDefault();
								moveHighlight(1);
								break;
							case "ArrowUp":
								event.preventDefault();
								moveHighlight(-1);
								break;
							case "Enter":
								event.preventDefault();
								openHighlighted();
								break;
							case "Escape":
								event.preventDefault();
								if (query) {
									setQuery("");
								} else {
									event.currentTarget.blur();
									setNavOpen(false);
								}
								break;
						}
					}}
				/>
				{query ? (
					<button
						type="button"
						className="wb-search-clear"
						aria-label={intl.formatMessage({ id: "workbench.search.clear" })}
						onClick={() => {
							setQuery("");
							searchInputRef.current?.focus();
						}}
					>
						<WorkbenchIcon name="close" size={14} />
					</button>
				) : (
					<kbd className="snow-kbd">{isMacos ? "⌘ K" : "Ctrl K"}</kbd>
				)}
			</label>

			<div className="wb-drag" data-tauri-drag-region />

			<div className="wb-window-actions">
				<MainWindowSizeControl />
				{!isMacos && (
					<>
						<button
							type="button"
							className="wb-icon-button"
							aria-label={intl.formatMessage({
								id: "workbench.window.minimize",
							})}
							title={intl.formatMessage({ id: "workbench.window.minimize" })}
							onClick={() => appWindowRef.current?.minimize()}
						>
							<WorkbenchIcon name="minus" />
						</button>
						<button
							type="button"
							className="wb-icon-button is-close"
							aria-label={intl.formatMessage({ id: "workbench.window.hide" })}
							title={intl.formatMessage({ id: "workbench.window.hide" })}
							onClick={() => {
								appWindowRef.current?.hide();
								appWindowRef.current?.emit("on-hide-main-window");
							}}
						>
							<WorkbenchIcon name="close" />
						</button>
					</>
				)}
			</div>
		</header>
	);
};
