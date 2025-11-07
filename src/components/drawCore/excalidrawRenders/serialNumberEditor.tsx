import type { ExcalidrawTextElement } from "@mg-chao/excalidraw/element/types";
import type { ExcalidrawPropsCustomOptions } from "@mg-chao/excalidraw/types";
import { InputNumber } from "antd";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FormattedMessage } from "react-intl";
import {
	isSerialNumberElement,
	isSerialNumberTextElement,
	limitSerialNumber,
	SerialNumberContext,
} from "../components/serialNumberTool";
import { DrawCoreContext } from "../extra";

const getSelectedElementSerialNumber = (
	textElement: ExcalidrawTextElement | undefined,
) => {
	if (!textElement) {
		return undefined;
	}

	return limitSerialNumber(parseInt(textElement.originalText, 10));
};

const SerialNumberEditor: NonNullable<
	NonNullable<
		ExcalidrawPropsCustomOptions["pickerRenders"]
	>["SerialNumberEditor"]
> = ({ appState, targetElements, isSerialNumberTool }) => {
	const {
		serialNumber,
		setSerialNumber,
		selectedSerialNumber,
		setSelectedSerialNumber,
	} = useContext(SerialNumberContext);
	const { getAction } = useContext(DrawCoreContext);

	const [selectedSerialNumberTextElement, setselectedSerialNumberTextElement] =
		useState<ExcalidrawTextElement | undefined>();

	const enableEditor = useMemo(() => {
		if (
			appState.activeTool.type !== "ellipse" &&
			appState.activeTool.type !== "arrow" &&
			appState.activeTool.type !== "selection"
		) {
			return false;
		}

		if (!(isSerialNumberTool || isSerialNumberElement(targetElements[0]))) {
			return false;
		}

		return true;
	}, [appState.activeTool.type, isSerialNumberTool, targetElements]);

	const getSelectedSerialNumberTextElement = useCallback(():
		| ExcalidrawTextElement
		| undefined => {
		if (!enableEditor) {
			return;
		}

		const textElement = targetElements.find(isSerialNumberTextElement);

		if (!textElement || textElement.type !== "text") {
			return;
		}

		return textElement;
	}, [enableEditor, targetElements]);
	useEffect(() => {
		const textElement = getSelectedSerialNumberTextElement();
		setSelectedSerialNumber(getSelectedElementSerialNumber(textElement));
		setselectedSerialNumberTextElement(textElement);
	}, [getSelectedSerialNumberTextElement, setSelectedSerialNumber]);

	useEffect(() => {
		if (!selectedSerialNumber || !selectedSerialNumberTextElement) {
			return;
		}

		if (
			getSelectedElementSerialNumber(selectedSerialNumberTextElement) ===
			selectedSerialNumber
		) {
			return;
		}

		const excalidrawAPI = getAction()?.getExcalidrawAPI();
		if (!excalidrawAPI) {
			return;
		}

		const sceneElements = excalidrawAPI?.getSceneElements();
		if (!sceneElements) {
			return;
		}

		excalidrawAPI.updateScene({
			elements: sceneElements.map((item) => {
				if (item.id === selectedSerialNumberTextElement.id) {
					return {
						...item,
						text: selectedSerialNumber.toString(),
						originalText: selectedSerialNumber.toString(),
					};
				}
				return item;
			}),
			captureUpdate: "IMMEDIATELY",
		});
	}, [selectedSerialNumberTextElement, selectedSerialNumber, getAction]);

	const onChange = useCallback(
		(value: number | null) => {
			if (!value) {
				return;
			}

			if (selectedSerialNumber) {
				setSelectedSerialNumber(value);
			} else {
				setSerialNumber(value);
			}
		},
		[setSerialNumber, selectedSerialNumber, setSelectedSerialNumber],
	);

	if (!enableEditor) {
		return undefined;
	}

	return (
		<fieldset>
			<legend>
				<FormattedMessage id="draw.serialNumber" />
			</legend>
			<div>
				<InputNumber
					value={selectedSerialNumber ?? serialNumber}
					onChange={onChange}
					min={1}
					max={999}
					changeOnWheel
					controls={true}
				/>
			</div>
		</fieldset>
	);
};

export default SerialNumberEditor;
