import { Button, Typography } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormattedMessage } from "react-intl";
import {
	checkAccessibilityPermission,
	checkMicrophonePermission,
	checkScreenRecordingPermission,
	requestAccessibilityPermission,
	requestMicrophonePermission,
	requestScreenRecordingPermission,
} from "tauri-plugin-macos-permissions-api";
import useInterval from "use-interval";
import { ResetIcon } from "@/components/icons";
import { SettingsGroup } from "@/components/settingsGroup";
import { useStateRef } from "@/hooks/useStateRef";
import { SettingsLine } from "../shared/settingsLine";

type PermissionsState = {
	enableRecordScreen: boolean;
	enableAccessibility: boolean;
	enableMicrophone: boolean;
};

const PERMISSIONS = [
	{
		key: "enableRecordScreen",
		messageId: "recordScreen",
		request: requestScreenRecordingPermission,
	},
	{
		key: "enableAccessibility",
		messageId: "accessibility",
		request: requestAccessibilityPermission,
	},
	{
		key: "enableMicrophone",
		messageId: "microphone",
		request: requestMicrophonePermission,
	},
] as const;

/** macOS privacy permissions required for capture, input and audio. */
export const PermissionsSection: React.FC = () => {
	const [permissionsState, setPermissionsState, permissionsStateRef] =
		useStateRef<PermissionsState>({
			enableRecordScreen: false,
			enableAccessibility: false,
			enableMicrophone: false,
		});

	const reloadingRef = useRef(false);
	const reloadPermissionsState = useCallback(async () => {
		if (reloadingRef.current) {
			return;
		}

		reloadingRef.current = true;
		try {
			const [enableRecordScreen, enableAccessibility, enableMicrophone] =
				await Promise.all([
					checkScreenRecordingPermission(),
					checkAccessibilityPermission(),
					checkMicrophonePermission(),
				]);
			setPermissionsState({
				enableRecordScreen,
				enableAccessibility,
				enableMicrophone,
			});
		} finally {
			reloadingRef.current = false;
		}
	}, [setPermissionsState]);

	useEffect(() => {
		reloadPermissionsState();
	}, [reloadPermissionsState]);

	// Permissions granted in System Settings take effect without a callback.
	useInterval(
		useCallback(() => {
			const state = permissionsStateRef.current;
			if (
				state.enableRecordScreen &&
				state.enableAccessibility &&
				state.enableMicrophone
			) {
				return;
			}

			reloadPermissionsState();
		}, [reloadPermissionsState, permissionsStateRef]),
		1000 * 10,
	);

	const [reloadButtonLoading, setReloadButtonLoading] = useState(false);
	const prefix = "settings.systemSettings.macosPermissionsSettings";

	return (
		<SettingsGroup
			title={<FormattedMessage id={prefix} />}
			description={
				<FormattedMessage
					id={`${prefix}.request.tip`}
					values={{
						link: (
							<FormattedMessage key="link" id={`${prefix}.request.tip.link`} />
						),
					}}
				/>
			}
			extra={
				<Button
					type="text"
					size="small"
					icon={<ResetIcon />}
					loading={reloadButtonLoading}
					onClick={async () => {
						setReloadButtonLoading(true);
						await reloadPermissionsState();
						setReloadButtonLoading(false);
					}}
				/>
			}
			rows={false}
		>
			{PERMISSIONS.map(({ key, messageId, request }) => (
				<SettingsLine
					key={key}
					label={<FormattedMessage id={`${prefix}.${messageId}`} />}
					description={<FormattedMessage id={`${prefix}.${messageId}.tip`} />}
					control={
						permissionsState[key] ? (
							<Typography.Text type="success">
								<FormattedMessage id={`${prefix}.authorized`} />
							</Typography.Text>
						) : (
							<Button
								onClick={() => {
									request().then(() => reloadPermissionsState());
								}}
							>
								<FormattedMessage id={`${prefix}.request`} />
							</Button>
						)
					}
				/>
			))}
		</SettingsGroup>
	);
};
