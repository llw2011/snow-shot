import { useMemo } from "react";
import { useIntl } from "react-intl";
import type { WorkbenchItem } from "./registry";

export type WorkbenchSearchResult = {
	item: WorkbenchItem;
	score: number;
	/** The setting label that matched, shown under the item title. */
	match?: string;
};

type IndexedItem = {
	item: WorkbenchItem;
	title: string;
	description: string;
	texts: string[];
};

const cleanMessage = (value: string) =>
	value
		.replace(/\{[^{}]*\}/g, "")
		.replace(/\s+/g, " ")
		.trim();

/**
 * Searches item titles, descriptions and every settings label owned by an item
 * (through its message prefixes) in the current language.
 */
export const useWorkbenchSearch = (
	items: WorkbenchItem[],
	query: string,
): WorkbenchSearchResult[] | undefined => {
	const intl = useIntl();

	const index = useMemo((): IndexedItem[] => {
		const messageEntries = Object.entries(intl.messages).filter(
			(entry): entry is [string, string] => typeof entry[1] === "string",
		);

		return items.map((item) => {
			const texts = new Set<string>();
			for (const prefix of item.searchPrefixes ?? []) {
				for (const [id, value] of messageEntries) {
					if (id.startsWith(prefix) && !id.endsWith(".tip")) {
						const text = cleanMessage(value);
						if (text && text.length <= 40) {
							texts.add(text);
						}
					}
				}
			}

			return {
				item,
				title: intl.formatMessage({ id: item.titleId }),
				description: intl.formatMessage({ id: item.descriptionId }),
				texts: Array.from(texts),
			};
		});
	}, [intl, items]);

	return useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) {
			return undefined;
		}

		const results: WorkbenchSearchResult[] = [];
		for (const entry of index) {
			const title = entry.title.toLowerCase();
			if (title.startsWith(normalizedQuery)) {
				results.push({ item: entry.item, score: 120 });
				continue;
			}
			if (title.includes(normalizedQuery)) {
				results.push({ item: entry.item, score: 100 });
				continue;
			}
			if (entry.description.toLowerCase().includes(normalizedQuery)) {
				results.push({ item: entry.item, score: 50 });
				continue;
			}
			const match = entry.texts.find((text) =>
				text.toLowerCase().includes(normalizedQuery),
			);
			if (match) {
				results.push({
					item: entry.item,
					score: entry.item.kind === "settings" ? 30 : 25,
					match,
				});
			}
		}

		return results.sort((a, b) => b.score - a.score);
	}, [index, query]);
};
