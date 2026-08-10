export type FixedContentSize = {
	width: number;
	height: number;
};

export const getInitialImageScale = (
	imageSize: FixedContentSize,
	monitorSize: FixedContentSize,
	autoResizeWindow: boolean,
) => {
	if (!autoResizeWindow) {
		return 1;
	}

	return Math.min(
		1,
		monitorSize.width / imageSize.width,
		monitorSize.height / imageSize.height,
	);
};

export const canInteractivelyResizeFixedContent = ({
	enableDraw,
	enableSelectText,
	isThumbnail,
}: {
	enableDraw: boolean;
	enableSelectText: boolean;
	isThumbnail: boolean;
}) => !enableDraw && !enableSelectText && !isThumbnail;

export const getDrawWindowTargetSize = ({
	contentSize,
	toolbarSize,
	drawMenuSize,
	devicePixelRatio,
	enableDraw,
}: {
	contentSize: FixedContentSize;
	toolbarSize: FixedContentSize;
	drawMenuSize: FixedContentSize;
	devicePixelRatio: number;
	enableDraw: boolean;
}): FixedContentSize => {
	if (!enableDraw) {
		return { ...contentSize };
	}

	const physicalToolbarSize = {
		width: Math.ceil(toolbarSize.width * devicePixelRatio),
		height: Math.ceil(toolbarSize.height * devicePixelRatio),
	};
	const physicalDrawMenuSize = {
		width: Math.ceil(drawMenuSize.width * devicePixelRatio),
		height: Math.ceil(drawMenuSize.height * devicePixelRatio),
	};

	return {
		width: Math.max(
			physicalDrawMenuSize.width + contentSize.width,
			physicalToolbarSize.width,
		),
		height: Math.max(
			contentSize.height + physicalToolbarSize.height,
			physicalDrawMenuSize.height,
		),
	};
};
