import ProForm, { ProFormSelect } from "@ant-design/pro-form";
import { Spin } from "antd";
import { useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import { AppSettingsGroup } from "@/types/appSettings";
import { DrawState } from "@/types/draw";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

/** Defaults of the full-screen presentation canvas. */
export const FullScreenDrawSection = () => {
	const intl = useIntl();
	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.FunctionFullScreenDraw,
	);

	const defaultToolOptions = useMemo(
		() =>
			(
				[
					["draw.selectTool", DrawState.Select],
					["draw.penTool", DrawState.Pen],
					["draw.laserPointerTool", DrawState.LaserPointer],
				] as const
			).map(([id, value]) => ({ label: intl.formatMessage({ id }), value })),
		[intl],
	);

	return (
		<SettingsGroup
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
					submitter={false}
					autoFocusFirstInput={false}
					layout="horizontal"
					onValuesChange={(_, values) => save(values)}
				>
					<ProFormSelect
						name="defaultTool"
						label={
							<FormattedMessage id="settings.functionSettings.fullScreenDrawSettings.defaultTool" />
						}
						options={defaultToolOptions}
						allowClear={false}
					/>
				</ProForm>
			</Spin>
		</SettingsGroup>
	);
};
