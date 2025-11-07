import { HolderOutlined } from "@ant-design/icons";
import { theme } from "antd";
import React, {
	useCallback,
	useContext,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
} from "react";
import { useIntl } from "react-intl";
import { DrawStatePublisher } from "@/components/drawCore/extra";
import { useCallbackRender } from "@/hooks/useCallbackRender";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { ElementDraggingPublisher } from "@/pages/draw/extra";
import { DrawContext } from "@/pages/draw/types";
import type { ElementRect } from "@/types/commands/screenshot";
import type { DrawState } from "@/types/draw";
import { MousePosition } from "@/utils/mousePosition";
import { useMonitorRect } from "../../../statusBar";
import { DrawToolbarContext, isEnableSubToolbar } from "../../extra";
import {
	type UpdateElementPositionResult,
	updateElementPosition,
} from "./extra";

export type DragButtonActionType = {
	setEnable: (enable: boolean) => void;
};

const useDragElementCore: () => {
	update: (
		element: HTMLElement,
		baseOffsetX: number,
		baseOffsetY: number,
		contentScale?: number,
		calculatedBoundaryRect?: (
			rect: ElementRect,
			toolbarWidth: number,
			toolbarHeight: number,
			viewportWidth: number,
			viewportHeight: number,
		) => ElementRect,
		autoHidePadding?: number,
	) => UpdateElementPositionResult;
	reset: () => void;
	mouseOriginPositionRef: React.RefObject<MousePosition>;
	mouseCurrentPositionRef: React.RefObject<MousePosition>;
	toolbarCurrentRectRef: React.RefObject<ElementRect>;
	toolbarPreviousRectRef: React.RefObject<ElementRect | undefined>;
	applyDragResult: (dragRes: UpdateElementPositionResult) => void;
} = () => {
	// 保存 toolbar 位置
	const mouseOriginPositionRef = useRef<MousePosition>(new MousePosition(0, 0));
	const mouseCurrentPositionRef = useRef<MousePosition>(
		new MousePosition(0, 0),
	);
	const toolbarCurrentRectRef = useRef<ElementRect>({
		min_x: 0,
		min_y: 0,
		max_x: 0,
		max_y: 0,
	});
	const toolbarPreviousRectRef = useRef<ElementRect>(undefined);
	const update = useCallback(
		(
			element: HTMLElement,
			baseOffsetX: number,
			baseOffsetY: number,
			contentScale?: number,
			calculatedBoundaryRect?: (
				rect: ElementRect,
				toolbarWidth: number,
				toolbarHeight: number,
				viewportWidth: number,
				viewportHeight: number,
			) => ElementRect,
			autoHidePadding?: number,
		): UpdateElementPositionResult => {
			const dragRes = updateElementPosition(
				element,
				baseOffsetX,
				baseOffsetY,
				mouseOriginPositionRef.current,
				mouseCurrentPositionRef.current,
				toolbarPreviousRectRef.current,
				undefined,
				contentScale,
				calculatedBoundaryRect,
				autoHidePadding,
			);

			return dragRes;
		},
		[],
	);

	const applyDragResult = useCallback(
		(dragRes: UpdateElementPositionResult) => {
			toolbarCurrentRectRef.current = dragRes.rect;
			mouseOriginPositionRef.current = dragRes.originPosition;
		},
		[],
	);

	const reset = useCallback(() => {
		mouseOriginPositionRef.current = new MousePosition(0, 0);
		mouseCurrentPositionRef.current = new MousePosition(0, 0);
		toolbarCurrentRectRef.current = {
			min_x: 0,
			min_y: 0,
			max_x: 0,
			max_y: 0,
		};
		toolbarPreviousRectRef.current = undefined;
	}, []);

	return useMemo(() => {
		return {
			update,
			applyDragResult,
			reset,
			mouseOriginPositionRef,
			mouseCurrentPositionRef,
			toolbarCurrentRectRef,
			toolbarPreviousRectRef,
		};
	}, [reset, update, applyDragResult]);
};

export type DragElementConfig = {
	getBaseOffset: (element: HTMLElement) => {
		x: number;
		y: number;
	};
	getContentScale?: () => number;
	calculatedBoundaryRect?: (
		rect: ElementRect,
		toolbarWidth: number,
		toolbarHeight: number,
		viewportWidth: number,
		viewportHeight: number,
	) => ElementRect;
};

export type DragElementOptionalConfig = {
	config: DragElementConfig;
	/** 判断结果是否可以应用 */
	canApply: (dragRes: UpdateElementPositionResult) => boolean;
	/** 判断是否需要尝试使用当前配置 */
	needTry: (mainDragRes: UpdateElementPositionResult) => boolean;
};

export const useDragElement = (
	mainConfig: DragElementConfig,
	optionalConfigs?: DragElementOptionalConfig[],
	autoHideConfig?: {
		padding: number;
		getElement: () => HTMLElement | undefined | null;
	},
): {
	update: (
		element: HTMLElement,
		contentScale?: number,
		calculatedBoundaryRect?: (
			rect: ElementRect,
			toolbarWidth: number,
			toolbarHeight: number,
			viewportWidth: number,
			viewportHeight: number,
		) => ElementRect,
	) => UpdateElementPositionResult;
	reset: () => void;
	onMouseDown: (event: React.MouseEvent<HTMLDivElement> | MouseEvent) => void;
	onMouseMove: (
		event: React.MouseEvent<HTMLDivElement> | MouseEvent,
		element: HTMLElement,
		contentScale?: number,
		calculatedBoundaryRect?: (
			rect: ElementRect,
			toolbarWidth: number,
			toolbarHeight: number,
			viewportWidth: number,
			viewportHeight: number,
		) => ElementRect,
	) => void;
	onMouseEnter: () => void;
	onMouseLeave: () => void;
	onMouseUp: () => void;
} => {
	const {
		update: updateCore,
		reset: resetDrag,
		mouseOriginPositionRef,
		mouseCurrentPositionRef,
		toolbarPreviousRectRef,
		toolbarCurrentRectRef,
		applyDragResult,
	} = useDragElementCore();

	const draggingRef = useRef(false);
	const [, setDragging] = useStateSubscriber(
		ElementDraggingPublisher,
		undefined,
	);

	const autoHideResultRef = useRef<
		| {
				top: number;
				left: number;
		  }
		| undefined
	>(undefined);
	const selectedConfigRef = useRef<DragElementConfig | undefined>(undefined);
	const update = useCallback(
		(
			element: HTMLElement,
			contentScale?: number,
			calculatedBoundaryRect?: (
				rect: ElementRect,
				toolbarWidth: number,
				toolbarHeight: number,
				viewportWidth: number,
				viewportHeight: number,
			) => ElementRect,
		) => {
			const baseOffset = selectedConfigRef.current
				? selectedConfigRef.current.getBaseOffset(element)
				: mainConfig.getBaseOffset(element);
			let dragRes = updateCore(
				element,
				baseOffset.x,
				baseOffset.y,
				contentScale,
				calculatedBoundaryRect,
				autoHideConfig?.padding,
			);

			if (!selectedConfigRef.current) {
				for (const { config, needTry, canApply } of optionalConfigs ?? []) {
					if (!needTry(dragRes)) {
						continue;
					}

					const baseOffset = config.getBaseOffset(element);
					const tempDragRes = updateCore(
						element,
						baseOffset.x,
						baseOffset.y,
						contentScale,
						calculatedBoundaryRect,
						autoHideConfig?.padding,
					);
					if (canApply(tempDragRes)) {
						dragRes = tempDragRes;
						selectedConfigRef.current = config;
						break;
					}
				}

				if (!selectedConfigRef.current) {
					// 回退到原来的方案
					const baseOffset = mainConfig.getBaseOffset(element);
					dragRes = updateCore(
						element,
						baseOffset.x,
						baseOffset.y,
						contentScale,
						calculatedBoundaryRect,
						autoHideConfig?.padding,
					);
					selectedConfigRef.current = mainConfig;
				}
			}

			applyDragResult(dragRes);
			autoHideResultRef.current = dragRes.autoHideResult;

			return dragRes;
		},
		[mainConfig, optionalConfigs, updateCore, applyDragResult, autoHideConfig],
	);
	const updateRender = useCallbackRender(update);

	const resetConfig = useCallback(() => {
		selectedConfigRef.current = undefined;
	}, []);

	const onMouseDown = useCallback(
		(event: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
			draggingRef.current = true;
			setDragging(true);
			mouseOriginPositionRef.current = new MousePosition(
				event.clientX,
				event.clientY,
			);
			mouseCurrentPositionRef.current = new MousePosition(
				event.clientX,
				event.clientY,
			);
			toolbarPreviousRectRef.current = toolbarCurrentRectRef.current;
		},
		[
			mouseOriginPositionRef,
			mouseCurrentPositionRef,
			toolbarPreviousRectRef,
			toolbarCurrentRectRef,
			setDragging,
		],
	);
	const onMouseMoveCore = useCallback(
		(
			event: React.MouseEvent<HTMLDivElement> | MouseEvent,
			element: HTMLElement,
			contentScale?: number,
			calculatedBoundaryRect?: (
				rect: ElementRect,
				toolbarWidth: number,
				toolbarHeight: number,
				viewportWidth: number,
				viewportHeight: number,
			) => ElementRect,
		) => {
			if (!draggingRef.current) {
				return;
			}

			mouseCurrentPositionRef.current = new MousePosition(
				event.clientX,
				event.clientY,
			);
			updateRender(element, contentScale, calculatedBoundaryRect);
		},
		[mouseCurrentPositionRef, updateRender],
	);

	const mouseHoverRef = useRef(false);
	const tryApplyAutoHideResult = useCallback(() => {
		if (mouseHoverRef.current || draggingRef.current) {
			return;
		}

		const element = autoHideConfig?.getElement();
		if (!element) {
			return;
		}

		if (autoHideResultRef.current) {
			element.style.top = `${autoHideResultRef.current.top}px`;
			element.style.left = `${autoHideResultRef.current.left}px`;
			element.style.opacity = "0.42";
		}
	}, [autoHideConfig]);

	const onMouseUp = useCallback(() => {
		if (!draggingRef.current) {
			return;
		}

		draggingRef.current = false;
		setDragging(false);

		tryApplyAutoHideResult();
	}, [setDragging, tryApplyAutoHideResult]);

	const onMouseEnter = useCallback(() => {
		mouseHoverRef.current = true;

		const element = autoHideConfig?.getElement();
		if (!element) {
			return;
		}

		element.style.transition =
			"left 0.2s ease-in-out, top 0.2s ease-in-out, opacity 0.2s ease-in-out";
		if (autoHideResultRef.current) {
			element.style.top = "";
			element.style.left = "";
			element.style.opacity = "1";
		}
	}, [autoHideConfig]);
	const onMouseLeave = useCallback(() => {
		mouseHoverRef.current = false;

		tryApplyAutoHideResult();
	}, [tryApplyAutoHideResult]);

	return useMemo(() => {
		return {
			update: updateRender,
			reset: () => {
				resetConfig();
				resetDrag();
			},
			onMouseDown,
			onMouseMove: onMouseMoveCore,
			onMouseUp,
			onMouseEnter,
			onMouseLeave,
		};
	}, [
		onMouseDown,
		onMouseMoveCore,
		onMouseUp,
		resetConfig,
		resetDrag,
		updateRender,
		onMouseEnter,
		onMouseLeave,
	]);
};

const DragButtonCore: React.FC<{
	actionRef: React.RefObject<DragButtonActionType | undefined>;
}> = ({ actionRef }) => {
	const enableRef = useRef(false);

	const enableSubToolbarRef = useRef(false);

	const { selectLayerActionRef } = useContext(DrawContext);
	const { drawToolbarRef, setDragging, draggingRef } =
		useContext(DrawToolbarContext);
	const { token } = theme.useToken();

	const {
		contentScale: [, , contentScaleRef],
		calculatedBoundaryRect,
	} = useMonitorRect(true);

	const getSelectedRect = useCallback(() => {
		return (
			selectLayerActionRef.current?.getSelectRect() ?? {
				min_x: 0,
				min_y: 0,
				max_x: 0,
				max_y: 0,
			}
		);
	}, [selectLayerActionRef]);
	const {
		update: updateDrawToolbarStyleCore,
		reset: resetDrag,
		onMouseDown,
		onMouseMove,
		onMouseUp,
	} = useDragElement(
		useMemo(() => {
			return {
				getBaseOffset: (element: HTMLElement) => {
					const selectedRect = getSelectedRect();

					return {
						x:
							selectedRect.max_x / window.devicePixelRatio -
							element.clientWidth * contentScaleRef.current,
						y:
							selectedRect.max_y / window.devicePixelRatio +
							token.marginXXS * contentScaleRef.current,
					};
				},
			};
		}, [contentScaleRef, getSelectedRect, token.marginXXS]),
		useMemo(() => {
			return [
				{
					config: {
						getBaseOffset: (element: HTMLElement) => {
							const selectedRect = getSelectedRect();

							return {
								x:
									selectedRect.max_x / window.devicePixelRatio -
									element.clientWidth * contentScaleRef.current,
								y:
									selectedRect.min_y / window.devicePixelRatio -
									element.clientHeight * contentScaleRef.current -
									token.marginXXS * contentScaleRef.current,
							};
						},
					},
					needTry: (dragRes: UpdateElementPositionResult) => {
						return dragRes.isBeyondMaxY;
					},
					canApply: (dragRes: UpdateElementPositionResult) => {
						return !(dragRes.isBeyondMaxY || dragRes.isBeyondMinY);
					},
				},
			];
		}, [contentScaleRef, getSelectedRect, token.marginXXS]),
	);

	const updateDrawToolbarStyle = useCallback(() => {
		const drawToolbar = drawToolbarRef.current;
		if (!drawToolbar) {
			return;
		}

		updateDrawToolbarStyleCore(
			drawToolbar,
			contentScaleRef.current,
			calculatedBoundaryRect,
		);
	}, [
		drawToolbarRef,
		updateDrawToolbarStyleCore,
		contentScaleRef,
		calculatedBoundaryRect,
	]);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			e.stopPropagation();
			setDragging(true);
			onMouseDown(e);
		},
		[onMouseDown, setDragging],
	);

	// 处理鼠标释放事件
	const handleMouseUp = useCallback(() => {
		if (!draggingRef.current) {
			return;
		}

		setDragging(false);
		onMouseUp();
	}, [draggingRef, setDragging, onMouseUp]);

	// 处理鼠标移动事件
	const handleMouseMove = useCallback(
		(event: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
			if (!draggingRef.current || !drawToolbarRef.current) {
				return;
			}

			onMouseMove(
				event,
				drawToolbarRef.current,
				contentScaleRef.current,
				calculatedBoundaryRect,
			);
		},
		[
			calculatedBoundaryRect,
			contentScaleRef,
			draggingRef,
			drawToolbarRef,
			onMouseMove,
		],
	);

	useEffect(() => {
		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [handleMouseMove, handleMouseUp]);

	const onEnableChange = useCallback(
		(enable: boolean) => {
			enableRef.current = enable;

			if (enable) {
				if (drawToolbarRef.current) {
					drawToolbarRef.current.style.opacity = "1";
					drawToolbarRef.current.style.pointerEvents = "auto";
				}

				// 重置偏移，避免工具栏定位受超出边界的逻辑影响
				resetDrag();
				updateDrawToolbarStyle();
			} else {
				if (drawToolbarRef.current) {
					drawToolbarRef.current.style.opacity = "0";
					drawToolbarRef.current.style.pointerEvents = "none";
				}
				resetDrag();
			}
		},
		[drawToolbarRef, resetDrag, updateDrawToolbarStyle],
	);

	const setEnable = useCallback(
		(enable: boolean) => {
			if (enableRef.current === enable) {
				return;
			}

			onEnableChange(enable);
		},
		[onEnableChange],
	);

	const onDrawStateChange = useCallback(
		(drawState: DrawState) => {
			enableSubToolbarRef.current = isEnableSubToolbar(drawState);

			updateDrawToolbarStyle();
		},
		[updateDrawToolbarStyle],
	);
	useStateSubscriber(DrawStatePublisher, onDrawStateChange);

	useImperativeHandle(actionRef, () => {
		return {
			setEnable,
		};
	}, [setEnable]);

	const intl = useIntl();
	const dragTitle = useMemo(() => {
		return intl.formatMessage({ id: "draw.drag" });
	}, [intl]);

	return (
		<div
			className="draw-toolbar-drag drag-button"
			title={dragTitle}
			onMouseDown={handleMouseDown}
		>
			<HolderOutlined />
		</div>
	);
};

export const DragButton = React.memo(DragButtonCore);
