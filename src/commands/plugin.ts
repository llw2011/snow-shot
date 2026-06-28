import { invoke } from "@tauri-apps/api/core";
import type { PluginStatusResult } from "@/types/commands/plugin";
import type { PluginFileSource } from "@/types/components/pluginService";

export const pluginInit = async (
	version: string,
	pluginInstallDir: string,
	pluginDownloadDir: string,
	pluginDownloadServiceUrl: string,
) => {
	await invoke("plugin_init", {
		version,
		pluginInstallDir,
		pluginDownloadDir,
		pluginDownloadServiceUrl,
	});
};

export const pluginGetPluginsStatus = async () => {
	return await invoke<PluginStatusResult[]>("plugin_get_plugins_status");
};

export const pluginRegisterPlugin = async (
	name: string,
	fileList: string[],
	fileSourceList: PluginFileSource[] = [],
) => {
	await invoke("plugin_register_plugin", { name, fileList, fileSourceList });
};

export const pluginInstallPlugin = async (
	name: string,
	force: boolean = false,
) => {
	await invoke("plugin_install_plugin", { name, force });
};

export const pluginInstallLocalPlugin = async (
	name: string,
	sourceDir: string,
	force: boolean = false,
) => {
	await invoke("plugin_install_local_plugin", { name, sourceDir, force });
};

export const pluginUninstallPlugin = async (name: string) => {
	await invoke("plugin_uninstall_plugin", { name });
};
