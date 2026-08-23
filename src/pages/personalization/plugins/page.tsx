"use client";

import { DeleteOutlined, PlusOutlined, SyncOutlined } from "@ant-design/icons";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Badge, Button, List } from "antd";
import { useCallback, useContext, useMemo, useRef, useState } from "react";
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
import { AntdContext } from "@/contexts/antdContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { PluginStatus } from "@/types/commands/plugin";
import { appError } from "@/utils/log";

export const PluginsPage = () => {
	const intl = useIntl();
	const { modal } = useContext(AntdContext);
	const { pluginConfig, pluginStatus } = usePluginServiceContext();
	const [pendingMutation, setPendingMutation] = useState<string>();
	const pendingMutationRef = useRef<string | undefined>(undefined);

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

	const installPlugin = useCallback(
		async (pluginId: string, force: boolean = false) => {
			try {
				const plugin = pluginConfig?.plugins.get(pluginId);
				const hasConfiguredRemoteSource =
					(plugin?.file_source_list?.length ?? 0) > 0;
				if (pluginId === PLUGIN_ID_FFMPEG && !hasConfiguredRemoteSource) {
					const sourceDir = await open({
						directory: true,
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
		[pluginConfig],
	);

	const confirmPluginMutation = useCallback(
		async (
			item: { id: string; title: string },
			action: "uninstall" | "reinstall",
		) => {
			const mutationKey = `${action}:${item.id}`;
			if (pendingMutationRef.current) {
				return;
			}

			pendingMutationRef.current = mutationKey;
			setPendingMutation(mutationKey);
			const messagePrefix =
				action === "uninstall" ? "plugin.uninstall" : "plugin.reinstall";
			try {
				const confirmed = await modal.confirmWithStatus({
					type: "error",
					title: intl.formatMessage(
						{ id: `${messagePrefix}.confirm.title` },
						{ name: item.title },
					),
					content: intl.formatMessage({
						id: `${messagePrefix}.confirm.description`,
					}),
					okText: intl.formatMessage({
						id: `${messagePrefix}.confirm.action`,
					}),
					okButtonProps: { danger: true },
				});
				if (!confirmed) {
					return;
				}

				if (action === "uninstall") {
					await pluginUninstallPlugin(item.id);
				} else {
					await installPlugin(item.id, true);
				}
			} catch (error) {
				appError(`[PluginsPage] ${action} plugin error`, error);
			} finally {
				if (pendingMutationRef.current === mutationKey) {
					pendingMutationRef.current = undefined;
				}
				setPendingMutation((current) =>
					current === mutationKey ? undefined : current,
				);
			}
		},
		[installPlugin, intl, modal],
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
									danger
									size="small"
									icon={<DeleteOutlined />}
									loading={
										item.status === PluginStatus.Uninstalling ||
										pendingMutation === `uninstall:${item.id}`
									}
									disabled={
										pendingMutation !== undefined ||
										item.status === PluginStatus.Uninstalling
									}
									onClick={() => {
										confirmPluginMutation(item, "uninstall");
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
									disabled={pendingMutation !== undefined}
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
								color="primary"
								size="small"
								icon={<SyncOutlined />}
								disabled={
									item.status !== PluginStatus.Installed ||
									pendingMutation !== undefined
								}
								loading={pendingMutation === `reinstall:${item.id}`}
								onClick={() => {
									confirmPluginMutation(item, "reinstall");
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
					</List.Item>
				)}
			/>
		</div>
	);
};
