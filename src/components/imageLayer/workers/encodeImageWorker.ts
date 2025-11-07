import type { ImageSharedBufferData } from "@/pages/draw/tools";

self.onmessage = async (
	event: MessageEvent<{
		imageSharedBuffer: ImageSharedBufferData;
	}>,
) => {
	const { imageSharedBuffer } = event.data;

	if (typeof OffscreenCanvas === "undefined") {
		throw new Error("[encodeImageWorker] OffscreenCanvas is not supported");
	}

	const canvase = new OffscreenCanvas(
		imageSharedBuffer.width,
		imageSharedBuffer.height,
	);
	const ctx = canvase.getContext("2d");
	if (!ctx) {
		throw new Error("[encodeImageWorker] Failed to get context");
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

	const image = await canvase.convertToBlob({ type: "image/png" });
	const arrayBuffer = await image.arrayBuffer();

	self.postMessage(
		{
			image: arrayBuffer,
		},
		{
			transfer: [arrayBuffer],
		},
	);
};
