import { Image, Tooltip } from "antd";
import { useState } from "react";
import { FormattedMessage } from "react-intl";
import type { CaptureHistoryRecordItem } from "../extra";

export const CaptureHistoryItemPreview: React.FC<{
	item: CaptureHistoryRecordItem;
}> = ({ item }) => {
	const [showCaptureResult, setShowCaptureResult] = useState(true);

	return (
		<Tooltip
			title={
				item.capture_result_file_url ? (
					<FormattedMessage id="tools.captureHistory.switchImage.tip" />
				) : undefined
			}
		>
			<Image
				alt="preview"
				loading="lazy"
				key={item.id}
				src={
					showCaptureResult
						? (item.capture_result_file_url ?? item.file_url)
						: item.file_url
				}
				width={350}
				height={128}
				style={{ objectFit: "contain" }}
				onContextMenu={(e) => {
					e.preventDefault();
					setShowCaptureResult(!showCaptureResult);
				}}
			/>
		</Tooltip>
	);
};
