"use client";

import { DeleteOutlined, PlusOutlined, SyncOutlined } from "@ant-design/icons";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Badge, Button, List } from "antd";
import { useCallback, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import {
	pluginInstallLocalPlugin,
	pluginInstallPlugin,
	pluginUninstallPlugin,
} from "@/commands/plugin";
import {
	PLUGIN_ID_FFMPEG,
	PLUGIN_ID_GLM_OCR,
	PLUGIN_ID_RAPID_OCR,
} from "@/constants/pluginService";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { PluginStatus } from "@/types/commands/plugin";
import { appError } from "@/utils/log";
import { getPlatformValue } from "@/utils/platform";

export const PluginsPage = () => {
	const intl = useIntl();
	const { pluginConfig, pluginStatus } = usePluginServiceContext();

	const pluginList = useMemo(() => {
		return Array.from(pluginConfig?.plugins.values() || []).map((plugin) => {
			let link: string | undefined;
			switch (plugin.id) {
				case PLUGIN_ID_FFMPEG:
					link = "https://ffmpeg.org/";
					break;
				case PLUGIN_ID_RAPID_OCR:
					link = "https://github.com/RapidAI/RapidOCR";
					break;
				case PLUGIN_ID_GLM_OCR:
					link = "https://ollama.com/";
					break;
			}

			return {
				id: plugin.id,
				link,
				title: intl.formatMessage({ id: `plugin.${plugin.id}.name` }),
				description: intl.formatMessage({
					id: `plugin.${plugin.id}.description`,
				}),
				functionDescription: intl.formatMessage({
					id: `plugin.${plugin.id}.functionDescription`,
				}),
				status: pluginStatus?.[plugin.id]?.status || PluginStatus.NotInstalled,
			};
		});
	}, [intl, pluginConfig?.plugins, pluginStatus]);

	const convertPluginStatusToBadgeStatus = (status: PluginStatus) => {
		switch (status) {
			case PluginStatus.Installed:
				return "success";
			case PluginStatus.NotInstalled:
				return "default";
			case PluginStatus.Downloading:
				return "processing";
			case PluginStatus.Unzipping:
				return "processing";
			case PluginStatus.Uninstalling:
				return "error";
		}
	};

	const getDefaultLocalPluginSourceDir = useCallback((pluginId: string) => {
		switch (pluginId) {
			case PLUGIN_ID_FFMPEG:
				return getPlatformValue("D:\\ffmpeg", "/usr/local/bin", "/usr/bin");
			default:
				return undefined;
		}
	}, []);

	const installPlugin = useCallback(
		async (pluginId: string, force: boolean = false) => {
			try {
				if (pluginId === PLUGIN_ID_FFMPEG) {
					const sourceDir = await open({
						directory: true,
						defaultPath: getDefaultLocalPluginSourceDir(pluginId),
					});

					if (!sourceDir || Array.isArray(sourceDir)) {
						return;
					}

					await pluginInstallLocalPlugin(pluginId, sourceDir, force);
					return;
				}

				await pluginInstallPlugin(pluginId, force);
			} catch (error) {
				appError("[PluginsPage] install plugin error", error);
			}
		},
		[getDefaultLocalPluginSourceDir],
	);

	return (
		<div>
			<List
				loading={pluginStatus === undefined || pluginList.length === 0}
				itemLayout="vertical"
				dataSource={pluginList}
				renderItem={(item) => (
					<List.Item
						actions={[
							item.status === PluginStatus.Installed ||
							item.status === PluginStatus.Uninstalling ? (
								<Button
									key="uninstall"
									variant="text"
									color="red"
									size="small"
									icon={<DeleteOutlined />}
									loading={item.status === PluginStatus.Uninstalling}
									onClick={() => {
										try {
											pluginUninstallPlugin(item.id);
										} catch (error) {
											appError("[PluginsPage] uninstall plugin error", error);
										}
									}}
								>
									<FormattedMessage id="plugin.uninstall" />
								</Button>
							) : (
								<Button
									key="install"
									variant="text"
									color="primary"
									size="small"
									icon={<PlusOutlined />}
									loading={
										item.status === PluginStatus.Downloading ||
										item.status === PluginStatus.Unzipping
									}
									onClick={() => {
										installPlugin(item.id);
									}}
								>
									<FormattedMessage id="plugin.install" />
								</Button>
							),
							<Button
								key="forceInstall"
								variant="text"
								color="green"
								size="small"
								icon={<SyncOutlined />}
								disabled={item.status !== PluginStatus.Installed}
								onClick={() => {
									installPlugin(item.id, true);
								}}
							>
								<FormattedMessage id="plugin.forceInstall" />
							</Button>,
						]}
						extra={
							<Badge
								status={convertPluginStatusToBadgeStatus(item.status)}
								key="status"
								text={intl.formatMessage({
									id: `plugin.status.${item.status}`,
								})}
							/>
						}
					>
						<List.Item.Meta
							title={
								<a
									onClick={(event) => {
										event.preventDefault();
										if (item.link) {
											openUrl(item.link);
										}
									}}
								>
									{item.title}
								</a>
							}
							description={item.description}
						/>
						{/* <div style={{ whiteSpace: 'pre-wrap' }}>
                            <FormattedMessage id="plugin.extensionFunction" />
                            {`: ${item.functionDescription}`}
                        </div> */}
					</List.Item>
				)}
			/>
		</div>
	);
};

export default PluginsPage;
