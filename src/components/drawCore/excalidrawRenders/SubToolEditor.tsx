import type { ExcalidrawPropsCustomOptions } from "@mg-chao/excalidraw/types";
import { Input } from "antd";
import { debounce } from "es-toolkit";
import { useCallback, useContext, useEffect, useMemo } from "react";
import { FormattedMessage } from "react-intl";
import { useStateRef } from "@/hooks/useStateRef";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { DrawContext } from "@/pages/fullScreenDraw/extra";
import { ExcalidrawEventPublisher } from "../extra";

const WatermarkTextInput = () => {
	const [, setDrawEvent] = useStateSubscriber(
		ExcalidrawEventPublisher,
		undefined,
	);
	const { getDrawCoreAction } = useContext(DrawContext);
	const [watermarkText, setWatermarkText, watermarkTextRef] =
		useStateRef<string>("");

	const updateWatermarkText = useMemo(() => {
		return debounce(() => {
			setDrawEvent({
				event: "onWatermarkTextChange",
				params: {
					text: watermarkTextRef.current,
				},
			});
			setDrawEvent(undefined);
		}, 128);
	}, [setDrawEvent, watermarkTextRef]);

	const refreshWatermarkText = useMemo(() => {
		return debounce(() => {
			const sceneElements = getDrawCoreAction()
				?.getExcalidrawAPI()
				?.getSceneElements();
			if (!sceneElements) {
				return;
			}

			const watermarkElement = sceneElements.find(
				(element) => element.type === "watermark",
			);

			setWatermarkText(watermarkElement?.watermarkText ?? "");
		}, 128);
	}, [getDrawCoreAction, setWatermarkText]);

	useEffect(() => {
		refreshWatermarkText();
	}, [refreshWatermarkText]);

	const onChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setWatermarkText(e.target.value);
			updateWatermarkText();
		},
		[setWatermarkText, updateWatermarkText],
	);

	const onMouseDown = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
		e.stopPropagation();
	}, []);

	const onMouseUp = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
		e.stopPropagation();
	}, []);

	return (
		<Input
			value={watermarkText}
			onChange={onChange}
			onMouseDown={onMouseDown}
			onMouseUp={onMouseUp}
		/>
	);
};

const SubToolEditor: NonNullable<
	NonNullable<ExcalidrawPropsCustomOptions["pickerRenders"]>["SubToolEditor"]
> = ({ appState, targetElements }) => {
	const watermarkSubTools = useMemo(() => {
		if (appState.activeTool.type !== "watermark") {
			return undefined;
		}

		return <WatermarkTextInput />;
	}, [appState.activeTool.type]);

	if (watermarkSubTools && targetElements.length === 0) {
		return (
			<fieldset>
				<legend>
					<FormattedMessage id="draw.watermarkTool.text" />
				</legend>
				<div>{watermarkSubTools}</div>
			</fieldset>
		);
	}

	return undefined;
};

export default SubToolEditor;
