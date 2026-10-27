import ProForm, { ProFormSwitch } from "@ant-design/pro-form";
import { Spin } from "antd";
import { FormattedMessage } from "react-intl";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import { AppSettingsGroup } from "@/types/appSettings";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

/** When global shortcuts are suspended. */
export const ShortcutPolicySection = () => {
	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.FunctionGlobalShortcut,
		{ syncAllWindow: false },
	);

	return (
		<SettingsGroup
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
					submitter={false}
					autoFocusFirstInput={false}
					layout="horizontal"
					onValuesChange={(_, values) => save(values)}
				>
					<ProFormSwitch
						name="disableOnFocusedFullScreenWindow"
						label={
							<FormattedMessage id="settings.functionSettings.globalShortcutSettings.disableOnFocusedFullScreenWindow" />
						}
					/>
				</ProForm>
			</Spin>
		</SettingsGroup>
	);
};
