"use client";

import { DeleteOutlined, PlusOutlined, SyncOutlined } from "@ant-design/icons";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Badge, Button, List } from "antd";
import { useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { pluginInstallPlugin, pluginUninstallPlugin } from "@/commands/plugin";
import {
	PLUGIN_ID_FFMPEG,
	PLUGIN_ID_RAPID_OCR,
} from "@/constants/pluginService";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { PluginStatus } from "@/types/commands/plugin";
import { appError } from "@/utils/log";

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
										try {
											pluginInstallPlugin(item.id);
										} catch (error) {
											appError("[PluginsPage] install plugin error", error);
										}
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
									try {
										pluginInstallPlugin(item.id, true);
									} catch (error) {
										appError("[PluginsPage] force install plugin error", error);
									}
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
