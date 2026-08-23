import ProForm, { ProFormSelect } from "@ant-design/pro-form";
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
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsSection } from "@/components/settingsSection";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import type { AppSettingsData } from "@/types/appSettings";
import { AppSettingsGroup } from "@/types/appSettings";

type TrayIconSettingsSectionProps = {
	form: FormInstance<AppSettingsData[AppSettingsGroup.FunctionTrayIcon]>;
	loading: boolean;
	iconClickActionOptions: SelectProps["options"];
};

export const TrayIconSettingsSection = ({
	form,
	loading,
	iconClickActionOptions,
}: TrayIconSettingsSectionProps) => {
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const { token } = theme.useToken();

	return (
		<SettingsSection
			sectionId="trayIconSettings"
			title={
				<FormattedMessage id="settings.functionSettings.trayIconSettings" />
			}
			extra={
				<ResetSettingsButton
					title={
						<FormattedMessage id="settings.functionSettings.trayIconSettings" />
					}
					appSettingsGroup={AppSettingsGroup.FunctionTrayIcon}
				/>
			}
		>
			<Spin spinning={loading}>
				<ProForm
					form={form}
					onValuesChange={(_, values) => {
						updateAppSettings(
							AppSettingsGroup.FunctionTrayIcon,
							values,
							true,
							true,
							false,
							true,
							false,
						);
					}}
					submitter={false}
					layout="horizontal"
				>
					<Row gutter={token.marginLG}>
						<Col span={12}>
							<ProFormSelect
								name="iconClickAction"
								label={
									<FormattedMessage id="settings.functionSettings.trayIconSettings.iconClickAction" />
								}
								options={iconClickActionOptions}
							/>
						</Col>
					</Row>
				</ProForm>
			</Spin>
		</SettingsSection>
	);
};
