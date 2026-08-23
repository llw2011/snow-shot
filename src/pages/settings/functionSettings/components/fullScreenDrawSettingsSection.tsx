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

type FullScreenDrawSettingsSectionProps = {
	form: FormInstance<AppSettingsData[AppSettingsGroup.FunctionFullScreenDraw]>;
	loading: boolean;
	defaultToolOptions: SelectProps["options"];
};

export const FullScreenDrawSettingsSection = ({
	form,
	loading,
	defaultToolOptions,
}: FullScreenDrawSettingsSectionProps) => {
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const { token } = theme.useToken();

	return (
		<SettingsSection
			sectionId="fullScreenDrawSettings"
			title={
				<FormattedMessage id="settings.functionSettings.fullScreenDrawSettings" />
			}
			extra={
				<ResetSettingsButton
					title={
						<FormattedMessage id="settings.functionSettings.fullScreenDrawSettings" />
					}
					appSettingsGroup={AppSettingsGroup.FunctionFullScreenDraw}
				/>
			}
		>
			<Spin spinning={loading}>
				<ProForm
					form={form}
					onValuesChange={(_, values) => {
						updateAppSettings(
							AppSettingsGroup.FunctionFullScreenDraw,
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
							<ProFormSelect
								name="defaultTool"
								layout="horizontal"
								label={
									<FormattedMessage id="settings.functionSettings.fullScreenDrawSettings.defaultTool" />
								}
								options={defaultToolOptions}
							/>
						</Col>
					</Row>
				</ProForm>
			</Spin>
		</SettingsSection>
	);
};
