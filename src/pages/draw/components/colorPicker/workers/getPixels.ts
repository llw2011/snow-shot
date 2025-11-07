export type DecodeResult = {
	data: ImageData;
	width: number;
	height: number;
};

let decodeWorker: Worker | undefined;

export function registerWebWorker() {
	try {
		decodeWorker = new Worker(new URL("./getPixelsWorker.ts", import.meta.url));
	} catch (error) {
		console.error("Failed to create decodeWorker:", error);
	}
}

export async function getPixels(
	wasmModuleArrayBuffer: ArrayBuffer,
	imageBuffer: ArrayBuffer,
): Promise<DecodeResult> {
	return new Promise((resolve, reject) => {
		// 如果 worker 未初始化，自动创建
		if (!decodeWorker) {
			registerWebWorker();
		}

		if (!decodeWorker) {
			reject(new Error("getPixels: Failed to create decodeWorker"));
			return;
		}

		decodeWorker.onmessage = (event: MessageEvent<DecodeResult>) => {
			resolve(event.data);
		};

		decodeWorker.onerror = (error) => {
			reject(error);
		};

		decodeWorker.postMessage({ imageBuffer, wasmModuleArrayBuffer });
	});
}

export function terminateWebWorker() {
	if (decodeWorker) {
		decodeWorker.terminate();
		decodeWorker = undefined;
	}
}
