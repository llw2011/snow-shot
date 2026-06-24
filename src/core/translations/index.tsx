import { trim } from "es-toolkit";
import OpenAI from "openai";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import {
	defaultTranslationPrompt,
	strictStructuredTranslationPrompt,
	structuredTranslationPrompt,
} from "@/constants/components/translation";
import { AntdContext } from "@/contexts/antdContext";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { useStateRef } from "@/hooks/useStateRef";
import {
	convertLanguageCodeToDeepLSourceLanguageCode,
	convertLanguageCodeToDeepLTargetLanguageCode,
} from "@/pages/settings/functionSettings/extra";
import { CUSTOM_MODEL_PREFIX } from "@/pages/tools/chat/page";
import { getTranslationPrompt } from "@/pages/tools/translation/extra";
import { appFetch } from "@/services/tools";
import { translateTextDeepL } from "@/services/tools/translation";
import {
	type AppSettingsData,
	AppSettingsGroup,
	type ChatApiConfig,
	type TranslationApiConfig,
	TranslationApiType,
} from "@/types/appSettings";
import {
	type DeepLTranslateResult,
	TranslationDomain,
	TranslationType,
	type TranslationTypeOption,
} from "@/types/servies/translation";
import { getCachedData, setCachedData } from "@/utils/cache";
import { appError } from "@/utils/log";

export type TranslationServiceConfig = (
	| TranslationTypeOption
	| {
			name: string;
			type: string;
			apiConfig: ChatApiConfig;
	  }
	| {
			name: string;
			type: TranslationApiType;
			translationApiConfig: TranslationApiConfig;
	  }
) & {
	isOfficial: boolean;
};

type TranslationResultItem = {
	content: string;
};

type StructuredTranslationInputItem = {
	id: number;
	text: string;
};

type TranslationRequestHandle = {
	requestSerial: number;
	abortController: AbortController;
};

type TranslationRequestResult = {
	success: boolean;
	aborted?: boolean;
	timeout?: boolean;
	result?: TranslationResultItem[];
};

type TranslationCachePayload = {
	version: string;
	result: TranslationResultItem[];
};

const TRANSLATION_CACHE_VERSION = "qwen-translation-cache-v1";
const TRANSLATION_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;
const TRANSLATION_CACHE_KEY_PREFIX = "translation:";
const TRANSLATION_CACHE_PROTOCOL_VERSION =
	"single-stream-v1;structured-json-v1;legacy-separator-v1";

const createSha256Hash = async (content: string) => {
	if (!globalThis.crypto?.subtle) {
		return undefined;
	}

	const digest = await globalThis.crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(content),
	);

	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
};

const createTranslationCacheKey = async (params: {
	apiUri?: string;
	model: string;
	sourceLanguage: string;
	targetLanguage: string;
	translationDomain: TranslationDomain;
	baseSystemPrompt: string;
	sourceContent: string[];
	completionParams: {
		max_completion_tokens: number;
		temperature: number;
		top_p: number;
	};
}) => {
	const hash = await createSha256Hash(
		JSON.stringify({
			version: TRANSLATION_CACHE_VERSION,
			protocol: TRANSLATION_CACHE_PROTOCOL_VERSION,
			apiUri: params.apiUri,
			model: params.model,
			sourceLanguage: params.sourceLanguage,
			targetLanguage: params.targetLanguage,
			translationDomain: params.translationDomain,
			baseSystemPrompt: params.baseSystemPrompt,
			structuredTranslationPrompt,
			strictStructuredTranslationPrompt,
			completionParams: params.completionParams,
			sourceContent: params.sourceContent,
		}),
	);

	return hash ? `${TRANSLATION_CACHE_KEY_PREFIX}${hash}` : undefined;
};

const getTranslationCacheResult = (
	cacheKey: string,
	sourceContentLength: number,
) => {
	const cached = getCachedData<TranslationCachePayload>(
		cacheKey,
		TRANSLATION_CACHE_DURATION,
	);
	if (
		!cached ||
		cached.version !== TRANSLATION_CACHE_VERSION ||
		!Array.isArray(cached.result) ||
		cached.result.length !== sourceContentLength ||
		cached.result.some((item) => !item || typeof item.content !== "string")
	) {
		return undefined;
	}

	return cached.result.map((item) => ({ content: item.content }));
};

const setTranslationCacheResult = (
	cacheKey: string | undefined,
	result: TranslationResultItem[],
) => {
	if (!cacheKey) {
		return;
	}

	setCachedData<TranslationCachePayload>(cacheKey, {
		version: TRANSLATION_CACHE_VERSION,
		result: result.map((item) => ({ content: item.content })),
	});
};

const buildStructuredTranslationInput = (sourceContent: string[]) =>
	sourceContent.map(
		(text, id): StructuredTranslationInputItem => ({
			id,
			text,
		}),
	);

const tryParseJson = (content: string): unknown => {
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

const parseStructuredTranslationResult = (
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
		content: trim(translationsById.get(id) ?? ""),
	}));
};

const buildStructuredTranslationSystemPrompt = (
	basePrompt: string,
	strictRetry: boolean,
) =>
	`${basePrompt}\n\n${structuredTranslationPrompt}${
		strictRetry ? `\n\n${strictStructuredTranslationPrompt}` : ""
	}`;

const isOpenAiAbortError = (error: unknown) =>
	error instanceof OpenAI.APIUserAbortError ||
	(error instanceof Error &&
		(error.name === "AbortError" || error.name === "APIUserAbortError"));

const isOpenAiTimeoutError = (error: unknown) =>
	error instanceof OpenAI.APIConnectionTimeoutError ||
	(error instanceof Error && error.name === "APIConnectionTimeoutError");

export const useTranslationRequest = (options?: {
	/// 配置从 Cache 中加载
	enableCacheConfig?: boolean;
	onComplete?: (result: { content: string }[], requestId?: number) => void;
	onDeltaContent?: (deltaContent: string) => void;
	/// 懒加载
	lazyLoad?: boolean;
}) => {
	const intl = useIntl();
	const { message } = useContext(AntdContext);

	// 翻译领域
	const [translationDomain, setTranslationDomain, translationDomainRef] =
		useStateRef<TranslationDomain>(TranslationDomain.General);
	// 翻译类型
	const [translationType, setTranslationType, translationTypeRef] = useStateRef<
		TranslationType | string
	>(TranslationType.Youdao);
	// 源语言
	const [sourceLanguage, setSourceLanguage, sourceLanguageRef] =
		useStateRef<string>("auto");
	// 目标语言
	const [targetLanguage, setTargetLanguage, targetLanguageRef] =
		useStateRef<string>("zh-CHS");

	/// 用户自定义的翻译 API 配置
	const [translationApiConfigList, setTranslationApiConfigList] = useState<
		TranslationApiConfig[] | undefined
	>(undefined);
	const [translationConfig, setTranslationConfig] =
		useState<AppSettingsData[AppSettingsGroup.FunctionTranslation]>();

	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData) => {
				if (options?.enableCacheConfig) {
					setTranslationDomain(
						settings[AppSettingsGroup.FunctionTranslationCache]
							.cacheTranslationDomain,
					);
					setTranslationType(
						settings[AppSettingsGroup.FunctionTranslationCache]
							.cacheTranslationType,
					);
					setSourceLanguage(
						settings[AppSettingsGroup.FunctionTranslationCache]
							.cacheSourceLanguage,
					);
					setTargetLanguage(
						settings[AppSettingsGroup.FunctionTranslationCache]
							.cacheTargetLanguage,
					);
				} else {
					setTranslationDomain(
						settings[AppSettingsGroup.FunctionTranslation].translationDomain,
					);
					setTranslationType(
						settings[AppSettingsGroup.FunctionTranslation].translationType,
					);
					setSourceLanguage(
						settings[AppSettingsGroup.FunctionTranslation].sourceLanguage,
					);
					setTargetLanguage(
						settings[AppSettingsGroup.FunctionTranslation].targetLanguage,
					);
				}

				setTranslationApiConfigList(
					settings[AppSettingsGroup.FunctionTranslation]
						.translationApiConfigList,
				);

				setTranslationConfig(settings[AppSettingsGroup.FunctionTranslation]);
			},
			[
				setSourceLanguage,
				setTargetLanguage,
				setTranslationDomain,
				setTranslationType,
				options?.enableCacheConfig,
			],
		),
		true,
	);
	const { updateAppSettings } = useContext(AppSettingsActionContext);

	const reloadOnlineConfigsPromiseRef = useRef<
		Promise<[undefined, undefined]> | undefined
	>(undefined);
	const reloadOnlineConfigs = useCallback(async () => {
		// Cloud backend disabled — no online configs to load
	}, []);

	useEffect(() => {
		if (options?.lazyLoad) {
			return;
		}

		reloadOnlineConfigs();
	}, [reloadOnlineConfigs, options?.lazyLoad]);

	const [
		supportedTranslationTypes,
		setSupportedTranslationTypes,
		supportedTranslationTypesRef,
	] = useStateRef<TranslationServiceConfig[]>([]);

	const getTranslationApiConfigTypeName = useCallback(
		(apiConfig: TranslationApiConfig) => {
			switch (apiConfig.api_type) {
				case TranslationApiType.OpenAiCompatible:
					return (
						apiConfig.model_name ||
						apiConfig.api_model ||
						intl.formatMessage({
							id: "tools.translation.type.openAiCompatible",
						})
					);
				case TranslationApiType.DeepL:
					return intl.formatMessage({ id: "tools.translation.type.deepl" });
				default:
					return apiConfig.api_type;
			}
		},
		[intl],
	);

	const [
		supportedTranslationTypesLoading,
		setSupportedTranslationTypesLoading,
	] = useState(false);
	useEffect(() => {
		setSupportedTranslationTypesLoading(true);
		setSupportedTranslationTypes([
			...(translationApiConfigList?.map((item): TranslationServiceConfig => {
				if (item.api_type === TranslationApiType.OpenAiCompatible) {
					return {
						type: `${CUSTOM_MODEL_PREFIX}${item.api_model ?? ""}`,
						name: getTranslationApiConfigTypeName(item),
						apiConfig: {
							api_uri: item.api_uri,
							api_key: item.api_key,
							api_model: item.api_model ?? "",
							model_name: item.model_name ?? item.api_model ?? "",
							support_thinking: false,
							support_vision: false,
						},
						isOfficial: false,
					};
				}

				return {
					type: item.api_type,
					name: getTranslationApiConfigTypeName(item),
					translationApiConfig: item,
					isOfficial: false,
				};
			}) ?? []),
		]);
		setSupportedTranslationTypesLoading(false);
	}, [
		setSupportedTranslationTypes,
		translationApiConfigList,
		getTranslationApiConfigTypeName,
	]);

	// 请求翻译的加载
	const [startTranslateLoading, setStartTranslateLoading] = useState(false);
	// 翻译内容的加载
	const [deltaTranslateLoading, setDeltaTranslateLoading] = useState(false);
	const [translatedContent, setTranslatedContent, translatedContentRef] =
		useStateRef<string>("");
	const translateRequestSerialRef = useRef(0);
	const translationAbortControllerRef = useRef<AbortController | undefined>(
		undefined,
	);
	const abortCurrentTranslationRequest = useCallback(() => {
		translationAbortControllerRef.current?.abort();
		translationAbortControllerRef.current = undefined;
	}, []);
	const beginTranslationRequest = useCallback(() => {
		abortCurrentTranslationRequest();
		const abortController = new AbortController();
		translationAbortControllerRef.current = abortController;
		translateRequestSerialRef.current += 1;
		return {
			requestSerial: translateRequestSerialRef.current,
			abortController,
		};
	}, [abortCurrentTranslationRequest]);
	const isCurrentTranslationRequest = useCallback(
		(requestSerial: number) =>
			requestSerial === translateRequestSerialRef.current,
		[],
	);
	const invalidateTranslationRequest = useCallback(() => {
		abortCurrentTranslationRequest();
		translateRequestSerialRef.current += 1;
		setStartTranslateLoading(false);
		setDeltaTranslateLoading(false);
		setTranslatedContent("");
	}, [abortCurrentTranslationRequest, setTranslatedContent]);
	useEffect(() => {
		return () => {
			abortCurrentTranslationRequest();
		};
	}, [abortCurrentTranslationRequest]);

	const customTranslation = useCallback(
		async (params: {
			sourceContent: string[];
			sourceLanguage: string;
			targetLanguage: string;
			translationType: string;
			translationDomain: TranslationDomain;
			requestHandle: TranslationRequestHandle;
			requestId?: number;
		}): Promise<TranslationRequestResult> => {
			const requestSerial = params.requestHandle.requestSerial;
			const config = supportedTranslationTypesRef.current.find(
				(item) => item.type === params.translationType,
			);

			if (!config || typeof config.type !== "string") {
				return {
					success: false,
				};
			}

			if ("translationApiConfig" in config) {
				if (config.type === TranslationApiType.DeepL) {
					if (isCurrentTranslationRequest(requestSerial)) {
						setStartTranslateLoading(true);
					}

					let result: DeepLTranslateResult | undefined;
					try {
						result = await translateTextDeepL(
							config.translationApiConfig.api_uri,
							config.translationApiConfig.api_key,
							params.sourceContent,
							convertLanguageCodeToDeepLSourceLanguageCode(
								params.sourceLanguage,
							),
							convertLanguageCodeToDeepLTargetLanguageCode(
								params.targetLanguage,
							),
							config.translationApiConfig.deepl_prefer_quality_optimized ??
								false,
						);
					} catch (error) {
						appError("[customTranslation] translateTextDeepL error", error);
					}

					if (isCurrentTranslationRequest(requestSerial)) {
						setStartTranslateLoading(false);
					}

					if (!result) {
						return {
							success: false,
						};
					}

					if (isCurrentTranslationRequest(requestSerial)) {
						options?.onComplete?.(
							result.translations.map((item) => ({
								content: item.text,
							})),
							params.requestId,
						);
					}

					return {
						success: true,
						result: result.translations.map((item) => ({
							content: item.text,
						})),
					};
				}
			}

			if (!("apiConfig" in config)) {
				return {
					success: false,
				};
			}

			const model = config.apiConfig.api_model.replace(CUSTOM_MODEL_PREFIX, "");
			const baseSystemPrompt = getTranslationPrompt(
				translationConfig?.translationSystemPrompt ?? defaultTranslationPrompt,
				params.sourceLanguage,
				params.targetLanguage,
				params.translationDomain,
			);
			const completionOptions = {
				timeout: translationConfig?.translationTimeoutMs ?? 60000,
				maxRetries: 0,
				signal: params.requestHandle.abortController.signal,
			};
			const completionBaseParams = {
				model,
				max_completion_tokens: translationConfig?.translationMaxTokens ?? 4096,
				temperature: translationConfig?.translationTemperature ?? 0.2,
				top_p: translationConfig?.translationTopP ?? 0.9,
			};
			let translationCacheKey: string | undefined;
			try {
				translationCacheKey = await createTranslationCacheKey({
					apiUri: config.apiConfig.api_uri,
					model,
					sourceLanguage: params.sourceLanguage,
					targetLanguage: params.targetLanguage,
					translationDomain: params.translationDomain,
					baseSystemPrompt,
					sourceContent: params.sourceContent,
					completionParams: completionBaseParams,
				});
			} catch (error) {
				appError("[customTranslation] translation cache key error", error);
			}

			if (!isCurrentTranslationRequest(requestSerial)) {
				return {
					success: false,
					aborted: true,
				};
			}

			const cachedResult = translationCacheKey
				? getTranslationCacheResult(
						translationCacheKey,
						params.sourceContent.length,
					)
				: undefined;

			if (cachedResult) {
				setTranslatedContent(
					cachedResult.map((item) => item.content).join("\n"),
				);
				options?.onComplete?.(cachedResult, params.requestId);
				return {
					success: true,
					result: cachedResult,
				};
			}

			const client = new OpenAI({
				apiKey: config.apiConfig.api_key,
				baseURL: config.apiConfig.api_uri,
				dangerouslyAllowBrowser: true,
				fetch: appFetch,
			});

			if (isCurrentTranslationRequest(requestSerial)) {
				setStartTranslateLoading(true);
			}

			const requestStructuredTranslation = async (strictRetry: boolean) => {
				const structuredResponse = await client.chat.completions.create(
					{
						...completionBaseParams,
						messages: [
							{
								role: "system",
								content: buildStructuredTranslationSystemPrompt(
									baseSystemPrompt,
									strictRetry,
								),
							},
							{
								role: "user",
								content: JSON.stringify(
									buildStructuredTranslationInput(params.sourceContent),
								),
							},
						],
						stream: false,
					},
					completionOptions,
				);

				return parseStructuredTranslationResult(
					structuredResponse.choices[0]?.message.content ?? "",
					params.sourceContent.length,
				);
			};

			try {
				if (params.sourceContent.length > 1) {
					const structuredResult =
						(await requestStructuredTranslation(false)) ??
						(await requestStructuredTranslation(true));

					if (structuredResult) {
						if (isCurrentTranslationRequest(requestSerial)) {
							setTranslatedContent(
								structuredResult.map((item) => item.content).join("\n"),
							);
							options?.onComplete?.(structuredResult, params.requestId);
							setTranslationCacheResult(translationCacheKey, structuredResult);
						}

						return {
							success: true,
							result: structuredResult,
						};
					}

					appError(
						"[customTranslation] structured translation validation failed; falling back to legacy separator protocol",
					);
				}

				let responseContent = "";
				const streamResponse = await client.chat.completions.create(
					{
						...completionBaseParams,
						messages: [
							{
								role: "system",
								content: baseSystemPrompt,
							},
							{
								role: "user",
								content: params.sourceContent.join("%%"),
							},
						],
						stream: true,
					},
					completionOptions,
				);

				if (isCurrentTranslationRequest(requestSerial)) {
					setDeltaTranslateLoading(true);
				}
				try {
					if (isCurrentTranslationRequest(requestSerial)) {
						setTranslatedContent("");
					}
					for await (const event of streamResponse) {
						if (event.choices.length > 0 && event.choices[0].delta.content) {
							responseContent += event.choices[0].delta.content;
							if (isCurrentTranslationRequest(requestSerial)) {
								setTranslatedContent(
									(prevContent) =>
										`${prevContent}${event.choices[0].delta.content}`,
								);
								options?.onDeltaContent?.(event.choices[0].delta.content);
							}
						}
					}
				} catch (error) {
					if (isOpenAiAbortError(error) || isOpenAiTimeoutError(error)) {
						throw error;
					}
					appError("[customTranslation] streamResponse error", error);
				}
				if (isCurrentTranslationRequest(requestSerial)) {
					setDeltaTranslateLoading(false);
				}
				const result =
					params.sourceContent.length > 1
						? responseContent
								.split("%%")
								.map((item) => ({ content: trim(item) }))
						: [{ content: responseContent }];

				if (isCurrentTranslationRequest(requestSerial)) {
					options?.onComplete?.(result, params.requestId);
					setTranslationCacheResult(translationCacheKey, result);
				}

				return {
					success: true,
					result,
				};
			} catch (error) {
				if (isOpenAiAbortError(error)) {
					return {
						success: false,
						aborted: true,
					};
				}

				if (isOpenAiTimeoutError(error)) {
					if (isCurrentTranslationRequest(requestSerial)) {
						message.error(
							intl.formatMessage({
								id: "tools.translation.requestTimeout",
							}),
						);
					}
					return {
						success: false,
						timeout: true,
					};
				}

				appError("[customTranslation] error", error);
			} finally {
				if (isCurrentTranslationRequest(requestSerial)) {
					setStartTranslateLoading(false);
					setDeltaTranslateLoading(false);
				}
			}

			return {
				success: false,
			};
		},
		[
			supportedTranslationTypesRef,
			options,
			intl,
			message,
			translationConfig?.translationMaxTokens,
			translationConfig?.translationSystemPrompt,
			translationConfig?.translationTemperature,
			translationConfig?.translationTimeoutMs,
			translationConfig?.translationTopP,
			setTranslatedContent,
			isCurrentTranslationRequest,
		],
	);

	const requestTranslate = useCallback(
		async (sourceContent: string[], requestId?: number) => {
			const requestHandle = beginTranslationRequest();
			const translationType = translationTypeRef.current;
			const translationDomain = translationDomainRef.current;
			const sourceLanguage = sourceLanguageRef.current;
			const targetLanguage = targetLanguageRef.current;

			if (options?.lazyLoad) {
				await reloadOnlineConfigs();
				await new Promise((resolve) => setTimeout(resolve, 17));
			}

			if (reloadOnlineConfigsPromiseRef.current) {
				await reloadOnlineConfigsPromiseRef.current;
				await new Promise((resolve) => setTimeout(resolve, 17));
			}

			if (!isCurrentTranslationRequest(requestHandle.requestSerial)) {
				return;
			}

			if (typeof translationType === "string") {
				const result = await customTranslation({
					sourceContent: sourceContent,
					sourceLanguage: sourceLanguage,
					targetLanguage: targetLanguage,
					translationType: translationType,
					translationDomain: translationDomain,
					requestHandle,
					requestId: requestId,
				});
				if (result.aborted || result.timeout) {
					return;
				}
				if (result.success) {
					return;
				}
			}

			if (!isCurrentTranslationRequest(requestHandle.requestSerial)) {
				return;
			}

			message.error(
				intl.formatMessage({ id: "tools.translation.noAvailableService" }),
			);
		},
		[
			customTranslation,
			options,
			sourceLanguageRef,
			message,
			targetLanguageRef,
			translationDomainRef,
			translationTypeRef,
			reloadOnlineConfigs,
			intl,
			beginTranslationRequest,
			isCurrentTranslationRequest,
		],
	);

	const updateTranslationDomain = useCallback(
		(translationDomain: TranslationDomain) => {
			invalidateTranslationRequest();
			if (options?.enableCacheConfig) {
				updateAppSettings(
					AppSettingsGroup.FunctionTranslationCache,
					{ cacheTranslationDomain: translationDomain },
					true,
					true,
					false,
					true,
					false,
				);
			} else {
				updateAppSettings(
					AppSettingsGroup.FunctionTranslation,
					{ translationDomain },
					true,
					true,
					true,
					true,
					false,
				);
			}
		},
		[
			updateAppSettings,
			options?.enableCacheConfig,
			invalidateTranslationRequest,
		],
	);

	const updateTranslationType = useCallback(
		(translationType: TranslationType | string) => {
			invalidateTranslationRequest();
			if (options?.enableCacheConfig) {
				updateAppSettings(
					AppSettingsGroup.FunctionTranslationCache,
					{ cacheTranslationType: translationType },
					true,
					true,
					false,
					true,
					false,
				);
			} else {
				updateAppSettings(
					AppSettingsGroup.FunctionTranslation,
					{ translationType },
					true,
					true,
					true,
					true,
					false,
				);
			}
		},
		[
			updateAppSettings,
			options?.enableCacheConfig,
			invalidateTranslationRequest,
		],
	);

	const updateSourceLanguage = useCallback(
		(sourceLanguage: string) => {
			invalidateTranslationRequest();
			if (options?.enableCacheConfig) {
				updateAppSettings(
					AppSettingsGroup.FunctionTranslationCache,
					{ cacheSourceLanguage: sourceLanguage },
					true,
					true,
					false,
					true,
					false,
				);
			} else {
				updateAppSettings(
					AppSettingsGroup.FunctionTranslation,
					{ sourceLanguage },
					true,
					true,
					true,
					true,
					false,
				);
			}
		},
		[
			updateAppSettings,
			options?.enableCacheConfig,
			invalidateTranslationRequest,
		],
	);

	const updateTargetLanguage = useCallback(
		(targetLanguage: string) => {
			invalidateTranslationRequest();
			if (options?.enableCacheConfig) {
				updateAppSettings(
					AppSettingsGroup.FunctionTranslationCache,
					{ cacheTargetLanguage: targetLanguage },
					true,
					true,
					false,
					true,
					false,
				);
			} else {
				updateAppSettings(
					AppSettingsGroup.FunctionTranslation,
					{ targetLanguage },
					true,
					true,
					true,
					true,
					false,
				);
			}
		},
		[
			updateAppSettings,
			options?.enableCacheConfig,
			invalidateTranslationRequest,
		],
	);

	const getTranslatedContent = useCallback(() => {
		return translatedContentRef.current;
	}, [translatedContentRef]);

	return {
		updateTranslationDomain,
		updateTranslationType,
		updateSourceLanguage,
		updateTargetLanguage,
		requestTranslate,
		startTranslateLoading,
		deltaTranslateLoading,
		translatedContent,
		translationType,
		translationDomain,
		sourceLanguage,
		targetLanguage,
		supportedTranslationTypes,
		supportedTranslationTypesLoading,
		getTranslatedContent,
		cancelTranslation: invalidateTranslationRequest,
	};
};
