export type CandidateRect = {
	min_x: number;
	min_y: number;
	max_x: number;
	max_y: number;
};

export type CandidatePoint = {
	mouseX: number;
	mouseY: number;
};

const EDGE_GRAB_LOGICAL_PX = 12;
const FRAMELESS_HEADER_LOGICAL_PX = 44;
const FRAMELESS_HEADER_TOLERANCE_LOGICAL_PX = 4;
const MIN_EDGE_WINDOW_LOGICAL_SIZE = 48;
const MIN_HEADER_WINDOW_LOGICAL_HEIGHT = 120;

const pointInRect = (rect: CandidateRect, point: CandidatePoint): boolean => {
	return (
		point.mouseX >= rect.min_x &&
		point.mouseX <= rect.max_x &&
		point.mouseY >= rect.min_y &&
		point.mouseY <= rect.max_y
	);
};

const isValidRect = (
	rect: CandidateRect | undefined,
): rect is CandidateRect => {
	return (
		!!rect &&
		Number.isFinite(rect.min_x) &&
		Number.isFinite(rect.min_y) &&
		Number.isFinite(rect.max_x) &&
		Number.isFinite(rect.max_y) &&
		rect.min_x < rect.max_x &&
		rect.min_y < rect.max_y
	);
};

/**
 * Determine whether the whole top-level window should be prioritized as the
 * first selection candidate (index 0) at this cursor position.
 */
export const isInWholeWindowPriorityZone = ({
	mousePosition,
	topWindowRect,
	topWindowClientRect,
	devicePixelRatio,
}: {
	mousePosition: CandidatePoint;
	topWindowRect?: CandidateRect;
	topWindowClientRect?: CandidateRect;
	devicePixelRatio: number;
}): boolean => {
	if (
		!isValidRect(topWindowRect) ||
		!pointInRect(topWindowRect, mousePosition)
	) {
		return false;
	}

	// Native non-client area (e.g. standard Windows title bar / frame)
	if (
		isValidRect(topWindowClientRect) &&
		!pointInRect(topWindowClientRect, mousePosition)
	) {
		return true;
	}

	const dpr =
		Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
			? devicePixelRatio
			: 1;
	const width = topWindowRect.max_x - topWindowRect.min_x;
	const height = topWindowRect.max_y - topWindowRect.min_y;

	// Window perimeter grab band lets users reliably pick the entire window on
	// both native and custom-drawn/frameless apps (Tauri, Electron, WebView2).
	const edgeBand = EDGE_GRAB_LOGICAL_PX * dpr;
	if (
		width >= MIN_EDGE_WINDOW_LOGICAL_SIZE * dpr &&
		height >= MIN_EDGE_WINDOW_LOGICAL_SIZE * dpr
	) {
		const nearEdge =
			mousePosition.mouseX - topWindowRect.min_x <= edgeBand ||
			topWindowRect.max_x - mousePosition.mouseX <= edgeBand ||
			mousePosition.mouseY - topWindowRect.min_y <= edgeBand ||
			topWindowRect.max_y - mousePosition.mouseY <= edgeBand;
		if (nearEdge) {
			return true;
		}
	}

	// Frameless / custom-titlebar windows expose rcClient starting at rcWindow's
	// top edge. Treat the top header strip as a whole-window grab zone so users
	// do not have to fight WebView2/Chromium child DOM elements.
	const isFramelessTop =
		!isValidRect(topWindowClientRect) ||
		topWindowClientRect.min_y <=
			topWindowRect.min_y + FRAMELESS_HEADER_TOLERANCE_LOGICAL_PX * dpr;
	if (
		isFramelessTop &&
		height >= MIN_HEADER_WINDOW_LOGICAL_HEIGHT * dpr &&
		mousePosition.mouseY - topWindowRect.min_y <=
			FRAMELESS_HEADER_LOGICAL_PX * dpr
	) {
		return true;
	}

	return false;
};

/**
 * Merge UIA child candidates with top-level window candidates in a deterministic,
 * deduplicated order.
 */
export const mergeCandidateRects = ({
	windowRectList,
	elementRectList,
	mousePosition,
	preferWholeWindow,
}: {
	windowRectList: CandidateRect[];
	elementRectList?: CandidateRect[];
	mousePosition: CandidatePoint;
	preferWholeWindow: boolean;
}): CandidateRect[] => {
	const result: CandidateRect[] = [];
	const rectKeys = new Set<string>();
	const topWindowRect = windowRectList[0];

	const pushRect = (rect: CandidateRect) => {
		const key = `${rect.min_x},${rect.min_y},${rect.max_x},${rect.max_y}`;
		if (!rectKeys.has(key)) {
			rectKeys.add(key);
			result.push(rect);
		}
	};

	if (preferWholeWindow && isValidRect(topWindowRect)) {
		pushRect(topWindowRect);
	}

	for (const rect of elementRectList ?? []) {
		const candidateRect = topWindowRect
			? {
					min_x: Math.max(rect.min_x, topWindowRect.min_x),
					min_y: Math.max(rect.min_y, topWindowRect.min_y),
					max_x: Math.min(rect.max_x, topWindowRect.max_x),
					max_y: Math.min(rect.max_y, topWindowRect.max_y),
				}
			: rect;

		if (
			isValidRect(candidateRect) &&
			pointInRect(candidateRect, mousePosition)
		) {
			pushRect(candidateRect);
		}
	}

	for (const rect of windowRectList) {
		if (isValidRect(rect)) {
			pushRect(rect);
		}
	}

	return result;
};

/**
 * Clamp the stored selection level for lookup WITHOUT overwriting the caller's
 * preferred level, so moving across desktop or shallow windows does not reset
 * a user who scrolled up to whole-window level.
 */
export const resolveSelectionLevel = (
	desiredLevel: number,
	candidateCount: number,
): number => {
	if (candidateCount <= 1) {
		return 0;
	}
	const maxLevel = candidateCount - 1;
	return Math.min(Math.max(desiredLevel, 0), maxLevel);
};

/**
 * Step the stored selection level in response to a mouse wheel tick, starting
 * from the currently effective level so reversing direction responds on the
 * first tick.
 */
export const stepSelectionLevel = (
	desiredLevel: number,
	deltaLevel: number,
	candidateCount: number,
): number => {
	const maxLevel = Math.max(candidateCount - 1, 0);
	const effectiveLevel = resolveSelectionLevel(desiredLevel, candidateCount);
	return Math.min(Math.max(effectiveLevel + deltaLevel, 0), maxLevel);
};
