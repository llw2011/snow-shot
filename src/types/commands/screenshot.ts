export enum ImageEncoder {
	Png = "png",
	WebP = "webp",
}

export enum ImageBufferType {
	// 原始的像素数据
	Pixels = "pixels",
	// 通过 SharedBuffer 传输的特殊标记
	SharedBuffer = "shared-buffer",
}

export type ImageBuffer = {
	encoder: ImageEncoder;
	data: Blob;
	bufferType: ImageBufferType;
	buffer: ArrayBuffer;
};

export type ElementRect = {
	min_x: number;
	min_y: number;
	max_x: number;
	max_y: number;
};

export type WindowElement = {
	element_rect: ElementRect;
	window_id: number;
};

export type CaptureFullScreenResult = {
	monitor_rect: ElementRect;
};
