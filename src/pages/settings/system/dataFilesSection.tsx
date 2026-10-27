import { appLogDir } from "@tauri-apps/api/path";
import * as dialog from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import { Button, Typography } from "antd";
import { useContext, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { createLocalConfigDir, getAppConfigBaseDir } from "@/commands/file";
import { SettingsGroup } from "@/components/settingsGroup";
import { AntdContext } from "@/contexts/antdContext";
import { clearAllConfig } from "@/utils/appConfig";
import { clearAllAppStore } from "@/utils/appStore";
import { CaptureHistory } from "@/utils/captureHistory";
import { getConfigDirPath } from "@/utils/environment";
import { appError } from "@/utils/log";
import { SettingsLine } from "../shared/settingsLine";

const openDirectory = async (
	path: string,
	onError: (error: unknown) => void,
) => {
	try {
		await openPath(path);
	} catch (error) {
		onError(error);
	}
};

/** Where configuration, logs and data live, and the destructive reset. */
export const DataFilesSection = () => {
	const { modal, message } = useContext(AntdContext);
	const [configDirPath, setConfigDirPath] = useState("");
	const [configDirBasePath, setConfigDirBasePath] = useState("");
	const [appLogPath, setAppLogPath] = useState("");

	useEffect(() => {
		getConfigDirPath().then(setConfigDirPath);
		getAppConfigBaseDir().then(setConfigDirBasePath);
		appLogDir().then(setAppLogPath);
	}, []);

	const openFailed = () => {
		message.error(
			<FormattedMessage id="settings.systemSettings.dataFilePath.open.failed" />,
		);
	};
	const openLogFailed = () => {
		message.error(
			<FormattedMessage id="settings.systemSettings.appLogFilePath.open.failed" />,
		);
	};

	return (
		<>
			<SettingsGroup
				title={<FormattedMessage id="settings.systemSettings.dataFile" />}
				rows={false}
			>
				<SettingsLine
					label={
						<FormattedMessage id="settings.systemSettings.dataDirectory" />
					}
					description={
						<Typography.Text
							className="settings-line-path"
							copyable={{ text: configDirBasePath }}
						>
							{configDirBasePath}
						</Typography.Text>
					}
					control={
						<Button
							onClick={async () => {
								try {
									const path = await dialog.open({
										directory: true,
										defaultPath: configDirBasePath,
									});
									if (!path) {
										return;
									}

									await createLocalConfigDir(path);
									relaunch();
								} catch (error) {
									appError("[enableLocalConfig] error", error);
									message.error(`${error}`);
								}
							}}
						>
							<FormattedMessage id="settings.systemSettings.dataFilePath.setDirectory" />
						</Button>
					}
					hint={
						<FormattedMessage id="settings.systemSettings.dataFilePath.setDirectory.tip" />
					}
				/>
				<SettingsLine
					label={<FormattedMessage id="settings.systemSettings.dataFilePath" />}
					description={
						<Typography.Text
							className="settings-line-path"
							copyable={{ text: configDirPath }}
						>
							{configDirPath}
						</Typography.Text>
					}
					control={
						<Button onClick={() => openDirectory(configDirPath, openFailed)}>
							<FormattedMessage id="settings.systemSettings.dataFilePath.open" />
						</Button>
					}
				/>
				<SettingsLine
					label={
						<FormattedMessage id="settings.systemSettings.appLogFilePath" />
					}
					description={
						<Typography.Text
							className="settings-line-path"
							copyable={{ text: appLogPath }}
						>
							{appLogPath}
						</Typography.Text>
					}
					control={
						<Button onClick={() => openDirectory(appLogPath, openLogFailed)}>
							<FormattedMessage id="settings.systemSettings.appLogFilePath.open" />
						</Button>
					}
				/>
			</SettingsGroup>

			<SettingsGroup
				title={<FormattedMessage id="workbench.group.dangerZone" />}
				rows={false}
			>
				<SettingsLine
					label={
						<FormattedMessage id="settings.systemSettings.dataFile.clearAll" />
					}
					description={
						<FormattedMessage id="settings.systemSettings.dataFile.clearAll.confirm" />
					}
					control={
						<Button
							danger
							onClick={() => {
								modal.confirm({
									title: (
										<FormattedMessage id="settings.systemSettings.dataFile.clearAll.confirm" />
									),
									type: "error",
									okButtonProps: { danger: true },
									onOk: async () => {
										await Promise.all([
											clearAllAppStore(),
											clearAllConfig(),
											(async () => {
												const captureHistory = new CaptureHistory();
												await captureHistory.init();
												await captureHistory.clearAll();
											})(),
										]);
										relaunch();
									},
								});
							}}
						>
							<FormattedMessage id="settings.systemSettings.dataFile.clearAll" />
						</Button>
					}
				/>
			</SettingsGroup>
		</>
	);
};
