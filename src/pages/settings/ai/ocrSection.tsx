import ProForm, { ProFormSelect, ProFormTextArea } from "@ant-design/pro-form";
import { useRouter } from "@tanstack/react-router";
import { Button, Form, type SelectProps, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import { defaultAppSettingsData } from "@/constants/appSettings";
import {
	PLUGIN_ID_AI_CHAT,
	PLUGIN_ID_RAPID_OCR,
} from "@/constants/pluginService";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { useVisionModelList } from "@/pages/fixedContent/components/ocrResult";
import { AppSettingsGroup, OcrModel } from "@/types/appSettings";
import { useAppSettingsSnapshot } from "../shared/hooks";
import { SettingsLine } from "../shared/settingsLine";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

const prefix = "settings.functionSettings.ocrSettings";

const useHtmlVisionModelOptions = () => {
	const intl = useIntl();
	const { getVisionModelList } = useVisionModelList();
	const [options, setOptions] = useState<SelectProps["options"]>([]);

	useEffect(() => {
		getVisionModelList().then((models) => {
			const custom = models.filter((model) => !model.isOfficial);
			setOptions([
				{
					label: intl.formatMessage({
						id: `${prefix}.htmlVisionModel.default`,
					}),
					value:
						defaultAppSettingsData[AppSettingsGroup.FunctionOcr]
							.htmlVisionModel,
				},
				...custom.map((model) => ({
					label: model.config.model_name,
					value: model.config.model_name,
				})),
			]);
		});
	}, [getVisionModelList, intl]);

	return options;
};

/** OCR engine choice and the vision prompts used to convert images. */
export const OcrSection = () => {
	const intl = useIntl();
	const router = useRouter();
	const { isReadyStatus } = usePluginServiceContext();
	const settings = useAppSettingsSnapshot();
	const htmlVisionModelOptions = useHtmlVisionModelOptions();
	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.FunctionOcr,
	);
	const ocrModel = Form.useWatch("ocrModel", form) as OcrModel | undefined;
	const glmOcrConfig = settings?.[AppSettingsGroup.FunctionOcr].glmOcrApiConfig;

	const ocrModelOptions = useMemo(() => {
		const options = [
			{
				label: intl.formatMessage({
					id: "settings.systemSettings.screenshotSettings.ocrModel.glmOcr",
				}),
				value: OcrModel.GlmOcr,
			},
		];
		if (isReadyStatus?.(PLUGIN_ID_RAPID_OCR)) {
			options.push(
				{
					label: intl.formatMessage({
						id: "settings.systemSettings.screenshotSettings.ocrModel.rapidOcrV4",
					}),
					value: OcrModel.RapidOcrV4,
				},
				{
					label: intl.formatMessage({
						id: "settings.systemSettings.screenshotSettings.ocrModel.rapidOcrV5",
					}),
					value: OcrModel.RapidOcrV5,
				},
			);
		}
		return options;
	}, [intl, isReadyStatus]);

	const isRapid =
		ocrModel === OcrModel.RapidOcrV4 || ocrModel === OcrModel.RapidOcrV5;

	return (
		<Spin spinning={loading}>
			<ProForm
				form={form}
				submitter={false}
				autoFocusFirstInput={false}
				layout="horizontal"
				onValuesChange={(changedValues) => save(changedValues)}
			>
				<SettingsGroup
					title={<FormattedMessage id={prefix} />}
					description={
						isRapid ? (
							<FormattedMessage
								id={
									ocrModel === OcrModel.RapidOcrV4
										? `${prefix}.rapidOcrRuntime.v4.description`
										: `${prefix}.rapidOcrRuntime.v5.description`
								}
							/>
						) : undefined
					}
					extra={
						<ResetSettingsButton
							title={<FormattedMessage id={prefix} />}
							appSettingsGroup={AppSettingsGroup.FunctionOcr}
						/>
					}
				>
					<ProFormSelect
						name="ocrModel"
						label={
							<IconLabel
								label={
									<FormattedMessage id="settings.systemSettings.screenshotSettings.ocrModel" />
								}
								tooltipTitle={
									<FormattedMessage id="settings.systemSettings.screenshotSettings.ocrModel.tip" />
								}
							/>
						}
						options={ocrModelOptions}
						allowClear={false}
					/>
					{ocrModel === OcrModel.GlmOcr && (
						<SettingsLine
							label={<FormattedMessage id="workbench.ocr.service" />}
							description={
								glmOcrConfig?.api_uri ? (
									<span className="settings-line-path">
										{[
											glmOcrConfig.model_name || glmOcrConfig.api_model,
											glmOcrConfig.api_uri,
										]
											.filter(Boolean)
											.join(" · ")}
									</span>
								) : (
									<FormattedMessage id="workbench.ocr.serviceMissing" />
								)
							}
							control={
								<Button
									onClick={() =>
										router.navigate({
											to: "/w/$itemId",
											params: { itemId: "modelServices" },
										})
									}
								>
									<FormattedMessage id="workbench.ocr.manageServices" />
								</Button>
							}
						/>
					)}
				</SettingsGroup>

				{isReadyStatus?.(PLUGIN_ID_AI_CHAT) && (
					<SettingsGroup
						title={<FormattedMessage id={`${prefix}.visionSettings`} />}
					>
						<ProFormSelect
							name="htmlVisionModel"
							label={
								<IconLabel
									label={<FormattedMessage id={`${prefix}.htmlVisionModel`} />}
									tooltipTitle={
										<FormattedMessage id={`${prefix}.htmlVisionModel.tip`} />
									}
								/>
							}
							options={htmlVisionModelOptions}
							allowClear={false}
						/>
						<ProFormTextArea
							name="htmlVisionModelSystemPrompt"
							label={
								<FormattedMessage
									id={`${prefix}.htmlVisionModelSystemPrompt`}
								/>
							}
							fieldProps={{ autoSize: { minRows: 2, maxRows: 8 } }}
						/>
						<ProFormTextArea
							name="markdownVisionModelSystemPrompt"
							label={
								<FormattedMessage
									id={`${prefix}.markdownVisionModelSystemPrompt`}
								/>
							}
							fieldProps={{ autoSize: { minRows: 2, maxRows: 8 } }}
						/>
					</SettingsGroup>
				)}
			</ProForm>
		</Spin>
	);
};
