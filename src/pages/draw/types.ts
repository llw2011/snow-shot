import React from "react";
import type { ImageLayerActionType } from "@/components/imageLayer";
import type { ImageBuffer } from "@/types/commands/screenshot";
import { MousePosition } from "@/utils/mousePosition";
import type { CaptureHistoryActionType } from "./components/captureHistory";
import type { ColorPickerActionType } from "./components/colorPicker";
import type { DrawLayerActionType } from "./components/drawLayer/extra";
import type { DrawToolbarActionType } from "./components/drawToolbar";
import type { OcrBlocksActionType } from "./components/ocrBlocks";
import type { SelectLayerActionType } from "./components/selectLayer";
import type { CaptureBoundingBoxInfo } from "./extra";
import type { ImageSharedBufferData } from "./tools";

export enum CaptureStep {
	// 选择阶段
	Select = 1,
	// 绘制阶段
	Draw = 2,
	// 固定阶段
	Fixed = 3,
}

export enum CanvasLayer {
	Draw = 1,
	Select = 2,
}

export type DrawContextType = {
	finishCapture: (clearScrollScreenshot?: boolean) => Promise<void>;
	imageLayerActionRef: React.RefObject<ImageLayerActionType | undefined>;
	selectLayerActionRef: React.RefObject<SelectLayerActionType | undefined>;
	imageBufferRef: React.RefObject<
		ImageBuffer | ImageSharedBufferData | undefined
	>;
	mousePositionRef: React.RefObject<MousePosition>;
	drawToolbarActionRef: React.RefObject<DrawToolbarActionType | undefined>;
	circleCursorRef: React.RefObject<HTMLDivElement | null>;
	drawLayerActionRef: React.RefObject<DrawLayerActionType | undefined>;
	ocrBlocksActionRef: React.RefObject<OcrBlocksActionType | undefined>;
	colorPickerActionRef: React.RefObject<ColorPickerActionType | undefined>;
	captureBoundingBoxInfoRef: React.RefObject<
		CaptureBoundingBoxInfo | undefined
	>;
	captureHistoryActionRef: React.RefObject<
		CaptureHistoryActionType | undefined
	>;
};

export const DrawContext = React.createContext<DrawContextType>({
	mousePositionRef: { current: new MousePosition(0, 0) },
	imageBufferRef: { current: undefined },
	finishCapture: () => Promise.resolve(),
	imageLayerActionRef: { current: undefined },
	selectLayerActionRef: { current: undefined },
	drawToolbarActionRef: { current: undefined },
	circleCursorRef: { current: null },
	drawLayerActionRef: { current: undefined },
	ocrBlocksActionRef: { current: undefined },
	colorPickerActionRef: { current: undefined },
	captureBoundingBoxInfoRef: { current: undefined },
	captureHistoryActionRef: { current: undefined },
});
