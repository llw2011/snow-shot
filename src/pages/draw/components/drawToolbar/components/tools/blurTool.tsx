import { last } from "es-toolkit";
import { useCallback, useContext, useRef } from "react";
import {
	type ExcalidrawEventOnChangeParams,
	type ExcalidrawEventParams,
	ExcalidrawEventPublisher,
	type ExcalidrawOnHandleEraserParams,
	ExcalidrawOnHandleEraserPublisher,
} from "@/components/drawCore/extra";
import { DRAW_LAYER_BLUR_CONTAINER_KEY } from "@/components/imageLayer";
import type { BlurSpriteProps } from "@/components/imageLayer/baseLayerRenderActions";
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

const isEqualBlurSpriteProps = (
	a: Omit<BlurSpriteProps, "valid">,
	b: Omit<BlurSpriteProps, "valid">,
) => {
	if (a.points?.length !== b.points?.length) {
		return false;
	} else if (a.points && b.points && a.points.length > 0) {
		const lastA = last(a.points);
		const lastB = last(b.points);
		if (
			a.points[0][0] !== b.points[0][0] ||
			a.points[0][1] !== b.points[0][1]
		) {
			return false;
		} else if (
			lastA &&
			lastB &&
			(lastA[0] !== lastB[0] || lastA[1] !== lastB[1])
		) {
			return false;
		}
	}

	return (
		a.blur === b.blur &&
		a.x === b.x &&
		a.y === b.y &&
		a.width === b.width &&
		a.height === b.height &&
		a.angle === b.angle &&
		a.zoom === b.zoom &&
		a.opacity === b.opacity &&
		a.strokeWidth === b.strokeWidth &&
		a.filterType === b.filterType
	);
};

const BlurToolCore: React.FC = () => {
	const { getImageLayerAction, getDrawCoreAction, getZoom } =
		useContext(DrawContext);
	const blurSpriteMapRef = useRef<
		Map<
			string,
			{
				props: BlurSpriteProps & { valid: boolean };
			}
		>
	>(new Map());

	const updateBlur = useCallback(
		async (params: ExcalidrawEventOnChangeParams["params"] | undefined) => {
			if (!params) {
				return;
			}

			const imageLayerAction = getImageLayerAction();
			if (!imageLayerAction) {
				return;
			}

			for (const { props } of blurSpriteMapRef.current.values()) {
				props.valid = false;
			}

			let needRender = false;

			for (const element of params.elements) {
				if (
					(element.type !== "blur" && element.type !== "blur_freedraw") ||
					element.isDeleted
				) {
					continue;
				}

				const appState = getDrawCoreAction()?.getAppState();
				if (!appState) {
					return;
				}

				const { scrollY, scrollX, zoom } = appState;

				const blurProps = {
					blur: element.blur,
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
					eraserAlpha: undefined,
					points: element.type === "blur_freedraw" ? element.points : undefined,
					strokeWidth:
						element.type === "blur_freedraw" ? element.strokeWidth : undefined,
					filterType: element.filterType,
				};

				let blurSprite = blurSpriteMapRef.current.get(element.id);
				if (!blurSprite) {
					await imageLayerAction.createBlurSprite(
						DRAW_LAYER_BLUR_CONTAINER_KEY,
						element.id,
					);

					blurSprite = {
						props: {
							...blurProps,
							blur: -1,
						},
					};

					blurSpriteMapRef.current.set(element.id, blurSprite);

					needRender = true;
				}

				blurSprite.props.valid = true;
				if (isEqualBlurSpriteProps(blurSprite.props, blurProps)) {
					continue;
				}

				await imageLayerAction.updateBlurSprite(
					element.id,
					blurProps,
					blurSprite.props.blur !== blurProps.blur ||
						blurSprite.props.filterType !== blurProps.filterType,
				);

				blurSprite.props = blurProps;
				needRender = true;
			}

			const blurSprites = Array.from(blurSpriteMapRef.current.entries()).filter(
				([, blurSprite]) => !blurSprite.props.valid,
			);
			for (const [id] of blurSprites) {
				blurSpriteMapRef.current.delete(id);
				await imageLayerAction.deleteBlurSprite(id);

				needRender = true;
			}

			if (needRender) {
				await imageLayerAction.canvasRender();
			}
		},
		[getImageLayerAction, getDrawCoreAction, getZoom],
	);
	const updateBlurRender = useCallbackRender(
		useCallbackAsyncRender(updateBlur),
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
				const blurSprite = blurSpriteMapRef.current.get(id);
				if (!blurSprite) {
					return;
				}

				const targetOpacity = (blurSprite.props.opacity / 100) * 0.42;
				if (targetOpacity === blurSprite.props.eraserAlpha) {
					return;
				}
				blurSprite.props.eraserAlpha = targetOpacity;
				await imageLayerAction.updateBlurSprite(id, blurSprite.props, true);
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
					updateBlurRender(params.params);
				}
			},
			[updateBlurRender],
		),
	);
	useStateSubscriber(ExcalidrawOnHandleEraserPublisher, handleEraserRender);

	useStateSubscriber(
		DrawEventPublisher,
		useCallback((params: DrawEventParams | undefined) => {
			if (params?.event === DrawEvent.ClearContext) {
				blurSpriteMapRef.current.clear();
			}
		}, []),
	);
	return undefined;
};

export const BlurTool = BlurToolCore;
