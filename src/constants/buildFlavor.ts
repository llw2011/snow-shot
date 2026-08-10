import {
	type ChatApiConfig,
	type TranslationApiConfig,
	TranslationApiType,
} from "@/types/appSettings";
import type { PluginFileSource } from "@/types/components/pluginService";

type JsonObject = Record<string, unknown>;

const asNonEmptyString = (value: unknown) =>
	typeof value === "string" && value.trim() ? value.trim() : undefined;

const asBoolean = (value: unknown, fallback = false) =>
	typeof value === "boolean" ? value : fallback;

const asHttpUrl = (value: unknown) => {
	const rawUrl = asNonEmptyString(value);
	if (!rawUrl) {
		return undefined;
	}

	try {
		const url = new URL(rawUrl);
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			return undefined;
		}
		return url.toString();
	} catch {
		return undefined;
	}
};

const parseJsonObject = (value: string | undefined) => {
	if (!value?.trim()) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(value) as unknown;
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as JsonObject)
			: undefined;
	} catch {
		return undefined;
	}
};

const parseChatApiConfig = (
	value: string | undefined,
): ChatApiConfig | undefined => {
	const config = parseJsonObject(value);
	const apiUri = asHttpUrl(config?.api_uri);
	const apiModel = asNonEmptyString(config?.api_model);
	if (!config || !apiUri || !apiModel) {
		return undefined;
	}

	return {
		api_uri: apiUri,
		api_key: asNonEmptyString(config.api_key) ?? "",
		api_model: apiModel,
		model_name: asNonEmptyString(config.model_name) ?? apiModel,
		support_thinking: asBoolean(config.support_thinking),
		support_vision: asBoolean(config.support_vision),
	};
};

const parseTranslationApiConfig = (
	value: string | undefined,
): TranslationApiConfig | undefined => {
	const config = parseJsonObject(value);
	const apiUri = asHttpUrl(config?.api_uri);
	if (!config || !apiUri) {
		return undefined;
	}

	const apiType =
		config.api_type === TranslationApiType.DeepL
			? TranslationApiType.DeepL
			: TranslationApiType.OpenAiCompatible;
	const apiModel = asNonEmptyString(config.api_model);
	if (apiType === TranslationApiType.OpenAiCompatible && !apiModel) {
		return undefined;
	}

	return {
		api_type: apiType,
		api_uri: apiUri,
		api_key: asNonEmptyString(config.api_key) ?? "",
		api_model: apiModel,
		model_name: asNonEmptyString(config.model_name) ?? apiModel,
		deepl_prefer_quality_optimized: asBoolean(
			config.deepl_prefer_quality_optimized,
		),
	};
};

const parsePluginFileSources = (value: string | undefined) => {
	const config = parseJsonObject(value);
	if (!config) {
		return {};
	}

	return Object.entries(config).reduce<Record<string, PluginFileSource[]>>(
		(result, [pluginId, sources]) => {
			if (!pluginId.trim() || !Array.isArray(sources)) {
				return result;
			}

			result[pluginId] = sources.reduce<PluginFileSource[]>((items, source) => {
				if (!source || typeof source !== "object" || Array.isArray(source)) {
					return items;
				}

				const sourceConfig = source as JsonObject;
				const path = asNonEmptyString(sourceConfig.path);
				const url = asHttpUrl(sourceConfig.url);
				const sha256 = asNonEmptyString(sourceConfig.sha256)?.toLowerCase();
				const hasSafePath =
					!!path &&
					!path.startsWith("/") &&
					!path.startsWith("\\") &&
					!path.split(/[\\/]/).includes("..");
				if (!hasSafePath || !url || !sha256 || !/^[a-f\d]{64}$/.test(sha256)) {
					return items;
				}

				items.push({ path, url, sha256 });
				return items;
			}, []);
			return result;
		},
		{},
	);
};

/**
 * Build-time defaults are opt-in. PUBLIC_* values are bundled into the app,
 * so they must never contain credentials that are expected to remain secret.
 */
const isCustomBuild = import.meta.env.PUBLIC_BUILD_FLAVOR === "custom";
const readCustomBuildValue = (value: string | undefined) =>
	isCustomBuild ? value : undefined;

export const BUILD_DEFAULT_CHAT_API_CONFIG = parseChatApiConfig(
	readCustomBuildValue(import.meta.env.PUBLIC_DEFAULT_CHAT_API_CONFIG),
);

export const BUILD_DEFAULT_TRANSLATION_API_CONFIG = parseTranslationApiConfig(
	readCustomBuildValue(import.meta.env.PUBLIC_DEFAULT_TRANSLATION_API_CONFIG),
);

export const BUILD_DEFAULT_OCR_API_CONFIG = parseChatApiConfig(
	readCustomBuildValue(import.meta.env.PUBLIC_DEFAULT_OCR_API_CONFIG),
);

const BUILD_PLUGIN_FILE_SOURCES = parsePluginFileSources(
	readCustomBuildValue(import.meta.env.PUBLIC_PLUGIN_FILE_SOURCES),
);

export const getBuildPluginFileSources = (pluginId: string) =>
	pluginId in BUILD_PLUGIN_FILE_SOURCES
		? BUILD_PLUGIN_FILE_SOURCES[pluginId]
		: undefined;

export const BUILD_SERVICE_BASE_URL = asHttpUrl(
	readCustomBuildValue(import.meta.env.PUBLIC_SERVICE_BASE_URL),
);

const configuredProxyBypassHosts: string[] =
	isCustomBuild && typeof import.meta.env.PUBLIC_PROXY_BYPASS_HOSTS === "string"
		? import.meta.env.PUBLIC_PROXY_BYPASS_HOSTS.split(",")
				.map((host: string) => host.trim())
				.filter((host: string) => /^[\w.:[\]-]+$/.test(host))
		: [];

export const BUILD_PROXY_BYPASS_HOSTS = Array.from(
	new Set(["127.0.0.1", "localhost", "::1", ...configuredProxyBypassHosts]),
).join(",");

export const CUSTOM_MODEL_PREFIX = "snow_shot_custom_";
