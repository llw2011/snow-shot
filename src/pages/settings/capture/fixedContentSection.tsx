import ProForm, { ProFormSelect, ProFormSwitch } from "@ant-design/pro-form";
import { ColorPicker, Spin } from "antd";
import type { AggregationColor } from "antd/es/color-picker/color";
import { useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import {
	AppSettingsFixedContentInitialPosition,
	AppSettingsGroup,
} from "@/types/appSettings";
import { useOcrReady } from "../shared/hooks";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

/** Behavior and frame of images or text pinned on top of the desktop. */
export const FixedContentSection = () => {
	const intl = useIntl();
	const ocrReady = useOcrReady();
	const behavior = useSettingsGroupForm(AppSettingsGroup.FunctionFixedContent);
	const frame = useSettingsGroupForm(AppSettingsGroup.FixedContent);

	const initialPositionOptions = useMemo(
		() => [
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.fixedContentSettings.initialPosition.monitorCenter",
				}),
				value: AppSettingsFixedContentInitialPosition.MonitorCenter,
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.fixedContentSettings.initialPosition.mousePosition",
				}),
				value: AppSettingsFixedContentInitialPosition.MousePosition,
			},
		],
		[intl],
	);

	return (
		<SettingsGroup
			title={
				<FormattedMessage id="settings.functionSettings.fixedContentSettings" />
			}
			extra={
				<ResetSettingsButton
					title={
						<FormattedMessage id="settings.functionSettings.fixedContentSettings" />
					}
					appSettingsGroup={AppSettingsGroup.FunctionFixedContent}
				/>
			}
		>
			<Spin spinning={behavior.loading || frame.loading}>
				<ProForm
					form={behavior.form}
					submitter={false}
					autoFocusFirstInput={false}
					layout="horizontal"
					onValuesChange={(_, values) => behavior.save(values)}
				>
					<ProFormSelect
						name="initialPosition"
						label={
							<FormattedMessage id="settings.functionSettings.fixedContentSettings.initialPosition" />
						}
						options={initialPositionOptions}
						allowClear={false}
					/>
					<ProFormSwitch
						name="zoomWithMouse"
						label={
							<FormattedMessage id="settings.functionSettings.fixedContentSettings.zoomWithMouse" />
						}
					/>
					<ProFormSwitch
						name="autoResizeWindow"
						label={
							<IconLabel
								label={
									<FormattedMessage id="settings.functionSettings.fixedContentSettings.autoResizeWindow" />
								}
								tooltipTitle={
									<FormattedMessage id="settings.functionSettings.fixedContentSettings.autoResizeWindow.tip" />
								}
							/>
						}
					/>
					<ProFormSwitch
						name="autoCopyToClipboard"
						label={
							<FormattedMessage id="settings.functionSettings.fixedContentSettings.autoCopyToClipboard" />
						}
					/>
					{ocrReady && (
						<ProFormSwitch
							name="autoOcr"
							label={
								<FormattedMessage id="settings.functionSettings.fixedContentSettings.autoOcr" />
							}
						/>
					)}
				</ProForm>
				<ProForm
					form={frame.form}
					submitter={false}
					autoFocusFirstInput={false}
					layout="horizontal"
					onValuesChange={(_, values) => {
						if (typeof values.borderColor === "object") {
							values.borderColor = (
								values.borderColor as unknown as AggregationColor
							).toHexString();
						}
						frame.save(values);
					}}
				>
					<ProForm.Item
						name="borderColor"
						label={
							<FormattedMessage id="settings.fixedContentSettings.borderColor" />
						}
						required={false}
					>
						<ColorPicker showText placement="bottomRight" />
					</ProForm.Item>
				</ProForm>
			</Spin>
		</SettingsGroup>
	);
};
