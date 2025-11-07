"use client";

import type {
	ExcalidrawPropsCustomOptions,
	NormalizedZoomValue,
} from "@mg-chao/excalidraw/types";
import { theme } from "antd";
import React, {
	Suspense,
	useCallback,
	useContext,
	useImperativeHandle,
	useMemo,
	useRef,
} from "react";
import { DrawCore } from "@/components/drawCore";
import { useHistory } from "@/components/drawCore/components/historyContext";
import {
	type DrawCoreActionType,
	DrawCoreContext,
	type DrawCoreContextValue,
	DrawStatePublisher,
	ExcalidrawEventPublisher,
} from "@/components/drawCore/extra";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import type { ElementRect } from "@/types/commands/screenshot";
import { DrawState } from "@/types/draw";
import { zIndexs } from "@/utils/zIndex";
import { DrawContext } from "../../types";
import type { DragElementOptionalConfig } from "../drawToolbar/components/dragButton";
import { useMonitorRect } from "../statusBar";
import type { DrawLayerActionType } from "./extra";

const DrawLayerCore: React.FC<{
	actionRef: React.RefObject<DrawLayerActionType | undefined>;
}> = ({ actionRef }) => {
	const { token } = theme.useToken();
	const drawCoreActionRef = useRef<DrawCoreActionType | undefined>(undefined);
	const { mousePositionRef } = useContext(DrawContext);
	const [, setExcalidrawEvent] = useStateSubscriber(
		ExcalidrawEventPublisher,
		undefined,
	);

	const { history } = useHistory();

	/**
	 * 结束绘制，终止画布正在进行的绘制操作
	 */
	const finishDraw = useCallback(() => {
		drawCoreActionRef.current?.finishDraw();
	}, []);

	const clearHistory = useCallback(() => {
		drawCoreActionRef.current?.getExcalidrawAPI()?.history.clear();
		history.clear();
	}, [history]);

	useImperativeHandle(actionRef, (): DrawLayerActionType => {
		return {
			setActiveTool: (...args) => {
				drawCoreActionRef.current?.setActiveTool?.(...args);
			},
			syncActionResult: (...args) => {
				drawCoreActionRef.current?.syncActionResult(...args);
			},
			updateScene: (...args) => {
				drawCoreActionRef.current?.updateScene(...args);
			},
			onCaptureReady: async () => {
				drawCoreActionRef.current?.updateScene({
					elements: [],
				});
				setExcalidrawEvent({
					event: "onDraw",
					params: undefined,
				});
				setExcalidrawEvent(undefined);
			},
			finishDraw,
			onCaptureFinish: async () => {
				drawCoreActionRef.current?.setActiveTool({
					type: "hand",
				});
				drawCoreActionRef.current?.updateScene({
					elements: [],
					appState: {
						// 清除在编辑中的元素
						newElement: null,
						editingTextElement: null,
						selectedLinearElement: null,
						zoom: {
							value: 1 as NormalizedZoomValue,
						},
						scrollX: 0,
						scrollY: 0,
					},
					captureUpdate: "IMMEDIATELY",
				});
				clearHistory();
			},
			getAppState: () => {
				return drawCoreActionRef.current?.getAppState();
			},
			getImageBitmap: async (...args) => {
				return await drawCoreActionRef.current?.getImageBitmap(...args);
			},
			getCanvasContext: () => {
				return drawCoreActionRef.current?.getCanvasContext();
			},
			getCanvas: () => {
				return drawCoreActionRef.current?.getCanvas();
			},
			getDrawCacheLayerElement: () => {
				return drawCoreActionRef.current?.getDrawCacheLayerElement();
			},
			getExcalidrawAPI: () => {
				return drawCoreActionRef.current?.getExcalidrawAPI();
			},
			clearHistory,
			getDrawCoreAction: () => {
				return drawCoreActionRef.current;
			},
		};
	}, [clearHistory, finishDraw, setExcalidrawEvent]);

	const { selectLayerActionRef } = useContext(DrawContext);

	const {
		contentScale: [, , contentScaleRef],
		calculatedBoundaryRect,
	} = useMonitorRect(true);
	const drawCoreContextValue = useMemo<DrawCoreContextValue>(() => {
		return {
			getLimitRect: () => {
				return selectLayerActionRef.current?.getSelectRect();
			},
			getDevicePixelRatio: () => {
				return window.devicePixelRatio;
			},
			getBaseOffset: (limitRect: ElementRect, devicePixelRatio: number) => {
				return {
					x:
						limitRect.max_x / devicePixelRatio +
						token.marginXXS * contentScaleRef.current,
					y: limitRect.min_y / devicePixelRatio,
				};
			},
			getDragElementOptionalConfig: (
				limitRect: ElementRect,
				devicePixelRatio: number,
			): DragElementOptionalConfig[] => {
				return [
					{
						config: {
							getBaseOffset: (element: HTMLElement) => {
								return {
									x:
										limitRect.min_x / devicePixelRatio -
										token.marginXXS * contentScaleRef.current -
										element.clientWidth * contentScaleRef.current,
									y: limitRect.min_y / devicePixelRatio,
								};
							},
						},
						needTry: (dragRes) => {
							return dragRes.isBeyondMaxX;
						},
						canApply: (dragRes) => {
							return !(dragRes.isBeyondMaxX || dragRes.isBeyondMinX);
						},
					},
				];
			},
			getAction: () => {
				return drawCoreActionRef.current;
			},
			getMousePosition: () => {
				return mousePositionRef.current;
			},
			calculatedBoundaryRect,
			getContentScale: () => {
				return contentScaleRef.current;
			},
		};
	}, [
		calculatedBoundaryRect,
		selectLayerActionRef,
		token.marginXXS,
		mousePositionRef,
		contentScaleRef,
	]);

	const excalidrawCustomOptions = useMemo<
		NonNullable<ExcalidrawPropsCustomOptions>
	>(() => {
		return {
			getReferenceSnapPoints: (defaultFn) => {
				return (...params: Parameters<typeof defaultFn>) => {
					const appState = params[2];
					const selectRect = selectLayerActionRef.current?.getSelectRect();

					const innerPadding = 3 * window.devicePixelRatio;

					const selectRectPoints: [number, number][] = selectRect
						? [
								[
									selectRect.min_x + innerPadding,
									selectRect.min_y + innerPadding,
								],
								[
									selectRect.max_x - innerPadding,
									selectRect.min_y + innerPadding,
								],
								[
									selectRect.max_x - innerPadding,
									selectRect.max_y - innerPadding,
								],
								[
									selectRect.min_x + innerPadding,
									selectRect.max_y - innerPadding,
								],
							].map(([x, y]) => {
								const canvasX =
									x / appState.zoom.value / window.devicePixelRatio -
									appState.scrollX;
								const canvasY =
									y / appState.zoom.value / window.devicePixelRatio -
									appState.scrollY;

								return [canvasX, canvasY];
							})
						: [];

					return defaultFn(...params).concat(
						selectRectPoints as ReturnType<typeof defaultFn>,
					);
				};
			},
		};
	}, [selectLayerActionRef]);

	/** 在 OCR、扫描二维码时禁用画布 */
	useStateSubscriber(
		DrawStatePublisher,
		useCallback((drawState: DrawState) => {
			const drawCoreElement =
				drawCoreActionRef.current?.getDrawCacheLayerElement();
			if (drawCoreElement) {
				if (
					drawState === DrawState.OcrTranslate ||
					drawState === DrawState.OcrDetect ||
					drawState === DrawState.ScanQrcode ||
					drawState === DrawState.ExtraTools ||
					drawState === DrawState.VideoRecord ||
					drawState === DrawState.ScrollScreenshot
				) {
					drawCoreElement.style.pointerEvents = "none";
				} else {
					drawCoreElement.style.pointerEvents = "auto";
				}
			}
		}, []),
	);

	return (
		<DrawCoreContext.Provider value={drawCoreContextValue}>
			<Suspense>
				<DrawCore
					actionRef={drawCoreActionRef}
					zIndex={zIndexs.Draw_DrawCacheLayer}
					layoutMenuZIndex={zIndexs.Draw_ExcalidrawToolbar}
					excalidrawCustomOptions={excalidrawCustomOptions}
				/>
			</Suspense>
		</DrawCoreContext.Provider>
	);
};

export const DrawLayer = React.memo(DrawLayerCore);
