import ProForm, { ProFormDigit } from "@ant-design/pro-form";
import { Spin } from "antd";
import { FormattedMessage } from "react-intl";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import { AppSettingsGroup } from "@/types/appSettings";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

/** Background window preloading. */
export const CoreSection = () => {
	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.SystemCore,
		{ syncAllWindow: false },
	);

	return (
		<SettingsGroup
			title={<FormattedMessage id="settings.systemSettings.coreSettings" />}
			extra={
				<ResetSettingsButton
					title={<FormattedMessage id="settings.systemSettings.coreSettings" />}
					appSettingsGroup={AppSettingsGroup.SystemCore}
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
					<ProFormDigit
						name="hotLoadPageCount"
						label={
							<IconLabel
								label={
									<FormattedMessage id="settings.systemSettings.coreSettings.hotLoadPageCount" />
								}
								tooltipTitle={
									<FormattedMessage id="settings.systemSettings.coreSettings.hotLoadPageCount.tip" />
								}
							/>
						}
						min={0}
						max={3}
						fieldProps={{ precision: 0 }}
					/>
				</ProForm>
			</Spin>
		</SettingsGroup>
	);
};
