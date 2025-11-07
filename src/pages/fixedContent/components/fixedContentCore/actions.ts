import type { RefObject } from "react";
import type { ElementRect } from "@/types/commands/screenshot";
import { appError } from "@/utils/log";
import type { FixedContentCoreDrawActionType } from "./components/drawLayer";
import type { FixedContentImageLayerActionType } from "./components/imageLayer";

export const renderToCanvasAction = async (
	imageLayerActionRef: RefObject<FixedContentImageLayerActionType | undefined>,
	drawActionRef: RefObject<FixedContentCoreDrawActionType | undefined>,
	ignoreDrawCanvas: boolean = false,
	renderRect: ElementRect,
) => {
	const imageLayerAction = imageLayerActionRef.current?.getImageLayerAction();
	if (!imageLayerAction) {
		appError("[renderToCanvas] imageLayerAction is undefined");
		return;
	}

	const sourceBitmap = await imageLayerAction.getImageBitmap(renderRect);
	if (!sourceBitmap) {
		appError("[renderToCanvas] sourceBitmap is undefined");
		return;
	}

	const canvas = document.createElement("canvas");
	canvas.width = sourceBitmap.width;
	canvas.height = sourceBitmap.height;

	const context = canvas.getContext("2d");
	if (!context) {
		return;
	}

	context.drawImage(
		sourceBitmap,
		0,
		0,
		sourceBitmap.width,
		sourceBitmap.height,
	);

	const drawCanvas = drawActionRef.current?.getCanvas();
	if (drawCanvas && !ignoreDrawCanvas) {
		context.drawImage(drawCanvas, 0, 0, canvas.width, canvas.height);
	}

	return canvas;
};
