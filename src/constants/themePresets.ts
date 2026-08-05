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
		panelBackground?: string;
		siderBackground?: string;
		headerBackground?: string;
		atmosphere?: string;
		pattern?: string;
		patternSize?: string;
		shadow?: string;
		cardShadow?: string;
		glow?: string;
		backdropFilter?: string;
		logoBackground?: string;
		keycapBackground?: string;
		commandGroupBackground?: string;
		accentAltOne?: string;
		accentAltTwo?: string;
		accentAltThree?: string;
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

	const visuals: AppThemeVisuals = {
		panelBackground: input.panelBackground ?? palette.surface,
		siderBackground: input.siderBackground ?? palette.canvas,
		headerBackground: input.headerBackground ?? palette.canvas,
		atmosphere:
			input.atmosphere ??
			"linear-gradient(135deg, rgba(255, 255, 255, 0.04), transparent 34%)",
		pattern: input.pattern ?? "none",
		patternSize: input.patternSize ?? "auto",
		shadow: input.shadow ?? "none",
		cardShadow: input.cardShadow ?? input.shadow ?? "none",
		glow: input.glow ?? "none",
		backdropFilter: input.backdropFilter ?? "none",
		logoBackground:
			input.logoBackground ??
			`linear-gradient(135deg, ${colorWithAlpha(palette.ink, 0.16)}, transparent 44%), ${palette.surfaceCard}`,
		keycapBackground:
			input.keycapBackground ??
			`linear-gradient(180deg, ${palette.surfaceCard}, ${palette.surface})`,
		commandGroupBackground:
			input.commandGroupBackground ??
			`linear-gradient(180deg, ${colorWithAlpha(palette.ink, 0.035)}, transparent), ${palette.surface}`,
		accentAltOne: input.accentAltOne ?? palette.blue,
		accentAltTwo: input.accentAltTwo ?? palette.red,
		accentAltThree: input.accentAltThree ?? palette.green,
	};

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

export const APP_THEME_PRESETS: Record<
	AppThemePreset,
	AppThemePresetDefinition
> = {
	[AppThemePreset.Obsidian]: {
		id: AppThemePreset.Obsidian,
		recommendedRadius: 8,
		modes: {
			[AppSettingsTheme.Dark]: createThemeMode({
				canvas: "#07080A",
				surface: "#0D0D0D",
				surfaceElevated: "#101111",
				surfaceCard: "#151617",
				hairline: "#242728",
				hairlineSoft: "rgba(255, 255, 255, 0.08)",
				hairlineStrong: "rgba(255, 255, 255, 0.16)",
				ink: "#F4F4F6",
				body: "#CDCDCD",
				muted: "#9C9C9D",
				ash: "#6A6B6C",
				recommendedAccent: "#FFFFFF",
				atmosphere:
					"linear-gradient(135deg, rgba(255, 255, 255, 0.045), transparent 34%)",
				commandGroupBackground:
					"linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent), #0D0D0D",
			}),
			[AppSettingsTheme.Light]: createThemeMode({
				canvas: "#F4F6FA",
				surface: "#FFFFFF",
				surfaceElevated: "#F8FAFC",
				surfaceCard: "#FFFFFF",
				hairline: "#DDE2EA",
				hairlineSoft: "rgba(15, 23, 42, 0.08)",
				hairlineStrong: "rgba(15, 23, 42, 0.16)",
				ink: "#15171A",
				body: "#4C5563",
				muted: "#666E7B",
				ash: "#818995",
				recommendedAccent: "#2563EB",
				atmosphere:
					"linear-gradient(135deg, rgba(37, 99, 235, 0.055), transparent 36%)",
				shadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
				cardShadow: "0 6px 18px rgba(15, 23, 42, 0.07)",
			}),
		},
	},
	[AppThemePreset.Aurora]: {
		id: AppThemePreset.Aurora,
		recommendedRadius: 12,
		modes: {
			[AppSettingsTheme.Dark]: createThemeMode({
				canvas: "#090817",
				surface: "#121126",
				surfaceElevated: "#191735",
				surfaceCard: "#211D42",
				hairline: "rgba(196, 174, 255, 0.22)",
				hairlineSoft: "rgba(208, 194, 255, 0.12)",
				hairlineStrong: "rgba(118, 229, 255, 0.34)",
				ink: "#FBF8FF",
				body: "#D8D1F0",
				muted: "#9D96B8",
				ash: "#736D8C",
				blue: "#6EE7FF",
				red: "#FF6FAE",
				green: "#66F4C3",
				yellow: "#FFD166",
				recommendedAccent: "#B86BFF",
				panelBackground: "rgba(18, 17, 38, 0.90)",
				siderBackground: "rgba(9, 8, 23, 0.88)",
				headerBackground: "rgba(9, 8, 23, 0.86)",
				atmosphere:
					"radial-gradient(circle at 10% 12%, rgba(255, 74, 180, 0.30), transparent 32%), radial-gradient(circle at 88% 6%, rgba(76, 214, 255, 0.27), transparent 34%), radial-gradient(circle at 70% 88%, rgba(132, 77, 255, 0.22), transparent 38%)",
				shadow: "0 24px 64px rgba(3, 2, 18, 0.42)",
				cardShadow:
					"0 18px 46px rgba(5, 3, 24, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
				glow: "0 0 30px rgba(184, 107, 255, 0.18)",
				backdropFilter: "blur(18px) saturate(125%)",
				logoBackground:
					"linear-gradient(145deg, rgba(255, 111, 174, 0.94), rgba(131, 88, 255, 0.88) 52%, rgba(80, 221, 255, 0.92))",
				keycapBackground:
					"linear-gradient(180deg, rgba(62, 50, 104, 0.92), rgba(20, 17, 48, 0.96))",
				commandGroupBackground:
					"linear-gradient(145deg, rgba(37, 29, 74, 0.88), rgba(16, 15, 39, 0.88))",
				accentAltOne: "#FF6FAE",
				accentAltTwo: "#6EE7FF",
				accentAltThree: "#A78BFA",
			}),
			[AppSettingsTheme.Light]: createThemeMode({
				canvas: "#F7F3FF",
				surface: "#FFFCFF",
				surfaceElevated: "#F1EAFF",
				surfaceCard: "#FBF6FF",
				hairline: "rgba(94, 70, 145, 0.18)",
				hairlineSoft: "rgba(72, 51, 121, 0.10)",
				hairlineStrong: "rgba(87, 74, 208, 0.28)",
				ink: "#241C38",
				body: "#5D5275",
				muted: "#6E6386",
				ash: "#877F98",
				blue: "#057AA3",
				red: "#C83370",
				green: "#087B5E",
				yellow: "#9A6500",
				recommendedAccent: "#7138C7",
				panelBackground: "rgba(255, 252, 255, 0.90)",
				siderBackground: "rgba(249, 244, 255, 0.88)",
				headerBackground: "rgba(255, 252, 255, 0.86)",
				atmosphere:
					"radial-gradient(circle at 8% 8%, rgba(255, 107, 180, 0.28), transparent 32%), radial-gradient(circle at 90% 4%, rgba(76, 208, 255, 0.28), transparent 34%), radial-gradient(circle at 74% 92%, rgba(145, 96, 255, 0.22), transparent 38%)",
				shadow: "0 24px 64px rgba(77, 44, 120, 0.15)",
				cardShadow:
					"0 16px 40px rgba(96, 57, 139, 0.13), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
				glow: "0 0 28px rgba(113, 56, 199, 0.14)",
				backdropFilter: "blur(18px) saturate(120%)",
				logoBackground:
					"linear-gradient(145deg, #FF78B7, #9B76FF 54%, #56D9F8)",
				commandGroupBackground:
					"linear-gradient(145deg, rgba(255, 255, 255, 0.82), rgba(240, 231, 255, 0.78))",
				accentAltOne: "#D73D82",
				accentAltTwo: "#078DB5",
				accentAltThree: "#7651D5",
			}),
		},
	},
	[AppThemePreset.Prism]: {
		id: AppThemePreset.Prism,
		recommendedRadius: 14,
		modes: {
			[AppSettingsTheme.Dark]: createThemeMode({
				canvas: "#171223",
				surface: "#221A33",
				surfaceElevated: "#2C2242",
				surfaceCard: "#372A50",
				hairline: "rgba(227, 211, 255, 0.20)",
				hairlineSoft: "rgba(255, 240, 236, 0.11)",
				hairlineStrong: "rgba(255, 180, 169, 0.30)",
				ink: "#FFF9F5",
				body: "#E0D3E4",
				muted: "#A697AE",
				ash: "#867B8E",
				blue: "#8AB7FF",
				red: "#FF8C92",
				green: "#77E1B5",
				yellow: "#FFD078",
				recommendedAccent: "#B9A7FF",
				panelBackground: "rgba(34, 26, 51, 0.92)",
				atmosphere:
					"radial-gradient(ellipse at 8% 18%, rgba(255, 133, 126, 0.22), transparent 38%), radial-gradient(ellipse at 88% 12%, rgba(137, 163, 255, 0.25), transparent 35%), radial-gradient(ellipse at 56% 100%, rgba(211, 151, 255, 0.22), transparent 42%)",
				shadow: "0 24px 60px rgba(16, 9, 29, 0.38)",
				cardShadow: "0 16px 36px rgba(14, 8, 25, 0.28)",
				glow: "0 0 34px rgba(185, 167, 255, 0.16)",
				backdropFilter: "blur(14px) saturate(115%)",
				logoBackground:
					"linear-gradient(145deg, #FF8F83, #C6A9FF 48%, #83B7FF)",
				commandGroupBackground:
					"linear-gradient(150deg, rgba(65, 45, 79, 0.92), rgba(31, 24, 49, 0.94))",
				accentAltOne: "#FF9288",
				accentAltTwo: "#8AB7FF",
				accentAltThree: "#D59BFF",
			}),
			[AppSettingsTheme.Light]: createThemeMode({
				canvas: "#FFF7F2",
				surface: "#FFFCFA",
				surfaceElevated: "#F5F0FF",
				surfaceCard: "#FFF5FA",
				hairline: "rgba(86, 62, 110, 0.16)",
				hairlineSoft: "rgba(90, 60, 113, 0.09)",
				hairlineStrong: "rgba(91, 92, 235, 0.26)",
				ink: "#2A2140",
				body: "#625773",
				muted: "#72677F",
				ash: "#8C8396",
				blue: "#2563A8",
				red: "#B93643",
				green: "#147455",
				yellow: "#916000",
				recommendedAccent: "#5152D7",
				panelBackground: "rgba(255, 252, 250, 0.90)",
				siderBackground: "rgba(255, 247, 242, 0.86)",
				headerBackground: "rgba(255, 252, 250, 0.84)",
				atmosphere:
					"radial-gradient(ellipse at 5% 15%, rgba(255, 139, 121, 0.34), transparent 38%), radial-gradient(ellipse at 92% 8%, rgba(122, 166, 255, 0.32), transparent 36%), radial-gradient(ellipse at 58% 96%, rgba(194, 145, 255, 0.30), transparent 42%)",
				shadow: "0 24px 58px rgba(83, 57, 112, 0.15)",
				cardShadow: "0 14px 34px rgba(92, 61, 111, 0.12)",
				glow: "0 0 30px rgba(81, 82, 215, 0.13)",
				backdropFilter: "blur(14px) saturate(115%)",
				logoBackground:
					"linear-gradient(145deg, #FF8F79, #C3A7FF 50%, #79AAFF)",
				commandGroupBackground:
					"linear-gradient(150deg, rgba(255, 255, 255, 0.86), rgba(249, 238, 255, 0.82))",
				accentAltOne: "#DB5D51",
				accentAltTwo: "#3B6FC5",
				accentAltThree: "#8251C7",
			}),
		},
	},
	[AppThemePreset.Matrix]: {
		id: AppThemePreset.Matrix,
		recommendedRadius: 7,
		modes: {
			[AppSettingsTheme.Dark]: createThemeMode({
				canvas: "#06100C",
				surface: "#0A1711",
				surfaceElevated: "#0D2117",
				surfaceCard: "#112A1D",
				hairline: "rgba(80, 230, 157, 0.20)",
				hairlineSoft: "rgba(116, 255, 188, 0.09)",
				hairlineStrong: "rgba(72, 240, 166, 0.34)",
				ink: "#E9FFF4",
				body: "#B8D8C7",
				muted: "#7FA58F",
				ash: "#5C7A69",
				blue: "#67C7FF",
				red: "#FF6F7D",
				green: "#48F0A6",
				yellow: "#F4D35E",
				recommendedAccent: "#48F0A6",
				panelBackground: "rgba(8, 24, 16, 0.91)",
				siderBackground: "rgba(4, 14, 10, 0.96)",
				headerBackground: "rgba(4, 14, 10, 0.92)",
				atmosphere:
					"radial-gradient(circle at 82% 12%, rgba(42, 232, 145, 0.14), transparent 34%), radial-gradient(circle at 12% 88%, rgba(33, 154, 104, 0.12), transparent 38%)",
				pattern:
					"linear-gradient(rgba(83, 240, 165, 0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(83, 240, 165, 0.055) 1px, transparent 1px)",
				patternSize: "24px 24px, 24px 24px",
				shadow: "0 20px 46px rgba(0, 8, 4, 0.42)",
				cardShadow: "inset 0 1px 0 rgba(126, 255, 192, 0.04)",
				glow: "0 0 24px rgba(72, 240, 166, 0.13)",
				logoBackground:
					"linear-gradient(145deg, rgba(72, 240, 166, 0.95), rgba(18, 105, 68, 0.94))",
				keycapBackground:
					"linear-gradient(180deg, rgba(18, 53, 35, 0.96), rgba(5, 20, 12, 0.98))",
				commandGroupBackground:
					"linear-gradient(150deg, rgba(13, 38, 25, 0.94), rgba(7, 23, 15, 0.96))",
				accentAltOne: "#48F0A6",
				accentAltTwo: "#67C7FF",
				accentAltThree: "#F4D35E",
			}),
			[AppSettingsTheme.Light]: createThemeMode({
				canvas: "#EFF8F2",
				surface: "#F9FFFB",
				surfaceElevated: "#E4F3E9",
				surfaceCard: "#F1FBF5",
				hairline: "rgba(16, 92, 57, 0.18)",
				hairlineSoft: "rgba(13, 76, 45, 0.09)",
				hairlineStrong: "rgba(8, 126, 85, 0.28)",
				ink: "#10271D",
				body: "#3F6451",
				muted: "#537060",
				ash: "#73897C",
				blue: "#156C9A",
				red: "#B23A48",
				green: "#087E55",
				yellow: "#856100",
				recommendedAccent: "#087C54",
				panelBackground: "rgba(249, 255, 251, 0.91)",
				siderBackground: "rgba(239, 248, 242, 0.94)",
				headerBackground: "rgba(249, 255, 251, 0.90)",
				atmosphere:
					"radial-gradient(circle at 86% 10%, rgba(31, 170, 108, 0.14), transparent 34%), radial-gradient(circle at 12% 90%, rgba(54, 138, 98, 0.10), transparent 38%)",
				pattern:
					"linear-gradient(rgba(8, 126, 85, 0.065) 1px, transparent 1px), linear-gradient(90deg, rgba(8, 126, 85, 0.065) 1px, transparent 1px)",
				patternSize: "24px 24px, 24px 24px",
				shadow: "0 18px 42px rgba(25, 76, 50, 0.12)",
				cardShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8)",
				glow: "0 0 22px rgba(8, 126, 85, 0.11)",
				logoBackground: "linear-gradient(145deg, #42D994, #087E55)",
				commandGroupBackground:
					"linear-gradient(150deg, rgba(249, 255, 251, 0.96), rgba(226, 244, 233, 0.92))",
				accentAltOne: "#087E55",
				accentAltTwo: "#156C9A",
				accentAltThree: "#856100",
			}),
		},
	},
	[AppThemePreset.Chromatic]: {
		id: AppThemePreset.Chromatic,
		recommendedRadius: 12,
		modes: {
			[AppSettingsTheme.Dark]: createThemeMode({
				canvas: "#100F16",
				surface: "#191820",
				surfaceElevated: "#23202C",
				surfaceCard: "#2D2737",
				hairline: "rgba(255, 220, 235, 0.18)",
				hairlineSoft: "rgba(255, 255, 255, 0.09)",
				hairlineStrong: "rgba(255, 122, 162, 0.32)",
				ink: "#FFF9FC",
				body: "#E1D4DD",
				muted: "#A99BA6",
				ash: "#7F757D",
				blue: "#79C8FF",
				red: "#FF7A8E",
				green: "#72E6BA",
				yellow: "#D9F36D",
				recommendedAccent: "#FF7AA2",
				panelBackground: "rgba(25, 24, 32, 0.91)",
				atmosphere:
					"radial-gradient(ellipse at 5% 10%, rgba(255, 109, 148, 0.24), transparent 32%), radial-gradient(ellipse at 95% 12%, rgba(157, 126, 255, 0.22), transparent 34%), radial-gradient(ellipse at 88% 92%, rgba(92, 230, 190, 0.18), transparent 36%)",
				shadow: "0 22px 54px rgba(7, 5, 12, 0.38)",
				cardShadow: "0 13px 30px rgba(7, 5, 12, 0.26)",
				glow: "0 0 28px rgba(255, 122, 162, 0.14)",
				logoBackground:
					"linear-gradient(135deg, #FF7A99 0 32%, #B296FF 32% 65%, #74E7BE 65%)",
				keycapBackground:
					"linear-gradient(180deg, rgba(57, 47, 68, 0.98), rgba(25, 22, 31, 0.98))",
				commandGroupBackground:
					"linear-gradient(150deg, rgba(45, 38, 54, 0.94), rgba(24, 22, 30, 0.96))",
				accentAltOne: "#FF7AA2",
				accentAltTwo: "#B296FF",
				accentAltThree: "#74E7BE",
			}),
			[AppSettingsTheme.Light]: createThemeMode({
				canvas: "#FFFDF8",
				surface: "#FFFFFF",
				surfaceElevated: "#FFF3E8",
				surfaceCard: "#FFF8F2",
				hairline: "rgba(71, 53, 69, 0.16)",
				hairlineSoft: "rgba(68, 50, 64, 0.08)",
				hairlineStrong: "rgba(201, 54, 99, 0.28)",
				ink: "#211D28",
				body: "#5A505F",
				muted: "#746A76",
				ash: "#8D8590",
				blue: "#236C99",
				red: "#B8364F",
				green: "#14765C",
				yellow: "#697A00",
				recommendedAccent: "#C93663",
				panelBackground: "rgba(255, 255, 255, 0.88)",
				siderBackground: "rgba(255, 253, 248, 0.88)",
				headerBackground: "rgba(255, 255, 255, 0.82)",
				atmosphere:
					"radial-gradient(ellipse at 4% 8%, rgba(255, 122, 153, 0.30), transparent 33%), radial-gradient(ellipse at 94% 10%, rgba(178, 150, 255, 0.30), transparent 35%), radial-gradient(ellipse at 92% 94%, rgba(116, 231, 190, 0.26), transparent 38%), radial-gradient(ellipse at 18% 92%, rgba(217, 243, 109, 0.20), transparent 34%)",
				shadow: "0 20px 50px rgba(91, 58, 79, 0.13)",
				cardShadow: "0 12px 28px rgba(93, 60, 82, 0.10)",
				glow: "0 0 26px rgba(201, 54, 99, 0.11)",
				logoBackground:
					"linear-gradient(135deg, #FF7A99 0 32%, #B296FF 32% 65%, #74E7BE 65%)",
				commandGroupBackground:
					"linear-gradient(150deg, rgba(255, 255, 255, 0.94), rgba(255, 245, 238, 0.92))",
				accentAltOne: "#C93663",
				accentAltTwo: "#7458C7",
				accentAltThree: "#14765C",
			}),
		},
	},
	[AppThemePreset.Glacier]: {
		id: AppThemePreset.Glacier,
		recommendedRadius: 16,
		modes: {
			[AppSettingsTheme.Dark]: createThemeMode({
				canvas: "#06131E",
				surface: "#0B1D2A",
				surfaceElevated: "#102839",
				surfaceCard: "#163448",
				hairline: "rgba(157, 220, 247, 0.22)",
				hairlineSoft: "rgba(199, 235, 250, 0.10)",
				hairlineStrong: "rgba(100, 215, 255, 0.34)",
				ink: "#F0FAFF",
				body: "#C4E2EF",
				muted: "#89ADBD",
				ash: "#678492",
				blue: "#64D7FF",
				red: "#FF7585",
				green: "#65E1C0",
				yellow: "#FFD477",
				recommendedAccent: "#64D7FF",
				panelBackground: "rgba(11, 29, 42, 0.88)",
				siderBackground: "rgba(6, 19, 30, 0.88)",
				headerBackground: "rgba(6, 19, 30, 0.86)",
				atmosphere:
					"radial-gradient(circle at 14% 10%, rgba(91, 211, 255, 0.24), transparent 35%), radial-gradient(circle at 90% 16%, rgba(130, 169, 255, 0.18), transparent 34%), linear-gradient(145deg, rgba(205, 242, 255, 0.05), transparent 45%)",
				shadow: "0 26px 68px rgba(0, 10, 18, 0.42)",
				cardShadow:
					"0 18px 42px rgba(0, 12, 22, 0.30), inset 0 1px 0 rgba(231, 249, 255, 0.08)",
				glow: "0 0 34px rgba(100, 215, 255, 0.17)",
				backdropFilter: "blur(20px) saturate(120%)",
				logoBackground:
					"linear-gradient(145deg, rgba(222, 249, 255, 0.96), rgba(92, 212, 255, 0.88) 48%, rgba(83, 132, 214, 0.90))",
				keycapBackground:
					"linear-gradient(180deg, rgba(29, 70, 91, 0.95), rgba(8, 28, 41, 0.98))",
				commandGroupBackground:
					"linear-gradient(145deg, rgba(26, 61, 79, 0.76), rgba(8, 29, 43, 0.84))",
				accentAltOne: "#64D7FF",
				accentAltTwo: "#8DA8FF",
				accentAltThree: "#65E1C0",
			}),
			[AppSettingsTheme.Light]: createThemeMode({
				canvas: "#EAF6FC",
				surface: "#F8FDFF",
				surfaceElevated: "#E2F2FA",
				surfaceCard: "#F2FAFE",
				hairline: "rgba(36, 112, 148, 0.18)",
				hairlineSoft: "rgba(32, 101, 134, 0.09)",
				hairlineStrong: "rgba(0, 117, 173, 0.28)",
				ink: "#102B3A",
				body: "#426879",
				muted: "#4E6E7D",
				ash: "#6F8894",
				blue: "#0075AD",
				red: "#B63849",
				green: "#08785F",
				yellow: "#8A6200",
				recommendedAccent: "#0073AB",
				panelBackground: "rgba(248, 253, 255, 0.90)",
				siderBackground: "rgba(234, 246, 252, 0.88)",
				headerBackground: "rgba(248, 253, 255, 0.86)",
				atmosphere:
					"radial-gradient(circle at 12% 8%, rgba(84, 202, 244, 0.28), transparent 36%), radial-gradient(circle at 92% 14%, rgba(139, 173, 255, 0.24), transparent 35%), linear-gradient(145deg, rgba(255, 255, 255, 0.82), transparent 48%)",
				shadow: "0 26px 62px rgba(42, 102, 129, 0.16)",
				cardShadow:
					"0 16px 38px rgba(45, 109, 138, 0.13), inset 0 1px 0 rgba(255, 255, 255, 0.94)",
				glow: "0 0 32px rgba(0, 117, 173, 0.12)",
				backdropFilter: "blur(20px) saturate(115%)",
				logoBackground:
					"linear-gradient(145deg, #FFFFFF, #7DD8F7 48%, #6F9CDF)",
				commandGroupBackground:
					"linear-gradient(145deg, rgba(255, 255, 255, 0.76), rgba(226, 244, 252, 0.74))",
				accentAltOne: "#0075AD",
				accentAltTwo: "#526FC1",
				accentAltThree: "#08785F",
			}),
		},
	},
};

export const isAppThemePreset = (value: unknown): value is AppThemePreset =>
	APP_THEME_PRESET_ORDER.includes(value as AppThemePreset);

export const getAppThemePreset = (preset: AppThemePreset) =>
	APP_THEME_PRESETS[preset] ?? APP_THEME_PRESETS[AppThemePreset.Obsidian];

export const getAppThemeRuntime = (
	preset: AppThemePreset,
	mode: AppSettingsTheme,
) => {
	const resolvedMode =
		mode === AppSettingsTheme.Dark
			? AppSettingsTheme.Dark
			: AppSettingsTheme.Light;
	return getAppThemePreset(preset).modes[resolvedMode];
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
