import * as tauriOs from "@tauri-apps/plugin-os";

let platformCache: tauriOs.Platform | undefined;
/**
 * nextjs 会在服务端执行一次 js 代码，所以直接调用 tauriOs.platform() 会报错
 * 但项目都使用了 use client，最终都会在浏览器环境执行，这里提供默认的值来取消报错
 *
 * 已迁移项目到 rsbuild
 */
export const getPlatform = () => {
	if (platformCache) {
		return platformCache;
	}

	let platform: tauriOs.Platform = "windows";
	if (typeof window !== "undefined") {
		platform = tauriOs.platform();
	}

	platformCache = platform;

	return platform;
};

/**
 * 根据平台获取某个参数值
 * @param defaultValue 默认值（windows 平台值）
 * @param macosValue macos 平台值
 * @param linuxValue linux 平台值
 * @returns 平台值
 */
export const getPlatformValue = <T>(
	defaultValue: T,
	macosValue?: T,
	linuxValue?: T,
): T => {
	let value: T | undefined = defaultValue;

	switch (getPlatform()) {
		case "macos":
			value = macosValue;
			break;
		case "linux":
			value = linuxValue;
			break;
		default:
			break;
	}

	return value ?? defaultValue;
};

let platformVersionCache: string | undefined;

export const getPlatformVersion = () => {
	if (platformVersionCache) {
		return platformVersionCache;
	}

	platformVersionCache = tauriOs.version();
	return platformVersionCache;
};
