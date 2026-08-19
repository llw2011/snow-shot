import type {
	ChatApiConfig,
	TranslationApiConfig,
} from "../types/appSettings.js";
import {
	isUsableChatApiConfig,
	isUsableTranslationApiConfig,
} from "./apiConfig.js";

const assert = (condition: boolean, message: string) => {
	if (!condition) {
		throw new Error(message);
	}
};

const chatConfig = (api_uri: string, api_model: string) =>
	({ api_uri, api_model }) as Pick<ChatApiConfig, "api_uri" | "api_model">;

const translationConfig = (
	api_type: string,
	api_uri: string,
	api_model?: string,
) =>
	({ api_type, api_uri, api_model }) as Pick<
		TranslationApiConfig,
		"api_type" | "api_uri" | "api_model"
	>;

assert(
	!isUsableChatApiConfig(chatConfig("", "")),
	"an empty chat draft is not runnable",
);
assert(
	!isUsableChatApiConfig(chatConfig("https://example.test", "")),
	"a chat draft without a model is not runnable",
);
assert(
	isUsableChatApiConfig(chatConfig(" https://example.test ", " model ")),
	"a chat config with URI and model is runnable",
);

assert(
	!isUsableTranslationApiConfig(
		translationConfig("translation_api_openai_compatible", "", "model"),
	),
	"an OpenAI-compatible draft without a URI is not runnable",
);
assert(
	!isUsableTranslationApiConfig(
		translationConfig(
			"translation_api_openai_compatible",
			"https://example.test",
		),
	),
	"an OpenAI-compatible draft without a model is not runnable",
);
assert(
	isUsableTranslationApiConfig(
		translationConfig(
			"translation_api_openai_compatible",
			"https://example.test",
			"model",
		),
	),
	"a complete OpenAI-compatible translation config is runnable",
);
assert(
	isUsableTranslationApiConfig(
		translationConfig("translation_api_deepl", "https://example.test"),
	),
	"DeepL only requires a URI at this boundary",
);
assert(
	!isUsableTranslationApiConfig(
		translationConfig("unknown", "https://example.test", "model"),
	),
	"unknown translation API types are not runnable",
);

console.log("API config regression checks passed");
