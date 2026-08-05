import {
	SOURCE_LANGUAGE_ENV_VARIABLE,
	TARGET_LANGUAGE_ENV_VARIABLE,
	TRANSLATION_DOMAIN_ENV_VARIABLE,
} from "@/constants/components/translation";

export const getTranslationPrompt = (
	chatPrompt: string,
	sourceLanguage: string,
	targetLanguage: string,
	translationDomain: string,
) => {
	const replacePromptVariable = (
		prompt: string,
		variable: string,
		value: string,
	) => prompt.split(variable).join(value);

	return replacePromptVariable(
		replacePromptVariable(
			replacePromptVariable(
				chatPrompt,
				SOURCE_LANGUAGE_ENV_VARIABLE,
				sourceLanguage,
			),
			TARGET_LANGUAGE_ENV_VARIABLE,
			targetLanguage,
		),
		TRANSLATION_DOMAIN_ENV_VARIABLE,
		translationDomain,
	);
};
