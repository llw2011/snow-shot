import { emit } from "@tauri-apps/api/event";

export const releaseOcrSession = async () => {
	await emit("release-ocr-session");
};
