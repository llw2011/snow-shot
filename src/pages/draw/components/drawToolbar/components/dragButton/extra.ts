import type { ElementRect } from "@/types/commands/screenshot";
import { MousePosition } from "@/utils/mousePosition";

export const dragRect = (
	rect: ElementRect,
	originMousePosition: MousePosition,
	currentMousePosition: MousePosition,
	previousRect: ElementRect | undefined,
	boundaryRect: ElementRect,
) => {
	const offsetX = currentMousePosition.mouseX - originMousePosition.mouseX;
	const offsetY = currentMousePosition.mouseY - originMousePosition.mouseY;

	const baseRect = previousRect || rect;

	let minX = baseRect.min_x + offsetX;
	let minY = baseRect.min_y + offsetY;
	let maxX = baseRect.max_x + offsetX;
	let maxY = baseRect.max_y + offsetY;

	const width = maxX - minX;
	const height = maxY - minY;

	// 检测是否超出边界（在调整之前）
	const isBeyondMinX = minX < boundaryRect.min_x;
	const isBeyondMaxX = maxX > boundaryRect.max_x;
	const isBeyondMinY = minY < boundaryRect.min_y;
	const isBeyondMaxY = maxY > boundaryRect.max_y;
	const isBeyond = isBeyondMinX || isBeyondMaxX || isBeyondMinY || isBeyondMaxY;

	// 检测是否触碰边界
	const adjustedOriginPosition = new MousePosition(
		originMousePosition.mouseX,
		originMousePosition.mouseY,
	);
	let boundaryHit = false;

	if (minX < boundaryRect.min_x) {
		minX = boundaryRect.min_x;
		maxX = minX + width;
		// 调整原点X坐标，消除回弹效应
		adjustedOriginPosition.mouseX =
			currentMousePosition.mouseX - (minX - baseRect.min_x);
		boundaryHit = true;
	} else if (maxX > boundaryRect.max_x) {
		maxX = boundaryRect.max_x;
		minX = maxX - width;
		// 调整原点X坐标
		adjustedOriginPosition.mouseX =
			currentMousePosition.mouseX - (minX - baseRect.min_x);
		boundaryHit = true;
	}

	if (minY < boundaryRect.min_y) {
		minY = boundaryRect.min_y;
		maxY = minY + height;
		// 调整原点Y坐标
		adjustedOriginPosition.mouseY =
			currentMousePosition.mouseY - (minY - baseRect.min_y);
		boundaryHit = true;
	} else if (maxY > boundaryRect.max_y) {
		maxY = boundaryRect.max_y;
		minY = maxY - height;
		// 调整原点Y坐标
		adjustedOriginPosition.mouseY =
			currentMousePosition.mouseY - (minY - baseRect.min_y);
		boundaryHit = true;
	}

	return {
		rect: {
			min_x: minX,
			min_y: minY,
			max_x: maxX,
			max_y: maxY,
		},
		newOriginPosition: boundaryHit
			? adjustedOriginPosition
			: originMousePosition,
		isBeyond,
		isBeyondMinX,
		isBeyondMaxX,
		isBeyondMinY,
		isBeyondMaxY,
	};
};

export type UpdateElementPositionResult = {
	rect: ElementRect;
	originPosition: MousePosition;
	isBeyond: boolean;
	isBeyondMinX: boolean;
	isBeyondMaxX: boolean;
	isBeyondMinY: boolean;
	isBeyondMaxY: boolean;
	autoHideResult?: {
		top: number;
		left: number;
	};
};

export const updateElementPosition = (
	element: HTMLElement,
	baseOffsetX: number,
	baseOffsetY: number,
	originMousePosition: MousePosition,
	currentMousePosition: MousePosition,
	previousRect: ElementRect | undefined,
	cancelOnBeyond: boolean = false,
	contentScale: number = 1,
	calculatedBoundaryRect: (
		rect: ElementRect,
		toolbarWidth: number,
		toolbarHeight: number,
		viewportWidth: number,
		viewportHeight: number,
	) => ElementRect = (rect) => rect,
	autoHidePadding?: number,
): UpdateElementPositionResult => {
	let { clientWidth: toolbarWidth, clientHeight: toolbarHeight } = element;

	toolbarWidth = toolbarWidth * contentScale;
	toolbarHeight = toolbarHeight * contentScale;

	const viewportWidth = Math.max(document.body.clientWidth, toolbarWidth);
	const viewportHeight = Math.max(document.body.clientHeight, toolbarHeight);

	const boundaryRect = calculatedBoundaryRect(
		{
			min_x: -baseOffsetX,
			min_y: -baseOffsetY,
			max_x: -baseOffsetX + viewportWidth,
			max_y: -baseOffsetY + viewportHeight,
		},
		toolbarWidth,
		toolbarHeight,
		viewportWidth,
		viewportHeight,
	);

	const dragRes = dragRect(
		{
			min_x: 0,
			min_y: 0,
			max_x: toolbarWidth,
			max_y: toolbarHeight,
		},
		originMousePosition,
		currentMousePosition,
		previousRect,
		boundaryRect,
	);

	let autoHideResult:
		| {
				top: number;
				left: number;
		  }
		| undefined;
	if (!(cancelOnBeyond && dragRes.isBeyond)) {
		const translateX = baseOffsetX + dragRes.rect.min_x;
		const translateY = baseOffsetY + dragRes.rect.min_y;

		// 先设置基础的 transform
		element.style.transform = `translate(${translateX}px, ${translateY}px) scale(${contentScale})`;

		// 自动隐藏逻辑
		if (autoHidePadding !== undefined) {
			// 检测元素是否接近边界，接近则自动隐藏
			const threshold = 1; // 触发自动隐藏的距离阈值

			// 计算元素当前位置（相对于视口）
			const elementLeft = translateX;
			const elementRight = translateX + toolbarWidth;
			const elementTop = translateY;
			const elementBottom = translateY + toolbarHeight;

			// 计算边界位置
			const boundaryLeft = boundaryRect.min_x + baseOffsetX;
			const boundaryRight = boundaryRect.max_x + baseOffsetX;
			const boundaryTop = boundaryRect.min_y + baseOffsetY;
			const boundaryBottom = boundaryRect.max_y + baseOffsetY;

			// 左边界自动隐藏
			if (elementLeft - boundaryLeft <= threshold) {
				autoHideResult = {
					top: 0,
					left: -toolbarWidth + autoHidePadding,
				};
			}
			// 右边界自动隐藏
			else if (boundaryRight - elementRight <= threshold) {
				autoHideResult = {
					top: 0,
					left: toolbarWidth - autoHidePadding,
				};
			}
			// 上边界自动隐藏
			else if (elementTop - boundaryTop <= threshold) {
				autoHideResult = {
					top: -toolbarHeight + autoHidePadding,
					left: 0,
				};
			}
			// 下边界自动隐藏
			else if (boundaryBottom - elementBottom <= threshold) {
				autoHideResult = {
					top: toolbarHeight - autoHidePadding,
					left: 0,
				};
			}
			// 没有接近边界，清空 top 和 left
			else {
				autoHideResult = undefined;
			}
		} else {
			// 没有传递 autoHidePadding，恢复 top 和 left
			autoHideResult = undefined;
		}
	}

	return {
		rect: dragRes.rect,
		originPosition: dragRes.newOriginPosition,
		isBeyond: dragRes.isBeyond,
		isBeyondMinX: dragRes.isBeyondMinX,
		isBeyondMaxX: dragRes.isBeyondMaxX,
		isBeyondMinY: dragRes.isBeyondMinY,
		isBeyondMaxY: dragRes.isBeyondMaxY,
		autoHideResult,
	};
};
