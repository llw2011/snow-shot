import { Tooltip } from "antd";
import type React from "react";
import { useContext } from "react";
import { FormattedMessage } from "react-intl";
import { GlobalShortcutContext } from "@/components/globalShortcut";
import { KeyButton } from "@/components/keyButton";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { AppSettingsGroup, ShortcutKeyStatus } from "@/types/appSettings";
import {
	type AppFunction,
	AppFunctionGroup,
} from "@/types/components/appFunction";
import { formatKey } from "@/utils/format";

export type ShortcutState = "ok" | "empty" | "warning" | "error";

export const getShortcutState = (
	status: ShortcutKeyStatus | undefined,
	hasKey: boolean,
): ShortcutState => {
	if (!hasKey || status === ShortcutKeyStatus.None) {
		return "empty";
	}

	switch (status) {
		case ShortcutKeyStatus.Unregistered:
			return "warning";
		case ShortcutKeyStatus.Error:
			return "error";
		default:
			return "ok";
	}
};

const STATUS_MESSAGE: Partial<Record<ShortcutKeyStatus, string>> = {
	[ShortcutKeyStatus.Unregistered]: "home.shortcut.unregistered",
	[ShortcutKeyStatus.Error]: "home.shortcut.error",
	[ShortcutKeyStatus.PrintScreen]: "settings.printScreen.tip",
};

/** Reads the configured shortcut and its registration status. */
export const useShortcutInfo = (appFunction: AppFunction) => {
	const { appFunctionSettings, shortcutKeyStatus, appSettingsLoading } =
		useContext(GlobalShortcutContext);
	const shortcutKey = appFunctionSettings?.[appFunction]?.shortcutKey ?? "";
	const status = appSettingsLoading
		? undefined
		: shortcutKeyStatus?.[appFunction];

	return {
		shortcutKey,
		status,
		state: getShortcutState(status, !!shortcutKey),
		statusMessageId: status === undefined ? undefined : STATUS_MESSAGE[status],
	};
};

/** Read-only keycap, used in lists. */
export const ShortcutKeycap: React.FC<{ appFunction: AppFunction }> = ({
	appFunction,
}) => {
	const { shortcutKey, state, statusMessageId } = useShortcutInfo(appFunction);
	const keycap = (
		<span className="snow-kbd" data-state={state === "ok" ? undefined : state}>
			{state === "empty" ? (
				<FormattedMessage id="home.shortcut.none" />
			) : (
				formatKey(shortcutKey)
			)}
		</span>
	);

	if (!statusMessageId || state === "ok") {
		return keycap;
	}

	return (
		<Tooltip title={<FormattedMessage id={statusMessageId} />}>
			{keycap}
		</Tooltip>
	);
};

const SPECIAL_KEY_GROUPS = new Set<AppFunctionGroup>([
	AppFunctionGroup.Screenshot,
	AppFunctionGroup.Translation,
	AppFunctionGroup.Chat,
	AppFunctionGroup.Other,
]);

/** Editable keycap: opens the recorder dialog and persists the result. */
export const ShortcutEditor: React.FC<{
	appFunction: AppFunction;
	title: React.ReactNode;
	group: AppFunctionGroup;
}> = ({ appFunction, title, group }) => {
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const { appFunctionSettings, setShortcutInputActive } = useContext(
		GlobalShortcutContext,
	);
	const { shortcutKey, state } = useShortcutInfo(appFunction);

	return (
		<KeyButton
			title={title}
			keyValue={shortcutKey}
			maxWidth={160}
			maxLength={1}
			speicalKeys={SPECIAL_KEY_GROUPS.has(group) ? ["PrintScreen"] : undefined}
			buttonProps={{
				className: `snow-shortcut-editor is-${state}`,
				onClick: () => setShortcutInputActive(true),
				children:
					state === "empty" ? (
						<span className="snow-shortcut-editor-empty">
							<FormattedMessage id="workbench.shortcut.set" />
						</span>
					) : undefined,
			}}
			onCancel={() => setShortcutInputActive(false)}
			onKeyChange={async (value) => {
				setShortcutInputActive(false);
				updateAppSettings(
					AppSettingsGroup.AppFunction,
					{
						[appFunction]: {
							...(appFunctionSettings?.[appFunction] ?? {}),
							shortcutKey: value,
						},
					},
					false,
					true,
					false,
					false,
				);
			}}
		/>
	);
};
