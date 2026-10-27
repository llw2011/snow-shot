import ProForm, { ProFormSwitch } from "@ant-design/pro-form";
import { Spin } from "antd";
import { FormattedMessage } from "react-intl";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import { AppSettingsGroup } from "@/types/appSettings";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

/** Whether outgoing requests honor the system proxy. */
export const NetworkSection = () => {
	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.SystemNetwork,
		{ syncAllWindow: false },
	);

	return (
		<SettingsGroup
			title={<FormattedMessage id="settings.systemSettings.networkSettings" />}
			extra={
				<ResetSettingsButton
					title={
						<FormattedMessage id="settings.systemSettings.networkSettings" />
					}
					appSettingsGroup={AppSettingsGroup.SystemNetwork}
				/>
			}
		>
			<Spin spinning={loading}>
				<ProForm
					form={form}
					submitter={false}
					autoFocusFirstInput={false}
					layout="horizontal"
					onValuesChange={(_, values) => save(values)}
				>
					<ProFormSwitch
						name="enableProxy"
						label={
							<FormattedMessage id="settings.systemSettings.networkSettings.proxy" />
						}
					/>
				</ProForm>
			</Spin>
		</SettingsGroup>
	);
};
