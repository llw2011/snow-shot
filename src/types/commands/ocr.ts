export interface OcrDetectResultTextPoint {
	x: number;
	y: number;
}

export interface OcrDetectResultTextBlock {
	box_points: OcrDetectResultTextPoint[];
	text: string;
	text_score: number;
}

export interface OcrDetectResult {
	text_blocks: OcrDetectResultTextBlock[];
	scale_factor: number;
}
