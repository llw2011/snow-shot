import ProForm, { ProFormSlider, ProFormSwitch } from "@ant-design/pro-form";
import { Spin } from "antd";
import { FormattedMessage } from "react-intl";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import { AppSettingsGroup } from "@/types/appSettings";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

const SLIDERS = [
	{ name: "imageFeatureThreshold", min: 0, max: 255, step: 1 },
	{ name: "sampleRate", min: 0, max: 1, step: 0.1 },
	{ name: "minSide", min: 64, max: 1024, step: 1 },
	{ name: "maxSide", min: 64, max: 1024, step: 1 },
	{ name: "imageFeatureDescriptionLength", min: 8, max: 128, step: 1 },
] as const;

/** Stitching parameters used by the scrolling screenshot tool. */
export const ScrollScreenshotSection = () => {
	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.SystemScrollScreenshot,
	);

	return (
		<SettingsGroup
			title={
				<FormattedMessage id="settings.systemSettings.scrollScreenshotSettings" />
			}
			extra={
				<ResetSettingsButton
					title={
						<FormattedMessage id="settings.systemSettings.scrollScreenshotSettings" />
					}
					appSettingsGroup={AppSettingsGroup.SystemScrollScreenshot}
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
						name="tryRollback"
						label={
							<IconLabel
								label={
									<FormattedMessage id="settings.systemSettings.scrollScreenshotSettings.tryRollback" />
								}
								tooltipTitle={
									<FormattedMessage id="settings.systemSettings.scrollScreenshotSettings.tryRollback.tip" />
								}
							/>
						}
					/>
					{SLIDERS.map(({ name, min, max, step }) => (
						<ProFormSlider
							key={name}
							name={name}
							label={
								<IconLabel
									label={
										<FormattedMessage
											id={`settings.systemSettings.scrollScreenshotSettings.${name}`}
										/>
									}
									tooltipTitle={
										<FormattedMessage
											id={`settings.systemSettings.scrollScreenshotSettings.${name}.tip`}
										/>
									}
								/>
							}
							min={min}
							max={max}
							step={step}
							marks={{ [min]: `${min}`, [max]: `${max}` }}
						/>
					))}
				</ProForm>
			</Spin>
		</SettingsGroup>
	);
};
