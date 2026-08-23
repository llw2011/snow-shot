import ProForm, {
	ProFormDigit,
	ProFormSelect,
	ProFormSwitch,
} from "@ant-design/pro-form";
import type { Platform } from "@tauri-apps/plugin-os";
import {
	Col,
	ColorPicker,
	type FormInstance,
	Row,
	type SelectProps,
	Spin,
	theme,
} from "antd";
import type { AggregationColor } from "antd/es/color-picker/color";
import { useContext } from "react";
import { FormattedMessage } from "react-intl";
import { DirectoryInput } from "@/components/directoryInput";
import { SubGroupTitle } from "@/components/groupTitle";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsSection } from "@/components/settingsSection";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import {
	type AppSettingsData,
	AppSettingsGroup,
	KeyDisplayDirection,
} from "@/types/appSettings";

type VideoRecordSettingsSectionProps = {
	form: FormInstance<AppSettingsData[AppSettingsGroup.FunctionVideoRecord]>;
	loading: boolean;
	ffmpegReady: boolean | undefined;
	currentPlatform: Platform | undefined;
	videoMaxSizeOptions: SelectProps["options"];
	gifMaxSizeOptions: SelectProps["options"];
	gifFormatOptions: SelectProps["options"];
	microphoneDeviceNameOptions: SelectProps["options"];
	encoderPresetOptions: SelectProps["options"];
};

const FRAME_RATE_OPTIONS = [10, 15, 24, 30, 60, 120, 83, 42].map((value) => ({
	label: `${value}`,
	value,
}));
const GIF_FRAME_RATE_OPTIONS = FRAME_RATE_OPTIONS.slice(0, 3);

export const VideoRecordSettingsSection = ({
	form,
	loading,
	ffmpegReady,
	currentPlatform,
	videoMaxSizeOptions,
	gifMaxSizeOptions,
	gifFormatOptions,
	microphoneDeviceNameOptions,
	encoderPresetOptions,
}: VideoRecordSettingsSectionProps) => {
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const { token } = theme.useToken();

	return (
		<div hidden={!ffmpegReady}>
			<SettingsSection
				sectionId="videoRecordSettings"
				title={
					<FormattedMessage id="settings.functionSettings.videoRecordSettings" />
				}
				extra={
					<ResetSettingsButton
						title={
							<FormattedMessage id="settings.functionSettings.videoRecordSettings" />
						}
						appSettingsGroup={AppSettingsGroup.FunctionVideoRecord}
					/>
				}
			>
				<Spin spinning={loading}>
					<ProForm
						form={form}
						onValuesChange={(_, values) => {
							if (typeof values.keyDisplayBackgroundColor === "object") {
								values.keyDisplayBackgroundColor = (
									values.keyDisplayBackgroundColor as AggregationColor
								).toRgbString();
							}
							if (typeof values.keyDisplayTextColor === "object") {
								values.keyDisplayTextColor = (
									values.keyDisplayTextColor as AggregationColor
								).toHexString();
							}

							updateAppSettings(
								AppSettingsGroup.FunctionVideoRecord,
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
									name="videoMaxSize"
									layout="horizontal"
									label={
										<FormattedMessage id="settings.functionSettings.videoRecordSettings.videoMaxSize" />
									}
									options={videoMaxSizeOptions}
								/>
							</Col>

							<Col span={12}>
								<ProFormSelect
									name="frameRate"
									layout="horizontal"
									label={
										<FormattedMessage id="settings.functionSettings.videoRecordSettings.frameRate" />
									}
									options={FRAME_RATE_OPTIONS}
								/>
							</Col>
						</Row>

						<Row gutter={token.marginLG}>
							<Col span={12}>
								<ProFormSelect
									name="gifMaxSize"
									layout="horizontal"
									label={
										<FormattedMessage id="settings.functionSettings.videoRecordSettings.gifMaxSize" />
									}
									options={gifMaxSizeOptions}
								/>
							</Col>

							<Col span={12}>
								<ProFormSelect
									name="gifFrameRate"
									layout="horizontal"
									label={
										<FormattedMessage id="settings.functionSettings.videoRecordSettings.gifFrameRate" />
									}
									options={GIF_FRAME_RATE_OPTIONS}
								/>
							</Col>

							<Col span={12}>
								<ProFormSelect
									name="gifFormat"
									layout="horizontal"
									label={
										<FormattedMessage id="settings.functionSettings.videoRecordSettings.gifFormat" />
									}
									options={gifFormatOptions}
								/>
							</Col>
						</Row>
						<Row gutter={token.marginLG}>
							<Col span={12}>
								<ProFormSelect
									name="microphoneDeviceName"
									layout="horizontal"
									label={
										<FormattedMessage id="settings.functionSettings.videoRecordSettings.microphoneDeviceName" />
									}
									options={microphoneDeviceNameOptions}
								/>
							</Col>
						</Row>
						<Row gutter={token.marginLG}>
							<Col span={12}>
								<ProFormSelect
									name="encoder"
									layout="horizontal"
									label={
										<IconLabel
											label={
												<FormattedMessage id="settings.functionSettings.videoRecordSettings.encoder" />
											}
											tooltipTitle={
												<FormattedMessage id="settings.functionSettings.videoRecordSettings.encoder.tip" />
											}
										/>
									}
									options={[
										{
											label: "Libx264 (CPU)",
											value: "libx264",
										},
										{
											label: "Libx265 (CPU)",
											value: "libx265",
										},
										...(currentPlatform === "windows"
											? [
													{
														label: "H264_AMF (AMD)",
														value: "h264_amf",
													},
													{
														label: "H264_NVENC (NVIDIA)",
														value: "h264_nvenc",
													},
												]
											: []),
									]}
								/>
							</Col>

							<Col span={12}>
								<ProFormSelect
									name="encoderPreset"
									layout="horizontal"
									label={
										<IconLabel
											label={
												<FormattedMessage id="settings.functionSettings.videoRecordSettings.encoderPreset" />
											}
											tooltipTitle={
												<FormattedMessage id="settings.functionSettings.videoRecordSettings.encoderPreset.tip" />
											}
										/>
									}
									options={encoderPresetOptions}
								/>
							</Col>

							<Col span={12}>
								<ProFormSwitch
									name="hwaccel"
									layout="horizontal"
									label={
										<FormattedMessage id="settings.functionSettings.videoRecordSettings.hwaccel" />
									}
								/>
							</Col>
						</Row>
						<Row gutter={token.marginLG}>
							<Col span={24}>
								<ProForm.Item
									name="saveDirectory"
									label={
										<IconLabel
											label={
												<FormattedMessage id="settings.functionSettings.videoRecordSettings.saveDirectory" />
											}
										/>
									}
									required={false}
								>
									<DirectoryInput />
								</ProForm.Item>
							</Col>
						</Row>

						<Row gutter={token.marginLG}>
							<Col span={12}>
								<ProFormSwitch
									name="enableExcludeFromCapture"
									layout="horizontal"
									label={
										<FormattedMessage id="settings.functionSettings.videoRecordSettings.enableExcludeFromCapture" />
									}
								/>
							</Col>
						</Row>

						<SubGroupTitle>
							<FormattedMessage id="settings.functionSettings.videoRecordSettings.keyDisplaySettings" />
						</SubGroupTitle>

						<Row gutter={token.marginLG} style={{ width: "100%" }}>
							<Col span={12} style={{ width: "100%" }}>
								<ProFormDigit
									name="keyDisplayFontSize"
									layout="horizontal"
									label={
										<FormattedMessage id="settings.functionSettings.videoRecordSettings.keyDisplayFontSize" />
									}
									style={{ width: "100%" }}
									min={8}
									max={64}
									fieldProps={{
										precision: 0,
									}}
								/>
							</Col>

							<Col span={12} style={{ width: "100%" }}>
								<ProFormDigit
									name="keyDisplayDuration"
									layout="horizontal"
									label={
										<FormattedMessage id="settings.functionSettings.videoRecordSettings.keyDisplayDuration" />
									}
									min={100}
									max={10000}
									style={{ width: "100%" }}
									fieldProps={{
										precision: 0,
										addonAfter: "ms",
									}}
								/>
							</Col>
						</Row>

						<Row gutter={token.marginLG}>
							<Col span={12}>
								<ProFormDigit
									name="keyDisplayMergeDuration"
									layout="horizontal"
									label={
										<FormattedMessage id="settings.functionSettings.videoRecordSettings.keyDisplayMergeDuration" />
									}
									min={0}
									max={2000}
									fieldProps={{
										precision: 0,
										addonAfter: "ms",
									}}
								/>
							</Col>
							<Col span={12}>
								<ProFormSelect
									name="keyDisplayDirection"
									layout="horizontal"
									label={
										<FormattedMessage id="settings.functionSettings.videoRecordSettings.keyDisplayDirection" />
									}
									options={[
										{
											label: (
												<FormattedMessage id="settings.functionSettings.videoRecordSettings.keyDisplayDirection.horizontal" />
											),
											value: KeyDisplayDirection.Horizontal,
										},
										{
											label: (
												<FormattedMessage id="settings.functionSettings.videoRecordSettings.keyDisplayDirection.vertical" />
											),
											value: KeyDisplayDirection.Vertical,
										},
									]}
								/>
							</Col>
							<Col span={12}>
								<ProForm.Item
									name="keyDisplayBackgroundColor"
									label={
										<FormattedMessage id="settings.functionSettings.videoRecordSettings.keyDisplayBackgroundColor" />
									}
									required={false}
								>
									<ColorPicker showText placement="bottom" />
								</ProForm.Item>
							</Col>

							<Col span={12}>
								<ProForm.Item
									name="keyDisplayTextColor"
									label={
										<FormattedMessage id="settings.functionSettings.videoRecordSettings.keyDisplayTextColor" />
									}
									required={false}
								>
									<ColorPicker showText placement="bottom" />
								</ProForm.Item>
							</Col>
						</Row>
					</ProForm>
				</Spin>
			</SettingsSection>
		</div>
	);
};
