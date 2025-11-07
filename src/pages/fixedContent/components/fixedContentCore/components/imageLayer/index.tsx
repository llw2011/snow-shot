import { useCallback, useImperativeHandle, useRef } from "react";
import { ImageLayer, type ImageLayerActionType } from "@/components/imageLayer";
import type { ImageSharedBufferData } from "@/pages/draw/tools";
import { appError } from "@/utils/log";
import { zIndexs } from "@/utils/zIndex";

export type FixedContentImageLayerActionType = {
	setBaseImage: (
		imageData:
			| ImageBitmap
			| ImageSharedBufferData
			| {
					type: "base_image_texture";
			  },
		hideImageSprite?: boolean,
	) => Promise<void>;
	initImageLayer: (width: number, height: number) => Promise<void>;
	initBaseImageTexture: (
		imageUrl: string,
	) => Promise<{ width: number; height: number }>;
	getImageLayerAction: () => ImageLayerActionType | undefined;
};

export const FixedContentImageLayer = ({
	actionRef,
	onImageLayerReady,
	disabled,
}: {
	actionRef: React.RefObject<FixedContentImageLayerActionType | undefined>;
	onImageLayerReady: () => void;
	disabled?: boolean;
}) => {
	const imageLayerActionRef = useRef<ImageLayerActionType | undefined>(
		undefined,
	);
	const onInitCanvasReady = useCallback(async () => {
		onImageLayerReady();
	}, [onImageLayerReady]);

	const initImageLayer = useCallback(async (width: number, height: number) => {
		await imageLayerActionRef.current?.onCaptureBoundingBoxInfoReady(
			width,
			height,
		);
	}, []);

	const setBaseImage = useCallback<
		FixedContentImageLayerActionType["setBaseImage"]
	>(async (imageData, hideImageSprite) => {
		if ("type" in imageData && imageData.type === "base_image_texture") {
			await imageLayerActionRef.current?.onCaptureReady(
				undefined,
				imageData,
				hideImageSprite,
				true,
			);
		} else if (imageData instanceof ImageBitmap) {
			await imageLayerActionRef.current?.onCaptureReady(
				undefined,
				imageData,
				hideImageSprite,
				true,
			);
		} else if ("sharedBuffer" in imageData) {
			await imageLayerActionRef.current?.onCaptureReady(
				undefined,
				imageData,
				hideImageSprite,
				true,
			);
		}
	}, []);

	const initBaseImageTexture = useCallback<
		FixedContentImageLayerActionType["initBaseImageTexture"]
	>(async (imageUrl: string) => {
		if (!imageLayerActionRef.current) {
			appError("[FixedContentImageLayer] imageLayerActionRef is not defined");
			return {
				width: 0,
				height: 0,
			};
		}

		return await imageLayerActionRef.current.initBaseImageTexture(imageUrl);
	}, []);

	const getImageLayerAction = useCallback(() => {
		return imageLayerActionRef.current;
	}, []);

	useImperativeHandle(actionRef, () => {
		return {
			setBaseImage,
			initImageLayer,
			initBaseImageTexture,
			getImageLayerAction,
		};
	}, [initImageLayer, setBaseImage, initBaseImageTexture, getImageLayerAction]);

	return (
		<ImageLayer
			actionRef={imageLayerActionRef}
			zIndex={zIndexs.Draw_DrawLayer}
			onInitCanvasReady={onInitCanvasReady}
			disabled={disabled}
		/>
	);
};
