import { useCallback, useEffect, useRef } from "react";
import {
	createWebViewSharedBuffer,
	setSupportWebViewSharedBuffer,
} from "@/commands/webview";
import { appInfo } from "@/utils/log";
import {
	getWebViewSharedBuffer,
	releaseWebViewSharedBuffer,
} from "@/utils/webview";

export const CheckEnvironment = () => {
	const hasCheckedEnvironmentRef = useRef(false);
	const checkEnvironment = useCallback(async () => {
		if (hasCheckedEnvironmentRef.current) {
			return;
		}
		hasCheckedEnvironmentRef.current = true;

		const testData = new Uint8Array([83]);
		const receiveDataPromise = getWebViewSharedBuffer(
			undefined,
			"check_environment",
		);
		await createWebViewSharedBuffer(testData.buffer, "check_environment");
		const receiveData = await receiveDataPromise;
		if (!receiveData) {
			return;
		}

		if (receiveData.byteLength !== testData.byteLength) {
			return;
		}

		if (
			!new Uint8Array(receiveData).every(
				(value, index) => value === testData[index],
			)
		) {
			return;
		}

		appInfo("[CheckEnvironment] Support WebView Shared Buffer");
		setSupportWebViewSharedBuffer(true);
		releaseWebViewSharedBuffer(receiveData);
	}, []);

	useEffect(() => {
		checkEnvironment();
	}, [checkEnvironment]);

	return undefined;
};
