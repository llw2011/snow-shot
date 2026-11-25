import { type ServiceDetection, suggestServiceName } from "./detection.js";
import {
	getModelServiceKey,
	type ModelService,
	type ModelServiceUses,
} from "./serviceModel.js";

export type InputDetection = {
	uriInput: string;
	keyInput: string;
	result: ServiceDetection | undefined;
};

/** A detected address/model may only be saved with the input that produced it. */
export const buildServiceDraft = (
	uriInput: string,
	keyInput: string,
	inputDetection: InputDetection | undefined,
	selectedModel: string | undefined,
	uses: ModelServiceUses,
): { detection?: ServiceDetection; service?: ModelService } => {
	const detection =
		uriInput.trim() &&
		inputDetection?.uriInput === uriInput &&
		inputDetection.keyInput === keyInput
			? inputDetection.result
			: undefined;
	const model = detection?.models.find((item) => item.id === selectedModel);
	if (
		!detection ||
		(detection.provider !== "deepl" && (detection.status !== "ok" || !model))
	) {
		return { detection };
	}

	const service: ModelService = {
		key: "",
		kind: detection.provider === "deepl" ? "deepl" : "openai",
		name: suggestServiceName(detection.provider, model?.id ?? ""),
		apiUri: detection.apiUri,
		apiKey: keyInput.trim(),
		apiModel: model?.id ?? "",
		supportThinking: !!model?.thinking,
		supportVision: !!model?.vision,
		deeplPreferQualityOptimized: false,
		uses,
	};
	service.key = getModelServiceKey(service);
	return { detection, service };
};
