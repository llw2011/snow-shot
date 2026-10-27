import { Link, useLocation } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { ShortcutKeycap } from "@/components/shortcutEditor";
import { useWorkbench, type WorkbenchFilter } from "./context";
import { WorkbenchIcon } from "./icons";
import {
	getWorkbenchItemIdByPath,
	useVisibleWorkbenchItems,
	WORKBENCH_SECTIONS,
	type WorkbenchItem,
} from "./registry";
import { useWorkbenchSearch } from "./search";

const FILTERS: WorkbenchFilter[] = ["all", "functions", "settings"];

const matchesFilter = (item: WorkbenchItem, filter: WorkbenchFilter) =>
	filter === "all" ||
	(filter === "settings" ? item.kind === "settings" : item.kind !== "settings");

export const getItemLink = (item: WorkbenchItem) =>
	item.to
		? ({ to: item.to } as const)
		: ({ to: "/w/$itemId", params: { itemId: item.id } } as const);

const NavigatorItem: React.FC<{
	item: WorkbenchItem;
	active: boolean;
	highlighted: boolean;
	match?: string;
	onNavigate: () => void;
}> = ({ item, active, highlighted, match, onNavigate }) => {
	const ref = useRef<HTMLAnchorElement>(null);

	useEffect(() => {
		if (highlighted) {
			ref.current?.scrollIntoView({ block: "nearest" });
		}
	}, [highlighted]);

	const showSubtitle = Boolean(match) || item.kind !== "action";

	return (
		<Link
			{...getItemLink(item)}
			ref={ref}
			className={`wb-nav-item${active ? " is-active" : ""}${highlighted ? " is-highlighted" : ""}`}
			aria-current={active ? "page" : undefined}
			onClick={onNavigate}
		>
			<WorkbenchIcon name={item.icon} />
			<span className="wb-nav-item-copy">
				<span className="wb-nav-item-title">
					<FormattedMessage id={item.titleId} />
				</span>
				{showSubtitle && (
					<span className="wb-nav-item-sub">
						{match ? (
							<mark>{match}</mark>
						) : (
							<FormattedMessage id={item.descriptionId} />
						)}
					</span>
				)}
			</span>
			<span className="wb-nav-item-trail">
				{item.appFunction ? (
					<ShortcutKeycap appFunction={item.appFunction} />
				) : (
					<WorkbenchIcon name="chevronRight" size={14} />
				)}
			</span>
		</Link>
	);
};

/** The left column: every action, tool and settings page, filterable and searchable. */
export const Navigator: React.FC = () => {
	const intl = useIntl();
	const location = useLocation();
	const activeId = getWorkbenchItemIdByPath(location.pathname);
	const {
		query,
		filter,
		setFilter,
		highlightedId,
		setHighlightedId,
		setNavOpen,
	} = useWorkbench();
	const items = useVisibleWorkbenchItems();
	const filteredItems = useMemo(
		() => items.filter((item) => matchesFilter(item, filter)),
		[filter, items],
	);
	const results = useWorkbenchSearch(filteredItems, query);

	// Keep the keyboard highlight on the first result while typing.
	useEffect(() => {
		if (!results) {
			setHighlightedId(undefined);
			return;
		}
		if (!results.some((result) => result.item.id === highlightedId)) {
			setHighlightedId(results[0]?.item.id);
		}
	}, [highlightedId, results, setHighlightedId]);

	const groups = useMemo(() => {
		if (results) {
			return WORKBENCH_SECTIONS.map((section) => ({
				section,
				entries: results.filter((result) => result.item.section === section),
			})).filter((group) => group.entries.length > 0);
		}

		return WORKBENCH_SECTIONS.map((section) => ({
			section,
			entries: filteredItems
				.filter((item) => item.section === section)
				.map((item) => ({ item, match: undefined as string | undefined })),
		})).filter((group) => group.entries.length > 0);
	}, [filteredItems, results]);

	return (
		<nav
			className="wb-nav"
			aria-label={intl.formatMessage({ id: "workbench.navigator" })}
		>
			<div className="wb-nav-filters" role="toolbar">
				{FILTERS.map((value) => (
					<button
						key={value}
						type="button"
						className={`wb-filter${filter === value ? " is-on" : ""}`}
						aria-pressed={filter === value}
						onClick={() => setFilter(value)}
					>
						<FormattedMessage id={`workbench.filter.${value}`} />
					</button>
				))}
			</div>
			<div className="wb-nav-scroll snow-scroll">
				{groups.length === 0 && (
					<div className="wb-nav-empty">
						<FormattedMessage id="workbench.search.empty" values={{ query }} />
					</div>
				)}
				{groups.map(({ section, entries }) => (
					<section
						key={section}
						aria-label={intl.formatMessage({
							id: `workbench.section.${section}`,
						})}
					>
						<div className="wb-nav-group-title">
							<FormattedMessage id={`workbench.section.${section}`} />
						</div>
						{entries.map(({ item, match }) => (
							<NavigatorItem
								key={item.id}
								item={item}
								active={item.id === activeId}
								highlighted={item.id === highlightedId}
								match={match}
								onNavigate={() => setNavOpen(false)}
							/>
						))}
					</section>
				))}
			</div>
		</nav>
	);
};

/** Flat, ordered list of what the navigator currently shows (for keyboard search). */
export const useNavigatorResults = () => {
	const { query, filter } = useWorkbench();
	const items = useVisibleWorkbenchItems();
	const filteredItems = useMemo(
		() => items.filter((item) => matchesFilter(item, filter)),
		[filter, items],
	);
	const results = useWorkbenchSearch(filteredItems, query);
	return useMemo(() => {
		if (!results) {
			return [];
		}
		// Same order as rendered: grouped by section, sorted by score inside.
		return WORKBENCH_SECTIONS.flatMap((section) =>
			results.filter((result) => result.item.section === section),
		).map((result) => result.item);
	}, [results]);
};
