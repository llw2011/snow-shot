import type {
	ChatApiConfig,
	OcrModel,
	TranslationApiConfig,
	TranslationApiType,
} from "../../../../types/appSettings";

// Type-only imports keep this module runnable by the node regression test,
// the same way utils/apiConfig.ts mirrors the enum values.
const GLM_OCR = "GlmOcr" as OcrModel.GlmOcr;
const TRANSLATION_API_DEEPL =
	"translation_api_deepl" as TranslationApiType.DeepL;
const TRANSLATION_API_OPENAI_COMPATIBLE =
	"translation_api_openai_compatible" as TranslationApiType.OpenAiCompatible;

/**
 * The settings store keeps three independent lists (chat models, translation
 * engines and the GLM OCR endpoint). The model-service view merges entries that
 * point at the same endpoint, model and key into one service with "uses", and
 * writes edits back to the original lists. Storage stays fully compatible.
 */

export type ModelServiceKind = "openai" | "deepl";

export type ModelServiceUses = {
	chat: boolean;
	translation: boolean;
	ocr: boolean;
};

export type ModelService = {
	/** Identity derived from kind, endpoint, model and key. */
	key: string;
	kind: ModelServiceKind;
	name: string;
	apiUri: string;
	apiKey: string;
	apiModel: string;
	supportThinking: boolean;
	supportVision: boolean;
	deeplPreferQualityOptimized: boolean;
	uses: ModelServiceUses;
};

export type ModelServiceStorage = {
	chatApiConfigList: ChatApiConfig[];
	translationApiConfigList: TranslationApiConfig[];
	glmOcrApiConfig: ChatApiConfig;
	ocrModel: OcrModel;
};

// Mirrors CUSTOM_MODEL_PREFIX. That constant lives in buildFlavor, which reads
// import.meta.env and cannot be loaded by the node regression test.
export const CUSTOM_MODEL_TYPE_PREFIX = "snow_shot_custom_";

export const normalizeServiceUri = (uri: string) => {
	const trimmed = uri.trim().replace(/\/+$/, "");
	try {
		const url = new URL(trimmed);
		return `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, "")}`;
	} catch {
		return trimmed;
	}
};

export const getModelServiceKey = (
	service: Pick<ModelService, "kind" | "apiUri" | "apiModel" | "apiKey">,
) =>
	[
		service.kind,
		normalizeServiceUri(service.apiUri),
		service.kind === "deepl" ? "" : service.apiModel.trim(),
		service.apiKey.trim(),
	].join("\u0000");

const emptyUses = (): ModelServiceUses => ({
	chat: false,
	translation: false,
	ocr: false,
});

const isConfiguredChat = (config: ChatApiConfig | undefined) =>
	Boolean(config?.api_uri.trim() && config.api_model.trim());

export const deriveModelServices = (
	storage: ModelServiceStorage,
): ModelService[] => {
	const services: ModelService[] = [];
	const byKey = new Map<string, ModelService>();

	const upsert = (
		input: Omit<ModelService, "key" | "uses">,
		use: keyof ModelServiceUses,
	) => {
		const key = getModelServiceKey(input);
		const existing = byKey.get(key);
		if (existing) {
			existing.uses[use] = true;
			existing.name ||= input.name;
			existing.supportThinking ||= input.supportThinking;
			existing.supportVision ||= input.supportVision;
			return;
		}

		const service: ModelService = { ...input, key, uses: emptyUses() };
		service.uses[use] = true;
		byKey.set(key, service);
		services.push(service);
	};

	for (const config of storage.chatApiConfigList) {
		upsert(
			{
				kind: "openai",
				name: config.model_name,
				apiUri: config.api_uri,
				apiKey: config.api_key,
				apiModel: config.api_model,
				supportThinking: config.support_thinking,
				supportVision: !!config.support_vision,
				deeplPreferQualityOptimized: false,
			},
			"chat",
		);
	}

	for (const config of storage.translationApiConfigList) {
		const isDeepL = config.api_type === TRANSLATION_API_DEEPL;
		upsert(
			{
				kind: isDeepL ? "deepl" : "openai",
				name: config.model_name ?? "",
				apiUri: config.api_uri,
				apiKey: config.api_key,
				apiModel: isDeepL ? "" : (config.api_model ?? ""),
				supportThinking: !!config.support_thinking,
				supportVision: false,
				deeplPreferQualityOptimized: !!config.deepl_prefer_quality_optimized,
			},
			"translation",
		);
	}

	const ocrConfig = storage.glmOcrApiConfig;
	if (isConfiguredChat(ocrConfig)) {
		const ocrService = {
			kind: "openai" as const,
			name: ocrConfig.model_name,
			apiUri: ocrConfig.api_uri,
			apiKey: ocrConfig.api_key,
			apiModel: ocrConfig.api_model,
			supportThinking: ocrConfig.support_thinking,
			supportVision: true,
			deeplPreferQualityOptimized: false,
		};
		const existing = byKey.get(getModelServiceKey(ocrService));
		if (storage.ocrModel === GLM_OCR) {
			upsert(ocrService, "ocr");
		} else if (existing) {
			// An inactive OCR endpoint is only shown when another use keeps it
			// persisted; otherwise it would appear as an unsaved ghost row.
			existing.supportVision = true;
		}
	}

	return services;
};

export const toChatApiConfig = (service: ModelService): ChatApiConfig => ({
	api_uri: service.apiUri.trim(),
	api_key: service.apiKey.trim(),
	api_model: service.apiModel.trim(),
	model_name: service.name.trim() || service.apiModel.trim(),
	support_thinking: service.supportThinking,
	support_vision: service.supportVision,
});

export const toTranslationApiConfig = (
	service: ModelService,
): TranslationApiConfig =>
	service.kind === "deepl"
		? {
				api_type: TRANSLATION_API_DEEPL,
				api_uri: service.apiUri.trim(),
				api_key: service.apiKey.trim(),
				api_model: "",
				model_name: service.name.trim() || "DeepL",
				deepl_prefer_quality_optimized: service.deeplPreferQualityOptimized,
			}
		: {
				api_type: TRANSLATION_API_OPENAI_COMPATIBLE,
				api_uri: service.apiUri.trim(),
				api_key: service.apiKey.trim(),
				api_model: service.apiModel.trim(),
				model_name: service.name.trim() || service.apiModel.trim(),
				deepl_prefer_quality_optimized: false,
				support_thinking: service.supportThinking,
			};

export const applyModelServices = (
	services: ModelService[],
	previous: ModelServiceStorage,
	/** OCR engine to fall back to when the GLM endpoint is unassigned. */
	ocrFallbackModel: OcrModel,
): ModelServiceStorage => {
	const ocrService = services.find(
		(service) => service.kind === "openai" && service.uses.ocr,
	);

	return {
		chatApiConfigList: services
			.filter((service) => service.kind === "openai" && service.uses.chat)
			.map(toChatApiConfig),
		translationApiConfigList: services
			.filter((service) => service.uses.translation)
			.map(toTranslationApiConfig),
		glmOcrApiConfig: ocrService
			? { ...toChatApiConfig(ocrService), support_vision: true }
			: previous.glmOcrApiConfig,
		ocrModel: ocrService
			? GLM_OCR
			: previous.ocrModel === GLM_OCR
				? ocrFallbackModel
				: previous.ocrModel,
	};
};

/** Value stored in translationType / chatModel for a service. */
export const getServiceModelType = (service: ModelService) =>
	service.kind === "deepl"
		? TRANSLATION_API_DEEPL
		: `${CUSTOM_MODEL_TYPE_PREFIX}${service.apiModel.trim()}`;

/** Exactly one service may own OCR; assigning it elsewhere moves it. */
export const setServiceUse = (
	services: ModelService[],
	key: string,
	use: keyof ModelServiceUses,
	enabled: boolean,
): ModelService[] =>
	services.map((service) => {
		if (service.key === key) {
			return { ...service, uses: { ...service.uses, [use]: enabled } };
		}
		if (use === "ocr" && enabled && service.uses.ocr) {
			return { ...service, uses: { ...service.uses, ocr: false } };
		}
		return service;
	});

export const updateService = (
	services: ModelService[],
	key: string,
	patch: Partial<Omit<ModelService, "key" | "uses">>,
): { services: ModelService[]; key: string } => {
	let nextKey = key;
	const nextServices = services.map((service) => {
		if (service.key !== key) {
			return service;
		}
		const next = { ...service, ...patch };
		next.key = getModelServiceKey(next);
		nextKey = next.key;
		return next;
	});
	return { services: nextServices, key: nextKey };
};

export const hasAnyUse = (service: Pick<ModelService, "uses">) =>
	service.uses.chat || service.uses.translation || service.uses.ocr;
