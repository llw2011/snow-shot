import {
	canInteractivelyResizeFixedContent,
	getDrawWindowTargetSize,
	getInitialImageScale,
} from "./windowLayout.js";

const assert = (condition: boolean, message: string) => {
	if (!condition) {
		throw new Error(message);
	}
};

const assertDeepEqual = (
	actual: unknown,
	expected: unknown,
	message: string,
) => {
	const actualJson = JSON.stringify(actual);
	const expectedJson = JSON.stringify(expected);
	assert(
		actualJson === expectedJson,
		`${message}\nactual: ${actualJson}\nexpected: ${expectedJson}`,
	);
};

const longImageSize = { width: 400, height: 40_000 };
const monitorSize = { width: 1_920, height: 1_080 };

const initialScale = getInitialImageScale(longImageSize, monitorSize, true);
assert(
	initialScale === 0.027,
	"a 400x40000 image must fit the monitor height when auto resize is enabled",
);
assert(
	initialScale < 0.2,
	"auto resize must not clamp an extra-tall image to the manual 20% minimum",
);
assert(
	getInitialImageScale(longImageSize, monitorSize, false) === 1,
	"disabling auto resize must preserve the original image scale",
);

assert(
	canInteractivelyResizeFixedContent({
		enableDraw: false,
		enableSelectText: false,
		isThumbnail: false,
	}),
	"normal fixed content must remain interactively resizable",
);
assert(
	!canInteractivelyResizeFixedContent({
		enableDraw: true,
		enableSelectText: false,
		isThumbnail: false,
	}),
	"drawing mode must disable interactive window resize",
);
assert(
	!canInteractivelyResizeFixedContent({
		enableDraw: false,
		enableSelectText: true,
		isThumbnail: false,
	}),
	"text selection mode must disable interactive window resize",
);
assert(
	!canInteractivelyResizeFixedContent({
		enableDraw: false,
		enableSelectText: false,
		isThumbnail: true,
	}),
	"thumbnail mode must disable interactive window resize",
);

const autoSizedContent = {
	width: Math.round(longImageSize.width * initialScale),
	height: Math.round(longImageSize.height * initialScale),
};
assertDeepEqual(
	autoSizedContent,
	{ width: 11, height: 1_080 },
	"the auto-sized extra-tall image must remain monitor-height sized",
);

const toolbarSize = { width: 360, height: 48 };
const drawMenuSize = { width: 280, height: 320 };
assertDeepEqual(
	getDrawWindowTargetSize({
		contentSize: autoSizedContent,
		toolbarSize,
		drawMenuSize,
		devicePixelRatio: 1.25,
		enableDraw: true,
	}),
	{ width: 450, height: 1_140 },
	"entering drawing mode must add room for its controls without rescaling the image",
);
assertDeepEqual(
	getDrawWindowTargetSize({
		contentSize: autoSizedContent,
		toolbarSize,
		drawMenuSize,
		devicePixelRatio: 1.25,
		enableDraw: false,
	}),
	autoSizedContent,
	"leaving drawing mode must restore the content-sized window",
);

console.log("fixed content window layout regression checks passed");
