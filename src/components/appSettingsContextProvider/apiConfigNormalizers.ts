import { CUSTOM_MODEL_PREFIX } from "@/constants/buildFlavor";
import {
	type ChatApiConfig,
	type TranslationApiConfig,
	TranslationApiType,
} from "@/types/appSettings";
import {
	isUsableChatApiConfig,
	isUsableTranslationApiConfig,
} from "@/utils/apiConfig";

const normalizeCustomModelValue = (model: unknown) => {
	const modelName = `${model ?? ""}`;
	return modelName.startsWith(CUSTOM_MODEL_PREFIX)
		? modelName.slice(CUSTOM_MODEL_PREFIX.length)
		: modelName;
};

const getCustomModelType = (apiModel: unknown) =>
	`${CUSTOM_MODEL_PREFIX}${normalizeCustomModelValue(apiModel)}`;

export const normalizeChatApiConfig = (
	config: Partial<ChatApiConfig> | undefined,
	fallback?: ChatApiConfig,
): ChatApiConfig => ({
	api_uri: `${config?.api_uri ?? fallback?.api_uri ?? ""}`,
	api_key: `${config?.api_key ?? fallback?.api_key ?? ""}`,
	api_model: normalizeCustomModelValue(
		config?.api_model ?? fallback?.api_model,
	),
	model_name: `${config?.model_name ?? fallback?.model_name ?? ""}`,
	support_thinking:
		typeof config?.support_thinking === "boolean"
			? config.support_thinking
			: (fallback?.support_thinking ?? false),
	support_vision:
		typeof config?.support_vision === "boolean"
			? config.support_vision
			: (fallback?.support_vision ?? false),
});

export const normalizeTranslationApiConfig = (
	config: Partial<TranslationApiConfig> | undefined,
	fallback?: TranslationApiConfig,
): TranslationApiConfig | undefined => {
	const apiModel = normalizeCustomModelValue(
		config?.api_model ?? fallback?.api_model,
	);
	const modelName = `${config?.model_name ?? fallback?.model_name ?? ""}`;
	const deeplPreferQualityOptimized =
		typeof config?.deepl_prefer_quality_optimized === "boolean"
			? config.deepl_prefer_quality_optimized
			: (fallback?.deepl_prefer_quality_optimized ?? false);

	const apiType = config?.api_type ?? TranslationApiType.OpenAiCompatible;
	if (
		apiType !== TranslationApiType.DeepL &&
		apiType !== TranslationApiType.OpenAiCompatible
	) {
		return undefined;
	}

	return {
		api_type: apiType,
		api_uri: `${config?.api_uri ?? fallback?.api_uri ?? ""}`,
		api_key: `${config?.api_key ?? fallback?.api_key ?? ""}`,
		api_model: apiModel,
		model_name: modelName,
		deepl_prefer_quality_optimized: deeplPreferQualityOptimized,
		support_thinking:
			typeof config?.support_thinking === "boolean"
				? config.support_thinking
				: (fallback?.support_thinking ?? false),
	};
};

const getTranslationApiConfigType = (config: TranslationApiConfig) =>
	config.api_type === TranslationApiType.OpenAiCompatible
		? getCustomModelType(config.api_model)
		: config.api_type;

const getFallbackTranslationType = (configList: TranslationApiConfig[]) => {
	const openAiConfig = configList.find(
		(config) =>
			isUsableTranslationApiConfig(config) &&
			config.api_type === TranslationApiType.OpenAiCompatible &&
			!!normalizeCustomModelValue(config.api_model),
	);
	if (openAiConfig?.api_model) {
		return getCustomModelType(openAiConfig.api_model);
	}

	if (
		configList.some(
			(config) =>
				isUsableTranslationApiConfig(config) &&
				config.api_type === TranslationApiType.DeepL,
		)
	) {
		return TranslationApiType.DeepL;
	}

	return "";
};

const getFallbackChatModel = (configList: ChatApiConfig[]) => {
	const openAiConfig = configList.find(
		(config) =>
			isUsableChatApiConfig(config) &&
			!!normalizeCustomModelValue(config.api_model),
	);
	if (openAiConfig?.api_model) {
		return getCustomModelType(openAiConfig.api_model);
	}

	return "";
};

export const normalizeChatModel = (
	chatModel: unknown,
	configList: ChatApiConfig[],
) => {
	const fallbackChatModel = getFallbackChatModel(configList);
	if (
		typeof chatModel === "string" &&
		configList.some(
			(config) =>
				isUsableChatApiConfig(config) &&
				getCustomModelType(config.api_model) === chatModel,
		)
	) {
		return chatModel;
	}

	return fallbackChatModel;
};

export const normalizeTranslationType = (
	translationType: unknown,
	configList: TranslationApiConfig[],
) => {
	const fallbackTranslationType = getFallbackTranslationType(configList);
	if (
		typeof translationType === "string" &&
		configList.some(
			(config) =>
				isUsableTranslationApiConfig(config) &&
				getTranslationApiConfigType(config) === translationType,
		)
	) {
		return translationType;
	}

	return fallbackTranslationType;
};
