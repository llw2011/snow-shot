export enum TranslationType {
	Youdao = 0,
	DeepSeek = 1,
	QwenTurbo = 2,
	QwenPlus = 3,
	QwenMax = 4,
}

export enum TranslationDomain {
	General = "general",
	Computers = "computers",
	Medicine = "medicine",
	Finance = "finance",
	Game = "game",
}

export interface TranslateParams {
	/**
	 * 需要翻译的内容
	 */
	content: string[];
	/**
	 * 源语言
	 */
	from: string;
	/**
	 * 目标语言
	 */
	to: string;
	/**
	 * 领域
	 */
	domain: TranslationDomain;
	/**
	 * 翻译类型
	 */
	type: TranslationType;
}

export interface TranslateData {
	/**
	 * 翻译后的内容
	 */
	results: {
		content: string;
	}[];
	/**
	 * 源语言
	 */
	from?: string;
	/**
	 * 目标语言
	 */
	to?: string;
}

export type TranslationTypeOption = {
	type: TranslationType;
	name: string;
};

export type DeepLTranslateResult = {
	translations: {
		detected_source_language: string;
		text: string;
	}[];
};
