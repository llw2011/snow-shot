import { supportWebViewSharedBuffer } from "./environment";

export const getWebViewSharedBuffer = (
	channelId?: string,
	transferType?: string,
): Promise<ArrayBuffer | undefined> => {
	if (!supportWebViewSharedBuffer()) {
		return Promise.resolve(undefined);
	}

	// Windows 下支持通过 SharedBuffer 传输图像数据
	return new Promise((resolve) => {
		const handleSharedBufferReceived = (e: {
			getBuffer: () => ArrayBuffer;
			additionalData?: Record<string, unknown>;
		}) => {
			if (transferType && e.additionalData?.transfer_type !== transferType) {
				return;
			}

			if (channelId && e.additionalData?.id !== channelId) {
				return;
			}

			clearTimeout(timeout);

			const buffer = e.getBuffer();

			resolve(buffer);
			window.chrome.webview.removeEventListener(
				"sharedbufferreceived",
				handleSharedBufferReceived,
			);
		};

		window.chrome.webview.addEventListener(
			"sharedbufferreceived",
			handleSharedBufferReceived,
		);

		const timeout = setTimeout(() => {
			resolve(undefined);
			window.chrome.webview.removeEventListener(
				"sharedbufferreceived",
				handleSharedBufferReceived,
			);
		}, 1000 * 3);
	});
};

export const releaseWebViewSharedBuffer = (buffer: ArrayBuffer) => {
	if (!supportWebViewSharedBuffer()) {
		return;
	}
	window.chrome.webview.releaseBuffer(buffer);
};
