"use client";

import ProForm, {
	ProFormDependency,
	ProFormList,
	ProFormSwitch,
	ProFormText,
} from "@ant-design/pro-form";
import { Col, Flex, Form, Row, Spin, Switch, theme } from "antd";
import { useCallback, useContext, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsSection } from "@/components/settingsSection";
import {
	PLUGIN_ID_AI_CHAT,
	PLUGIN_ID_TRANSLATE,
} from "@/constants/pluginService";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import type { AppSettingsData } from "@/types/appSettings";
import { AppSettingsGroup } from "@/types/appSettings";
import { ModelProbeInput } from "./modelProbeInput";
import { TestChat } from "./testChat";

export const ChatSettingsSection = () => {
	const intl = useIntl();
	const { token } = theme.useToken();
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const { isReadyStatus } = usePluginServiceContext();
	const [functionForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.FunctionChat]>();
	const [appSettingsLoading, setAppSettingsLoading] = useState(true);

	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData, preSettings?: AppSettingsData) => {
				setAppSettingsLoading(false);

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.FunctionChat] !==
						settings[AppSettingsGroup.FunctionChat]
				) {
					functionForm.setFieldsValue(settings[AppSettingsGroup.FunctionChat]);
				}
			},
			[functionForm],
		),
		true,
	);

	return (
		<>
			{(isReadyStatus?.(PLUGIN_ID_TRANSLATE) ||
				isReadyStatus?.(PLUGIN_ID_AI_CHAT)) && (
				<SettingsSection
					sectionId="chatSettings"
					title={
						<FormattedMessage id="settings.functionSettings.chatSettings" />
					}
					extra={
						<ResetSettingsButton
							title={
								<FormattedMessage id="settings.functionSettings.chatSettings" />
							}
							appSettingsGroup={AppSettingsGroup.FunctionChat}
						/>
					}
				>
					<Spin spinning={appSettingsLoading}>
						<ProForm
							form={functionForm}
							onValuesChange={(_, values) => {
								updateAppSettings(
									AppSettingsGroup.FunctionChat,
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
							{isReadyStatus?.(PLUGIN_ID_AI_CHAT) && (
								<Row gutter={token.marginLG}>
									<Col span={12}>
										<ProForm.Item
											label={
												<IconLabel
													label={
														<FormattedMessage id="settings.functionSettings.chatSettings.autoCreateNewSession" />
													}
												/>
											}
											layout="horizontal"
											name="autoCreateNewSession"
											valuePropName="checked"
										>
											<Switch />
										</ProForm.Item>
									</Col>

									<Col span={12}>
										<ProForm.Item
											label={
												<IconLabel
													label={
														<FormattedMessage id="settings.functionSettings.chatSettings.autoCreateNewSessionOnCloseWindow" />
													}
												/>
											}
											layout="horizontal"
											name="autoCreateNewSessionOnCloseWindow"
											valuePropName="checked"
										>
											<Switch />
										</ProForm.Item>
									</Col>
								</Row>
							)}

							<Row gutter={token.marginLG}>
								<Col span={24}>
									<ProFormList
										name="chatApiConfigList"
										label={
											<IconLabel
												label={
													<FormattedMessage id="settings.functionSettings.chatSettings.apiConfig" />
												}
												tooltipTitle={
													<FormattedMessage id="settings.functionSettings.chatSettings.apiConfig.tip" />
												}
											/>
										}
										creatorButtonProps={{
											creatorButtonText: intl.formatMessage({
												id: "settings.functionSettings.chatSettings.apiConfig.add",
											}),
										}}
										actionRender={(...params) => {
											const [field, , defaultActionDom] = params;
											return [
												defaultActionDom,
												<TestChat
													key="test-chat"
													config={
														functionForm.getFieldValue("chatApiConfigList")[
															field.name
														]
													}
												/>,
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
										})}
									>
										<Row gutter={token.marginLG} style={{ width: "100%" }}>
											<Col span={12}>
												<ProFormText
													name="model_name"
													label={
														<IconLabel
															label={
																<FormattedMessage id="settings.functionSettings.chatSettings.apiConfig.modelName" />
															}
															tooltipTitle={
																<FormattedMessage id="settings.functionSettings.chatSettings.apiConfig.modelName.tip" />
															}
														/>
													}
													rules={[
														{
															required: true,
															message: intl.formatMessage({
																id: "settings.functionSettings.chatSettings.apiConfig.modelName.required",
															}),
														},
													]}
												/>
											</Col>
										</Row>
										<Row gutter={token.marginLG}>
											<Col span={12}>
												<ProFormText
													name="api_uri"
													label={
														<IconLabel
															label={
																<FormattedMessage id="settings.functionSettings.chatSettings.apiConfig.apiUri" />
															}
															tooltipTitle={
																<FormattedMessage id="settings.functionSettings.chatSettings.apiConfig.apiUri.tip" />
															}
														/>
													}
													rules={[
														{
															required: true,
															message: intl.formatMessage({
																id: "settings.functionSettings.chatSettings.apiConfig.apiUri.required",
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
																<FormattedMessage id="settings.functionSettings.chatSettings.apiConfig.apiKey" />
															}
															tooltipTitle={
																<FormattedMessage id="settings.functionSettings.chatSettings.apiConfig.apiKey.tip" />
															}
														/>
													}
													rules={[
														{
															required: true,
															message: intl.formatMessage({
																id: "settings.functionSettings.chatSettings.apiConfig.apiKey.required",
															}),
														},
													]}
												/>
											</Col>
											<ProFormDependency<{
												api_uri?: string;
												api_key?: string;
											}>
												name={["api_uri", "api_key"]}
											>
												{({ api_uri, api_key }) => (
													<Col span={12}>
														<ModelProbeInput
															name="api_model"
															label={
																<FormattedMessage id="settings.functionSettings.chatSettings.apiConfig.apiModel" />
															}
															tooltipTitle={
																<FormattedMessage id="settings.functionSettings.chatSettings.apiConfig.apiModel.tip" />
															}
															apiUri={api_uri}
															apiKey={api_key}
															required
														/>
													</Col>
												)}
											</ProFormDependency>
										</Row>
										<Row gutter={token.marginLG}>
											<Col span={12}>
												<ProFormSwitch
													name="support_thinking"
													label={
														<IconLabel
															label={
																<FormattedMessage id="settings.functionSettings.chatSettings.apiConfig.supportThinking" />
															}
														/>
													}
												/>
											</Col>
											{isReadyStatus?.(PLUGIN_ID_AI_CHAT) && (
												<Col span={12}>
													<ProFormSwitch
														name="support_vision"
														label={
															<IconLabel
																label={
																	<FormattedMessage id="settings.functionSettings.chatSettings.apiConfig.supportVision" />
																}
																tooltipTitle={
																	<FormattedMessage id="settings.functionSettings.chatSettings.apiConfig.supportVision.tip" />
																}
															/>
														}
													/>
												</Col>
											)}
										</Row>
									</ProFormList>
								</Col>
							</Row>
						</ProForm>
					</Spin>
				</SettingsSection>
			)}
		</>
	);
};
