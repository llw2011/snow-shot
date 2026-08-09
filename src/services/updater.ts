import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import {
	check,
	type DownloadEvent,
	type Update,
} from "@tauri-apps/plugin-updater";
import { isPortableApp } from "@/commands/file";
import { appWarn } from "@/utils/log";

const UPDATE_CHECK_TIMEOUT = 15_000;
const UPDATE_DOWNLOAD_TIMEOUT = 10 * 60 * 1000;
const UPDATE_RESOURCE_CLOSE_TIMEOUT = 3_000;
const PORTABLE_STATE_TIMEOUT = 3_000;
const PORTABLE_STATE_TIMEOUT_RESULT = Symbol("portable-state-timeout");
const UPDATE_RESOURCE_CLOSE_TIMEOUT_RESULT = Symbol(
	"update-resource-close-timeout",
);
const MISSING_UPDATER_ENDPOINT_PATTERN =
	/updater does not have any endpoints set/i;

export type UpdateInfo = {
	version: string;
	currentVersion: string;
	date?: string;
	body?: string;
};

export type UpdateProgress = {
	downloadedBytes: number;
	contentLength?: number;
	finished: boolean;
};

let activeCheck: Promise<UpdateInfo | null> | undefined;
let activeInstall: Promise<boolean> | undefined;
let activeInstallVersion: string | undefined;
let portableStatePromise: Promise<boolean | undefined> | undefined;
let updatePromptActive = false;

export class UpdaterUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UpdaterUnavailableError";
	}
}

const errorMessage = (error: unknown) => {
	const message =
		error instanceof Error
			? error.message
			: typeof error === "object" && error !== null && "message" in error
				? String((error as { message: unknown }).message)
				: String(error);
	return message.replace(/[\r\n]+/g, " ").slice(0, 240);
};

const isUpdaterUnavailableCause = (error: unknown) => {
	return (
		error instanceof UpdaterUnavailableError ||
		MISSING_UPDATER_ENDPOINT_PATTERN.test(errorMessage(error))
	);
};

const closeUpdate = async (update: Update) => {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	try {
		const closePromise = update.close().catch((error) => {
			appWarn(
				"[Updater] failed to release update resource",
				errorMessage(error),
			);
		});
		const timeoutPromise = new Promise<
			typeof UPDATE_RESOURCE_CLOSE_TIMEOUT_RESULT
		>((resolve) => {
			timeoutId = setTimeout(
				() => resolve(UPDATE_RESOURCE_CLOSE_TIMEOUT_RESULT),
				UPDATE_RESOURCE_CLOSE_TIMEOUT,
			);
		});
		const result = await Promise.race([closePromise, timeoutPromise]);
		if (result === UPDATE_RESOURCE_CLOSE_TIMEOUT_RESULT) {
			appWarn(
				"[Updater] update resource close timed out; continuing without blocking",
			);
		}
	} catch (error) {
		appWarn("[Updater] update resource close failed", errorMessage(error));
	} finally {
		if (timeoutId !== undefined) {
			clearTimeout(timeoutId);
		}
	}
};

const probePortableState = async (): Promise<boolean | undefined> => {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	const portableStatePromise = isPortableApp().catch((error) => {
		appWarn("[Updater] portable-state check failed", errorMessage(error));
		return undefined;
	});
	const timeoutPromise = new Promise<typeof PORTABLE_STATE_TIMEOUT_RESULT>(
		(resolve) => {
			timeoutId = setTimeout(
				() => resolve(PORTABLE_STATE_TIMEOUT_RESULT),
				PORTABLE_STATE_TIMEOUT,
			);
		},
	);

	try {
		const portableState = await Promise.race([
			portableStatePromise,
			timeoutPromise,
		]);
		if (portableState === PORTABLE_STATE_TIMEOUT_RESULT) {
			appWarn("[Updater] portable-state check timed out; update check skipped");
			return undefined;
		}
		return portableState;
	} finally {
		if (timeoutId !== undefined) {
			clearTimeout(timeoutId);
		}
	}
};

/**
 * Portability cannot change while the process is running. Share one probe so
 * a timed-out Tauri invocation cannot be multiplied by later manual checks.
 * An unknown result stays fail-closed until the WebView is recreated.
 */
const readPortableState = (): Promise<boolean | undefined> => {
	if (!portableStatePromise) {
		portableStatePromise = probePortableState().catch((error) => {
			appWarn(
				"[Updater] unexpected portable-state probe failure",
				errorMessage(error),
			);
			return undefined;
		});
	}

	return portableStatePromise;
};

const assertUpdaterSupported = async () => {
	if (!isTauri()) {
		throw new UpdaterUnavailableError(
			"online updates are only available in the desktop application",
		);
	}

	const portableState = await readPortableState();
	if (portableState === true) {
		throw new UpdaterUnavailableError(
			"online updates are unavailable for portable installations",
		);
	}
	if (portableState !== false) {
		throw new UpdaterUnavailableError(
			"the installation channel could not be verified safely",
		);
	}
};

/** Backwards-compatible capability probe; update operations still throw. */
export const isUpdaterSupported = async () => {
	try {
		await assertUpdaterSupported();
		return true;
	} catch (error) {
		if (isUpdaterUnavailableCause(error)) {
			return false;
		}
		throw error;
	}
};

const checkNativeUpdater = async (): Promise<Update | null> => {
	try {
		return await check({ timeout: UPDATE_CHECK_TIMEOUT });
	} catch (error) {
		if (MISSING_UPDATER_ENDPOINT_PATTERN.test(errorMessage(error))) {
			throw new UpdaterUnavailableError(errorMessage(error));
		}
		throw error;
	}
};

const checkForUpdateCore = async (): Promise<UpdateInfo | null> => {
	await assertUpdaterSupported();

	const update = await checkNativeUpdater();
	if (!update) {
		return null;
	}

	try {
		return {
			version: update.version,
			currentVersion: update.currentVersion,
			date: update.date,
			body: update.body,
		};
	} finally {
		await closeUpdate(update);
	}
};

/**
 * Checks the public GitHub updater manifest. Concurrent callers share one
 * request, while the returned metadata is detached from Tauri's resource
 * table and therefore safe to retain in React state.
 */
export const checkForUpdate = (): Promise<UpdateInfo | null> => {
	if (!activeCheck) {
		activeCheck = checkForUpdateCore().finally(() => {
			activeCheck = undefined;
		});
	}

	return activeCheck;
};

export const getLatestVersion = async (): Promise<string | undefined> => {
	try {
		return (await checkForUpdate())?.version;
	} catch (error) {
		if (!isUpdaterUnavailableCause(error)) {
			appWarn("[Updater] version check failed", errorMessage(error));
		}
		return undefined;
	}
};

/**
 * Re-checks immediately before download so a stale manifest cannot install a
 * different release than the one the user accepted. Tauri verifies the
 * minisign signature before handing the installer to the OS.
 */
const installUpdateCore = async (
	expectedVersion?: string,
	onProgress?: (progress: UpdateProgress) => void,
): Promise<boolean> => {
	await assertUpdaterSupported();

	let update: Update | null = null;
	try {
		update = await checkNativeUpdater();
		if (!update) {
			return false;
		}

		if (expectedVersion && update.version !== expectedVersion) {
			throw new Error(
				`the available version changed from ${expectedVersion} to ${update.version}`,
			);
		}

		let downloadedBytes = 0;
		let contentLength: number | undefined;
		await update.downloadAndInstall(
			(event: DownloadEvent) => {
				if (event.event === "Started") {
					downloadedBytes = 0;
					contentLength = event.data.contentLength;
					onProgress?.({
						downloadedBytes,
						contentLength,
						finished: false,
					});
				} else if (event.event === "Progress") {
					downloadedBytes += event.data.chunkLength;
					onProgress?.({
						downloadedBytes,
						contentLength,
						finished: false,
					});
				} else {
					onProgress?.({ downloadedBytes, contentLength, finished: true });
				}
			},
			{ timeout: UPDATE_DOWNLOAD_TIMEOUT },
		);
	} finally {
		if (update) {
			await closeUpdate(update);
		}
	}

	await relaunch();
	return true;
};

/**
 * Serializes installation requests. A startup check and an About-page click
 * can overlap, but only one signed installer may be downloaded at a time.
 */
export const installUpdate = (
	expectedVersion?: string,
	onProgress?: (progress: UpdateProgress) => void,
): Promise<boolean> => {
	if (activeInstall) {
		if (
			expectedVersion &&
			activeInstallVersion &&
			expectedVersion !== activeInstallVersion
		) {
			return Promise.reject(
				new Error(
					`an installation for ${activeInstallVersion} is already in progress`,
				),
			);
		}
		return activeInstall;
	}

	activeInstallVersion = expectedVersion;
	activeInstall = installUpdateCore(expectedVersion, onProgress).finally(() => {
		activeInstall = undefined;
		activeInstallVersion = undefined;
	});
	return activeInstall;
};

/**
 * Runs at most one update prompt flow in this WebView. Acquisition is
 * synchronous, while finally guarantees that cancel/error paths release it.
 */
export const runWithUpdatePromptLock = async (
	task: () => Promise<void>,
): Promise<boolean> => {
	if (updatePromptActive) {
		return false;
	}

	updatePromptActive = true;
	try {
		await task();
		return true;
	} finally {
		updatePromptActive = false;
	}
};

export const formatUpdateProgress = (progress: UpdateProgress) => {
	if (progress.contentLength && progress.contentLength > 0) {
		const percentage = progress.finished
			? 100
			: Math.round((progress.downloadedBytes / progress.contentLength) * 100);
		return `${Math.max(0, Math.min(100, percentage))}%`;
	}

	if (progress.downloadedBytes < 1024 * 1024) {
		return `${Math.max(0, Math.round(progress.downloadedBytes / 1024))} KB`;
	}

	return `${(progress.downloadedBytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatUpdaterError = errorMessage;

export const isUpdaterUnavailableError = (error: unknown) => {
	return isUpdaterUnavailableCause(error);
};
