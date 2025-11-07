import { getPlatform } from "./platform";

/**
 * 格式化快捷键
 * @param key 快捷键
 * @returns 格式化后的快捷键
 */
export const formatKey = (key: string | undefined | null) => {
	if (!key) {
		return "";
	}

	let result = key.replace("Period", ".").replace("Comma", ",");
	switch (getPlatform()) {
		case "macos":
			result = result
				.replace("Meta", "Command")
				.replace("Alt", "Option")
				.replace("Ctrl", "Control");
			break;
		default:
			result = result.replace("Super", "Win");
			break;
	}

	return result;
};
