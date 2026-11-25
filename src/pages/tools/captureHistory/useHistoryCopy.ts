import { App } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { writeFilePathToClipboard } from "@/utils/clipboard";
import type { CaptureHistoryRecordItem } from "./extra";

export const useHistoryCopy = () => {
	const { message } = App.useApp();
	const intl = useIntl();
	const [copiedId, setCopiedId] = useState<string>();
	const [copyingId, setCopyingId] = useState<string>();
	const pendingRef = useRef(false);
	const mountedRef = useRef(false);
	const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			clearTimeout(timerRef.current);
		};
	}, []);

	const copyItem = useCallback(
		async (item: CaptureHistoryRecordItem) => {
			if (!item.capture_result_file_path || pendingRef.current) {
				return;
			}
			// Serialize clipboard writes so the success mark matches the clipboard.
			pendingRef.current = true;
			clearTimeout(timerRef.current);
			setCopiedId(undefined);
			setCopyingId(item.id);
			try {
				// The native clipboard accepts paths even after their files are deleted.
				// Recheck the existing local asset URL without using the image cache.
				const readable = item.capture_result_file_url
					? await fetch(item.capture_result_file_url, {
							method: "HEAD",
							cache: "no-store",
						}).then(
							(response) => response.ok,
							() => false,
						)
					: false;
				const copied =
					readable &&
					mountedRef.current &&
					(await writeFilePathToClipboard(item.capture_result_file_path));
				if (!mountedRef.current) {
					return;
				}
				if (copied) {
					setCopiedId(item.id);
					timerRef.current = setTimeout(() => setCopiedId(undefined), 3000);
				} else {
					message.error(
						intl.formatMessage({ id: "tools.captureHistory.copyFailed" }),
					);
				}
			} finally {
				pendingRef.current = false;
				if (mountedRef.current) {
					setCopyingId(undefined);
				}
			}
		},
		[intl, message],
	);

	return { copiedId, copyingId, copyItem };
};
