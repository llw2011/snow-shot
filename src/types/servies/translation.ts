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
