export const getExcalidrawCanvas = (): HTMLCanvasElement | undefined => {
	const elementList = document.getElementsByClassName(
		"excalidraw__canvas interactive",
	);

	if (elementList.length === 0) {
		return;
	}

	const canvas = elementList[0] as HTMLCanvasElement;

	return canvas;
};
