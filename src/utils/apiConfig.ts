import type { ChatApiConfig, TranslationApiConfig } from "../types/appSettings";

const TRANSLATION_API_OPENAI_COMPATIBLE = "translation_api_openai_compatible";
const TRANSLATION_API_DEEPL = "translation_api_deepl";

/**
 * A draft may be stored while its fields are being edited. Runtime callers
 * should only expose configurations that can actually create a request.
 */
export const isUsableChatApiConfig = (
	config: Pick<ChatApiConfig, "api_uri" | "api_model"> | undefined,
) => Boolean(config?.api_uri.trim() && config.api_model.trim());

export const isUsableTranslationApiConfig = (
	config:
		| Pick<TranslationApiConfig, "api_type" | "api_uri" | "api_model">
		| undefined,
) => {
	if (!config?.api_uri.trim()) {
		return false;
	}

	if (config.api_type === TRANSLATION_API_DEEPL) {
		return true;
	}

	return (
		config.api_type === TRANSLATION_API_OPENAI_COMPATIBLE &&
		Boolean(config.api_model?.trim())
	);
};
