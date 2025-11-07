import { emit } from "@tauri-apps/api/event";
import { hasVideoRecordWindow } from "@/commands/core";
import type { VideoRecordState } from "@/pages/videoRecord/extra";
import { ScreenshotType } from "@/utils/types";
import { executeScreenshot } from "./screenshot";

export const changeVideoRecordState = async (state: VideoRecordState) => {
	await emit("change-video-record-state", {
		state,
	});
};

export const startOrCopyVideo = async () => {
	if (await hasVideoRecordWindow()) {
		await emit("start-or-copy-video");
	} else {
		executeScreenshot(ScreenshotType.VideoRecord);
	}
};
