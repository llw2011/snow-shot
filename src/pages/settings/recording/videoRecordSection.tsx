import ProForm, {
	ProFormDigit,
	ProFormSelect,
	ProFormSwitch,
} from "@ant-design/pro-form";
import { ColorPicker, Spin } from "antd";
import type { AggregationColor } from "antd/es/color-picker/color";
import { useEffect, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { videoRecordGetMicrophoneDeviceNames } from "@/commands/videoRecord";
import { DirectoryInput } from "@/components/directoryInput";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import { usePlatform } from "@/hooks/usePlatform";
import {
	AppSettingsGroup,
	GifFormat,
	KeyDisplayDirection,
	VideoMaxSize,
} from "@/types/appSettings";
import { getVideoRecordSaveDirectory } from "@/utils/file";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

const prefix = "settings.functionSettings.videoRecordSettings";

const FRAME_RATE_OPTIONS = [10, 15, 24, 30, 60, 120, 83, 42].map((value) => ({
	label: `${value}`,
	value,
}));
const GIF_FRAME_RATE_OPTIONS = FRAME_RATE_OPTIONS.slice(0, 3);

const useMicrophoneOptions = () => {
	const intl = useIntl();
	const [currentPlatform] = usePlatform();
	const [options, setOptions] = useState<{ label: string; value: string }[]>(
		[],
	);

	useEffect(() => {
		if (!currentPlatform) {
			return;
		}

		let canceled = false;
		const defaultOption = {
			label: intl.formatMessage({
				id: `${prefix}.microphoneDeviceName.default`,
			}),
			value: "",
		};
		videoRecordGetMicrophoneDeviceNames()
			.then((names) =>
				names.map((name) => ({
					// macOS reports "[index] Device name".
					label:
						(currentPlatform === "macos"
							? name.match(/\[\d+\]\s+(.+)/)?.[1]?.trim()
							: undefined) ?? name,
					value: name,
				})),
			)
			.catch(() => [])
			.then((devices) => {
				if (!canceled) {
					setOptions([defaultOption, ...devices]);
				}
			});

		return () => {
			canceled = true;
		};
	}, [currentPlatform, intl]);

	return options;
};

/** Screen recording output, encoding and the on-screen key display. */
export const VideoRecordSection = () => {
	const intl = useIntl();
	const [currentPlatform] = usePlatform();
	const microphoneOptions = useMicrophoneOptions();
	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.FunctionVideoRecord,
		{
			onLoad: (settings, currentForm) => {
				if (settings[AppSettingsGroup.FunctionVideoRecord].saveDirectory) {
					return;
				}

				getVideoRecordSaveDirectory(settings).then((saveDirectory) => {
					currentForm.setFieldsValue({ saveDirectory });
				});
			},
		},
	);

	const videoMaxSizeOptions = useMemo(
		() =>
			(
				[
					["p2160", VideoMaxSize.P2160],
					["p1440", VideoMaxSize.P1440],
					["p1080", VideoMaxSize.P1080],
					["p720", VideoMaxSize.P720],
					["p480", VideoMaxSize.P480],
				] as const
			).map(([key, value]) => ({
				label: intl.formatMessage({ id: `${prefix}.videoMaxSize.${key}` }),
				value,
			})),
		[intl],
	);

	const gifFormatOptions = useMemo(
		() =>
			(
				[
					["gif", GifFormat.Gif],
					["apng", GifFormat.Apng],
					["webp", GifFormat.Webp],
				] as const
			).map(([key, value]) => ({
				label: intl.formatMessage({ id: `${prefix}.gifFormat.${key}` }),
				value,
			})),
		[intl],
	);

	const encoderOptions = useMemo(
		() => [
			{ label: "Libx264 (CPU)", value: "libx264" },
			{ label: "Libx265 (CPU)", value: "libx265" },
			...(currentPlatform === "windows"
				? [
						{ label: "H264_AMF (AMD)", value: "h264_amf" },
						{ label: "H264_NVENC (NVIDIA)", value: "h264_nvenc" },
					]
				: []),
		],
		[currentPlatform],
	);

	const encoderPresetOptions = useMemo(
		() =>
			["ultrafast", "veryfast", "medium", "slower", "placebo"].map((value) => ({
				label: intl.formatMessage({ id: `${prefix}.encoderPreset.${value}` }),
				value,
			})),
		[intl],
	);

	const reset = (
		<ResetSettingsButton
			title={<FormattedMessage id={prefix} />}
			appSettingsGroup={AppSettingsGroup.FunctionVideoRecord}
		/>
	);

	const onValuesChange = (_: unknown, values: Parameters<typeof save>[0]) => {
		if (typeof values.keyDisplayBackgroundColor === "object") {
			values.keyDisplayBackgroundColor = (
				values.keyDisplayBackgroundColor as unknown as AggregationColor
			).toRgbString();
		}
		if (typeof values.keyDisplayTextColor === "object") {
			values.keyDisplayTextColor = (
				values.keyDisplayTextColor as unknown as AggregationColor
			).toHexString();
		}
		save(values);
	};

	return (
		<Spin spinning={loading}>
			<ProForm
				form={form}
				submitter={false}
				autoFocusFirstInput={false}
				layout="horizontal"
				onValuesChange={onValuesChange}
			>
				<SettingsGroup title={<FormattedMessage id={prefix} />} extra={reset}>
					<ProFormSelect
						name="videoMaxSize"
						label={<FormattedMessage id={`${prefix}.videoMaxSize`} />}
						options={videoMaxSizeOptions}
						allowClear={false}
					/>
					<ProFormSelect
						name="frameRate"
						label={<FormattedMessage id={`${prefix}.frameRate`} />}
						options={FRAME_RATE_OPTIONS}
						allowClear={false}
					/>
					<ProFormSelect
						name="microphoneDeviceName"
						label={<FormattedMessage id={`${prefix}.microphoneDeviceName`} />}
						options={microphoneOptions}
						allowClear={false}
					/>
					<ProFormSwitch
						name="enableExcludeFromCapture"
						label={
							<FormattedMessage id={`${prefix}.enableExcludeFromCapture`} />
						}
					/>
					<ProForm.Item
						name="saveDirectory"
						label={<FormattedMessage id={`${prefix}.saveDirectory`} />}
						required={false}
					>
						<DirectoryInput />
					</ProForm.Item>
				</SettingsGroup>

				<SettingsGroup
					title={<FormattedMessage id="workbench.group.encoding" />}
				>
					<ProFormSelect
						name="encoder"
						label={
							<IconLabel
								label={<FormattedMessage id={`${prefix}.encoder`} />}
								tooltipTitle={<FormattedMessage id={`${prefix}.encoder.tip`} />}
							/>
						}
						options={encoderOptions}
						allowClear={false}
					/>
					<ProFormSelect
						name="encoderPreset"
						label={
							<IconLabel
								label={<FormattedMessage id={`${prefix}.encoderPreset`} />}
								tooltipTitle={
									<FormattedMessage id={`${prefix}.encoderPreset.tip`} />
								}
							/>
						}
						options={encoderPresetOptions}
						allowClear={false}
					/>
					<ProFormSwitch
						name="hwaccel"
						label={<FormattedMessage id={`${prefix}.hwaccel`} />}
					/>
				</SettingsGroup>

				<SettingsGroup title={<FormattedMessage id="workbench.group.gif" />}>
					<ProFormSelect
						name="gifFormat"
						label={<FormattedMessage id={`${prefix}.gifFormat`} />}
						options={gifFormatOptions}
						allowClear={false}
					/>
					<ProFormSelect
						name="gifMaxSize"
						label={<FormattedMessage id={`${prefix}.gifMaxSize`} />}
						options={videoMaxSizeOptions.slice(-3)}
						allowClear={false}
					/>
					<ProFormSelect
						name="gifFrameRate"
						label={<FormattedMessage id={`${prefix}.gifFrameRate`} />}
						options={GIF_FRAME_RATE_OPTIONS}
						allowClear={false}
					/>
				</SettingsGroup>

				<SettingsGroup
					title={<FormattedMessage id={`${prefix}.keyDisplaySettings`} />}
				>
					<ProFormDigit
						name="keyDisplayFontSize"
						label={<FormattedMessage id={`${prefix}.keyDisplayFontSize`} />}
						min={8}
						max={64}
						fieldProps={{ precision: 0 }}
					/>
					<ProFormDigit
						name="keyDisplayDuration"
						label={<FormattedMessage id={`${prefix}.keyDisplayDuration`} />}
						min={100}
						max={10000}
						fieldProps={{ precision: 0, suffix: "ms" }}
					/>
					<ProFormDigit
						name="keyDisplayMergeDuration"
						label={
							<FormattedMessage id={`${prefix}.keyDisplayMergeDuration`} />
						}
						min={0}
						max={2000}
						fieldProps={{ precision: 0, suffix: "ms" }}
					/>
					<ProFormSelect
						name="keyDisplayDirection"
						label={<FormattedMessage id={`${prefix}.keyDisplayDirection`} />}
						allowClear={false}
						options={[
							{
								label: intl.formatMessage({
									id: `${prefix}.keyDisplayDirection.horizontal`,
								}),
								value: KeyDisplayDirection.Horizontal,
							},
							{
								label: intl.formatMessage({
									id: `${prefix}.keyDisplayDirection.vertical`,
								}),
								value: KeyDisplayDirection.Vertical,
							},
						]}
					/>
					<ProForm.Item
						name="keyDisplayBackgroundColor"
						label={
							<FormattedMessage id={`${prefix}.keyDisplayBackgroundColor`} />
						}
						required={false}
					>
						<ColorPicker showText placement="bottomRight" />
					</ProForm.Item>
					<ProForm.Item
						name="keyDisplayTextColor"
						label={<FormattedMessage id={`${prefix}.keyDisplayTextColor`} />}
						required={false}
					>
						<ColorPicker showText placement="bottomRight" />
					</ProForm.Item>
				</SettingsGroup>
			</ProForm>
		</Spin>
	);
};
