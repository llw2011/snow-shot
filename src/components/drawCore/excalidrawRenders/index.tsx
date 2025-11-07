import type { ExcalidrawPropsCustomOptions } from "@mg-chao/excalidraw/types";
import { useCallback, useEffect, useRef } from "react";
import { ButtonIcon } from "./buttonIcon";
import { buttonIconSelectRadioRender } from "./buttonIconSelectRadioRender";
import { ButtonList } from "./buttonList";
import { colorPickerPopoverRender } from "./colorPickerPopoverRender";
import { colorPickerTopPickesButtonRender } from "./colorPickerTopPickesButtonRender";
import { layerButtonRender } from "./layerButtonRender";
import { layoutMenuRender } from "./layoutMenuRender";
import {
	FilterTypeRadioSelection,
	MaskBorderTypeRadioSelection,
	MaskShapeTypeRadioSelection,
	RadioSelection,
} from "./radioSelection";
import { ChangeFontSizeSlider, ChangeStrokeWidthSlider } from "./radioSlider";
import { rangeRender } from "./rangeRender";
import SubToolEditor from "./SubToolEditor";
import SerialNumberEditor from "./serialNumberEditor";

export const useGetPopupContainer = () => {
	const containerRef = useRef<HTMLElement>(null);
	useEffect(() => {
		containerRef.current =
			document.getElementById("layout-menu-render") ?? document.body;
	}, []);

	return useCallback(() => {
		return containerRef.current ?? document.body;
	}, []);
};

export const generatePickerRenders: (
	enableSliderChangeWidth: boolean,
) => ExcalidrawPropsCustomOptions["pickerRenders"] = (
	enableSliderChangeWidth,
) => {
	return {
		colorPickerTopPickesButtonRender,
		colorPickerPopoverRender,
		buttonIconSelectRadioRender,
		CustomButtonIcon: ButtonIcon,
		RadioSelection: RadioSelection as unknown as NonNullable<
			ExcalidrawPropsCustomOptions["pickerRenders"]
		>["RadioSelection"],
		rangeRender,
		FilterTypeRadioSelection:
			FilterTypeRadioSelection as unknown as NonNullable<
				ExcalidrawPropsCustomOptions["pickerRenders"]
			>["FilterTypeRadioSelection"],
		ShapeTypeRadioSelection:
			MaskShapeTypeRadioSelection as unknown as NonNullable<
				ExcalidrawPropsCustomOptions["pickerRenders"]
			>["ShapeTypeRadioSelection"],
		BorderTypeRadioSelection:
			MaskBorderTypeRadioSelection as unknown as NonNullable<
				ExcalidrawPropsCustomOptions["pickerRenders"]
			>["BorderTypeRadioSelection"],
		layerButtonRender,
		elementStrokeColors: [
			"#1e1e1e",
			"#f5222d",
			"#52c41a",
			"#1677ff",
			"#faad14",
		],
		elementBackgroundColors: [
			"transparent",
			"#ffccc7",
			"#d9f7be",
			"#bae0ff",
			"#fff1b8",
		],
		ButtonList: ButtonList,
		SerialNumberEditor,
		SubToolEditor,
		ChangeStrokeWidthSlider: enableSliderChangeWidth
			? ChangeStrokeWidthSlider
			: undefined,
		ChangeFontSizeSlider: enableSliderChangeWidth
			? ChangeFontSizeSlider
			: undefined,
	};
};

export const layoutRenders: ExcalidrawPropsCustomOptions["layoutRenders"] = {
	menuRender: layoutMenuRender,
};
