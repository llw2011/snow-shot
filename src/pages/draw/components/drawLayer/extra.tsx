import type {
	AppState,
	ExcalidrawActionType,
	ExcalidrawImperativeAPI,
} from "@mg-chao/excalidraw/types";
import type { DrawCoreActionType } from "@/components/drawCore/extra";
import type { ElementRect } from "@/types/commands/screenshot";

export type DrawLayerActionType = {
	setActiveTool: DrawCoreActionType["setActiveTool"];
	syncActionResult: ExcalidrawActionType["syncActionResult"];
	updateScene: ExcalidrawImperativeAPI["updateScene"];
	onCaptureReady: () => Promise<void>;
	onCaptureFinish: () => Promise<void>;
	getImageBitmap: (selectRect: ElementRect) => Promise<ImageBitmap | undefined>;
	getCanvasContext: () => CanvasRenderingContext2D | null | undefined;
	getCanvas: () => HTMLCanvasElement | null | undefined;
	getAppState: () => AppState | undefined;
	getDrawCacheLayerElement: () => HTMLDivElement | null | undefined;
	getExcalidrawAPI: () => ExcalidrawImperativeAPI | undefined;
	finishDraw: () => void;
	clearHistory: () => void;
	getDrawCoreAction: () => DrawCoreActionType | undefined;
};
