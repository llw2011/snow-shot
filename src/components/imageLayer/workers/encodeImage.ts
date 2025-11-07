import type { ImageSharedBufferData } from "@/pages/draw/tools";

export type DecodeResult = {
	data: ImageData;
	width: number;
	height: number;
};

export async function encodeImage(
	encodeImageWorker: Worker | undefined,
	imageSharedBuffer: ImageSharedBufferData,
): Promise<ArrayBuffer | undefined> {
	if (!encodeImageWorker) {
		const canvase = new HTMLCanvasElement();
		canvase.width = imageSharedBuffer.width;
		canvase.height = imageSharedBuffer.height;
		const ctx = canvase.getContext("2d");
		if (!ctx) {
			return undefined;
		}

		ctx.putImageData(
			new ImageData(
				imageSharedBuffer.sharedBuffer,
				imageSharedBuffer.width,
				imageSharedBuffer.height,
			),
			0,
			0,
		);

		const image = new Promise<ArrayBuffer | undefined>((resolve) => {
			canvase.toBlob(
				async (blob) => {
					if (!blob) {
						resolve(undefined);
						return;
					}

					resolve(await blob.arrayBuffer());
				},
				"image/png",
				1,
			);
		});

		return image;
	}

	return new Promise((resolve, reject) => {
		if (!encodeImageWorker) {
			reject(new Error("[encodeImage] encodeImageWorker is not registered"));
			return;
		}

		encodeImageWorker.onmessage = async (
			event: MessageEvent<{
				image: ArrayBuffer;
			}>,
		) => {
			resolve(event.data.image);
		};

		encodeImageWorker.onerror = (error) => {
			reject(error);
		};

		encodeImageWorker.postMessage(
			{ imageSharedBuffer },
			{
				transfer: [imageSharedBuffer.sharedBuffer.buffer],
			},
		);
	});
}
