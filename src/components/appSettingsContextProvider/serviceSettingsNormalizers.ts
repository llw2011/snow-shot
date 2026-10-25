import { defaultAppSettingsData } from "@/constants/appSettings";
import {
	type AppSettingsData,
	AppSettingsGroup,
	OcrModel,
	type TranslationApiConfig,
} from "@/types/appSettings";
import {
	isUsableChatApiConfig,
	isUsableTranslationApiConfig,
} from "@/utils/apiConfig";
import {
	normalizeChatApiConfig,
	normalizeTranslationApiConfig,
	normalizeTranslationType,
} from "./apiConfigNormalizers";

export const normalizeServiceSettingsGroup = (
	group: AppSettingsGroup,
	inputSettings: Partial<AppSettingsData[typeof group]>,
	currentSettings: AppSettingsData,
): AppSettingsData[typeof group] | undefined => {
	let newSettings = inputSettings;
	let settings: AppSettingsData[typeof group];

	if (group === AppSettingsGroup.SystemCommon) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		settings = {
			autoStart:
				typeof newSettings?.autoStart === "boolean"
					? newSettings.autoStart
					: (prevSettings?.autoStart ??
						defaultAppSettingsData[group].autoStart),
			autoCheckVersion:
				typeof newSettings?.autoCheckVersion === "boolean"
					? newSettings.autoCheckVersion
					: (prevSettings?.autoCheckVersion ??
						defaultAppSettingsData[group].autoCheckVersion),
			runLog:
				typeof newSettings?.runLog === "boolean"
					? newSettings.runLog
					: (prevSettings?.runLog ?? defaultAppSettingsData[group].runLog),
		};
	} else if (group === AppSettingsGroup.SystemChat) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		settings = {
			maxTokens:
				typeof newSettings?.maxTokens === "number"
					? Math.min(Math.max(newSettings.maxTokens, 512), 8192)
					: (prevSettings?.maxTokens ??
						defaultAppSettingsData[group].maxTokens),
			temperature:
				typeof newSettings?.temperature === "number"
					? Math.min(Math.max(newSettings.temperature, 0), 2)
					: (prevSettings?.temperature ??
						defaultAppSettingsData[group].temperature),
			thinkingBudgetTokens:
				typeof newSettings?.thinkingBudgetTokens === "number"
					? Math.min(Math.max(newSettings.thinkingBudgetTokens, 1024), 8192)
					: (prevSettings?.thinkingBudgetTokens ??
						defaultAppSettingsData[group].thinkingBudgetTokens),
		};
	} else if (group === AppSettingsGroup.SystemNetwork) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		settings = {
			enableProxy:
				typeof newSettings?.enableProxy === "boolean"
					? newSettings.enableProxy
					: (prevSettings?.enableProxy ??
						defaultAppSettingsData[group].enableProxy),
		};
	} else if (group === AppSettingsGroup.FunctionOcr) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		settings = {
			ocrModel: (() => {
				if (typeof newSettings?.ocrModel === "string") {
					switch (newSettings.ocrModel) {
						case OcrModel.GlmOcr:
						case OcrModel.RapidOcrV4:
						case OcrModel.RapidOcrV5:
							return newSettings.ocrModel;
					}
				}

				return prevSettings?.ocrModel ?? defaultAppSettingsData[group].ocrModel;
			})(),
			glmOcrApiConfig: normalizeChatApiConfig(
				newSettings?.glmOcrApiConfig,
				prevSettings?.glmOcrApiConfig ??
					defaultAppSettingsData[group].glmOcrApiConfig,
			),
			htmlVisionModel:
				typeof newSettings?.htmlVisionModel === "string"
					? newSettings.htmlVisionModel
					: (prevSettings?.htmlVisionModel ??
						defaultAppSettingsData[group].htmlVisionModel),
			htmlVisionModelSystemPrompt:
				typeof newSettings?.htmlVisionModelSystemPrompt === "string"
					? newSettings.htmlVisionModelSystemPrompt
					: (prevSettings?.htmlVisionModelSystemPrompt ??
						defaultAppSettingsData[group].htmlVisionModelSystemPrompt),
			markdownVisionModelSystemPrompt:
				typeof newSettings?.markdownVisionModelSystemPrompt === "string"
					? newSettings.markdownVisionModelSystemPrompt
					: (prevSettings?.markdownVisionModelSystemPrompt ??
						defaultAppSettingsData[group].markdownVisionModelSystemPrompt),
		};
	} else if (group === AppSettingsGroup.FunctionChat) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		const hasConfiguredChat = (list: unknown) =>
			Array.isArray(list) &&
			list.some(
				(item) =>
					isUsableChatApiConfig(item) ||
					(typeof item?.api_uri === "string" && item.api_uri.trim() !== "") ||
					(typeof item?.api_model === "string" && item.api_model.trim() !== ""),
			);

		let resolvedChatApiConfigList: (typeof defaultAppSettingsData)[AppSettingsGroup.FunctionChat]["chatApiConfigList"];
		if (Array.isArray(newSettings?.chatApiConfigList)) {
			if (
				newSettings.chatApiConfigList.length === 0 &&
				hasConfiguredChat(prevSettings?.chatApiConfigList)
			) {
				resolvedChatApiConfigList = [];
			} else if (hasConfiguredChat(newSettings.chatApiConfigList)) {
				resolvedChatApiConfigList = newSettings.chatApiConfigList;
			} else if (!hasConfiguredChat(prevSettings?.chatApiConfigList)) {
				resolvedChatApiConfigList =
					defaultAppSettingsData[group].chatApiConfigList;
			} else {
				resolvedChatApiConfigList = newSettings.chatApiConfigList;
			}
		} else if (prevSettings?.chatApiConfigList) {
			resolvedChatApiConfigList = prevSettings.chatApiConfigList;
		} else {
			resolvedChatApiConfigList =
				defaultAppSettingsData[group].chatApiConfigList;
		}

		settings = {
			autoCreateNewSession:
				typeof newSettings?.autoCreateNewSession === "boolean"
					? newSettings.autoCreateNewSession
					: (prevSettings?.autoCreateNewSession ??
						defaultAppSettingsData[group].autoCreateNewSession),
			// Keep incomplete rows as editable drafts. Runtime consumers filter them.
			chatApiConfigList: resolvedChatApiConfigList.map((item) =>
				normalizeChatApiConfig(item),
			),
			autoCreateNewSessionOnCloseWindow:
				typeof newSettings?.autoCreateNewSessionOnCloseWindow === "boolean"
					? newSettings.autoCreateNewSessionOnCloseWindow
					: (prevSettings?.autoCreateNewSessionOnCloseWindow ??
						defaultAppSettingsData[group].autoCreateNewSessionOnCloseWindow),
		};
	} else if (group === AppSettingsGroup.FunctionTranslationCache) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;

		settings = {
			cacheSourceLanguage:
				typeof newSettings?.cacheSourceLanguage === "string"
					? newSettings.cacheSourceLanguage
					: (prevSettings?.cacheSourceLanguage ??
						defaultAppSettingsData[group].cacheSourceLanguage),
			cacheTargetLanguage:
				typeof newSettings?.cacheTargetLanguage === "string"
					? newSettings.cacheTargetLanguage
					: (prevSettings?.cacheTargetLanguage ??
						defaultAppSettingsData[group].cacheTargetLanguage),
			cacheTranslationDomain:
				typeof newSettings?.cacheTranslationDomain === "string"
					? newSettings.cacheTranslationDomain
					: (prevSettings?.cacheTranslationDomain ??
						defaultAppSettingsData[group].cacheTranslationDomain),
			cacheTranslationType:
				typeof newSettings?.cacheTranslationType === "number" ||
				typeof newSettings?.cacheTranslationType === "string"
					? newSettings.cacheTranslationType
					: (prevSettings?.cacheTranslationType ??
						defaultAppSettingsData[group].cacheTranslationType),
		};

		settings.cacheTranslationType = normalizeTranslationType(
			settings.cacheTranslationType,
			currentSettings[AppSettingsGroup.FunctionTranslation]
				.translationApiConfigList,
		);
	} else if (group === AppSettingsGroup.FunctionTranslation) {
		newSettings = newSettings as AppSettingsData[typeof group];
		const prevSettings = currentSettings[group] as
			| AppSettingsData[typeof group]
			| undefined;
		const previousTranslationApiConfigList =
			prevSettings?.translationApiConfigList;

		const hasConfiguredTranslation = (list: unknown) =>
			Array.isArray(list) &&
			list.some(
				(item) =>
					isUsableTranslationApiConfig(item) ||
					(typeof item?.api_uri === "string" && item.api_uri.trim() !== ""),
			);

		let resolvedTranslationApiConfigList: TranslationApiConfig[];
		if (Array.isArray(newSettings?.translationApiConfigList)) {
			if (
				newSettings.translationApiConfigList.length === 0 &&
				hasConfiguredTranslation(previousTranslationApiConfigList)
			) {
				resolvedTranslationApiConfigList = [];
			} else if (
				hasConfiguredTranslation(newSettings.translationApiConfigList)
			) {
				resolvedTranslationApiConfigList = newSettings.translationApiConfigList;
			} else if (!hasConfiguredTranslation(previousTranslationApiConfigList)) {
				resolvedTranslationApiConfigList =
					defaultAppSettingsData[group].translationApiConfigList;
			} else {
				resolvedTranslationApiConfigList = newSettings.translationApiConfigList;
			}
		} else if (previousTranslationApiConfigList) {
			resolvedTranslationApiConfigList = previousTranslationApiConfigList;
		} else {
			resolvedTranslationApiConfigList =
				defaultAppSettingsData[group].translationApiConfigList;
		}

		const shouldPreservePreviousTranslationApiConfig =
			Array.isArray(newSettings?.translationApiConfigList) &&
			previousTranslationApiConfigList?.length ===
				resolvedTranslationApiConfigList.length;
		const translationApiConfigList = resolvedTranslationApiConfigList
			.map((item, index) =>
				normalizeTranslationApiConfig(
					item,
					shouldPreservePreviousTranslationApiConfig
						? previousTranslationApiConfigList[index]
						: undefined,
				),
			)
			.filter((item): item is TranslationApiConfig => !!item);

		settings = {
			translationSystemPrompt:
				typeof newSettings?.translationSystemPrompt === "string"
					? newSettings.translationSystemPrompt
					: (prevSettings?.translationSystemPrompt ??
						defaultAppSettingsData[group].translationSystemPrompt),
			optimizeAiTranslationLayout:
				typeof newSettings?.optimizeAiTranslationLayout === "boolean"
					? newSettings.optimizeAiTranslationLayout
					: (prevSettings?.optimizeAiTranslationLayout ??
						defaultAppSettingsData[group].optimizeAiTranslationLayout),
			translationMaxTokens:
				typeof newSettings?.translationMaxTokens === "number"
					? Math.min(Math.max(newSettings.translationMaxTokens, 512), 8192)
					: (prevSettings?.translationMaxTokens ??
						defaultAppSettingsData[group].translationMaxTokens),
			translationTemperature:
				typeof newSettings?.translationTemperature === "number"
					? Math.min(Math.max(newSettings.translationTemperature, 0), 2)
					: (prevSettings?.translationTemperature ??
						defaultAppSettingsData[group].translationTemperature),
			translationTopP:
				typeof newSettings?.translationTopP === "number"
					? Math.min(Math.max(newSettings.translationTopP, 0), 1)
					: (prevSettings?.translationTopP ??
						defaultAppSettingsData[group].translationTopP),
			translationTimeoutMs:
				typeof newSettings?.translationTimeoutMs === "number"
					? Math.min(Math.max(newSettings.translationTimeoutMs, 5000), 300000)
					: (prevSettings?.translationTimeoutMs ??
						defaultAppSettingsData[group].translationTimeoutMs),
			translationApiConfigList,
			defaultTranslationApiConfigInitialized: true,
			sourceLanguage:
				typeof newSettings?.sourceLanguage === "string"
					? newSettings.sourceLanguage
					: (prevSettings?.sourceLanguage ??
						defaultAppSettingsData[group].sourceLanguage),
			targetLanguage:
				typeof newSettings?.targetLanguage === "string"
					? newSettings.targetLanguage
					: (prevSettings?.targetLanguage ??
						defaultAppSettingsData[group].targetLanguage),
			translationDomain:
				typeof newSettings?.translationDomain === "string"
					? newSettings.translationDomain
					: (prevSettings?.translationDomain ??
						defaultAppSettingsData[group].translationDomain),
			translationType:
				typeof newSettings?.translationType === "number" ||
				typeof newSettings?.translationType === "string"
					? newSettings.translationType
					: (prevSettings?.translationType ??
						defaultAppSettingsData[group].translationType),
		};

		settings.translationType = normalizeTranslationType(
			settings.translationType,
			settings.translationApiConfigList,
		);
	} else {
		return undefined;
	}

	return settings;
};
