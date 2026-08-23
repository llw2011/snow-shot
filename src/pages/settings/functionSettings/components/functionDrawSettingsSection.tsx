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
import { FormattedMessage, useIntl } from "react-intl";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsSection } from "@/components/settingsSection";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import type { AppSettingsData } from "@/types/appSettings";
import { AppSettingsGroup } from "@/types/appSettings";

type FunctionDrawSettingsSectionProps = {
	form: FormInstance<AppSettingsData[AppSettingsGroup.FunctionDraw]>;
	loading: boolean;
	disableQuickSelectElementToolListOptions: SelectProps["options"];
};

export const FunctionDrawSettingsSection = ({
	form,
	loading,
	disableQuickSelectElementToolListOptions,
}: FunctionDrawSettingsSectionProps) => {
	const intl = useIntl();
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const { token } = theme.useToken();

	return (
		<SettingsSection
			sectionId="functionDrawSettings"
			title={<FormattedMessage id="settings.commonSettings.draw" />}
			extra={
				<ResetSettingsButton
					title={intl.formatMessage({ id: "settings.commonSettings.draw" })}
					appSettingsGroup={AppSettingsGroup.FunctionDraw}
				/>
			}
		>
			<ProForm<AppSettingsData[AppSettingsGroup.FunctionDraw]>
				className="settings-form common-draw-settings-form"
				form={form}
				submitter={false}
				onValuesChange={(_, values) => {
					updateAppSettings(
						AppSettingsGroup.FunctionDraw,
						values,
						true,
						true,
						true,
						true,
						false,
					);
				}}
				layout="horizontal"
			>
				<Spin spinning={loading}>
					<Row gutter={token.marginLG}>
						<Col span={12}>
							<ProFormSwitch
								name="lockDrawTool"
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.functionSettings.screenshotSettings.lockDrawTool" />
										}
									/>
								}
							/>
						</Col>

						<Col span={12}>
							<ProFormSwitch
								name="enableSliderChangeWidth"
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.commonSettings.draw.enableSliderChangeWidth" />
										}
										tooltipTitle={
											<FormattedMessage id="settings.commonSettings.draw.enableSliderChangeWidth.tip" />
										}
									/>
								}
							/>
						</Col>

						<Col span={12}>
							<ProFormSwitch
								name="toolIndependentStyle"
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.commonSettings.draw.toolIndependentStyle" />
										}
										tooltipTitle={
											<FormattedMessage id="settings.commonSettings.draw.toolIndependentStyle.tip" />
										}
									/>
								}
							/>
						</Col>
					</Row>

					<Row gutter={token.marginLG}>
						<Col span={24}>
							<ProFormSelect
								name="disableQuickSelectElementToolList"
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.functionSettings.drawSettings.disableQuickSelectElementToolList" />
										}
										tooltipTitle={
											<FormattedMessage id="settings.functionSettings.drawSettings.disableQuickSelectElementToolList.tip" />
										}
									/>
								}
								mode="multiple"
								options={disableQuickSelectElementToolListOptions}
							/>
						</Col>
					</Row>
				</Spin>
			</ProForm>
		</SettingsSection>
	);
};
