export type TranslationResultItem = {
	content: string;
};

export type StructuredTranslationInputItem = {
	id: number;
	text: string;
};

export const buildStructuredTranslationInput = (sourceContent: string[]) =>
	sourceContent.map(
		(text, id): StructuredTranslationInputItem => ({
			id,
			text,
		}),
	);

export const tryParseJson = (content: string): unknown => {
	const trimmedContent = content.trim();
	const fencedJsonMatch = trimmedContent.match(
		/^```(?:json)?\s*([\s\S]*?)\s*```$/i,
	);
	const candidate = fencedJsonMatch?.[1]?.trim() ?? trimmedContent;

	try {
		return JSON.parse(candidate);
	} catch {
		const startIndex = candidate.indexOf("[");
		const endIndex = candidate.lastIndexOf("]");
		if (startIndex < 0 || endIndex <= startIndex) {
			return undefined;
		}

		try {
			return JSON.parse(candidate.slice(startIndex, endIndex + 1));
		} catch {
			return undefined;
		}
	}
};

export const parseStructuredTranslationResult = (
	responseContent: string,
	sourceContentLength: number,
): TranslationResultItem[] | undefined => {
	const parsedContent = tryParseJson(responseContent);
	if (!Array.isArray(parsedContent)) {
		return undefined;
	}

	const translationsById = new Map<number, string>();
	for (const item of parsedContent) {
		if (!item || typeof item !== "object") {
			return undefined;
		}

		const typedItem = item as Record<string, unknown>;
		if (
			typeof typedItem.id !== "number" ||
			!Number.isInteger(typedItem.id) ||
			typedItem.id < 0 ||
			typedItem.id >= sourceContentLength ||
			typeof typedItem.translation !== "string" ||
			translationsById.has(typedItem.id)
		) {
			return undefined;
		}

		translationsById.set(typedItem.id, typedItem.translation);
	}

	if (translationsById.size !== sourceContentLength) {
		return undefined;
	}

	return Array.from({ length: sourceContentLength }, (_, id) => ({
		content: (translationsById.get(id) ?? "").trim(),
	}));
};
