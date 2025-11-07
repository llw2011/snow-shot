import type { ButtonProps } from "antd";
import { FormattedMessage } from "react-intl";
import { ShortcutKeyStatus } from "@/types/appSettings";

export const convertShortcutKeyStatusToButtonColor = (
	status: ShortcutKeyStatus | undefined,
): ButtonProps["color"] => {
	if (status === undefined) {
		return "danger";
	}

	switch (status) {
		case ShortcutKeyStatus.PrintScreen:
		case ShortcutKeyStatus.Registered:
			return "green";
		case ShortcutKeyStatus.Unregistered:
			return "orange";
		case ShortcutKeyStatus.Error:
			return "danger";
		default:
			return "default";
	}
};

export const convertShortcutKeyStatusToTip = (
	status: ShortcutKeyStatus | undefined,
): React.ReactNode | undefined => {
	if (status === undefined || status === ShortcutKeyStatus.Registered) {
		return undefined;
	}

	switch (status) {
		case ShortcutKeyStatus.Unregistered:
			return <FormattedMessage id="home.shortcut.unregistered" />;
		case ShortcutKeyStatus.Error:
			return <FormattedMessage id="home.shortcut.error" />;
		case ShortcutKeyStatus.None:
			return <FormattedMessage id="home.shortcut.none" />;
		case ShortcutKeyStatus.PrintScreen:
			return <FormattedMessage id="settings.printScreen.tip" />;
		default:
			return undefined;
	}
};
