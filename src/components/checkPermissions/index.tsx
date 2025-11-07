import { useRouter } from "@tanstack/react-router";
import { Alert, Button, theme } from "antd";
import { useCallback, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import {
	checkAccessibilityPermission,
	checkScreenRecordingPermission,
} from "tauri-plugin-macos-permissions-api";
import { usePlatform } from "@/hooks/usePlatform";

export const CheckPermissions = () => {
	const { token } = theme.useToken();
	const [currentPlatform] = usePlatform();
	const router = useRouter();

	const [showPermissionTip, setShowPermissionTip] = useState(false);
	const reloadPermissionsState = useCallback(async () => {
		if (currentPlatform !== "macos") {
			return;
		}

		const [enableRecordScreen, enableAccessibility] = await Promise.all([
			checkScreenRecordingPermission(),
			checkAccessibilityPermission(),
		]);

		setShowPermissionTip(!(enableRecordScreen && enableAccessibility));
	}, [currentPlatform]);

	useEffect(() => {
		reloadPermissionsState();
	}, [reloadPermissionsState]);

	if (currentPlatform !== "macos") {
		return null;
	}

	if (!showPermissionTip) {
		return null;
	}

	return (
		<Alert
			message={<FormattedMessage id="common.permission.error.title" />}
			description={
				<FormattedMessage id="common.permission.error.description" />
			}
			type="error"
			showIcon
			action={
				<Button
					type="primary"
					onClick={() => {
						router.navigate({
							to: "/settings/systemSettings",
							hash: "macosPermissionsSettings",
						});
					}}
				>
					<FormattedMessage id="common.permission.error.goToSettings" />
				</Button>
			}
			style={{
				marginBottom: token.margin,
			}}
		/>
	);
};
