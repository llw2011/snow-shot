import { invoke } from "@tauri-apps/api/core";
import type { OcrModel } from "@/types/appSettings";
import type { OcrDetectResult } from "@/types/commands/ocr";

export const ocrDetect = async (
	data: ArrayBuffer | Uint8Array,
	scaleFactor: number,
	detectAngle: boolean,
): Promise<OcrDetectResult> => {
	return await invoke<OcrDetectResult>("ocr_detect", data, {
		headers: {
			"x-scale-factor": scaleFactor.toFixed(3),
			"x-detect-angle": detectAngle ? "true" : "false",
		},
	});
};

export const ocrDetectWithSharedBuffer = async (
	channelId: string,
	scaleFactor: number,
	detectAngle: boolean,
): Promise<OcrDetectResult> => {
	return await invoke<OcrDetectResult>("ocr_detect_with_shared_buffer", {
		channelId,
		scaleFactor,
		detectAngle,
	});
};

export const ocrInit = async (
	orcPluginPath: string,
	model: OcrModel,
	hotStart: boolean,
	modelWriteToMemory: boolean,
): Promise<void> => {
	await invoke<void>("ocr_init", {
		orcPluginPath,
		model,
		hotStart,
		modelWriteToMemory,
	});
};

export const ocrRelease = async (): Promise<void> => {
	await invoke<void>("ocr_release");
};
