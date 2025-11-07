export enum PluginStatus {
	NotInstalled = "NotInstalled",
	Installed = "Installed",
	Downloading = "Downloading",
	Unzipping = "Unzipping",
	Uninstalling = "Uninstalling",
}

export type PluginStatusResult = {
	name: string;
	status: PluginStatus;
};
