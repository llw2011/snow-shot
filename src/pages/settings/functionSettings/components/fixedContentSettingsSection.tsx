import ProForm, { ProFormSelect, ProFormSwitch } from "@ant-design/pro-form";
import {
	Col,
	type FormInstance,
	Row,
	type SelectProps,
	Spin,
	theme,
} from "antd";
import { useContext } from "react";
import { FormattedMessage } from "react-intl";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsSection } from "@/components/settingsSection";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import type { AppSettingsData } from "@/types/appSettings";
import { AppSettingsGroup } from "@/types/appSettings";

type FixedContentSettingsSectionProps = {
	form: FormInstance<AppSettingsData[AppSettingsGroup.FunctionFixedContent]>;
	loading: boolean;
	ocrReady: boolean;
	initialPositionOptions: SelectProps["options"];
};

export const FixedContentSettingsSection = ({
	form,
	loading,
	ocrReady,
	initialPositionOptions,
}: FixedContentSettingsSectionProps) => {
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const { token } = theme.useToken();

	return (
		<SettingsSection
			sectionId="fixedContentSettings"
			title={
				<FormattedMessage id="settings.functionSettings.fixedContentSettings" />
			}
			extra={
				<ResetSettingsButton
					title={
						<FormattedMessage id="settings.functionSettings.fixedContentSettings" />
					}
					appSettingsGroup={AppSettingsGroup.FunctionFixedContent}
				/>
			}
		>
			<Spin spinning={loading}>
				<ProForm
					form={form}
					onValuesChange={(_, values) => {
						updateAppSettings(
							AppSettingsGroup.FunctionFixedContent,
							values,
							true,
							true,
							true,
							true,
							false,
						);
					}}
					submitter={false}
					layout="horizontal"
				>
					<Row gutter={token.marginLG}>
						<Col span={12}>
							<ProFormSwitch
								name="zoomWithMouse"
								layout="horizontal"
								label={
									<FormattedMessage id="settings.functionSettings.fixedContentSettings.zoomWithMouse" />
								}
							/>
						</Col>

						<Col span={12}>
							<ProFormSelect
								name="initialPosition"
								layout="horizontal"
								label={
									<FormattedMessage id="settings.functionSettings.fixedContentSettings.initialPosition" />
								}
								options={initialPositionOptions}
							/>
						</Col>

						{ocrReady && (
							<Col span={12}>
								<ProFormSwitch
									label={
										<FormattedMessage id="settings.functionSettings.fixedContentSettings.autoOcr" />
									}
									name="autoOcr"
									layout="horizontal"
								/>
							</Col>
						)}

						<Col span={12}>
							<ProFormSwitch
								name="autoResizeWindow"
								layout="horizontal"
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.functionSettings.fixedContentSettings.autoResizeWindow" />
										}
										tooltipTitle={
											<FormattedMessage id="settings.functionSettings.fixedContentSettings.autoResizeWindow.tip" />
										}
									/>
								}
							/>
						</Col>

						<Col span={12}>
							<ProFormSwitch
								label={
									<FormattedMessage id="settings.functionSettings.fixedContentSettings.autoCopyToClipboard" />
								}
								name="autoCopyToClipboard"
								layout="horizontal"
							/>
						</Col>
					</Row>
				</ProForm>
			</Spin>
		</SettingsSection>
	);
};
