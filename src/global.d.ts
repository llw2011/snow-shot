/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ServiceResponse } from "./services/tools";

declare global {
	interface Window {
		__APP_AUTO_START_HIDE_WINDOW__: boolean;
		__APP_HANDLE_HTTP_ERROR__:
			| ((response: ServiceResponse<unknown>) => void)
			| undefined;
		__APP_HANDLE_SERVICE_ERROR__:
			| ((response: ServiceResponse<unknown>) => void)
			| undefined;
		__APP_HANDLE_REQUEST_ERROR__:
			| ((response: ServiceResponse<unknown>) => void)
			| undefined;
		__APP_ACCEPT_LANGUAGE__: string;
		chrome: {
			webview: {
				addEventListener: (
					event: string,
					callback: (e: { getBuffer: () => ArrayBuffer }) => void,
				) => void;
				removeEventListener: (
					event: string,
					callback: (e: {
						getBuffer: () => SharedBuffer;
						additionalData?: Record<string, unknown>;
					}) => void,
				) => void;
				releaseBuffer: (buffer: SharedBuffer) => void;
			};
		};
	}
}
