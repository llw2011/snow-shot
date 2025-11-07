import type { ExcalidrawElement } from "@mg-chao/excalidraw/element/types";
import type { ExcalidrawPropsCustomOptions } from "@mg-chao/excalidraw/types";
import { Radio, Select, Space } from "antd";
import { last } from "es-toolkit";
import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useIntl } from "react-intl";
import { CircleIcon, RectIcon } from "@/components/icons";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { DrawContext } from "@/pages/fullScreenDraw/extra";
import {
	convertSerialNumberElementIdToEllipseElementId,
	convertSerialNumberElementIdToEllipseTextElementId,
	generateSerialNumber,
	isSerialNumberElement,
} from "../components/serialNumberTool";
import {
	DrawCoreContext,
	type ExcalidrawEventCallbackParams,
	ExcalidrawEventCallbackPublisher,
	ExcalidrawEventCallbackType,
} from "../extra";

export const useChangeFontSizeProps = (
	isSlider: boolean,
	props: React.ComponentProps<
		NonNullable<
			NonNullable<
				ExcalidrawPropsCustomOptions["pickerRenders"]
			>["RadioSelection"]
		>
	>,
) => {
	const { getAction } = useContext(DrawCoreContext);

	const propsRef = useRef<typeof props | undefined>(undefined);

	const updateSerialNumber = useCallback(
		(value: number): boolean => {
			const selectedElementIds = getAction()?.getAppState()?.selectedElementIds;
			const elements = getAction()?.getExcalidrawAPI()?.getSceneElements();
			const selectedElements =
				elements && selectedElementIds
					? elements.filter(
							(item) =>
								selectedElementIds?.[item.id] && isSerialNumberElement(item),
						)
					: [];

			if (!selectedElements || selectedElements.length === 0) {
				return false;
			}

			const appState = getAction()?.getAppState();
			if (!appState) {
				return false;
			}

			const selectedElementsMap = new Map(
				selectedElements.map((item) => [item.id, item]),
			);
			const generateSerialNumberCache = new Map<string, ExcalidrawElement[]>();
			const changedElementsMap = new Map();
			selectedElements.forEach((item) => {
				const changedElement = {
					...item,
					fontSize: value as unknown as number,
				};

				changedElementsMap.set(item.id, changedElement);

				const ellipseElementId =
					convertSerialNumberElementIdToEllipseElementId(item);
				const ellipseTextElementId =
					convertSerialNumberElementIdToEllipseTextElementId(item);
				if (!ellipseElementId || !ellipseTextElementId) {
					return;
				}

				const ellipseElement = selectedElementsMap.get(ellipseElementId);
				const ellipseTextElement =
					selectedElementsMap.get(ellipseTextElementId);
				if (
					!ellipseElement ||
					!ellipseTextElement ||
					!("fontFamily" in ellipseTextElement)
				) {
					return;
				}

				const originPositionX = ellipseElement.x + ellipseElement.width / 2;
				const originPositionY = ellipseElement.y + ellipseElement.height / 2;

				const serialNumberElementList =
					generateSerialNumberCache.get(ellipseElementId) ??
					generateSerialNumber(
						{
							x: originPositionX,
							y: originPositionY,
						},
						1,
						{
							...appState,
							currentItemFontFamily: ellipseTextElement.fontFamily,
							currentItemFontSize: value,
						},
					);
				generateSerialNumberCache.set(
					ellipseElementId,
					serialNumberElementList,
				);

				if (item.type === "text" && "fontSize" in item) {
					const serialNumberTextElement = last(serialNumberElementList);

					if (
						!serialNumberTextElement ||
						!("fontSize" in serialNumberTextElement)
					) {
						return;
					}

					changedElement.x = serialNumberTextElement.x;
					changedElement.y = serialNumberTextElement.y;
					changedElement.width = serialNumberTextElement.width;
					changedElement.height = serialNumberTextElement.height;
					changedElement.fontSize = serialNumberTextElement.fontSize;
				} else if (item.type === "ellipse") {
					const serialNumberEllipseElement = serialNumberElementList[0];

					if (!serialNumberEllipseElement) {
						return;
					}

					changedElement.x = serialNumberEllipseElement.x;
					changedElement.y = serialNumberEllipseElement.y;
					changedElement.width = serialNumberEllipseElement.width;
					changedElement.height = serialNumberEllipseElement.height;
				}
			});

			getAction()
				?.getExcalidrawAPI()
				?.updateScene({
					elements: elements?.map(
						(item) => changedElementsMap.get(item.id) ?? item,
					),
					appState: {
						currentItemFontSize: value,
					},
					captureUpdate: "IMMEDIATELY",
				});

			return true;
		},
		[getAction],
	);

	useEffect(() => {
		if (!("group" in props) || props.group !== "font-size") {
			propsRef.current = props;
			return;
		}

		propsRef.current = {
			...props,
			onChange: (value) => {
				if (!updateSerialNumber(value as unknown as number)) {
					props.onChange?.(value);
				}
			},
		};
	}, [props, updateSerialNumber]);

	useStateSubscriber(
		ExcalidrawEventCallbackPublisher,
		useCallback(
			(value: ExcalidrawEventCallbackParams | undefined) => {
				const currentProps = propsRef.current;
				if (!currentProps) {
					return;
				}

				if (!("group" in currentProps) || currentProps.group !== "font-size") {
					return;
				}

				if (value?.event === ExcalidrawEventCallbackType.ChangeFontSize) {
					const fontSize = value.params.fontSize;
					if (isSlider) {
						if ("onChange" in currentProps) {
							currentProps.onChange(fontSize);
						}
					} else {
						const fontSizeIndex = currentProps.options.findIndex(
							(option) =>
								typeof option.value === "number" && option.value === fontSize,
						);
						if (fontSizeIndex === -1) {
							return;
						}
						const targetFontSize = currentProps.options[fontSizeIndex].value;
						if ("onChange" in currentProps) {
							currentProps.onChange(targetFontSize);
						}
					}
				}
			},
			[isSlider],
		),
	);

	return useMemo(() => {
		return {
			propsRef,
		};
	}, []);
};

export const RadioSelection = (
	props: React.ComponentProps<
		NonNullable<
			NonNullable<
				ExcalidrawPropsCustomOptions["pickerRenders"]
			>["RadioSelection"]
		>
	>,
) => {
	const { propsRef } = useChangeFontSizeProps(false, props);

	if (props.type === "button") {
		return (
			<Space>
				<Radio.Group value={props.value}>
					{props.options.map((option) => (
						<Radio.Button
							key={option.text}
							title={option.text}
							value={option.value}
							checked={option.active ?? props.value === option.value}
						>
							<div
								className="radio-button-icon"
								onClick={(event) => {
									return props.onClick(
										option.value,
										event as unknown as React.MouseEvent<HTMLButtonElement>,
									);
								}}
							>
								{option.icon}
							</div>
						</Radio.Button>
					))}
				</Radio.Group>
			</Space>
		);
	}

	return (
		<Radio.Group value={props.value}>
			{props.options.map((option) => (
				<Radio.Button
					name={props.group}
					key={option.text}
					title={option.text}
					value={option.value}
					checked={props.value === option.value}
					data-testid={option.testId}
				>
					<div
						className="radio-button-icon"
						onClick={() => {
							if (!propsRef.current || !("onChange" in propsRef.current)) {
								return;
							}

							propsRef.current.onChange(option.value as unknown as number);
						}}
					>
						{option.icon}
					</div>
				</Radio.Button>
			))}
		</Radio.Group>
	);
};

export const FilterTypeRadioSelection = (
	props: React.ComponentProps<
		NonNullable<
			NonNullable<
				ExcalidrawPropsCustomOptions["pickerRenders"]
			>["FilterTypeRadioSelection"]
		>
	>,
) => {
	const intl = useIntl();

	const options = useMemo(() => {
		return [
			{
				label: intl.formatMessage({ id: `draw.filterType.blur` }),
				value: "blur",
			},
			{
				label: intl.formatMessage({ id: `draw.filterType.pixelate` }),
				value: "pixelate",
			},
			{
				label: intl.formatMessage({ id: `draw.filterType.ascii` }),
				value: "ascii",
			},
			{
				label: intl.formatMessage({ id: `draw.filterType.negative` }),
				value: "negative",
			},
			{
				label: intl.formatMessage({ id: `draw.filterType.crossHatch` }),
				value: "crossHatch",
			},
			{
				label: intl.formatMessage({ id: `draw.filterType.crt` }),
				value: "crt",
			},
			{
				label: intl.formatMessage({ id: `draw.filterType.dot` }),
				value: "dot",
			},
			{
				label: intl.formatMessage({ id: `draw.filterType.emboss` }),
				value: "emboss",
			},
			{
				label: intl.formatMessage({ id: `draw.filterType.grayscale` }),
				value: "grayscale",
			},
			{
				label: intl.formatMessage({ id: `draw.filterType.kawaseBlur` }),
				value: "kawaseBlur",
			},
			{
				label: intl.formatMessage({ id: `draw.filterType.motionBlur` }),
				value: "motionBlur",
			},
			{
				label: intl.formatMessage({ id: `draw.filterType.rgbSplit` }),
				value: "rgbSplit",
			},
			{
				label: intl.formatMessage({ id: `draw.filterType.noise` }),
				value: "noise",
			},
		];
	}, [intl]);

	const { getPopupContainer } = useContext(DrawContext);

	if (props.type !== "button") {
		return undefined;
	}

	return (
		<Select
			style={{ width: "100%" }}
			options={options}
			value={props.value}
			getPopupContainer={getPopupContainer}
			onChange={(value) => {
				props.onClick(
					value as unknown as number,
					{} as unknown as React.MouseEvent<HTMLButtonElement>,
				);
			}}
		/>
	);
};

export const MaskShapeTypeRadioSelection = (
	props: React.ComponentProps<
		NonNullable<
			NonNullable<
				ExcalidrawPropsCustomOptions["pickerRenders"]
			>["ShapeTypeRadioSelection"]
		>
	>,
) => {
	const intl = useIntl();
	const options = useMemo(() => {
		return [
			{
				text: intl.formatMessage({ id: `draw.maskShapeType.rect` }),
				value: "rect",
				icon: <RectIcon />,
			},
			{
				text: intl.formatMessage({ id: `draw.maskShapeType.circle` }),
				value: "circle",
				icon: <CircleIcon />,
			},
		];
	}, [intl]);

	if (props.type !== "button") {
		return undefined;
	}

	return (
		<Space>
			<Radio.Group value={props.value}>
				{options.map((option) => (
					<Radio.Button
						key={option.text}
						title={option.text}
						value={option.value}
						checked={props.value === option.value}
					>
						<div
							className="radio-button-icon"
							onClick={(event) => {
								return props.onClick(
									option.value,
									event as unknown as React.MouseEvent<HTMLButtonElement>,
								);
							}}
						>
							{option.icon}
						</div>
					</Radio.Button>
				))}
			</Radio.Group>
		</Space>
	);
};

export const MaskBorderTypeRadioSelection = (
	props: React.ComponentProps<
		NonNullable<
			NonNullable<
				ExcalidrawPropsCustomOptions["pickerRenders"]
			>["BorderTypeRadioSelection"]
		>
	>,
) => {
	if (props.type !== "button") {
		return undefined;
	}

	return (
		<Space>
			<Radio.Group value={props.value}>
				{props.options.map((option) => (
					<Radio.Button
						key={option.text}
						title={option.text}
						value={option.value}
						checked={option.active ?? props.value === option.value}
					>
						<div
							className="radio-button-icon"
							onClick={(event) => {
								return props.onClick(
									option.value,
									event as unknown as React.MouseEvent<HTMLButtonElement>,
								);
							}}
						>
							{option.icon}
						</div>
					</Radio.Button>
				))}
			</Radio.Group>
		</Space>
	);
};
