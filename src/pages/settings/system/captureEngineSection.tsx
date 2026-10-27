import ProForm, { ProFormSelect, ProFormSwitch } from "@ant-design/pro-form";
import { Spin } from "antd";
import { useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import { PLUGIN_ID_RAPID_OCR } from "@/constants/pluginService";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { usePlatform } from "@/hooks/usePlatform";
import {
	AppSettingsGroup,
	HdrColorAlgorithm,
	HistoryValidDuration,
} from "@/types/appSettings";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

const switchLabel = (id: string, withTip = false) => (
	<IconLabel
		label={<FormattedMessage id={id} />}
		tooltipTitle={withTip ? <FormattedMessage id={`${id}.tip`} /> : undefined}
	/>
);

/** Low-level capture pipeline: displays, color, clipboard and history. */
export const CaptureEngineSection = () => {
	const intl = useIntl();
	const [currentPlatform] = usePlatform();
	const { isReadyStatus } = usePluginServiceContext();
	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.SystemScreenshot,
	);

	const historyValidDurationOptions = useMemo(() => {
		const durations: [string, HistoryValidDuration][] = [
			["day", HistoryValidDuration.Day],
			["three", HistoryValidDuration.Three],
			["week", HistoryValidDuration.Week],
			["month", HistoryValidDuration.Month],
			["forever", HistoryValidDuration.Forever],
		];
		if (process.env.NODE_ENV === "development") {
			durations.push(["test", HistoryValidDuration.Test]);
		}

		return durations.map(([key, value]) => ({
			label: intl.formatMessage({
				id: `settings.systemSettings.screenshotSettings.historyValidDuration.${key}`,
			}),
			value,
		}));
	}, [intl]);

	const prefix = "settings.systemSettings.screenshotSettings";

	return (
		<SettingsGroup
			title={<FormattedMessage id="workbench.group.captureEngine" />}
			extra={
				<ResetSettingsButton
					title={<FormattedMessage id={prefix} />}
					appSettingsGroup={AppSettingsGroup.SystemScreenshot}
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
						name="enableMultipleMonitor"
						label={switchLabel(`${prefix}.enableMultipleMonitor`, true)}
					/>
					{currentPlatform === "windows" && (
						<>
							<ProFormSwitch
								name="correctColorFilter"
								label={switchLabel(`${prefix}.correctColorFilter`, true)}
							/>
							<ProFormSwitch
								name="correctHdrColor"
								label={switchLabel(`${prefix}.enableCorrectHdrColor`, true)}
							/>
							<ProFormSelect
								name="correctHdrColorAlgorithm"
								label={switchLabel(`${prefix}.enableCorrectHdrColor.algorithm`)}
								allowClear={false}
								options={[
									{
										label: intl.formatMessage({
											id: `${prefix}.enableCorrectHdrColor.algorithm.linear`,
										}),
										value: HdrColorAlgorithm.Linear,
									},
								]}
							/>
							<ProFormSwitch
								name="tryWriteBitmapImageToClipboard"
								label={switchLabel(
									`${prefix}.tryWriteBitmapImageToClipboard`,
									true,
								)}
							/>
						</>
					)}
					<ProFormSwitch
						name="recordCaptureHistory"
						label={switchLabel(`${prefix}.recordCaptureHistory`)}
					/>
					<ProFormSelect
						name="historyValidDuration"
						label={switchLabel(`${prefix}.historyValidDuration`)}
						options={historyValidDurationOptions}
						allowClear={false}
					/>
					<ProFormSwitch
						name="historySaveEditResult"
						label={switchLabel(`${prefix}.historySaveEditResult`, true)}
					/>
					{isReadyStatus?.(PLUGIN_ID_RAPID_OCR) && (
						<>
							<ProFormSwitch
								name="ocrHotStart"
								label={switchLabel(`${prefix}.ocrHotStart`, true)}
							/>
							<ProFormSwitch
								name="ocrModelWriteToMemory"
								label={switchLabel(`${prefix}.ocrModelWriteToMemory`, true)}
							/>
							<ProFormSwitch
								name="ocrDetectAngle"
								label={switchLabel(`${prefix}.ocrDetectAngle`)}
							/>
						</>
					)}
				</ProForm>
			</Spin>
		</SettingsGroup>
	);
};
