import { invoke } from "@tauri-apps/api/core";
import type { CaptureState } from "@/types/commands/global_state";

export const setCaptureState = async (capturing: boolean) => {
	const result = await invoke<void>("set_capture_state", { capturing });
	return result;
};

export const getCaptureState = async () => {
	const result = await invoke<CaptureState>("get_capture_state");
	return result;
};

export type ReadClipboardState = {
	reading: boolean;
};

export const setReadClipboardState = async (reading: boolean) => {
	const result = await invoke<void>("set_read_clipboard_state", { reading });
	return result;
};

export const getReadClipboardState = async () => {
	const result = await invoke<ReadClipboardState>("get_read_clipboard_state");
	return result;
};
