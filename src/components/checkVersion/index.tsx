import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { nativeShowMainWindow } from "@/commands/nativeAction";
import { AntdContext } from "@/contexts/antdContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import {
	checkForUpdate,
	formatUpdateProgress,
	formatUpdaterError,
	installUpdate,
	isUpdaterUnavailableError,
	runWithUpdatePromptLock,
	type UpdateInfo,
} from "@/services/updater";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";
import { appWarn } from "@/utils/log";

export { getLatestVersion } from "@/services/updater";

const UPDATE_MESSAGE_KEY = "snow-shot-update";

export const CheckVersion: React.FC = () => {
	const intl = useIntl();
	const { isConfirmingRef, message, modal } = useContext(AntdContext);
	const checkingRef = useRef(false);
	const hasCheckedVersionRef = useRef(false);
	const promptedVersionRef = useRef<string | undefined>(undefined);
	const [autoCheckVersion, setAutoCheckVersion] = useState<boolean>();

	useAppSettingsLoad(
		useCallback((appSettings: AppSettingsData) => {
			setAutoCheckVersion(
				appSettings[AppSettingsGroup.SystemCommon].autoCheckVersion,
			);
		}, []),
		true,
	);

	const installAvailableUpdate = useCallback(
		async (update: UpdateInfo) => {
			let lastProgressAt = 0;
			message.open({
				key: UPDATE_MESSAGE_KEY,
				type: "loading",
				content: intl.formatMessage({ id: "common.newVersion.downloading" }),
				duration: 0,
			});

			try {
				const installed = await installUpdate(update.version, (progress) => {
					const now = Date.now();
					if (!progress.finished && now - lastProgressAt < 120) {
						return;
					}
					lastProgressAt = now;

					const suffix = ` (${formatUpdateProgress(progress)})`;
					message.open({
						key: UPDATE_MESSAGE_KEY,
						type: "loading",
						content: `${intl.formatMessage({ id: "common.newVersion.downloading" })}${suffix}`,
						duration: 0,
					});
				});
				if (!installed) {
					message.open({
						key: UPDATE_MESSAGE_KEY,
						type: "info",
						content: intl.formatMessage({ id: "common.newVersion.latest" }),
						duration: 5,
					});
				}
			} catch (error) {
				const details = formatUpdaterError(error);
				if (isUpdaterUnavailableError(error)) {
					message.open({
						key: UPDATE_MESSAGE_KEY,
						type: "info",
						content: intl.formatMessage({
							id: "common.newVersion.unavailable",
						}),
						duration: 6,
					});
				} else {
					appWarn("[CheckVersion] update installation failed", details);
					message.open({
						key: UPDATE_MESSAGE_KEY,
						type: "error",
						content: intl.formatMessage(
							{ id: "common.newVersion.updateFailed" },
							{ error: details },
						),
						duration: 6,
					});
				}
			}
		},
		[intl, message],
	);

	const promptForUpdate = useCallback(
		async (update: UpdateInfo) => {
			if (promptedVersionRef.current === update.version) {
				return;
			}

			await runWithUpdatePromptLock(async () => {
				if (
					promptedVersionRef.current === update.version ||
					isConfirmingRef.current
				) {
					return;
				}

				try {
					await nativeShowMainWindow();
				} catch (error) {
					appWarn(
						"[CheckVersion] failed to show update prompt window",
						formatUpdaterError(error),
					);
					return;
				}
				if (isConfirmingRef.current) {
					return;
				}
				const confirmed = await modal.confirmWithStatus({
					title: intl.formatMessage(
						{ id: "common.newVersion.title" },
						{ latestVersion: update.version },
					),
					content: intl.formatMessage(
						{ id: "common.newVersion" },
						{
							latestVersion: update.version,
							currentVersion: update.currentVersion,
						},
					),
					okText: intl.formatMessage({ id: "common.newVersion.updateNow" }),
					cancelText: intl.formatMessage({
						id: "common.newVersion.updateLater",
					}),
					centered: true,
				});
				promptedVersionRef.current = update.version;

				if (confirmed) {
					await installAvailableUpdate(update);
				}
			});
		},
		[installAvailableUpdate, intl, isConfirmingRef, modal],
	);

	const checkVersion = useCallback(async () => {
		if (checkingRef.current) {
			return;
		}

		checkingRef.current = true;
		try {
			const update = await checkForUpdate();
			if (update) {
				await promptForUpdate(update);
			}
		} catch (error) {
			if (!isUpdaterUnavailableError(error)) {
				appWarn(
					"[CheckVersion] update check failed",
					formatUpdaterError(error),
				);
			}
		} finally {
			checkingRef.current = false;
		}
	}, [promptForUpdate]);

	useEffect(() => {
		if (autoCheckVersion !== true || hasCheckedVersionRef.current) {
			return;
		}

		hasCheckedVersionRef.current = true;
		void checkVersion();
	}, [autoCheckVersion, checkVersion]);

	return null;
};
