import ProForm, { ProFormSelect, ProFormSwitch } from "@ant-design/pro-form";
import { Select, Spin } from "antd";
import { useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { DirectoryInput } from "@/components/directoryInput";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import { usePlatform } from "@/hooks/usePlatform";
import {
	AppSettingsGroup,
	DoubleClickAction,
	OcrDetectAfterAction,
} from "@/types/appSettings";
import { ImageFormat } from "@/types/utils/file";
import { getImageSaveDirectory } from "@/utils/file";
import { useOcrReady } from "../shared/hooks";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

const IMAGE_FORMAT_OPTIONS = [
	{ label: "PNG", value: ImageFormat.PNG },
	{ label: "JPEG", value: ImageFormat.JPEG },
	{ label: "WEBP", value: ImageFormat.WEBP },
	{ label: "AVIF", value: ImageFormat.AVIF },
	{ label: "JPEG XL", value: ImageFormat.JPEG_XL },
];

/** What happens while a selection is open, and right after it closes. */
export const ScreenshotBehaviorSection = () => {
	const intl = useIntl();
	const [currentPlatform] = usePlatform();
	const ocrReady = useOcrReady();
	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.FunctionScreenshot,
	);

	const doubleClickActionOptions = useMemo(
		() => [
			{
				label: intl.formatMessage({ id: "draw.doubleClickAction.copy" }),
				value: DoubleClickAction.Copy,
			},
			{
				label: intl.formatMessage({ id: "draw.doubleClickAction.save" }),
				value: DoubleClickAction.Save,
			},
			{
				label: intl.formatMessage({
					id: "draw.doubleClickAction.fixedToScreen",
				}),
				value: DoubleClickAction.FixedToScreen,
			},
			{
				label: intl.formatMessage({ id: "draw.doubleClickAction.none" }),
				value: DoubleClickAction.None,
			},
		],
		[intl],
	);

	const ocrAfterActionOptions = useMemo(
		() =>
			[
				["none", OcrDetectAfterAction.None],
				["copyText", OcrDetectAfterAction.CopyText],
				["copyTextAndCloseWindow", OcrDetectAfterAction.CopyTextAndCloseWindow],
				["ocrDetectCopyText", OcrDetectAfterAction.OcrDetectCopyText],
				[
					"ocrDetectCopyTextAndCloseWindow",
					OcrDetectAfterAction.OcrDetectCopyTextAndCloseWindow,
				],
			].map(([key, value]) => ({
				label: intl.formatMessage({
					id: `settings.functionSettings.screenshotSettings.ocrAfterAction.${key}`,
				}),
				value,
			})),
		[intl],
	);

	return (
		<SettingsGroup
			title={<FormattedMessage id="workbench.group.whileCapturing" />}
			extra={
				<ResetSettingsButton
					title={
						<FormattedMessage id="settings.functionSettings.screenshotSettings" />
					}
					appSettingsGroup={AppSettingsGroup.FunctionScreenshot}
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
					{currentPlatform !== "macos" && (
						<ProFormSwitch
							name="findChildrenElements"
							label={
								<FormattedMessage id="settings.functionSettings.screenshotSettings.findChildrenElements" />
							}
						/>
					)}
					<ProFormSwitch
						name="shortcutCanleTip"
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
					/>
					<ProFormSelect
						name="doubleClickAction"
						label={<FormattedMessage id="draw.doubleClickAction" />}
						options={doubleClickActionOptions}
						allowClear={false}
					/>
					{ocrReady && (
						<>
							<ProFormSelect
								name="ocrAfterAction"
								label={
									<FormattedMessage id="settings.functionSettings.screenshotSettings.ocrAfterAction" />
								}
								options={ocrAfterActionOptions}
								allowClear={false}
							/>
							<ProFormSwitch
								name="ocrCopyText"
								label={
									<FormattedMessage id="settings.functionSettings.screenshotSettings.ocrCopyText" />
								}
							/>
						</>
					)}
				</ProForm>
			</Spin>
		</SettingsGroup>
	);
};

/** Clipboard and file output of a finished screenshot. */
export const ScreenshotSaveSection = () => {
	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.FunctionScreenshot,
		{
			onLoad: (settings, currentForm) => {
				const screenshotSettings =
					settings[AppSettingsGroup.FunctionScreenshot];
				if (screenshotSettings.saveFileDirectory) {
					return;
				}

				getImageSaveDirectory(settings).then((saveFileDirectory) => {
					currentForm.setFieldsValue({ saveFileDirectory });
				});
			},
		},
	);

	return (
		<SettingsGroup
			title={<FormattedMessage id="workbench.group.copyAndSave" />}
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
						name="focusedWindowCopyToClipboard"
						label={
							<FormattedMessage id="settings.functionSettings.screenshotSettings.focusedWindowCopyToClipboard" />
						}
					/>
					<ProFormSwitch
						name="fullScreenCopyToClipboard"
						label={
							<FormattedMessage id="settings.functionSettings.screenshotSettings.fullScreenCopyToClipboard" />
						}
					/>
					<ProFormSwitch
						name="copyImageFileToClipboard"
						label={
							<IconLabel
								label={<FormattedMessage id="draw.copyImageFileToClipboard" />}
								tooltipTitle={
									<FormattedMessage id="draw.copyImageFileToClipboard.tip" />
								}
							/>
						}
					/>
					<ProFormSwitch
						name="autoSaveOnCopy"
						label={
							<FormattedMessage id="settings.functionSettings.screenshotSettings.autoSaveFileMode.autoSave" />
						}
					/>
					<ProFormSwitch
						name="fastSave"
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
					<ProForm.Item
						name="saveFileFormat"
						label={
							<FormattedMessage id="settings.functionSettings.screenshotSettings.autoSaveFileMode.saveFileFormat" />
						}
					>
						<Select options={IMAGE_FORMAT_OPTIONS} />
					</ProForm.Item>
					<ProForm.Item
						name="saveFileDirectory"
						label={
							<FormattedMessage id="settings.functionSettings.screenshotSettings.autoSaveFileMode.directory" />
						}
						required={false}
					>
						<DirectoryInput />
					</ProForm.Item>
				</ProForm>
			</Spin>
		</SettingsGroup>
	);
};
