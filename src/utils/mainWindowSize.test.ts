import type { Monitor } from "@tauri-apps/api/window";
import type { MainWindowSizeTier } from "../types/appSettings.js";
import {
	getAvailableMainWindowSizeTiers,
	getClampedMainWindowPosition,
	getResponsiveMainWindowSizeTier,
} from "./mainWindowSize.js";

const COMPACT = "compact" as MainWindowSizeTier;
const STANDARD = "standard" as MainWindowSizeTier;
const LARGE = "large" as MainWindowSizeTier;

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
	assert(
		JSON.stringify(actual) === JSON.stringify(expected),
		`${message}\nactual: ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`,
	);
};

const createMonitor = (
	logicalWidth: number,
	logicalHeight: number,
	scaleFactor = 1,
): Monitor =>
	({
		name: "Regression monitor",
		scaleFactor,
		position: { x: 0, y: 0 },
		size: {
			width: logicalWidth * scaleFactor,
			height: logicalHeight * scaleFactor,
		},
		workArea: {
			position: { x: 0, y: 0 },
			size: {
				width: logicalWidth * scaleFactor,
				height: logicalHeight * scaleFactor,
			},
		},
	}) as Monitor;

assert(
	getResponsiveMainWindowSizeTier(LARGE, createMonitor(1600, 900)) === LARGE,
	"a large work area should keep the default large tier",
);
assert(
	getResponsiveMainWindowSizeTier(LARGE, createMonitor(1200, 700)) === STANDARD,
	"a medium work area should downgrade large to standard",
);
assert(
	getResponsiveMainWindowSizeTier(LARGE, createMonitor(800, 600)) === COMPACT,
	"a small work area should downgrade large to compact",
);
assert(
	getResponsiveMainWindowSizeTier(STANDARD, createMonitor(1600, 900)) ===
		STANDARD,
	"a large display must preserve an explicit standard preference",
);
assert(
	getResponsiveMainWindowSizeTier(LARGE, createMonitor(1200, 700, 1.5)) ===
		STANDARD,
	"150% DPI must use logical rather than physical work-area dimensions",
);
assertDeepEqual(
	getAvailableMainWindowSizeTiers(null),
	[COMPACT, STANDARD, LARGE],
	"an unavailable monitor query should retain all configured tiers",
);

const offsetMonitor = createMonitor(1920, 1040);
offsetMonitor.workArea.position.x = -1920;
offsetMonitor.position.x = -1920;
assertDeepEqual(
	getClampedMainWindowPosition(
		offsetMonitor,
		{ x: -1800, y: 100 },
		{ width: 1024, height: 632 },
	),
	{ x: -1800, y: 100 },
	"clamp must not move a fully visible window",
);
assertDeepEqual(
	getClampedMainWindowPosition(
		offsetMonitor,
		{ x: 200, y: 900 },
		{ width: 1024, height: 632 },
	),
	{ x: -1024, y: 408 },
	"clamp must return an off-screen window to the monitor work area",
);

console.log("main window size regression checks passed");
