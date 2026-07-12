import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import {
	nativeRuntimeHeartbeat,
	nativeRuntimeStart,
} from "@/commands/nativeAction";
import { appError } from "@/utils/log";

const HEARTBEAT_INTERVAL_MS = 5000;
const MAIN_WINDOW_LABEL = "main";

export const NativeRuntimeGuard = () => {
	useEffect(() => {
		let releaseLock: (() => void) | undefined;
		const abortController = new AbortController();
		const windowLabel = getCurrentWindow().label;
		void nativeRuntimeStart().catch((error) => {
			appError("[NativeRuntimeGuard] runtime start failed", error);
		});

		if (navigator.locks) {
			void navigator.locks
				.request(
					`snow-shot-runtime-${windowLabel}`,
					{ signal: abortController.signal },
					() =>
						new Promise<void>((resolve) => {
							releaseLock = resolve;
						}),
				)
				.catch((error) => {
					if (!(error instanceof DOMException && error.name === "AbortError")) {
						appError("[NativeRuntimeGuard] WebLock failed", error);
					}
				});
		}

		let heartbeatTimer: number | undefined;
		if (windowLabel === MAIN_WINDOW_LABEL) {
			const heartbeat = () => {
				nativeRuntimeHeartbeat().catch((error) => {
					appError("[NativeRuntimeGuard] heartbeat failed", error);
				});
			};
			heartbeat();
			heartbeatTimer = window.setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
		}

		return () => {
			if (heartbeatTimer !== undefined) {
				window.clearInterval(heartbeatTimer);
			}
			releaseLock?.();
			abortController.abort();
		};
	}, []);

	return null;
};
