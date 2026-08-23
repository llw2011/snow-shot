import type { Monitor } from "@tauri-apps/api/window";
import type { MainWindowSizeTier } from "@/types/appSettings";

export type MainWindowSizePreset = {
	width: number;
	height: number;
};

export const MAIN_WINDOW_SIZE_PRESETS: Record<
	MainWindowSizeTier,
	MainWindowSizePreset
> = {
	compact: { width: 760, height: 560 },
	standard: { width: 1024, height: 632 },
	large: { width: 1268, height: 734 },
};

export const MAIN_WINDOW_SIZE_TIERS = [
	"compact",
	"standard",
	"large",
] as const as readonly MainWindowSizeTier[];

const WORK_AREA_MARGIN = 16;

const getLogicalWorkArea = (monitor: Monitor) => ({
	width: monitor.workArea.size.width / monitor.scaleFactor,
	height: monitor.workArea.size.height / monitor.scaleFactor,
});

export const getAvailableMainWindowSizeTiers = (monitor: Monitor | null) => {
	if (!monitor) {
		return [...MAIN_WINDOW_SIZE_TIERS];
	}

	const workArea = getLogicalWorkArea(monitor);
	const available = MAIN_WINDOW_SIZE_TIERS.filter((tier) => {
		const preset = MAIN_WINDOW_SIZE_PRESETS[tier];
		return (
			preset.width + WORK_AREA_MARGIN * 2 <= workArea.width &&
			preset.height + WORK_AREA_MARGIN * 2 <= workArea.height
		);
	});

	// 760 × 560 is the supported minimum layout. Keep it selectable on an
	// unusually small work area so the window never starts without a tier.
	return available.length > 0 ? available : ["compact" as MainWindowSizeTier];
};

export const getResponsiveMainWindowSizeTier = (
	preferredTier: MainWindowSizeTier,
	monitor: Monitor | null,
) => {
	const available = getAvailableMainWindowSizeTiers(monitor);
	const preferredIndex = MAIN_WINDOW_SIZE_TIERS.indexOf(preferredTier);

	for (let index = preferredIndex; index >= 0; index -= 1) {
		const tier = MAIN_WINDOW_SIZE_TIERS[index];
		if (available.includes(tier)) {
			return tier;
		}
	}

	return available[0];
};

export const getMainWindowMonitorKey = (monitor: Monitor | null) => {
	if (!monitor) {
		return "unknown";
	}

	const { position, size } = monitor.workArea;
	return [
		monitor.name ?? "",
		monitor.scaleFactor,
		position.x,
		position.y,
		size.width,
		size.height,
	].join(":");
};

export const getClampedMainWindowPosition = (
	monitor: Monitor,
	position: { x: number; y: number },
	windowSize: { width: number; height: number },
) => {
	const minX = monitor.workArea.position.x;
	const minY = monitor.workArea.position.y;
	const maxX = Math.max(
		minX,
		minX + monitor.workArea.size.width - windowSize.width,
	);
	const maxY = Math.max(
		minY,
		minY + monitor.workArea.size.height - windowSize.height,
	);

	return {
		x: Math.min(Math.max(position.x, minX), maxX),
		y: Math.min(Math.max(position.y, minY), maxY),
	};
};
