import { getCurrentWindow } from "@tauri-apps/api/window";

export const sendErrorMessage = (message: string) => {
	getCurrentWindow().emit("main-window:send-error-message", message);
};
