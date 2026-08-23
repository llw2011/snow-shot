import ProForm, { ProFormSelect, ProFormSwitch } from "@ant-design/pro-form";
import type { Platform } from "@tauri-apps/plugin-os";
import {
	Col,
	type FormInstance,
	Row,
	Select,
	type SelectProps,
	Spin,
	theme,
} from "antd";
import { useContext } from "react";
import { FormattedMessage } from "react-intl";
import { DirectoryInput } from "@/components/directoryInput";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsSection } from "@/components/settingsSection";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import type { AppSettingsData } from "@/types/appSettings";
import { AppSettingsGroup } from "@/types/appSettings";
import { ImageFormat } from "@/types/utils/file";

type ScreenshotSettingsSectionProps = {
	form: FormInstance<AppSettingsData[AppSettingsGroup.FunctionScreenshot]>;
	loading: boolean;
	currentPlatform: Platform | undefined;
	ocrReady: boolean;
	ocrAfterActionOptions: SelectProps["options"];
	doubleClickActionOptions: SelectProps["options"];
};

export const ScreenshotSettingsSection = ({
	form,
	loading,
	currentPlatform,
	ocrReady,
	ocrAfterActionOptions,
	doubleClickActionOptions,
}: ScreenshotSettingsSectionProps) => {
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const { token } = theme.useToken();

	return (
		<SettingsSection
			sectionId="screenshotSettings"
			title={
				<FormattedMessage id="settings.functionSettings.screenshotSettings" />
			}
			extra={
				<ResetSettingsButton
					title={
						<FormattedMessage id="settings.functionSettings.screenshotSettings" />
					}
					appSettingsGroup={AppSettingsGroup.FunctionScreenshot}
				/>
			}
			defaultOpen
		>
			<Spin spinning={loading}>
				<ProForm
					form={form}
					onValuesChange={(_, values) => {
						updateAppSettings(
							AppSettingsGroup.FunctionScreenshot,
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
						{currentPlatform !== "macos" && (
							<Col span={12}>
								<ProFormSwitch
									name="findChildrenElements"
									layout="horizontal"
									label={
										<FormattedMessage id="settings.functionSettings.screenshotSettings.findChildrenElements" />
									}
								/>
							</Col>
						)}

						<Col span={12}>
							<ProFormSwitch
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.functionSettings.screenshotSettings.shortcutCanleTip" />
										}
										tooltipTitle={
											<FormattedMessage id="settings.functionSettings.screenshotSettings.shortcutCanleTip.tip" />
										}
									/>
								}
								name="shortcutCanleTip"
								layout="horizontal"
							/>
						</Col>
					</Row>

					{ocrReady && (
						<Row gutter={token.marginLG}>
							<Col span={12}>
								<ProFormSelect
									name="ocrAfterAction"
									layout="horizontal"
									label={
										<FormattedMessage id="settings.functionSettings.screenshotSettings.ocrAfterAction" />
									}
									options={ocrAfterActionOptions}
								/>
							</Col>

							<Col span={12}>
								<ProFormSwitch
									name="ocrCopyText"
									layout="horizontal"
									label={
										<FormattedMessage id="settings.functionSettings.screenshotSettings.ocrCopyText" />
									}
								/>
							</Col>
						</Row>
					)}

					<Row gutter={token.marginLG}>
						<Col span={12}>
							<ProFormSelect
								name="doubleClickAction"
								layout="horizontal"
								label={
									<IconLabel
										label={<FormattedMessage id="draw.doubleClickAction" />}
									/>
								}
								options={doubleClickActionOptions}
							/>
						</Col>
					</Row>

					<Row gutter={token.marginLG}>
						<Col span={12}>
							<ProFormSwitch
								name="focusedWindowCopyToClipboard"
								layout="horizontal"
								label={
									<FormattedMessage id="settings.functionSettings.screenshotSettings.focusedWindowCopyToClipboard" />
								}
							/>
						</Col>

						<Col span={12}>
							<ProFormSwitch
								name="fullScreenCopyToClipboard"
								layout="horizontal"
								label={
									<FormattedMessage id="settings.functionSettings.screenshotSettings.fullScreenCopyToClipboard" />
								}
							/>
						</Col>
					</Row>

					<Row gutter={token.marginLG}>
						<Col span={12}>
							<ProFormSwitch
								name="copyImageFileToClipboard"
								layout="horizontal"
								label={
									<IconLabel
										label={
											<FormattedMessage id="draw.copyImageFileToClipboard" />
										}
										tooltipTitle={
											<FormattedMessage id="draw.copyImageFileToClipboard.tip" />
										}
									/>
								}
							/>
						</Col>

						<Col span={12}>
							<ProFormSwitch
								name="autoSaveOnCopy"
								layout="horizontal"
								label={
									<FormattedMessage id="settings.functionSettings.screenshotSettings.autoSaveFileMode.autoSave" />
								}
							/>
						</Col>

						<Col span={12}>
							<ProFormSwitch
								name="fastSave"
								layout="horizontal"
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.functionSettings.screenshotSettings.autoSaveFileMode.fastSave" />
										}
										tooltipTitle={
											<FormattedMessage id="settings.functionSettings.screenshotSettings.autoSaveFileMode.fastSave.tip" />
										}
									/>
								}
							/>
						</Col>
					</Row>

					<Row gutter={token.marginLG}>
						<Col span={12}>
							<ProForm.Item
								name="saveFileDirectory"
								label={
									<IconLabel
										label={
											<FormattedMessage id="settings.functionSettings.screenshotSettings.autoSaveFileMode.directory" />
										}
									/>
								}
								required={false}
							>
								<DirectoryInput />
							</ProForm.Item>
						</Col>

						<Col span={12}>
							<ProForm.Item
								name="saveFileFormat"
								label={
									<FormattedMessage id="settings.functionSettings.screenshotSettings.autoSaveFileMode.saveFileFormat" />
								}
							>
								<Select
									options={[
										{
											label: "PNG(*.png)",
											value: ImageFormat.PNG,
										},
										{
											label: "JPEG(*.jpg)",
											value: ImageFormat.JPEG,
										},
										{
											label: "WEBP(*.webp)",
											value: ImageFormat.WEBP,
										},
										{
											label: "AVIF(*.avif)",
											value: ImageFormat.AVIF,
										},
										{
											label: "JPEG XL(*.jxl)",
											value: ImageFormat.JPEG_XL,
										},
									]}
								/>
							</ProForm.Item>
						</Col>
					</Row>
				</ProForm>
			</Spin>
		</SettingsSection>
	);
};
