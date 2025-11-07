import type {
	BoundElement,
	ExcalidrawElement,
	ExcalidrawTextElement,
} from "@mg-chao/excalidraw/element/types";
import type { AppState } from "@mg-chao/excalidraw/types";
import React, {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	AppSettingsActionContext,
	AppSettingsPublisher,
} from "@/contexts/appSettingsActionContext";
import { useHotkeysApp } from "@/hooks/useHotkeysApp";
import { useStateRef } from "@/hooks/useStateRef";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";
import { HotkeysScope } from "@/types/core/appHotKeys";
import { DrawState } from "@/types/draw";
import {
	DrawCoreContext,
	DrawStatePublisher,
	type ExcalidrawEventParams,
	ExcalidrawEventPublisher,
} from "../../extra";

export const isSerialNumberElement = (
	element: ExcalidrawElement | undefined,
) => {
	if (!element) {
		return false;
	}

	return element.id.startsWith("snow-shot_serial-number_");
};

export const isSerialNumberTextElement = (
	element: ExcalidrawElement | undefined,
) => {
	return isSerialNumberElement(element) && element?.type === "text";
};

export const convertSerialNumberElementIdToEllipseElementId = (
	element: ExcalidrawElement | undefined,
) => {
	return element?.id
		.replace("-text", "-ellipse")
		.replace("-ellipse-background", "-ellipse");
};

export const convertSerialNumberElementIdToEllipseTextElementId = (
	element: ExcalidrawElement | undefined,
) => {
	return element?.id
		.replace("-ellipse", "-text")
		.replace("-ellipse-background", "-text");
};

export const limitSerialNumber = (serialNumber: number) => {
	if (Number.isNaN(serialNumber)) {
		return 1;
	}

	return Math.min(999, Math.max(serialNumber ?? 0, 1));
};

export type SerialNumberContextType = {
	selectedSerialNumber: number | undefined;
	selectedSerialNumberRef: React.RefObject<number | undefined>;
	setSelectedSerialNumber: (selectedSerialNumber: number | undefined) => void;
	serialNumber: number;
	serialNumberRef: React.RefObject<number>;
	setSerialNumber: (serialNumber: number) => void;
};

export const SerialNumberContext = React.createContext<SerialNumberContextType>(
	{
		selectedSerialNumber: undefined,
		selectedSerialNumberRef: { current: undefined },
		setSelectedSerialNumber: () => {},
		serialNumber: 1,
		serialNumberRef: { current: 1 },
		setSerialNumber: () => {},
	},
);

export const SerialNumberContextProvider: React.FC<{
	children: React.ReactNode;
}> = ({ children }) => {
	const [
		selectedSerialNumber,
		setSelectedSerialNumber,
		selectedSerialNumberRef,
	] = useStateRef<number | undefined>(undefined);
	const [serialNumber, setSerialNumber, serialNumberRef] = useStateRef(1);

	const contextValue = useMemo<SerialNumberContextType>(() => {
		return {
			selectedSerialNumber,
			selectedSerialNumberRef,
			setSelectedSerialNumber,
			serialNumber,
			setSerialNumber,
			serialNumberRef,
		};
	}, [
		selectedSerialNumber,
		selectedSerialNumberRef,
		setSelectedSerialNumber,
		serialNumber,
		setSerialNumber,
		serialNumberRef,
	]);

	return (
		<SerialNumberContext.Provider value={contextValue}>
			{children}
		</SerialNumberContext.Provider>
	);
};

export const generateSerialNumber = (
	position: { x: number; y: number },
	number: number,
	appState: AppState,
) => {
	const id = Date.now();

	const ellipseId = `snow-shot_serial-number_${id}-ellipse`;
	const textId = `snow-shot_serial-number_${id}-text`;
	const serialNumberGroupNumber = `snow-shot_serial-number_${id}-group-number`;

	const sizeScale = appState.currentItemFontSize / 16;

	const ellipseWidth = 32 * sizeScale;
	const ellipseHeight = 32 * sizeScale;

	let textHeight = 20 * sizeScale;
	const fontSize = appState.currentItemFontSize;
	if (fontSize <= 16) {
		textHeight = 21 * (fontSize / 16);
	} else if (fontSize <= 20) {
		textHeight = 26 * (fontSize / 20);
	} else if (fontSize <= 28) {
		textHeight = 36 * (fontSize / 28);
	} else if (fontSize <= 36) {
		textHeight = 46 * (fontSize / 36);
	}

	if (appState.currentItemFontFamily === 6) {
		textHeight += 3;
	}

	const res: ExcalidrawElement[] = [];

	res.push(
		{
			id: ellipseId,
			type: "ellipse",
			x: position.x - ellipseWidth / 2,
			y: position.y - ellipseHeight / 2,
			width: ellipseWidth,
			height: ellipseHeight,
			// @ts-expect-error 忽略 angle 的类型，因为所需的 Radians 无法导出
			angle: 0,
			strokeColor: appState.currentItemStrokeColor,
			backgroundColor: appState.currentItemBackgroundColor,
			fillStyle: appState.currentItemFillStyle,
			strokeWidth: appState.currentItemStrokeWidth,
			strokeStyle: appState.currentItemStrokeStyle,
			roughness: appState.currentItemRoughness,
			opacity: appState.currentItemOpacity,
			groupIds: [serialNumberGroupNumber],
			frameId: null,
			roundness: null,
			version: 304,
			versionNonce: 1149037384,
			isDeleted: false,
			boundElements: [],
			link: null,
			locked: false,
			seed: 0,
			index: null,
			updated: 0,
		},
		{
			id: textId,
			type: "text",
			x: position.x - ellipseWidth / 2,
			y: position.y - textHeight / 2 + 2,
			width: 32 * sizeScale,
			height: textHeight,
			angle: 0,
			textStrokeColor: "transparent",
			textBackgroundColor: "transparent",
			strokeColor: appState.currentItemStrokeColor,
			backgroundColor: appState.currentItemBackgroundColor,
			fillStyle: appState.currentItemFillStyle,
			strokeWidth: 1,
			strokeStyle: appState.currentItemStrokeStyle,
			roughness: appState.currentItemRoughness,
			opacity: appState.currentItemOpacity,
			groupIds: [serialNumberGroupNumber],
			frameId: null,
			roundness: null,
			version: 1159,
			versionNonce: 2123386168,
			isDeleted: false,
			boundElements: [],
			link: null,
			locked: false,
			text: number.toString(),
			fontSize: fontSize,
			fontFamily: appState.currentItemFontFamily,
			textAlign: "center",
			verticalAlign: "center",
			containerId: null,
			originalText: number.toString(),
			autoResize: false,
			lineHeight: 1.25 as ExcalidrawTextElement["lineHeight"],
			seed: 0,
			index: null,
			updated: 0,
			textSerialNumberType: appState.currentItemTextSerialNumberType,
		},
	);

	return res;
};

export const SerialNumberTool: React.FC = () => {
	const { getAction, getMousePosition } = useContext(DrawCoreContext);
	const { setSerialNumber, serialNumberRef } = useContext(SerialNumberContext);

	const arrowElementIdsRef = useRef<Set<string>>(new Set());
	const [enable, setEnable, enableRef] = useStateRef(false);

	const [disableArrowHotKey, setDisableArrowHotKey] = useState("");
	const [disableArrow, setDisableArrow, disableArrowRef] = useStateRef(false);
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const [getAppSettings] = useStateSubscriber(
		AppSettingsPublisher,
		useCallback(
			(appSettings: AppSettingsData) => {
				setDisableArrow(appSettings[AppSettingsGroup.Cache].disableArrowPicker);
				setDisableArrowHotKey(
					appSettings[AppSettingsGroup.DrawToolbarKeyEvent]
						.serialNumberDisableArrow.hotKey,
				);
			},
			[setDisableArrow],
		),
	);
	const lockTool = useCallback(() => {
		let toolLocked = true;
		if (!getAppSettings()[AppSettingsGroup.FunctionDraw].lockDrawTool) {
			toolLocked = getAppSettings()[AppSettingsGroup.Cache].enableLockDrawTool;
		}
		return toolLocked;
	}, [getAppSettings]);

	useStateSubscriber(
		DrawStatePublisher,
		useCallback(
			(drawState: DrawState) => {
				const isEnable = drawState === DrawState.SerialNumber;
				setEnable(isEnable);

				if (isEnable) {
					arrowElementIdsRef.current = new Set(
						getAction()
							?.getExcalidrawAPI()
							?.getSceneElements()
							.filter((item) => item.type === "arrow")
							.map((item) => item.id),
					);
				}
			},
			[setEnable, getAction],
		),
	);

	const latestSerialNumberElementListRef = useRef<ExcalidrawElement[]>([]);
	const onMouseDown = useCallback(async () => {
		await new Promise((resolve) => {
			setTimeout(resolve, 17);
		});

		const mousePosition = getMousePosition();
		if (!mousePosition) {
			return;
		}

		const appState = getAction()?.getAppState();
		if (!appState) {
			return;
		}

		setTimeout(() => {
			// 如果存在在编辑中的 ellipse 元素，则直接删除
			const newElement = getAction()?.getAppState()?.newElement;
			if (newElement && newElement.type === "ellipse") {
				getAction()
					?.getExcalidrawAPI()
					?.updateScene({
						elements: getAction()
							?.getExcalidrawAPI()
							?.getSceneElements()
							.filter((item) => item.id !== newElement.id),
						appState: {
							newElement: null,
						},
						captureUpdate: "NEVER",
					});
			}
		}, 0);

		const sceneElements = getAction()?.getExcalidrawAPI()?.getSceneElements();
		if (!sceneElements) {
			return;
		}

		const currentNumber = serialNumberRef.current;

		// 将屏幕坐标转换为画布坐标
		const canvasX =
			mousePosition.mouseX / appState.zoom.value - appState.scrollX;
		const canvasY =
			mousePosition.mouseY / appState.zoom.value - appState.scrollY;

		const serialNumberElement = generateSerialNumber(
			{
				x: canvasX,
				y: canvasY,
			},
			currentNumber,
			appState,
		);

		// 判断是否有新增的 arrow 元素
		const newArrowElement = sceneElements.find((item) => {
			return item.type === "arrow" && !arrowElementIdsRef.current.has(item.id);
		});

		if (!newArrowElement && !disableArrowRef.current) {
			return;
		}

		if (newArrowElement) {
			arrowElementIdsRef.current.add(newArrowElement.id);

			sceneElements.forEach((item) => {
				if (item.id === newArrowElement.id && "startBinding" in item) {
					(
						serialNumberElement[0] as ExcalidrawElement & {
							boundElements: BoundElement[];
						}
					).boundElements = [
						{
							id: newArrowElement.id,
							type: "arrow",
						},
					] as never[];

					// @ts-expect-error - 忽略 startBinding 是只读属性
					item.startBinding = {
						elementId: serialNumberElement[0].id,
						focus: 0,
						gap: 8,
					};
				}
			});
		}

		latestSerialNumberElementListRef.current = serialNumberElement;

		getAction()?.updateScene({
			elements: [...sceneElements, ...serialNumberElement],
			captureUpdate: "IMMEDIATELY",
		});

		setSerialNumber(limitSerialNumber(currentNumber + 1));
	}, [
		disableArrowRef,
		getAction,
		getMousePosition,
		serialNumberRef,
		setSerialNumber,
	]);

	const onMouseUp = useCallback(() => {
		if (!lockTool()) {
			const action = getAction();

			// 自动框选新增元素
			if (
				disableArrowRef.current &&
				action &&
				Array.isArray(latestSerialNumberElementListRef.current)
			) {
				action.setActiveTool({
					type: "selection",
				});

				const selectedElementIds: Readonly<{
					[id: string]: true;
				}> = latestSerialNumberElementListRef.current.reduce(
					(acc, item) => {
						acc[item.id] = true;
						return acc;
					},
					{} as {
						[id: string]: true;
					},
				);

				action.updateScene({
					appState: {
						selectedGroupIds: {
							[latestSerialNumberElementListRef.current[0].groupIds[0]]: true,
						},
						selectedElementIds,
					},
					captureUpdate: "IMMEDIATELY",
				});
			}
		}
	}, [disableArrowRef, getAction, lockTool]);

	useStateSubscriber(
		ExcalidrawEventPublisher,
		useCallback(
			(params: ExcalidrawEventParams | undefined) => {
				if (params?.event === "onDraw") {
					latestSerialNumberElementListRef.current = [];
					setSerialNumber(1);
				}

				if (!enableRef.current) {
					return;
				}

				if (params?.event === "onPointerDown") {
					const { pointerDownState } = params.params;
					if (
						pointerDownState.hit.element?.id.startsWith(
							"snow-shot_serial-number_",
						) ||
						pointerDownState.resize.isResizing
					) {
						return;
					}

					onMouseDown();
				} else if (params?.event === "onPointerUp") {
					onMouseUp();
				}
			},
			[enableRef, onMouseDown, onMouseUp, setSerialNumber],
		),
	);

	useHotkeysApp(
		disableArrowHotKey,
		useCallback(() => {
			if (!enableRef.current) {
				return;
			}

			updateAppSettings(
				AppSettingsGroup.Cache,
				{
					disableArrowPicker: !disableArrowRef.current,
				},
				true,
				true,
				false,
				true,
				false,
			);
		}, [disableArrowRef, enableRef, updateAppSettings]),
		useMemo(
			() => ({
				preventDefault: true,
				keyup: true,
				keydown: false,
				scopes: HotkeysScope.DrawTool,
			}),
			[],
		),
	);

	const updateActiveTool = useCallback(
		(enable: boolean, disableArrow: boolean) => {
			if (!enable) {
				return;
			}

			const toolLocked = lockTool();

			if (disableArrow) {
				getAction()?.setActiveTool(
					{
						type: "ellipse",
						locked: toolLocked,
					},
					undefined,
					DrawState.SerialNumber,
				);
			} else {
				getAction()?.setActiveTool(
					{
						type: "arrow",
						locked: toolLocked,
					},
					undefined,
					DrawState.SerialNumber,
				);
			}
		},
		[lockTool, getAction],
	);
	useEffect(() => {
		if (enable) {
			updateActiveTool(enable, disableArrow);
		}
	}, [updateActiveTool, enable, disableArrow]);

	return undefined;
};
