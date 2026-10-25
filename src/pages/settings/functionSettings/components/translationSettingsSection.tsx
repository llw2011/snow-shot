"use client";

import ProForm, {
	ProFormDependency,
	ProFormDigit,
	ProFormList,
	ProFormSelect,
	ProFormSwitch,
	ProFormText,
	ProFormTextArea,
} from "@ant-design/pro-form";
import {
	Alert,
	Col,
	Divider,
	Flex,
	Form,
	Row,
	Spin,
	Typography,
	theme,
} from "antd";
import { useCallback, useContext, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsSection } from "@/components/settingsSection";
import {
	SOURCE_LANGUAGE_ENV_VARIABLE,
	TARGET_LANGUAGE_ENV_VARIABLE,
	TRANSLATION_DOMAIN_ENV_VARIABLE,
} from "@/constants/components/translation";
import { PLUGIN_ID_TRANSLATE } from "@/constants/pluginService";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import {
	type AppSettingsData,
	AppSettingsGroup,
	TranslationApiType,
} from "@/types/appSettings";
import { ModelProbeInput } from "./modelProbeInput";
import { TestTranslation } from "./testTranslation";
import { TranslationConfig } from "./translationConfig";

export const TranslationSettingsSection = () => {
	const intl = useIntl();
	const { token } = theme.useToken();
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const { isReadyStatus } = usePluginServiceContext();
	const [translationForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.FunctionTranslation]>();
	const [appSettingsLoading, setAppSettingsLoading] = useState(true);

	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData, preSettings?: AppSettingsData) => {
				setAppSettingsLoading(false);

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.FunctionTranslation] !==
						settings[AppSettingsGroup.FunctionTranslation]
				) {
					translationForm.setFieldsValue(
						settings[AppSettingsGroup.FunctionTranslation],
					);
				}
			},
			[translationForm],
		),
		true,
	);

	const translationApiTypeOptions = useMemo(() => {
		return [
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.translationSettings.apiConfig.apiType.openAiCompatible",
				}),
				value: TranslationApiType.OpenAiCompatible,
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.translationSettings.apiConfig.apiType.deepL",
				}),
				value: TranslationApiType.DeepL,
			},
		];
	}, [intl]);

	return (
		<>
			{isReadyStatus?.(PLUGIN_ID_TRANSLATE) && (
				<SettingsSection
					sectionId="translationSettings"
					title={
						<FormattedMessage id="settings.functionSettings.translationSettings" />
					}
					extra={
						<ResetSettingsButton
							title={
								<FormattedMessage id="settings.functionSettings.translationSettings" />
							}
							appSettingsGroup={AppSettingsGroup.FunctionTranslation}
						/>
					}
				>
					<Spin spinning={appSettingsLoading}>
						{/* 默认语言与翻译引擎偏好 */}
						<div className="settings-subsection">
							<TranslationConfig />
						</div>

						<Divider style={{ margin: `${token.margin}px 0` }} />

						<ProForm
							form={translationForm}
							onValuesChange={(_, values) => {
								updateAppSettings(
									AppSettingsGroup.FunctionTranslation,
									values,
									true,
									true,
									true,
									true,
									false,
								);
							}}
							submitter={false}
						>
							{/* 服务提供商与自定义模型列表 */}
							<Row gutter={token.marginLG}>
								<Col span={24}>
									<ProFormList
										name="translationApiConfigList"
										label={
											<IconLabel
												label={
													<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig" />
												}
												tooltipTitle={
													<FormattedMessage
														id="settings.functionSettings.translationSettings.apiConfig.tip"
														defaultMessage="可添加本地大模型（如 Ollama、vLLM、LM Studio）或 OpenAI、DeepL 兼容服务"
													/>
												}
											/>
										}
										creatorButtonProps={{
											creatorButtonText: intl.formatMessage({
												id: "settings.functionSettings.translationSettings.apiConfig.add",
											}),
										}}
										actionRender={(...params) => {
											const [field, , defaultActionDom] = params;
											const list = translationForm.getFieldValue(
												"translationApiConfigList",
											);
											const config = list?.[field.name];
											return [
												defaultActionDom,
												config && (
													<TestTranslation
														key="test-translation"
														config={config}
													/>
												),
											];
										}}
										className="api-config-list"
										min={0}
										itemRender={({ listDom, action }) => (
											<Flex
												className="api-config-list-item"
												align="end"
												gap={token.margin}
												justify="space-between"
											>
												<div className="api-config-list-item-content">
													{listDom}
												</div>

												<div className="api-config-list-item-action">
													{action}
												</div>
											</Flex>
										)}
										creatorRecord={() => ({
											api_uri: "",
											api_key: "",
											api_model: "",
											model_name: "",
											api_type: TranslationApiType.OpenAiCompatible,
										})}
									>
										<Row gutter={token.marginLG} style={{ width: "100%" }}>
											<Col span={12}>
												<ProFormSelect
													name="api_type"
													label={
														<IconLabel
															label={
																<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.apiType" />
															}
														/>
													}
													allowClear={false}
													options={translationApiTypeOptions}
												/>
											</Col>

											<ProFormDependency<{
												api_type: TranslationApiType;
												api_uri?: string;
												api_key?: string;
											}>
												name={["api_type", "api_uri", "api_key"]}
											>
												{({ api_type, api_uri, api_key }) => {
													if (
														api_type === TranslationApiType.OpenAiCompatible ||
														!api_type
													) {
														return (
															<>
																<Col span={12}>
																	<ProFormText
																		name="model_name"
																		label={
																			<IconLabel
																				label={
																					<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.modelName" />
																				}
																				tooltipTitle={
																					<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.modelName.tip" />
																				}
																			/>
																		}
																		rules={[
																			{
																				required: true,
																				message: intl.formatMessage({
																					id: "settings.functionSettings.translationSettings.apiConfig.modelName.required",
																				}),
																			},
																		]}
																	/>
																</Col>
																<Col span={12}>
																	<ProFormText
																		name="api_uri"
																		label={
																			<IconLabel
																				label={
																					<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.apiUri" />
																				}
																				tooltipTitle={
																					<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.apiUri.tip" />
																				}
																			/>
																		}
																		rules={[
																			{
																				required: true,
																				message: intl.formatMessage({
																					id: "settings.functionSettings.translationSettings.apiConfig.apiUri.required",
																				}),
																			},
																		]}
																	/>
																</Col>
																<Col span={12}>
																	<ProFormText.Password
																		name="api_key"
																		label={
																			<IconLabel
																				label={
																					<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.apiKey" />
																				}
																				tooltipTitle={
																					<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.apiKey.tip" />
																				}
																			/>
																		}
																	/>
																</Col>
																<Col span={12}>
																	<ModelProbeInput
																		name="api_model"
																		label={
																			<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.apiModel" />
																		}
																		tooltipTitle={
																			<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.apiModel.tip" />
																		}
																		apiUri={api_uri}
																		apiKey={api_key}
																		required
																	/>
																</Col>
															</>
														);
													}

													if (api_type === TranslationApiType.DeepL) {
														return (
															<>
																<Col span={12}>
																	<ProFormText
																		name="model_name"
																		label={
																			<IconLabel
																				label={
																					<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.modelName" />
																				}
																				tooltipTitle={
																					<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.modelName.tip" />
																				}
																			/>
																		}
																		rules={[
																			{
																				required: true,
																				message: intl.formatMessage({
																					id: "settings.functionSettings.translationSettings.apiConfig.modelName.required",
																				}),
																			},
																		]}
																	/>
																</Col>
																<Col span={12}>
																	<ProFormText
																		name="api_uri"
																		label={
																			<IconLabel
																				label={
																					<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.apiUri" />
																				}
																				tooltipTitle={
																					<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.apiUri.tip" />
																				}
																			/>
																		}
																		rules={[
																			{
																				required: true,
																				message: intl.formatMessage({
																					id: "settings.functionSettings.translationSettings.apiConfig.apiUri.required",
																				}),
																			},
																		]}
																	/>
																</Col>
																<Col span={12}>
																	<ProFormText.Password
																		name="api_key"
																		label={
																			<IconLabel
																				label={
																					<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.apiKey" />
																				}
																				tooltipTitle={
																					<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.apiKey.tip" />
																				}
																			/>
																		}
																		rules={[
																			{
																				required: true,
																				message: intl.formatMessage({
																					id: "settings.functionSettings.translationSettings.apiConfig.apiKey.required",
																				}),
																			},
																		]}
																	/>
																</Col>
																<Col span={12}>
																	<ProFormSwitch
																		name="deepl_prefer_quality_optimized"
																		label={
																			<IconLabel
																				label={
																					<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.deeplPreferQualityOptimized" />
																				}
																				tooltipTitle={
																					<FormattedMessage id="settings.functionSettings.translationSettings.apiConfig.deeplPreferQualityOptimized.tip" />
																				}
																			/>
																		}
																	/>
																</Col>
															</>
														);
													}

													return null;
												}}
											</ProFormDependency>
										</Row>
									</ProFormList>
								</Col>
							</Row>

							<Divider style={{ margin: `${token.margin}px 0` }} />

							{/* 高级参数与排版优化 */}
							<Row gutter={token.marginLG}>
								<Col span={12}>
									<ProFormSwitch
										name="optimizeAiTranslationLayout"
										label={
											<IconLabel
												label={
													<FormattedMessage id="settings.functionSettings.translationSettings.optimizeAiTranslationLayout" />
												}
												tooltipTitle={
													<FormattedMessage id="settings.functionSettings.translationSettings.optimizeAiTranslationLayout.tip" />
												}
											/>
										}
										layout="horizontal"
									/>
								</Col>
							</Row>

							<Row gutter={token.marginLG}>
								<Col span={12}>
									<ProFormDigit
										name="translationMaxTokens"
										label={
											<IconLabel
												label={
													<FormattedMessage id="settings.functionSettings.translationSettings.maxTokens" />
												}
												tooltipTitle={
													<FormattedMessage id="settings.functionSettings.translationSettings.maxTokens.tip" />
												}
											/>
										}
										min={512}
										max={8192}
										fieldProps={{
											precision: 0,
										}}
									/>
								</Col>

								<Col span={12}>
									<ProFormDigit
										name="translationTemperature"
										label={
											<IconLabel
												label={
													<FormattedMessage id="settings.functionSettings.translationSettings.temperature" />
												}
												tooltipTitle={
													<FormattedMessage id="settings.functionSettings.translationSettings.temperature.tip" />
												}
											/>
										}
										min={0}
										max={2}
										fieldProps={{
											precision: 1,
											step: 0.1,
										}}
									/>
								</Col>
							</Row>

							<Row gutter={token.marginLG}>
								<Col span={12}>
									<ProFormDigit
										name="translationTopP"
										label={
											<IconLabel
												label={
													<FormattedMessage id="settings.functionSettings.translationSettings.topP" />
												}
												tooltipTitle={
													<FormattedMessage id="settings.functionSettings.translationSettings.topP.tip" />
												}
											/>
										}
										min={0}
										max={1}
										fieldProps={{
											precision: 2,
											step: 0.05,
										}}
									/>
								</Col>

								<Col span={12}>
									<ProFormDigit
										name="translationTimeoutMs"
										label={
											<IconLabel
												label={
													<FormattedMessage id="settings.functionSettings.translationSettings.timeoutMs" />
												}
												tooltipTitle={
													<FormattedMessage id="settings.functionSettings.translationSettings.timeoutMs.tip" />
												}
											/>
										}
										min={5000}
										max={300000}
										fieldProps={{
											precision: 0,
											addonAfter: "ms",
										}}
									/>
								</Col>
							</Row>

							<Divider style={{ margin: `${token.margin}px 0` }} />

							{/* 提示词工程 */}
							<Row gutter={token.marginLG}>
								<Col span={24}>
									<Alert
										message={
											<Typography>
												<Row gutter={[8, 4]}>
													<Col span={24}>
														<FormattedMessage id="settings.functionSettings.translationSettings.chatPrompt.variables" />
													</Col>
													<Col span={8}>
														<FormattedMessage id="settings.functionSettings.translationSettings.chatPrompt.sourceLanguage" />
														<code>{SOURCE_LANGUAGE_ENV_VARIABLE}</code>
													</Col>
													<Col span={8}>
														<FormattedMessage id="settings.functionSettings.translationSettings.chatPrompt.targetLanguage" />
														<code>{TARGET_LANGUAGE_ENV_VARIABLE}</code>
													</Col>
													<Col span={8}>
														<FormattedMessage id="settings.functionSettings.translationSettings.chatPrompt.translationDomain" />
														<code>{TRANSLATION_DOMAIN_ENV_VARIABLE}</code>
													</Col>
												</Row>
											</Typography>
										}
										type="info"
										style={{ marginBottom: token.margin }}
									/>
									<ProFormTextArea
										label={
											<IconLabel
												label={
													<FormattedMessage id="settings.functionSettings.translationSettings.chatPrompt" />
												}
												tooltipTitle={
													<FormattedMessage id="settings.functionSettings.translationSettings.chatPrompt.tip" />
												}
											/>
										}
										layout="horizontal"
										name="translationSystemPrompt"
										rules={[
											{
												required: true,
												message: intl.formatMessage({
													id: "settings.functionSettings.translationSettings.chatPrompt.required",
												}),
											},
										]}
										fieldProps={{
											autoSize: {
												minRows: 2,
												maxRows: 6,
											},
										}}
									/>
								</Col>
							</Row>
						</ProForm>
					</Spin>
				</SettingsSection>
			)}
		</>
	);
};
