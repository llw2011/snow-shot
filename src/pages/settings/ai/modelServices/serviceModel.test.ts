import type {
	ChatApiConfig,
	OcrModel,
	TranslationApiConfig,
	TranslationApiType,
} from "../../../../types/appSettings.js";
import {
	applyModelServices,
	deriveModelServices,
	getServiceModelType,
	type ModelServiceStorage,
	setServiceUse,
	updateService,
} from "./serviceModel.js";

const assert = (condition: boolean, message: string) => {
	if (!condition) {
		throw new Error(message);
	}
};

const GLM_OCR = "GlmOcr" as OcrModel;
const RAPID_OCR_V4 = "RapidOcrV4" as OcrModel;
const OPENAI = "translation_api_openai_compatible" as TranslationApiType;
const DEEPL = "translation_api_deepl" as TranslationApiType;

const chat = (
	api_uri: string,
	api_model: string,
	extra: Partial<ChatApiConfig> = {},
): ChatApiConfig => ({
	api_uri,
	api_key: "",
	api_model,
	model_name: api_model,
	support_thinking: false,
	support_vision: false,
	...extra,
});

const translation = (
	api_uri: string,
	api_model: string,
	extra: Partial<TranslationApiConfig> = {},
): TranslationApiConfig => ({
	api_type: OPENAI,
	api_uri,
	api_key: "",
	api_model,
	model_name: api_model,
	deepl_prefer_quality_optimized: false,
	...extra,
});

const storage = (
	overrides: Partial<ModelServiceStorage> = {},
): ModelServiceStorage => ({
	chatApiConfigList: [],
	translationApiConfigList: [],
	glmOcrApiConfig: chat("", "", { support_vision: true }),
	ocrModel: RAPID_OCR_V4,
	...overrides,
});

// One endpoint used by chat and translation becomes one service.
{
	const services = deriveModelServices(
		storage({
			chatApiConfigList: [chat("http://127.0.0.1:11434/v1", "qwen3.5:2b")],
			translationApiConfigList: [
				translation("http://127.0.0.1:11434/v1/", "qwen3.5:2b", {
					support_thinking: true,
				}),
			],
		}),
	);
	assert(services.length === 1, "matching chat and translation entries merge");
	assert(
		services[0].uses.chat && services[0].uses.translation,
		"the merged service keeps both uses",
	);
	assert(services[0].supportThinking, "capabilities from either list are kept");
}

// Different keys or models stay separate services.
{
	const services = deriveModelServices(
		storage({
			chatApiConfigList: [
				chat("https://api.example.test/v1", "a", { api_key: "k1" }),
				chat("https://api.example.test/v1", "a", { api_key: "k2" }),
				chat("https://api.example.test/v1", "b", { api_key: "k1" }),
			],
		}),
	);
	assert(services.length === 3, "key and model are part of the identity");
}

// DeepL entries ignore the model field.
{
	const services = deriveModelServices(
		storage({
			translationApiConfigList: [
				translation("https://api-free.deepl.com/v2/translate", "", {
					api_type: DEEPL,
					api_key: "secret",
				}),
			],
		}),
	);
	assert(
		services[0].kind === "deepl" && services[0].uses.translation,
		"DeepL is a translation-only service",
	);
	assert(
		getServiceModelType(services[0]) === DEEPL,
		"DeepL maps to its translation type",
	);
}

// Round trip: applying derived services reproduces the stored lists.
{
	const original = storage({
		chatApiConfigList: [
			chat("http://127.0.0.1:11440/v1", "qwen3.5-35b"),
			chat("http://127.0.0.1:11434/v1", "qwen3.5:2b", {
				support_thinking: true,
			}),
		],
		translationApiConfigList: [
			translation("http://127.0.0.1:11440/v1", "qwen3.5-35b"),
		],
	});
	const applied = applyModelServices(
		deriveModelServices(original),
		original,
		RAPID_OCR_V4,
	);
	assert(
		applied.chatApiConfigList.length === 2 &&
			applied.translationApiConfigList.length === 1,
		"a round trip keeps every entry",
	);
	assert(
		applied.chatApiConfigList[1].support_thinking,
		"a round trip keeps capabilities",
	);
	assert(
		applied.ocrModel === RAPID_OCR_V4,
		"OCR is untouched without an OCR use",
	);
}

// Toggling a use adds or removes the entry from that list only.
{
	const original = storage({
		chatApiConfigList: [chat("http://127.0.0.1:11434/v1", "qwen3.5:2b")],
	});
	const services = deriveModelServices(original);
	const withTranslation = applyModelServices(
		setServiceUse(services, services[0].key, "translation", true),
		original,
		RAPID_OCR_V4,
	);
	assert(
		withTranslation.translationApiConfigList.length === 1 &&
			withTranslation.chatApiConfigList.length === 1,
		"enabling translation adds a translation entry",
	);

	const withoutChat = applyModelServices(
		setServiceUse(services, services[0].key, "chat", false),
		original,
		RAPID_OCR_V4,
	);
	assert(
		withoutChat.chatApiConfigList.length === 0,
		"disabling chat removes the chat entry",
	);
}

// OCR is exclusive and switches the engine to GLM OCR.
{
	const original = storage({
		chatApiConfigList: [
			chat("http://127.0.0.1:11434/v1", "glm-ocr", { support_vision: true }),
			chat("http://127.0.0.1:11434/v1", "qwen3.5:2b", { support_vision: true }),
		],
	});
	let services = deriveModelServices(original);
	services = setServiceUse(services, services[0].key, "ocr", true);
	services = setServiceUse(services, services[1].key, "ocr", true);
	assert(
		!services[0].uses.ocr && services[1].uses.ocr,
		"assigning OCR moves it from the previous service",
	);

	const applied = applyModelServices(services, original, RAPID_OCR_V4);
	assert(applied.ocrModel === GLM_OCR, "an OCR service selects GLM OCR");
	assert(
		applied.glmOcrApiConfig.api_model === "qwen3.5:2b",
		"the OCR endpoint follows the assigned service",
	);

	const unassigned = applyModelServices(
		setServiceUse(services, services[1].key, "ocr", false),
		{ ...original, ocrModel: GLM_OCR },
		RAPID_OCR_V4,
	);
	assert(
		unassigned.ocrModel === RAPID_OCR_V4,
		"removing the OCR service falls back to the local engine",
	);
}

// Editing an endpoint updates every list that uses it and returns the new key.
{
	const original = storage({
		chatApiConfigList: [chat("http://127.0.0.1:11434/v1", "qwen3.5:2b")],
		translationApiConfigList: [
			translation("http://127.0.0.1:11434/v1", "qwen3.5:2b"),
		],
	});
	const services = deriveModelServices(original);
	const result = updateService(services, services[0].key, {
		apiUri: "http://127.0.0.1:1234/v1",
	});
	assert(
		result.key !== services[0].key,
		"editing the endpoint changes the key",
	);

	const applied = applyModelServices(result.services, original, RAPID_OCR_V4);
	assert(
		applied.chatApiConfigList[0].api_uri === "http://127.0.0.1:1234/v1" &&
			applied.translationApiConfigList[0].api_uri ===
				"http://127.0.0.1:1234/v1",
		"both lists receive the edited endpoint",
	);
}

// An inactive OCR endpoint without another use is not shown as a service.
{
	const services = deriveModelServices(
		storage({
			glmOcrApiConfig: chat("http://127.0.0.1:11434/v1", "glm-ocr", {
				support_vision: true,
			}),
			ocrModel: RAPID_OCR_V4,
		}),
	);
	assert(services.length === 0, "an unused OCR endpoint is not listed");
}

console.log("model services regression passed");
