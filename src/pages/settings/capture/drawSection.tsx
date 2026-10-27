import ProForm, { ProFormSelect, ProFormSwitch } from "@ant-design/pro-form";
import { Spin } from "antd";
import { useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import { AppSettingsGroup } from "@/types/appSettings";
import { DrawState } from "@/types/draw";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

/** Annotation tools shared by the screenshot and pinned-image editors. */
export const DrawSection = () => {
	const intl = useIntl();
	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.FunctionDraw,
	);

	const quickSelectToolOptions = useMemo(
		() =>
			(
				[
					["draw.rectTool", DrawState.Rect],
					["draw.diamondTool", DrawState.Diamond],
					["draw.ellipseTool", DrawState.Ellipse],
					["draw.arrowTool", DrawState.Arrow],
					["draw.lineTool", DrawState.Line],
					["draw.penTool", DrawState.Pen],
					["draw.serialNumberTool", DrawState.SerialNumber],
					["draw.blurTool", DrawState.Blur],
				] as const
			).map(([id, value]) => ({ label: intl.formatMessage({ id }), value })),
		[intl],
	);

	return (
		<SettingsGroup
			title={<FormattedMessage id="settings.commonSettings.draw" />}
			extra={
				<ResetSettingsButton
					title={intl.formatMessage({ id: "settings.commonSettings.draw" })}
					appSettingsGroup={AppSettingsGroup.FunctionDraw}
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
						name="lockDrawTool"
						label={
							<FormattedMessage id="settings.functionSettings.screenshotSettings.lockDrawTool" />
						}
					/>
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
						options={quickSelectToolOptions}
					/>
				</ProForm>
			</Spin>
		</SettingsGroup>
	);
};
