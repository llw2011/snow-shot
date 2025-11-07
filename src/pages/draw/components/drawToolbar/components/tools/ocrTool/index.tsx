import { Button } from "antd";
import { useCallback, useState } from "react";
import { useIntl } from "react-intl";
import { DrawStatePublisher } from "@/components/drawCore/extra";
import {
	OcrTranslateIcon,
	VisionMarkdownIcon,
	VisionModelHtmlIcon,
} from "@/components/icons";
import {
	PLUGIN_ID_AI_CHAT,
	PLUGIN_ID_TRANSLATE,
} from "@/constants/pluginService";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import {
	type AppOcrResult,
	OcrResultType,
} from "@/pages/fixedContent/components/ocrResult";
import { DrawState } from "@/types/draw";
import { SubTools } from "../../subTools";
import { OcrToolModalSettings } from "./components/ocrToolModalSettings";

export const isOcrTool = (drawState: DrawState) => {
	return (
		drawState === DrawState.OcrDetect || drawState === DrawState.OcrTranslate
	);
};

const OcrTool: React.FC<{
	onSwitchOcrResult: (ocrResultType: OcrResultType) => void;
	onTranslate: () => void;
	onConvertImageToHtml: () => void;
	onConvertImageToMarkdown: () => void;
	currentOcrResult:
		| (AppOcrResult & { ocrResultType: OcrResultType })
		| undefined;
	ocrResult: AppOcrResult | undefined;
	translatedOcrResult: AppOcrResult | undefined;
	translateLoading: boolean;
	visionModelHtmlResult: AppOcrResult | undefined;
	visionModelHtmlLoading: boolean;
	visionModelMarkdownResult: AppOcrResult | undefined;
	visionModelMarkdownLoading: boolean;
}> = ({
	onSwitchOcrResult,
	onTranslate,
	onConvertImageToHtml,
	onConvertImageToMarkdown,
	currentOcrResult,
	ocrResult,
	translatedOcrResult,
	translateLoading,
	visionModelHtmlResult,
	visionModelHtmlLoading,
	visionModelMarkdownResult,
	visionModelMarkdownLoading,
}) => {
	const intl = useIntl();

	const [enabled, setEnabled] = useState(false);

	useStateSubscriber(
		DrawStatePublisher,
		useCallback((drawState: DrawState) => {
			if (isOcrTool(drawState)) {
				setEnabled(true);
			} else {
				setEnabled(false);
			}
		}, []),
	);

	const { isReadyStatus } = usePluginServiceContext();

	if (!enabled) {
		return null;
	}

	return (
		<SubTools
			buttons={[
				...(isReadyStatus?.(PLUGIN_ID_TRANSLATE)
					? [
							<Button
								disabled={!currentOcrResult}
								loading={translateLoading}
								onClick={() => {
									if (ocrResult) {
										if (translatedOcrResult) {
											onSwitchOcrResult(
												currentOcrResult?.ocrResultType ===
													OcrResultType.Translated
													? OcrResultType.Ocr
													: OcrResultType.Translated,
											);
										} else {
											onTranslate();
										}
									}
								}}
								type={
									currentOcrResult?.ocrResultType === OcrResultType.Translated
										? "primary"
										: "text"
								}
								icon={<OcrTranslateIcon />}
								title={intl.formatMessage({ id: "draw.ocrDetect.translate" })}
								key="translate"
							/>,
						]
					: []),
				...(isReadyStatus?.(PLUGIN_ID_AI_CHAT)
					? [
							<Button
								loading={visionModelHtmlLoading}
								onClick={() => {
									if (visionModelHtmlResult) {
										onSwitchOcrResult(
											currentOcrResult?.ocrResultType ===
												OcrResultType.VisionModelHtml
												? OcrResultType.Ocr
												: OcrResultType.VisionModelHtml,
										);
									} else {
										onConvertImageToHtml();
									}
								}}
								type={
									currentOcrResult?.ocrResultType ===
									OcrResultType.VisionModelHtml
										? "primary"
										: "text"
								}
								icon={<VisionModelHtmlIcon />}
								title={intl.formatMessage({
									id: "draw.ocrDetect.visionModelHtml",
								})}
								key="visionModelHtml"
							/>,
							<Button
								loading={visionModelMarkdownLoading}
								onClick={() => {
									if (visionModelMarkdownResult) {
										onSwitchOcrResult(
											currentOcrResult?.ocrResultType ===
												OcrResultType.VisionModelMarkdown
												? OcrResultType.Ocr
												: OcrResultType.VisionModelMarkdown,
										);
									} else {
										onConvertImageToMarkdown();
									}
								}}
								type={
									currentOcrResult?.ocrResultType ===
									OcrResultType.VisionModelMarkdown
										? "primary"
										: "text"
								}
								icon={<VisionMarkdownIcon />}
								title={intl.formatMessage({
									id: "draw.ocrDetect.visionModelMarkdown",
								})}
								key="visionModelMarkdown"
							/>,
						]
					: []),
				<OcrToolModalSettings
					key="ocrToolModalSettings"
					onFinish={async () => {
						onTranslate();
						return;
					}}
				/>,
			]}
		/>
	);
};

export default OcrTool;
