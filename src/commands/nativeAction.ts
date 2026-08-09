import { invoke } from "@tauri-apps/api/core";
import type { TrayIconClickAction } from "@/types/appSettings";
import type { AppFunction } from "@/types/components/appFunction";

const runtimeDocumentId =
	globalThis.crypto?.randomUUID?.() ??
	`runtime-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
let runtimeStartPromise: Promise<void> | undefined;
let runtimeListenersReadyRequested = false;
let runtimeSettingsReadyRequested = false;
let runtimeReadyConfirmed = false;
let runtimeReadyPromise: Promise<void> | undefined;
let desiredShortcutInputActive = false;
let confirmedShortcutInputActive = false;
let shortcutInputSyncTail: Promise<void> = Promise.resolve();

export const nativeRuntimeStart = () => {
	runtimeStartPromise ??= invoke<void>("native_runtime_start", {
		documentId: runtimeDocumentId,
	})
		.then(() => {
			confirmedShortcutInputActive = false;
		})
		.catch((error) => {
			runtimeStartPromise = undefined;
			throw error;
		});
	return runtimeStartPromise;
};

const syncShortcutInputState = () => {
	const result = shortcutInputSyncTail
		.catch(() => {})
		.then(async () => {
			await nativeRuntimeStart();
			const active = desiredShortcutInputActive;
			if (confirmedShortcutInputActive === active) {
				return;
			}
			await invoke<void>("native_shortcut_set_input_active", { active });
			confirmedShortcutInputActive = active;
		});
	shortcutInputSyncTail = result;
	return result;
};

const confirmNativeRuntimeReady = async () => {
	if (
		!runtimeListenersReadyRequested ||
		!runtimeSettingsReadyRequested ||
		runtimeReadyConfirmed
	) {
		return;
	}
	runtimeReadyPromise ??= invoke<void>("native_runtime_ready", {
		documentId: runtimeDocumentId,
	})
		.then(() => {
			runtimeReadyConfirmed = true;
		})
		.finally(() => {
			runtimeReadyPromise = undefined;
		});
	await runtimeReadyPromise;
};

export const nativeShortcutRegisterAction = async (
	shortcut: string,
	action: AppFunction,
) => {
	return await invoke<boolean>("native_shortcut_register_action", {
		shortcut,
		action,
	});
};

export const nativeShortcutResetActions = async () => {
	await invoke<void>("native_shortcut_reset_actions");
};

export const nativeShortcutSetDisabled = async (disabled: boolean) => {
	await invoke<void>("native_shortcut_set_disabled", { disabled });
};

export const nativeShortcutSetInputActive = async (active: boolean) => {
	desiredShortcutInputActive = active;
	await syncShortcutInputState();
};

export const nativeShortcutSetFullScreenPolicy = async (
	disabledOnFocusedFullScreen: boolean,
) => {
	await invoke<void>("native_shortcut_set_full_screen_policy", {
		disabledOnFocusedFullScreen,
	});
};

export const nativeTraySetClickAction = async (action: TrayIconClickAction) => {
	await invoke<void>("native_tray_set_click_action", { action });
};

export const nativeTraySetEnabled = async (enabled: boolean) => {
	await invoke<void>("native_tray_set_enabled", { enabled });
};

export const nativeShowMainWindow = async () => {
	await invoke<void>("native_show_main_window");
};

export const nativeRuntimeListenersReady = async () => {
	runtimeListenersReadyRequested = true;
	await nativeRuntimeStart();
	await confirmNativeRuntimeReady();
};

export const nativeRuntimeSettingsReady = async () => {
	runtimeSettingsReadyRequested = true;
	await nativeRuntimeStart();
	await confirmNativeRuntimeReady();
};

export const nativeDrawRuntimeReady = async () => {
	await nativeRuntimeStart();
	await invoke<void>("native_draw_runtime_ready", {
		documentId: runtimeDocumentId,
	});
};

export const nativeDrawRuntimeProbeAck = async (
	probeId: number,
	expectedDocumentId: string,
) => {
	if (expectedDocumentId !== runtimeDocumentId) {
		return false;
	}
	return await invoke<boolean>("native_draw_runtime_probe_ack", {
		probeId,
		documentId: runtimeDocumentId,
	});
};

export const nativeMainRuntimeProbeAck = async (
	probeId: number,
	expectedDocumentId: string,
) => {
	if (expectedDocumentId !== runtimeDocumentId) {
		return false;
	}
	return await invoke<boolean>("native_main_runtime_probe_ack", {
		probeId,
		documentId: runtimeDocumentId,
	});
};

export const nativeRuntimeBindDraw = async (drawWindowLabel: string) => {
	await nativeRuntimeStart();
	await invoke<void>("native_runtime_bind_draw", {
		documentId: runtimeDocumentId,
		drawWindowLabel,
	});
};

export const nativeActionAck = async (
	requestId: number,
	expectedDocumentId: string,
) => {
	if (expectedDocumentId !== runtimeDocumentId) {
		return false;
	}
	return await invoke<boolean>("native_action_ack", {
		requestId,
		documentId: runtimeDocumentId,
	});
};
