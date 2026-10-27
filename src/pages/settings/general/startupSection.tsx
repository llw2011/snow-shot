import ProForm, { ProFormSwitch } from "@ant-design/pro-form";
import { Button, Spin, Typography } from "antd";
import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { restartWithAdmin } from "@/commands/core";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import { usePlatform } from "@/hooks/usePlatform";
import { AppSettingsGroup } from "@/types/appSettings";
import { isAdminWithCache } from "@/utils/environment";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

const prefix = "settings.systemSettings.commonSettings";

/** Launch at login, update checks, logging and elevated mode. */
export const StartupSection = () => {
	const [currentPlatform] = usePlatform();
	const [isAdmin, setIsAdmin] = useState(false);
	useEffect(() => {
		isAdminWithCache().then(setIsAdmin);
	}, []);

	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.SystemCommon,
		{ syncAllWindow: false },
	);

	return (
		<SettingsGroup
			title={<FormattedMessage id="workbench.group.startup" />}
			extra={
				<ResetSettingsButton
					title={<FormattedMessage id="workbench.group.startup" />}
					appSettingsGroup={AppSettingsGroup.SystemCommon}
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
						name="autoStart"
						label={<FormattedMessage id={`${prefix}.autoStart`} />}
					/>
					<ProFormSwitch
						name="autoCheckVersion"
						label={<FormattedMessage id={`${prefix}.autoCheckVersion`} />}
					/>
					<ProFormSwitch
						name="runLog"
						label={<FormattedMessage id={`${prefix}.runLog`} />}
					/>
					{currentPlatform === "windows" && (
						<ProForm.Item
							label={
								<IconLabel
									label={<FormattedMessage id={`${prefix}.adminPermission`} />}
									tooltipTitle={
										<FormattedMessage id={`${prefix}.adminPermission.tip`} />
									}
								/>
							}
						>
							{isAdmin ? (
								<Typography.Text type="success">
									<FormattedMessage id={`${prefix}.adminPermission.enabled`} />
								</Typography.Text>
							) : (
								<Button onClick={() => restartWithAdmin()}>
									<FormattedMessage
										id={`${prefix}.adminPermission.useAdminRestart`}
									/>
								</Button>
							)}
						</ProForm.Item>
					)}
				</ProForm>
			</Spin>
		</SettingsGroup>
	);
};
