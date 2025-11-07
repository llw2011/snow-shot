export enum ImageFormat {
	PNG = "image/png",
	JPEG = "image/jpeg",
	WEBP = "image/webp",
	AVIF = "image/avif",
	JPEG_XL = "image/jpeg-xl",
}

export type ImagePath = {
	filePath: string;
	imageFormat: ImageFormat;
};
