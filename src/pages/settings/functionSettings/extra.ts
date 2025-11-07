import type { ChatApiConfig } from "@/types/appSettings";

export const fliterChatApiConfig = (configList: ChatApiConfig[]) => {
	return configList.filter(
		(item) => item.api_key && item.api_uri && item.api_model && item.model_name,
	);
};

export const convertLanguageCodeToDeepLSourceLanguageCode = (
	languageCode: string,
): string | null => {
	switch (languageCode) {
		case "en":
			return "EN";
		case "zh-CHS":
			return "ZH";
		case "zh-CHT":
			return "ZH";
		case "es":
			return "ES";
		case "fr":
			return "FR";
		case "ar":
			return "AR";
		case "de":
			return "DE";
		case "it":
			return "IT";
		case "ja":
			return "JA";
		case "pt":
			return "PT";
		case "ru":
			return "RU";
		case "tr":
			return "TR";
		default:
			return null;
	}
};

export const convertLanguageCodeToDeepLTargetLanguageCode = (
	languageCode: string,
): string => {
	switch (languageCode) {
		case "en":
			return "EN-US";
		case "zh-CHS":
			return "ZH-HANS";
		case "zh-CHT":
			return "ZH-HANT";
		case "es":
			return "ES";
		case "fr":
			return "FR";
		case "ar":
			return "AR";
		case "de":
			return "DE";
		case "it":
			return "IT";
		case "ja":
			return "JA";
		case "pt":
			return "PT-PT";
		case "ru":
			return "RU";
		case "tr":
			return "TR";
		default:
			return "EN-US";
	}
};
