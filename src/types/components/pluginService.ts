import * as path from "@tauri-apps/api/path";
import { appError } from "@/utils/log";
import type { PluginStatusResult } from "../commands/plugin";

export type PluginItem = {
	id: string;
	file_list: string[];
	file_source_list?: PluginFileSource[];
};

export type PluginFileSource = {
	path: string;
	url: string;
	sha256?: string;
};

export class PluginConfig {
	plugins: Map<string, PluginItem> = new Map();
	version: string = "";
	plugin_install_dir: string = "";
	plugin_download_dir: string = "";

	constructor(
		plugins: PluginItem[],
		version: string,
		plugin_install_dir: string,
		plugin_download_dir: string,
	) {
		this.plugins = new Map(plugins.map((plugin) => [plugin.id, plugin]));
		this.version = version;
		this.plugin_install_dir = plugin_install_dir;
		this.plugin_download_dir = plugin_download_dir;
	}

	async getPluginDirPath(name: string) {
		const pluginId = this.plugins.get(name)?.id ?? "";
		if (pluginId === "") {
			appError("[PluginConfig::getPluginDirPath] pluginId is empty");
		}

		return await path.join(
			this.plugin_install_dir,
			this.version,
			this.plugins.get(name)?.id ?? "",
		);
	}
}

export type PluginStatusRecord = Record<string, PluginStatusResult>;
