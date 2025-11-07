import { useCallback, useContext, useRef } from "react";
import {
	type ExcalidrawEventOnChangeParams,
	type ExcalidrawEventParams,
	ExcalidrawEventPublisher,
	type ExcalidrawOnHandleEraserParams,
	ExcalidrawOnHandleEraserPublisher,
} from "@/components/drawCore/extra";
import { DRAW_LAYER_HIGHLIGHT_CONTAINER_KEY } from "@/components/imageLayer";
import type { HighlightElementProps } from "@/components/imageLayer/baseLayerRenderActions";
import { useCallbackAsyncRender } from "@/hooks/useCallbackAsyncRender";
import {
	useCallbackRender,
	useCallbackRenderSlow,
} from "@/hooks/useCallbackRender";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import {
	DrawEvent,
	type DrawEventParams,
	DrawEventPublisher,
} from "@/pages/draw/extra";
import { DrawContext } from "@/pages/fullScreenDraw/extra";

const isEqualHighlightSpriteProps = (
	a: Omit<HighlightElementProps, "valid">,
	b: Omit<HighlightElementProps, "valid">,
) => {
	return (
		a.x === b.x &&
		a.y === b.y &&
		a.width === b.width &&
		a.height === b.height &&
		a.angle === b.angle &&
		a.zoom === b.zoom &&
		a.opacity === b.opacity &&
		a.strokeColor === b.strokeColor &&
		a.strokeWidth === b.strokeWidth &&
		a.backgroundColor === b.backgroundColor &&
		a.maskColor === b.maskColor &&
		a.maskOpacity === b.maskOpacity &&
		a.borderType === b.borderType &&
		a.shapeType === b.shapeType
	);
};

const HighlightToolCore: React.FC = () => {
	const {
		getImageLayerAction,
		getDrawCoreAction,
		getSelectRectParams,
		getZoom,
	} = useContext(DrawContext);
	const highlightSpriteMapRef = useRef<
		Map<
			string,
			{
				props: HighlightElementProps & { valid: boolean };
			}
		>
	>(new Map());

	const updateHighlight = useCallback(
		async (params: ExcalidrawEventOnChangeParams["params"] | undefined) => {
			if (!params) {
				return;
			}

			const imageLayerAction = getImageLayerAction();
			if (!imageLayerAction) {
				return;
			}

			const drawCoreAction = getDrawCoreAction();
			if (!drawCoreAction) {
				return;
			}

			for (const { props } of highlightSpriteMapRef.current.values()) {
				props.valid = false;
			}

			let needRender = false;

			for (const element of params.elements) {
				if (element.type !== "highlight" || element.isDeleted) {
					continue;
				}

				const appState = drawCoreAction.getAppState();
				if (!appState) {
					return;
				}

				const { scrollY, scrollX, zoom } = appState;

				const highlightProps = {
					x:
						Math.round(element.x * window.devicePixelRatio) +
						scrollX * window.devicePixelRatio,
					y:
						Math.round(element.y * window.devicePixelRatio) +
						scrollY * window.devicePixelRatio,
					width: Math.round(element.width * window.devicePixelRatio),
					height: Math.round(element.height * window.devicePixelRatio),
					angle: element.angle,
					opacity: element.opacity,
					zoom: zoom.value / (getZoom?.() ?? 1),
					valid: true,
					strokeColor: element.strokeColor,
					backgroundColor: element.backgroundColor,
					strokeWidth: element.strokeWidth,
					maskColor: element.maskColor,
					maskOpacity: element.maskOpacity,
					borderType: element.borderType,
					shapeType: element.shapeType,
					eraserAlpha: undefined,
				};

				let highlightSprite = highlightSpriteMapRef.current.get(element.id);
				if (!highlightSprite) {
					highlightSprite = {
						props: {
							...highlightProps,
							valid: true,
						},
					};

					highlightSpriteMapRef.current.set(element.id, highlightSprite);

					needRender = true;
				} else {
					highlightSprite.props.valid = true;
					if (
						isEqualHighlightSpriteProps(highlightSprite.props, highlightProps)
					) {
						continue;
					}
				}

				await imageLayerAction.updateHighlightElement(
					DRAW_LAYER_HIGHLIGHT_CONTAINER_KEY,
					element.id,
					highlightProps,
				);

				highlightSprite.props = highlightProps;
				needRender = true;
			}

			const highlightSprites = Array.from(
				highlightSpriteMapRef.current.entries(),
			).filter(([, highlightSprite]) => !highlightSprite.props.valid);
			for (const [id] of highlightSprites) {
				highlightSpriteMapRef.current.delete(id);
				await imageLayerAction.updateHighlightElement(
					DRAW_LAYER_HIGHLIGHT_CONTAINER_KEY,
					id,
					undefined,
				);

				needRender = true;
			}

			const selectRectParams = getSelectRectParams();
			if (needRender && selectRectParams) {
				await imageLayerAction.updateHighlight(
					DRAW_LAYER_HIGHLIGHT_CONTAINER_KEY,
					{
						selectRectParams,
					},
				);
				await imageLayerAction.canvasRender();
			}
		},
		[getDrawCoreAction, getImageLayerAction, getSelectRectParams, getZoom],
	);
	const updateHighlightRender = useCallbackRender(
		useCallbackAsyncRender(updateHighlight),
	);

	const handleEraser = useCallback(
		(params: ExcalidrawOnHandleEraserParams | undefined) => {
			if (!params) {
				return;
			}

			const imageLayerAction = getImageLayerAction();
			if (!imageLayerAction) {
				return;
			}

			params.elements.forEach(async (id) => {
				const highlightSprite = highlightSpriteMapRef.current.get(id);
				if (!highlightSprite) {
					return;
				}

				const targetOpacity = (highlightSprite.props.opacity / 100) * 0.42;
				if (targetOpacity === highlightSprite.props.eraserAlpha) {
					return;
				}
				highlightSprite.props.eraserAlpha = targetOpacity;
				await imageLayerAction.updateHighlightElement(
					DRAW_LAYER_HIGHLIGHT_CONTAINER_KEY,
					id,
					highlightSprite.props,
				);
				await imageLayerAction.canvasRender();
			});
		},
		[getImageLayerAction],
	);
	const handleEraserRender = useCallbackRenderSlow(handleEraser);

	useStateSubscriber(
		ExcalidrawEventPublisher,
		useCallback(
			(params: ExcalidrawEventParams | undefined) => {
				if (params?.event === "onChange") {
					updateHighlightRender(params.params);
				}
			},
			[updateHighlightRender],
		),
	);
	useStateSubscriber(ExcalidrawOnHandleEraserPublisher, handleEraserRender);

	useStateSubscriber(
		DrawEventPublisher,
		useCallback(
			(params: DrawEventParams | undefined) => {
				const imageLayerAction = getImageLayerAction();
				if (!imageLayerAction) {
					return;
				}

				if (params?.event === DrawEvent.SelectRectParamsAnimationChange) {
					imageLayerAction
						?.updateHighlight(DRAW_LAYER_HIGHLIGHT_CONTAINER_KEY, {
							selectRectParams: params.params.selectRectParams,
						})
						.then(() => {
							imageLayerAction?.canvasRender();
						});
				} else if (params?.event === DrawEvent.ClearContext) {
					highlightSpriteMapRef.current.clear();
				}
			},
			[getImageLayerAction],
		),
	);

	return undefined;
};

export const HighlightTool = HighlightToolCore;
