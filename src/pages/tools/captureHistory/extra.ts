import type { CaptureHistoryItem } from "@/utils/appStore";

export type CaptureHistoryRecordItem = CaptureHistoryItem & {
	serial_number: number;
	file_path: string;
	file_url: string;
	capture_result_file_path?: string;
	capture_result_file_url?: string;
};
