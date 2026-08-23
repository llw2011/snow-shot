import ProForm, { ProFormSwitch } from "@ant-design/pro-form";
import { Col, type FormInstance, Row, Spin, theme } from "antd";
import { useContext } from "react";
import { FormattedMessage } from "react-intl";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsSection } from "@/components/settingsSection";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import type { AppSettingsData } from "@/types/appSettings";
import { AppSettingsGroup } from "@/types/appSettings";

type GlobalShortcutSettingsSectionProps = {
	form: FormInstance<AppSettingsData[AppSettingsGroup.FunctionGlobalShortcut]>;
	loading: boolean;
};

export const GlobalShortcutSettingsSection = ({
	form,
	loading,
}: GlobalShortcutSettingsSectionProps) => {
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const { token } = theme.useToken();

	return (
		<SettingsSection
			sectionId="globalShortcutSettings"
			title={
				<FormattedMessage id="settings.functionSettings.globalShortcutSettings" />
			}
			extra={
				<ResetSettingsButton
					title={
						<FormattedMessage id="settings.functionSettings.globalShortcutSettings" />
					}
					appSettingsGroup={AppSettingsGroup.FunctionGlobalShortcut}
				/>
			}
		>
			<Spin spinning={loading}>
				<ProForm
					form={form}
					onValuesChange={(_, values) => {
						updateAppSettings(
							AppSettingsGroup.FunctionGlobalShortcut,
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
							<ProFormSwitch
								name="disableOnFocusedFullScreenWindow"
								layout="horizontal"
								label={
									<FormattedMessage id="settings.functionSettings.globalShortcutSettings.disableOnFocusedFullScreenWindow" />
								}
							/>
						</Col>
					</Row>
				</ProForm>
			</Spin>
		</SettingsSection>
	);
};
