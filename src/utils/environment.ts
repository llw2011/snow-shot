import { isAdmin } from "@/commands/core";
import { getAppConfigBaseDir, getAppConfigDir } from "@/commands/file";
import { getPlatform } from "./platform";

let isAdminResultCache: boolean | undefined;
export const isAdminWithCache = async () => {
	if (isAdminResultCache !== undefined) {
		return isAdminResultCache;
	}

	const result = await isAdmin();
	isAdminResultCache = result;
	return result;
};

/**
 * 判断是否支持 OffscreenCanvas
 * 支持主线程和 Worker 环境
 * @returns 是否支持
 */
export const supportOffscreenCanvas = () => {
	// 主线程环境
	if (typeof window !== "undefined") {
		return "OffscreenCanvas" in window;
	}

	// Worker 环境
	if (typeof self !== "undefined") {
		return "OffscreenCanvas" in self;
	}

	return false;
};

let getAppConfigBaseDirCache: string | undefined;
export const getAppConfigBaseDirWithCache = async () => {
	if (getAppConfigBaseDirCache !== undefined) {
		return getAppConfigBaseDirCache;
	}

	getAppConfigBaseDirCache = await getAppConfigBaseDir();
	return getAppConfigBaseDirCache;
};

let configDirPathCache: string | undefined;
export const getConfigDirPath = async () => {
	if (configDirPathCache) {
		return configDirPathCache;
	}

	configDirPathCache = await getAppConfigDir();

	return configDirPathCache;
};

export function listenDevicePixelRatio(callback: (ratio: number) => void) {
	const media = window.matchMedia(
		`(resolution: ${window.devicePixelRatio}dppx)`,
	);

	function handleChange() {
		callback(window.devicePixelRatio);
	}

	media.addEventListener("change", handleChange);

	return function stopListen() {
		media.removeEventListener("change", handleChange);
	};
}

export function supportWebViewSharedBuffer() {
	if (
		getPlatform() !== "windows" ||
		!("chrome" in window) ||
		!("webview" in window.chrome) ||
		!("addEventListener" in window.chrome.webview)
	) {
		return false;
	}

	return true;
}
