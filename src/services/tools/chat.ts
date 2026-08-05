import { appFetch } from ".";

export interface ChatModel {
	model: string;
	name: string;
	thinking: boolean;
	support_vision: boolean;
}

export type OpenAiCompatibleModelProbeResult = {
	models: string[];
	checkedUrls: string[];
	errorMessage?: string;
};

const normalizeBaseUrl = (apiUri: string) => {
	const trimmedApiUri = apiUri.trim();
	return trimmedApiUri.endsWith("/") ? trimmedApiUri : `${trimmedApiUri}/`;
};

const getModelProbeUrls = (apiUri: string) => {
	const normalizedBaseUrl = normalizeBaseUrl(apiUri);
	const primaryUrl = new URL("models", normalizedBaseUrl).toString();
	const parsedBaseUrl = new URL(normalizedBaseUrl);
	const rootUrl = `${parsedBaseUrl.protocol}//${parsedBaseUrl.host}/`;
	const v1Url = new URL("v1/models", rootUrl).toString();

	return Array.from(new Set([primaryUrl, v1Url]));
};

const appendStringValue = (models: Set<string>, value: unknown) => {
	if (typeof value === "string" && value.trim()) {
		models.add(value.trim());
	}
};

const appendModelEntry = (models: Set<string>, entry: unknown) => {
	if (!entry || typeof entry !== "object") {
		return;
	}

	const modelEntry = entry as Record<string, unknown>;
	appendStringValue(models, modelEntry.id);
	appendStringValue(models, modelEntry.model);
	appendStringValue(models, modelEntry.name);

	if (Array.isArray(modelEntry.aliases)) {
		modelEntry.aliases.forEach((alias) => {
			appendStringValue(models, alias);
		});
	}
};

const extractModelNames = (payload: unknown) => {
	const models = new Set<string>();

	if (!payload || typeof payload !== "object") {
		return [];
	}

	const payloadObject = payload as Record<string, unknown>;
	if (Array.isArray(payloadObject.data)) {
		payloadObject.data.forEach((entry) => {
			appendModelEntry(models, entry);
		});
	}

	if (Array.isArray(payloadObject.models)) {
		payloadObject.models.forEach((entry) => {
			appendModelEntry(models, entry);
		});
	}

	return Array.from(models).sort((a, b) => a.localeCompare(b));
};

export const probeOpenAiCompatibleModels = async (
	apiUri: string,
	apiKey: string,
): Promise<OpenAiCompatibleModelProbeResult> => {
	const checkedUrls = getModelProbeUrls(apiUri);
	let lastErrorMessage: string | undefined;

	for (const url of checkedUrls) {
		try {
			const headers: Record<string, string> = {};
			if (apiKey.trim()) {
				headers.Authorization = `Bearer ${apiKey}`;
			}

			const response = await appFetch(url, {
				method: "GET",
				headers,
			});

			if (response.status !== 200) {
				lastErrorMessage = `${url} returned HTTP ${response.status}`;
				continue;
			}

			const models = extractModelNames(await response.json());
			if (models.length > 0) {
				return {
					models,
					checkedUrls,
				};
			}

			lastErrorMessage = `${url} returned an empty model list`;
		} catch (error) {
			lastErrorMessage =
				error instanceof Error ? error.message : `Unknown error: ${error}`;
		}
	}

	return {
		models: [],
		checkedUrls,
		errorMessage: lastErrorMessage,
	};
};
