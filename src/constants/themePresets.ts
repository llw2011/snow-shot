import type { ThemeConfig } from "antd";
import Color from "color";
import { AppSettingsTheme, AppThemePreset } from "@/types/appSettings";

type ThemeMode = AppSettingsTheme.Light | AppSettingsTheme.Dark;
type ThemeToken = NonNullable<ThemeConfig["token"]>;
type ThemeCssVariable = `--snow-shot-${string}`;

export type AppThemePalette = {
	canvas: string;
	surface: string;
	surfaceElevated: string;
	surfaceCard: string;
	hairline: string;
	hairlineSoft: string;
	hairlineStrong: string;
	ink: string;
	body: string;
	muted: string;
	ash: string;
	blue: string;
	red: string;
	green: string;
	yellow: string;
};

export type AppThemeVisuals = {
	panelBackground: string;
	siderBackground: string;
	headerBackground: string;
	atmosphere: string;
	pattern: string;
	patternSize: string;
	shadow: string;
	cardShadow: string;
	glow: string;
	backdropFilter: string;
	logoBackground: string;
	keycapBackground: string;
	commandGroupBackground: string;
	accentAltOne: string;
	accentAltTwo: string;
	accentAltThree: string;
};

export type AppThemeModeDefinition = {
	palette: AppThemePalette;
	visuals: AppThemeVisuals;
	recommendedAccent: string;
	antTokens: ThemeToken;
};

export type AppThemePresetDefinition = {
	id: AppThemePreset;
	recommendedRadius: number;
	modes: Record<ThemeMode, AppThemeModeDefinition>;
};

type ThemeModeInput = Omit<
	AppThemePalette,
	"blue" | "red" | "green" | "yellow"
> &
	Partial<Pick<AppThemePalette, "blue" | "red" | "green" | "yellow">> & {
		recommendedAccent: string;
	};

export const colorWithAlpha = (value: string, alpha: number) => {
	try {
		return Color(value).alpha(alpha).string();
	} catch {
		return value;
	}
};

const MIN_TEXT_CONTRAST = 4.5;

const ensureReadableTextColor = (value: string, surfaces: string[]) => {
	try {
		const source = Color(value);
		const surfaceColors = surfaces.map((surface) => Color(surface));
		if (
			surfaceColors.every(
				(surface) => source.contrast(surface) >= MIN_TEXT_CONTRAST,
			)
		) {
			return source.hex();
		}

		const target = Color(surfaces[0]).isDark()
			? Color("#FFFFFF")
			: Color("#000000");
		for (let step = 1; step <= 100; step += 1) {
			const candidate = Color(source.mix(target, step / 100).hex());
			if (
				surfaceColors.every(
					(surface) => candidate.contrast(surface) >= MIN_TEXT_CONTRAST,
				)
			) {
				return candidate.hex();
			}
		}

		return target.hex();
	} catch {
		return value;
	}
};

// Presets may vary their semantic palette, but the application shell is a
// single workbench. Keeping material decisions here prevents one preset from
// becoming a glass showcase while another behaves like a desktop utility.
const isDarkPalette = (palette: AppThemePalette) => {
	try {
		return Color(palette.canvas).isDark();
	} catch {
		return true;
	}
};

// Surfaces stay flat; only floating layers (menus, popovers, dialogs) carry a
// soft shadow so they read as above the page.
const createWorkbenchVisuals = (palette: AppThemePalette): AppThemeVisuals => ({
	panelBackground: palette.surface,
	siderBackground: palette.canvas,
	headerBackground: palette.canvas,
	atmosphere: "none",
	pattern: "none",
	patternSize: "auto",
	shadow: isDarkPalette(palette)
		? "0 12px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 247, 240, 0.06)"
		: "0 12px 32px rgba(28, 25, 23, 0.12), 0 1px 3px rgba(28, 25, 23, 0.08)",
	cardShadow: isDarkPalette(palette)
		? "0 8px 24px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 247, 240, 0.06)"
		: "0 8px 24px rgba(28, 25, 23, 0.1), 0 1px 2px rgba(28, 25, 23, 0.06)",
	glow: "none",
	backdropFilter: "none",
	logoBackground: palette.surfaceCard,
	keycapBackground: palette.surfaceElevated,
	commandGroupBackground: palette.surface,
	accentAltOne: palette.ink,
	accentAltTwo: palette.body,
	accentAltThree: palette.muted,
});

const createThemeMode = (input: ThemeModeInput): AppThemeModeDefinition => {
	const textSurfaces = [
		input.canvas,
		input.surface,
		input.surfaceElevated,
		input.surfaceCard,
	];
	const palette: AppThemePalette = {
		canvas: input.canvas,
		surface: input.surface,
		surfaceElevated: input.surfaceElevated,
		surfaceCard: input.surfaceCard,
		hairline: input.hairline,
		hairlineSoft: input.hairlineSoft,
		hairlineStrong: input.hairlineStrong,
		ink: input.ink,
		body: input.body,
		muted: input.muted,
		ash: input.ash,
		blue: ensureReadableTextColor(input.blue ?? "#57C1FF", textSurfaces),
		red: ensureReadableTextColor(input.red ?? "#FF6161", textSurfaces),
		green: ensureReadableTextColor(input.green ?? "#59D499", textSurfaces),
		yellow: ensureReadableTextColor(input.yellow ?? "#FFC533", textSurfaces),
	};

	const visuals = createWorkbenchVisuals(palette);

	return {
		palette,
		visuals,
		recommendedAccent: input.recommendedAccent,
		antTokens: {
			colorBgLayout: palette.canvas,
			colorBgContainer: palette.surface,
			colorBgElevated: palette.surfaceElevated,
			colorBorder: palette.hairline,
			colorBorderSecondary: palette.hairlineSoft,
			colorSplit: palette.hairlineSoft,
			colorFill: colorWithAlpha(palette.ink, 0.08),
			colorFillSecondary: colorWithAlpha(palette.ink, 0.06),
			colorFillTertiary: colorWithAlpha(palette.ink, 0.04),
			colorFillQuaternary: colorWithAlpha(palette.ink, 0.025),
			colorText: palette.ink,
			colorTextLightSolid: palette.canvas,
			colorTextSecondary: palette.body,
			colorTextTertiary: palette.muted,
			colorTextQuaternary: palette.ash,
			colorTextPlaceholder: palette.muted,
			colorTextDisabled: palette.ash,
			colorIcon: palette.muted,
			colorIconHover: palette.ink,
			colorLink: input.recommendedAccent,
			colorInfo: palette.blue,
			colorSuccess: palette.green,
			colorWarning: palette.yellow,
			colorError: palette.red,
			colorPrimaryBg: colorWithAlpha(input.recommendedAccent, 0.12),
			colorPrimaryBgHover: colorWithAlpha(input.recommendedAccent, 0.2),
			colorPrimaryBorder: colorWithAlpha(input.recommendedAccent, 0.42),
			boxShadow: visuals.shadow,
			boxShadowSecondary: visuals.cardShadow,
		},
	};
};

export const APP_THEME_PRESET_ORDER = [
	AppThemePreset.Obsidian,
	AppThemePreset.Aurora,
	AppThemePreset.Prism,
	AppThemePreset.Matrix,
	AppThemePreset.Chromatic,
	AppThemePreset.Glacier,
] as const;

// The six historic IDs stay valid in persisted settings, but there is only one
// built-in visual system. Mode changes luminance; a preset no longer changes skin.
export const APP_THEME_RADIUS = 8;

// Warm neutral surfaces with a single orange accent. Status colors keep their
// hue so success, warning, and error never collapse into the same gray.
const WORKBENCH_MODES: Record<ThemeMode, AppThemeModeDefinition> = {
	[AppSettingsTheme.Dark]: createThemeMode({
		canvas: "#141312",
		surface: "#1B1A19",
		surfaceElevated: "#232120",
		surfaceCard: "#262423",
		hairline: "#3A3734",
		hairlineSoft: "rgba(255, 247, 240, 0.08)",
		hairlineStrong: "rgba(255, 247, 240, 0.18)",
		ink: "#F5F4F2",
		body: "#CFCBC6",
		muted: "#A39E98",
		ash: "#7D7771",
		blue: "#6CA8FF",
		red: "#F87171",
		green: "#4ADE80",
		yellow: "#FACC15",
		recommendedAccent: "#FF7A3D",
	}),
	[AppSettingsTheme.Light]: createThemeMode({
		canvas: "#FAFAF9",
		surface: "#FFFFFF",
		surfaceElevated: "#F4F3F1",
		surfaceCard: "#FFFFFF",
		hairline: "#D6D3CF",
		hairlineSoft: "rgba(28, 25, 23, 0.09)",
		hairlineStrong: "rgba(28, 25, 23, 0.2)",
		ink: "#1C1917",
		body: "#44403C",
		muted: "#736D67",
		ash: "#A8A29E",
		blue: "#2563EB",
		red: "#DC2626",
		green: "#15803D",
		yellow: "#B45309",
		recommendedAccent: "#D9480F",
	}),
};

const createLegacyPreset = (id: AppThemePreset): AppThemePresetDefinition => ({
	id,
	recommendedRadius: APP_THEME_RADIUS,
	modes: WORKBENCH_MODES,
});

export const APP_THEME_PRESETS: Record<
	AppThemePreset,
	AppThemePresetDefinition
> = {
	[AppThemePreset.Obsidian]: createLegacyPreset(AppThemePreset.Obsidian),
	[AppThemePreset.Aurora]: createLegacyPreset(AppThemePreset.Aurora),
	[AppThemePreset.Prism]: createLegacyPreset(AppThemePreset.Prism),
	[AppThemePreset.Matrix]: createLegacyPreset(AppThemePreset.Matrix),
	[AppThemePreset.Chromatic]: createLegacyPreset(AppThemePreset.Chromatic),
	[AppThemePreset.Glacier]: createLegacyPreset(AppThemePreset.Glacier),
};

export const isAppThemePreset = (value: unknown): value is AppThemePreset =>
	APP_THEME_PRESET_ORDER.includes(value as AppThemePreset);

export const getAppThemePreset = (preset: AppThemePreset) =>
	APP_THEME_PRESETS[preset] ?? APP_THEME_PRESETS[AppThemePreset.Obsidian];

export const getAppThemeRuntime = (
	_preset: AppThemePreset,
	mode: AppSettingsTheme,
) => {
	const resolvedMode =
		mode === AppSettingsTheme.Dark
			? AppSettingsTheme.Dark
			: AppSettingsTheme.Light;
	return WORKBENCH_MODES[resolvedMode];
};

export const resolveThemePrimaryColor = (
	value: string,
	runtime: AppThemeModeDefinition,
	transformColor: (color: string) => string = (color) => color,
) => {
	try {
		const candidate = Color(value);
		const transformedCandidate = Color(transformColor(candidate.hex()));
		const textSurfaces = [
			runtime.palette.canvas,
			runtime.palette.surface,
			runtime.palette.surfaceElevated,
			runtime.palette.surfaceCard,
		];
		if (
			textSurfaces.every(
				(surface) =>
					candidate.contrast(Color(surface)) >= MIN_TEXT_CONTRAST &&
					transformedCandidate.contrast(Color(surface)) >= MIN_TEXT_CONTRAST,
			)
		) {
			return candidate.hex();
		}
	} catch {
		// Invalid legacy values fall back to the preset's readable accent.
	}

	return runtime.recommendedAccent;
};

export const createThemeCssVariables = (
	runtime: AppThemeModeDefinition,
	primaryColor: string,
	borderRadius: number,
	promoteLowContrastText = false,
): Record<ThemeCssVariable, string> => {
	const { palette, visuals } = runtime;
	const body = promoteLowContrastText ? palette.ink : palette.body;
	const muted = promoteLowContrastText ? palette.body : palette.muted;
	const ash = promoteLowContrastText ? palette.muted : palette.ash;

	return {
		"--snow-shot-canvas": palette.canvas,
		"--snow-shot-surface": palette.surface,
		"--snow-shot-surface-elevated": palette.surfaceElevated,
		"--snow-shot-surface-card": palette.surfaceCard,
		"--snow-shot-panel-bg": visuals.panelBackground,
		"--snow-shot-sider-bg": visuals.siderBackground,
		"--snow-shot-header-bg": visuals.headerBackground,
		"--snow-shot-hairline": palette.hairline,
		"--snow-shot-hairline-soft": palette.hairlineSoft,
		"--snow-shot-hairline-strong": palette.hairlineStrong,
		"--snow-shot-ink": palette.ink,
		"--snow-shot-body": body,
		"--snow-shot-muted": muted,
		"--snow-shot-ash": ash,
		"--snow-shot-blue": palette.blue,
		"--snow-shot-red": palette.red,
		"--snow-shot-green": palette.green,
		"--snow-shot-yellow": palette.yellow,
		"--snow-shot-on-error": palette.canvas,
		"--snow-shot-primary": primaryColor,
		"--snow-shot-primary-soft": colorWithAlpha(primaryColor, 0.13),
		"--snow-shot-primary-strong": colorWithAlpha(primaryColor, 0.38),
		"--snow-shot-atmosphere": visuals.atmosphere,
		"--snow-shot-pattern": visuals.pattern,
		"--snow-shot-pattern-size": visuals.patternSize,
		"--snow-shot-shadow": visuals.shadow,
		"--snow-shot-card-shadow": visuals.cardShadow,
		"--snow-shot-glow": visuals.glow,
		"--snow-shot-backdrop-filter": visuals.backdropFilter,
		"--snow-shot-logo-bg": visuals.logoBackground,
		"--snow-shot-keycap-bg": visuals.keycapBackground,
		"--snow-shot-command-group-bg": visuals.commandGroupBackground,
		"--snow-shot-accent-alt-one": visuals.accentAltOne,
		"--snow-shot-accent-alt-two": visuals.accentAltTwo,
		"--snow-shot-accent-alt-three": visuals.accentAltThree,
		"--snow-shot-radius": `${borderRadius}px`,
		"--snow-shot-radius-sm": `${Math.max(2, borderRadius - 2)}px`,
		"--snow-shot-radius-lg": `${Math.min(20, borderRadius + 4)}px`,
	};
};
