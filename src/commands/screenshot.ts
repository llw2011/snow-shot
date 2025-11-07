import { invoke } from "@tauri-apps/api/core";
import type { HdrColorAlgorithm } from "@/types/appSettings";
import {
	type CaptureFullScreenResult,
	type ImageBuffer,
	ImageBufferType,
	ImageEncoder,
} from "@/types/commands/screenshot";

export const switchAlwaysOnTop = async (windowId: number) => {
	const result = await invoke<string>("switch_always_on_top", {
		windowId,
	});
	return result;
};

export const setDrawWindowStyle = async () => {
	const result = await invoke("set_draw_window_style");
	return result;
};

/**
 * 捕获焦点窗口
 * @param filePath 文件路径
 * @param copyToClipboard 是否复制到剪贴板
 */
export const captureFocusedWindow = async (
	filePath: string,
	copyToClipboard: boolean,
	focusWindowAppNameVariableName: string,
	correctHdrColorAlgorithm: HdrColorAlgorithm,
) => {
	const result = await invoke("capture_focused_window", {
		filePath,
		copyToClipboard,
		focusWindowAppNameVariableName,
		correctHdrColorAlgorithm,
	});
	return result;
};

export const captureAllMonitors = async (
	enableMultipleMonitor: boolean,
	correctHdrColorAlgorithm: HdrColorAlgorithm,
	correctColorFilter: boolean,
): Promise<ImageBuffer | undefined> => {
	const result = await invoke<ArrayBuffer>("capture_all_monitors", {
		enableMultipleMonitor,
		correctHdrColorAlgorithm,
		correctColorFilter,
	});

	if (result.byteLength === 0) {
		return undefined;
	}

	let type = ImageBufferType.Pixels;
	if (result.byteLength === 1) {
		if (new Uint8Array(result)[0] === 1) {
			type = ImageBufferType.SharedBuffer;
		}
	}

	return {
		encoder: ImageEncoder.Png,
		data: new Blob([result]),
		buffer: result,
		bufferType: type,
	};
};

export const captureFullScreen = async (
	enableMultipleMonitor: boolean,
	filePath: string,
	copyToClipboard: boolean,
	captureHistoryFilePath: string,
	correctHdrColorAlgorithm: HdrColorAlgorithm,
	correctColorFilter: boolean,
): Promise<CaptureFullScreenResult> => {
	const result = await invoke<CaptureFullScreenResult>("capture_full_screen", {
		enableMultipleMonitor,
		filePath,
		copyToClipboard,
		captureHistoryFilePath,
		correctHdrColorAlgorithm,
		correctColorFilter,
	});
	return result;
};
