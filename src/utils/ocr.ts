import {
	type AppSettingsData,
	AppSettingsGroup,
	OcrModel,
} from "@/types/appSettings";

export const isGlmOcrModel = (ocrModel: OcrModel | string | undefined) =>
	ocrModel === OcrModel.GlmOcr;

export const isRapidOcrModel = (ocrModel: OcrModel | string | undefined) =>
	ocrModel === OcrModel.RapidOcrV4 || ocrModel === OcrModel.RapidOcrV5;

export const canUseOcr = (
	appSettings: AppSettingsData,
	glmOcrReady: boolean | undefined,
	rapidOcrReady: boolean | undefined,
) => {
	const ocrModel = appSettings[AppSettingsGroup.FunctionOcr].ocrModel;
	if (!glmOcrReady) {
		return false;
	}

	return (
		isGlmOcrModel(ocrModel) || (isRapidOcrModel(ocrModel) && !!rapidOcrReady)
	);
};
