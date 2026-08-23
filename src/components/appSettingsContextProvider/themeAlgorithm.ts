import { theme } from "antd";
import type { MappingAlgorithm } from "antd/es/theme/interface";
import Color from "color";
import { colorWithAlpha } from "@/constants/themePresets";

export const preserveReadableThemeColors: MappingAlgorithm = (
	token,
	mapToken,
) => {
	const current = mapToken ?? theme.defaultAlgorithm(token);
	const stateTarget = Color(current.colorBgLayout).isDark()
		? Color("#FFFFFF")
		: Color("#000000");
	const createStateColor = (value: string, weight: number) => {
		try {
			const source = Color(value);
			if (source.hex() === stateTarget.hex()) {
				return source.mix(Color(current.colorBgLayout), weight / 2).hex();
			}
			return source.mix(stateTarget, weight).hex();
		} catch {
			return value;
		}
	};
	const primaryHover = createStateColor(token.colorPrimary, 0.18);
	const primaryActive = createStateColor(token.colorPrimary, 0.32);
	const infoHover = createStateColor(token.colorInfo, 0.18);
	const infoActive = createStateColor(token.colorInfo, 0.32);
	const successHover = createStateColor(token.colorSuccess, 0.18);
	const successActive = createStateColor(token.colorSuccess, 0.32);
	const warningHover = createStateColor(token.colorWarning, 0.18);
	const warningActive = createStateColor(token.colorWarning, 0.32);
	const errorHover = createStateColor(token.colorError, 0.18);
	const errorActive = createStateColor(token.colorError, 0.32);
	return {
		...current,
		colorPrimary: token.colorPrimary,
		colorPrimaryHover: primaryHover,
		colorPrimaryActive: primaryActive,
		colorPrimaryBg: colorWithAlpha(token.colorPrimary, 0.12),
		colorPrimaryBgHover: colorWithAlpha(token.colorPrimary, 0.2),
		colorPrimaryBorder: colorWithAlpha(token.colorPrimary, 0.42),
		colorPrimaryBorderHover: colorWithAlpha(token.colorPrimary, 0.58),
		colorPrimaryText: token.colorPrimary,
		colorPrimaryTextHover: primaryHover,
		colorPrimaryTextActive: primaryActive,
		colorLink: token.colorPrimary,
		colorLinkHover: primaryHover,
		colorLinkActive: primaryActive,
		colorInfo: token.colorInfo,
		colorInfoHover: infoHover,
		colorInfoActive: infoActive,
		colorInfoText: token.colorInfo,
		colorInfoTextHover: infoHover,
		colorInfoTextActive: infoActive,
		colorSuccess: token.colorSuccess,
		colorSuccessHover: successHover,
		colorSuccessActive: successActive,
		colorSuccessText: token.colorSuccess,
		colorSuccessTextHover: successHover,
		colorSuccessTextActive: successActive,
		colorWarning: token.colorWarning,
		colorWarningHover: warningHover,
		colorWarningActive: warningActive,
		colorWarningText: token.colorWarning,
		colorWarningTextHover: warningHover,
		colorWarningTextActive: warningActive,
		colorError: token.colorError,
		colorErrorHover: errorHover,
		colorErrorActive: errorActive,
		colorErrorText: token.colorError,
		colorErrorTextHover: errorHover,
		colorErrorTextActive: errorActive,
	};
};
