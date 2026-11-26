import {
	type CandidateRect,
	isInWholeWindowPriorityZone,
	mergeCandidateRects,
	resolveSelectionLevel,
	stepSelectionLevel,
} from "./candidateSelection.js";

const assert = (condition: boolean, message: string) => {
	if (!condition) {
		throw new Error(message);
	}
};

const framelessWindow: CandidateRect = {
	min_x: 100,
	min_y: 100,
	max_x: 1100,
	max_y: 800,
};

// Frameless / Tauri WebView2 window (like EcholIKE): rcClient === rcWindow
const framelessClient: CandidateRect = { ...framelessWindow };

const childButton: CandidateRect = {
	min_x: 140,
	min_y: 110,
	max_x: 240,
	max_y: 140,
};

const contentCard: CandidateRect = {
	min_x: 300,
	min_y: 300,
	max_x: 600,
	max_y: 500,
};

// 1. Frameless window top header strip prioritizes whole window
assert(
	isInWholeWindowPriorityZone({
		mousePosition: { mouseX: 180, mouseY: 120 },
		topWindowRect: framelessWindow,
		topWindowClientRect: framelessClient,
		devicePixelRatio: 1,
		isVideoRecord: false,
	}),
	"Frameless window top header strip should prioritize whole window",
);

// 2. Frameless window edge grab band prioritizes whole window
assert(
	isInWholeWindowPriorityZone({
		mousePosition: { mouseX: 108, mouseY: 450 },
		topWindowRect: framelessWindow,
		topWindowClientRect: framelessClient,
		devicePixelRatio: 1,
		isVideoRecord: false,
	}),
	"Window left edge grab band should prioritize whole window",
);

// 3. Inside content area during screenshot allows child element selection first
assert(
	!isInWholeWindowPriorityZone({
		mousePosition: { mouseX: 450, mouseY: 400 },
		topWindowRect: framelessWindow,
		topWindowClientRect: framelessClient,
		devicePixelRatio: 1,
		isVideoRecord: false,
	}),
	"Inner content area during screenshot should allow child elements first",
);

// 4. Inside content area during video recording prioritizes whole window
assert(
	isInWholeWindowPriorityZone({
		mousePosition: { mouseX: 450, mouseY: 400 },
		topWindowRect: framelessWindow,
		topWindowClientRect: framelessClient,
		devicePixelRatio: 1,
		isVideoRecord: true,
	}),
	"Video recording mode should prioritize whole window everywhere inside window",
);

// 5. Merge order when whole window is preferred puts topWindowRect first, keeps children accessible
const mergedPreferred = mergeCandidateRects({
	windowRectList: [framelessWindow],
	elementRectList: [childButton, framelessWindow],
	mousePosition: { mouseX: 180, mouseY: 120 },
	preferWholeWindow: true,
});
assert(
	mergedPreferred.length === 2 &&
		mergedPreferred[0].min_x === framelessWindow.min_x &&
		mergedPreferred[0].max_x === framelessWindow.max_x &&
		mergedPreferred[1].min_x === childButton.min_x,
	"Whole-window preferred merge should place top window at index 0 and keep child candidate at index 1",
);

// 6. Merge order in content area keeps child first and whole window as reliable fallback
const mergedContent = mergeCandidateRects({
	windowRectList: [framelessWindow],
	elementRectList: [contentCard],
	mousePosition: { mouseX: 450, mouseY: 400 },
	preferWholeWindow: false,
});
assert(
	mergedContent.length === 2 &&
		mergedContent[0].min_x === contentCard.min_x &&
		mergedContent[1].min_x === framelessWindow.min_x,
	"Content-area merge should place child first and whole window second",
);

// 7. Wheel level preservation: moving over desktop (1 candidate) does NOT wipe stored desiredLevel
let desiredLevel = 0;
// User wheels up 3 times on EcholIKE (4 candidates) to reach whole window (index 3)
desiredLevel = stepSelectionLevel(desiredLevel, 1, 4);
desiredLevel = stepSelectionLevel(desiredLevel, 1, 4);
desiredLevel = stepSelectionLevel(desiredLevel, 1, 4);
assert(desiredLevel === 3, "Expected desiredLevel 3 after scrolling up");
// Mouse moves over desktop (1 candidate): resolveSelectionLevel returns 0, desiredLevel stays 3
assert(
	resolveSelectionLevel(desiredLevel, 1) === 0 && desiredLevel === 3,
	"Moving over desktop should clamp effective index without resetting desiredLevel",
);
// Mouse moves back over EcholIKE (4 candidates): still selects whole window (index 3)!
assert(
	resolveSelectionLevel(desiredLevel, 4) === 3,
	"Returning to EcholIKE should immediately restore whole-window selection",
);
// Mouse wheels down once on a 2-candidate window: steps down cleanly from effective index 1 -> 0
const steppedDown = stepSelectionLevel(desiredLevel, -1, 2);
assert(
	steppedDown === 0,
	"Scrolling down should step from effective level on the first tick",
);

console.log(
	"select-layer candidate selection regressions passed: frameless header, edge grab, videoRecord priority, merge order, wheel level preservation",
);
