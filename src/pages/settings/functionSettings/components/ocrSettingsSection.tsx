"use client";

import ProForm, {
	ProFormSelect,
	ProFormText,
	ProFormTextArea,
} from "@ant-design/pro-form";
import {
	Alert,
	Col,
	Divider,
	Form,
	Row,
	type SelectProps,
	Spin,
	theme,
} from "antd";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { SubGroupTitle } from "@/components/groupTitle";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsSection } from "@/components/settingsSection";
import { defaultAppSettingsData } from "@/constants/appSettings";
import {
	PLUGIN_ID_AI_CHAT,
	PLUGIN_ID_GLM_OCR,
	PLUGIN_ID_RAPID_OCR,
} from "@/constants/pluginService";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { useVisionModelList } from "@/pages/fixedContent/components/ocrResult";
import {
	type AppSettingsData,
	AppSettingsGroup,
	OcrModel,
} from "@/types/appSettings";
import { canUseOcr } from "@/utils/ocr";

export const useFunctionOcrSettings = () => {
	const intl = useIntl();
	const { isReadyStatus } = usePluginServiceContext();
	const [functionOcrForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.FunctionOcr]>();
	const [appSettingsLoading, setAppSettingsLoading] = useState(true);

	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData, preSettings?: AppSettingsData) => {
				setAppSettingsLoading(false);

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.FunctionOcr] !==
						settings[AppSettingsGroup.FunctionOcr]
				) {
					functionOcrForm.setFieldsValue(
						settings[AppSettingsGroup.FunctionOcr],
					);
				}
			},
			[functionOcrForm],
		),
		true,
	);

	const currentFunctionOcrModel = Form.useWatch("ocrModel", functionOcrForm);
	const selectedFunctionOcrModel =
		currentFunctionOcrModel ??
		defaultAppSettingsData[AppSettingsGroup.FunctionOcr].ocrModel;
	const isCurrentGlmOcrModel = selectedFunctionOcrModel === OcrModel.GlmOcr;
	const isCurrentRapidOcrModel =
		selectedFunctionOcrModel === OcrModel.RapidOcrV4 ||
		selectedFunctionOcrModel === OcrModel.RapidOcrV5;
	const rapidOcrRuntimeMessageId =
		selectedFunctionOcrModel === OcrModel.RapidOcrV4
			? "settings.functionSettings.ocrSettings.rapidOcrRuntime.v4.title"
			: "settings.functionSettings.ocrSettings.rapidOcrRuntime.v5.title";
	const rapidOcrRuntimeDescriptionId =
		selectedFunctionOcrModel === OcrModel.RapidOcrV4
			? "settings.functionSettings.ocrSettings.rapidOcrRuntime.v4.description"
			: "settings.functionSettings.ocrSettings.rapidOcrRuntime.v5.description";
	const ocrReady = canUseOcr(
		{
			...defaultAppSettingsData,
			[AppSettingsGroup.FunctionOcr]: {
				...defaultAppSettingsData[AppSettingsGroup.FunctionOcr],
				ocrModel: selectedFunctionOcrModel,
			},
		},
		isReadyStatus?.(PLUGIN_ID_GLM_OCR),
		isReadyStatus?.(PLUGIN_ID_RAPID_OCR),
	);

	const ocrModelOptions = useMemo(() => {
		const options = [
			{
				label: intl.formatMessage({
					id: "settings.systemSettings.screenshotSettings.ocrModel.glmOcr",
				}),
				value: OcrModel.GlmOcr,
			},
		];

		if (!isReadyStatus?.(PLUGIN_ID_RAPID_OCR)) {
			return options;
		}

		return [
			...options,
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
		];
	}, [intl, isReadyStatus]);

	const { getVisionModelList } = useVisionModelList();
	const [htmlVisionModelOptions, setHtmlVisionModelOptions] = useState<
		SelectProps["options"]
	>([]);
	useEffect(() => {
		getVisionModelList().then((visionModelList) => {
			const officialVisionModelList = visionModelList.filter(
				(model) => model.isOfficial,
			);
			const customVisionModelList = visionModelList.filter(
				(model) => !model.isOfficial,
			);

			const htmlVisionModelOptions = [
				{
					label: (
						<IconLabel
							label={intl.formatMessage({
								id: "settings.functionSettings.ocrSettings.htmlVisionModel.default",
							})}
							tooltipTitle={intl.formatMessage({
								id: "settings.functionSettings.ocrSettings.htmlVisionModel.default.tip",
							})}
						/>
					),
					value:
						defaultAppSettingsData[AppSettingsGroup.FunctionOcr]
							.htmlVisionModel,
				},
				customVisionModelList.length > 0
					? {
							label: <FormattedMessage id="tools.chat.custom" />,
							options: customVisionModelList.map((model) => ({
								label: model.config.model_name,
								value: model.config.model_name,
							})),
						}
					: undefined,
				officialVisionModelList.length > 0
					? {
							label: <FormattedMessage id="tools.chat.official" />,
							options: officialVisionModelList.map((model) => ({
								label: model.config.model_name,
								value: model.config.model_name,
							})),
						}
					: undefined,
			].filter(Boolean) as SelectProps["options"];

			setHtmlVisionModelOptions(htmlVisionModelOptions);
		});
	}, [getVisionModelList, intl]);

	return {
		appSettingsLoading,
		functionOcrForm,
		htmlVisionModelOptions,
		isCurrentGlmOcrModel,
		isCurrentRapidOcrModel,
		isReadyStatus,
		ocrModelOptions,
		ocrReady,
		rapidOcrRuntimeDescriptionId,
		rapidOcrRuntimeMessageId,
	};
};

export const OcrSettingsSection = (
	settings: ReturnType<typeof useFunctionOcrSettings>,
) => {
	const {
		appSettingsLoading,
		functionOcrForm,
		htmlVisionModelOptions,
		isCurrentGlmOcrModel,
		isCurrentRapidOcrModel,
		isReadyStatus,
		ocrModelOptions,
		rapidOcrRuntimeDescriptionId,
		rapidOcrRuntimeMessageId,
	} = settings;
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const { token } = theme.useToken();

	return (
		<>
			{(isReadyStatus?.(PLUGIN_ID_GLM_OCR) ||
				isReadyStatus?.(PLUGIN_ID_RAPID_OCR)) && (
				<SettingsSection
					sectionId="ocrSettings"
					title={
						<FormattedMessage id="settings.functionSettings.ocrSettings" />
					}
					extra={
						<ResetSettingsButton
							title={
								<FormattedMessage id="settings.functionSettings.ocrSettings" />
							}
							appSettingsGroup={AppSettingsGroup.FunctionOcr}
						/>
					}
				>
					<Spin spinning={appSettingsLoading}>
						<ProForm
							form={functionOcrForm}
							onValuesChange={(_, values) => {
								updateAppSettings(
									AppSettingsGroup.FunctionOcr,
									values,
									true,
									true,
									true,
									true,
									false,
								);
							}}
							submitter={false}
							layout="vertical"
						>
							<Row gutter={token.marginLG}>
								<Col span={12}>
									<ProFormSelect
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
										name="ocrModel"
										options={ocrModelOptions}
										allowClear={false}
									/>
								</Col>
								{isCurrentRapidOcrModel && (
									<Col span={12}>
										<Alert
											type="info"
											showIcon
											message={
												<FormattedMessage id={rapidOcrRuntimeMessageId} />
											}
											description={
												<FormattedMessage id={rapidOcrRuntimeDescriptionId} />
											}
										/>
									</Col>
								)}
								{isCurrentGlmOcrModel && (
									<>
										<Col span={12}>
											<ProFormText
												name={["glmOcrApiConfig", "model_name"]}
												label={
													<IconLabel
														label={
															<FormattedMessage id="settings.functionSettings.ocrSettings.glmOcrApiConfig.modelName" />
														}
													/>
												}
											/>
										</Col>
										<Col span={12}>
											<ProFormText
												name={["glmOcrApiConfig", "api_uri"]}
												label={
													<IconLabel
														label={
															<FormattedMessage id="settings.functionSettings.ocrSettings.glmOcrApiConfig.apiUri" />
														}
														tooltipTitle={
															<FormattedMessage id="settings.functionSettings.ocrSettings.glmOcrApiConfig.apiUri.tip" />
														}
													/>
												}
											/>
										</Col>
										<Col span={12}>
											<ProFormText.Password
												name={["glmOcrApiConfig", "api_key"]}
												label={
													<IconLabel
														label={
															<FormattedMessage id="settings.functionSettings.ocrSettings.glmOcrApiConfig.apiKey" />
														}
													/>
												}
											/>
										</Col>
										<Col span={12}>
											<ProFormText
												name={["glmOcrApiConfig", "api_model"]}
												label={
													<IconLabel
														label={
															<FormattedMessage id="settings.functionSettings.ocrSettings.glmOcrApiConfig.apiModel" />
														}
													/>
												}
											/>
										</Col>
									</>
								)}

								{isReadyStatus?.(PLUGIN_ID_AI_CHAT) && (
									<>
										<Col span={24}>
											<Divider style={{ margin: `${token.margin}px 0` }} />
											<SubGroupTitle>
												<FormattedMessage id="settings.functionSettings.ocrSettings.visionSettings" />
											</SubGroupTitle>
										</Col>
										<Col span={12}>
											<ProFormSelect
												name="htmlVisionModel"
												label={
													<IconLabel
														label={
															<FormattedMessage id="settings.functionSettings.ocrSettings.htmlVisionModel" />
														}
														tooltipTitle={
															<FormattedMessage id="settings.functionSettings.ocrSettings.htmlVisionModel.tip" />
														}
													/>
												}
												layout="vertical"
												options={htmlVisionModelOptions}
												allowClear={false}
											/>
										</Col>
										<Col span={24}>
											<ProFormTextArea
												name="htmlVisionModelSystemPrompt"
												label={
													<IconLabel
														label={
															<FormattedMessage id="settings.functionSettings.ocrSettings.htmlVisionModelSystemPrompt" />
														}
													/>
												}
												fieldProps={{
													autoSize: {
														minRows: 1,
														maxRows: 1,
													},
												}}
											/>
										</Col>
										<Col span={24}>
											<ProFormTextArea
												name="markdownVisionModelSystemPrompt"
												label={
													<IconLabel
														label={
															<FormattedMessage id="settings.functionSettings.ocrSettings.markdownVisionModelSystemPrompt" />
														}
													/>
												}
												fieldProps={{
													autoSize: {
														minRows: 1,
														maxRows: 1,
													},
												}}
											/>
										</Col>
									</>
								)}
							</Row>
						</ProForm>
					</Spin>
				</SettingsSection>
			)}
		</>
	);
};
