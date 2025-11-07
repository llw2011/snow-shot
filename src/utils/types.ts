export enum ScreenshotType {
	Default = "default",
	Fixed = "fixed",
	Delay = "delay",
	OcrDetect = "ocr-detect",
	OcrTranslate = "ocr-translate",
	TopWindow = "top-window",
	Copy = "copy",
	VideoRecord = "video-record",
	SwitchCaptureHistory = "switch-capture-history",
	CaptureFullScreen = "capture-full-screen",
}

export type VideoRecordWindowInfo = {
	select_rect_max_x: number;
	select_rect_max_y: number;
	select_rect_min_x: number;
	select_rect_min_y: number;
};

export enum ResizeWindowSide {
	Top = "Top",
	Bottom = "Bottom",
	Left = "Left",
	Right = "Right",
}
