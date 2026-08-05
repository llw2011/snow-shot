import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { nativeRuntimeStart } from "@/commands/nativeAction";
import { appError } from "@/utils/log";

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

		return () => {
			releaseLock?.();
			abortController.abort();
		};
	}, []);

	return null;
};
