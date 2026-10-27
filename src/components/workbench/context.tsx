import type React from "react";
import { createContext, useContext, useMemo, useRef, useState } from "react";

export type WorkbenchFilter = "all" | "functions" | "settings";

type WorkbenchContextValue = {
	query: string;
	setQuery: (query: string) => void;
	filter: WorkbenchFilter;
	setFilter: (filter: WorkbenchFilter) => void;
	/** Drawer state of the navigator in compact windows. */
	navOpen: boolean;
	setNavOpen: (open: boolean) => void;
	/** Item highlighted by the keyboard while searching. */
	highlightedId: string | undefined;
	setHighlightedId: (id: string | undefined) => void;
	searchInputRef: React.RefObject<HTMLInputElement | null>;
};

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

export const WorkbenchProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<WorkbenchFilter>("all");
	const [navOpen, setNavOpen] = useState(false);
	const [highlightedId, setHighlightedId] = useState<string>();
	const searchInputRef = useRef<HTMLInputElement | null>(null);

	const value = useMemo(
		() => ({
			query,
			setQuery,
			filter,
			setFilter,
			navOpen,
			setNavOpen,
			highlightedId,
			setHighlightedId,
			searchInputRef,
		}),
		[query, filter, navOpen, highlightedId],
	);

	return (
		<WorkbenchContext.Provider value={value}>
			{children}
		</WorkbenchContext.Provider>
	);
};

export const useWorkbench = () => {
	const context = useContext(WorkbenchContext);
	if (!context) {
		throw new Error("useWorkbench must be used inside WorkbenchProvider");
	}
	return context;
};
