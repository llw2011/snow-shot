import { invoke } from "@tauri-apps/api/core";
import { supportWebViewSharedBuffer } from "@/utils/environment";

export const createWebViewSharedBuffer = async (
	data: ArrayBuffer,
	transferType: string,
) => {
	const result = await invoke<void>("create_webview_shared_buffer", {
		data,
		transferType,
	});
	return result;
};

export const setSupportWebViewSharedBuffer = async (value: boolean) => {
	const result = await invoke<void>("set_support_webview_shared_buffer", {
		value,
	});
	return result;
};

export const createWebViewSharedBufferChannel = async (
	channelId: string,
	dataSize: number,
) => {
	if (!supportWebViewSharedBuffer()) {
		return false;
	}

	const result = await invoke<boolean>("create_webview_shared_buffer_channel", {
		channelId,
		dataSize,
	});
	return result;
};
