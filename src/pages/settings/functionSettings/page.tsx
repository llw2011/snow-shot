"use client";

import { Form } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { videoRecordGetMicrophoneDeviceNames } from "@/commands/videoRecord";
import { ContentWrap } from "@/components/contentWrap";
import { PLUGIN_ID_FFMPEG } from "@/constants/pluginService";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { usePlatform } from "@/hooks/usePlatform";
import {
	type AppSettingsData,
	AppSettingsFixedContentInitialPosition,
	AppSettingsGroup,
	DoubleClickAction,
	GifFormat,
	OcrDetectAfterAction,
	TrayIconClickAction,
	VideoMaxSize,
} from "@/types/appSettings";
import { DrawState } from "@/types/draw";
import {
	getImageSaveDirectory,
	getVideoRecordSaveDirectory,
} from "@/utils/file";
import { ChatSettingsSection } from "./components/chatSettingsSection";
import { FixedContentSettingsSection } from "./components/fixedContentSettingsSection";
import { FullScreenDrawSettingsSection } from "./components/fullScreenDrawSettingsSection";
import { FunctionDrawSettingsSection } from "./components/functionDrawSettingsSection";
import { GlobalShortcutSettingsSection } from "./components/globalShortcutSettingsSection";
import {
	OcrSettingsSection,
	useFunctionOcrSettings,
} from "./components/ocrSettingsSection";
import { OutputSettingsSection } from "./components/outputSettingsSection";
import { ScreenshotSettingsSection } from "./components/screenshotSettingsSection";
import { TranslationSettingsSection } from "./components/translationSettingsSection";
import { TrayIconSettingsSection } from "./components/trayIconSettingsSection";
import { VideoRecordSettingsSection } from "./components/videoRecordSettingsSection";

export const FunctionSettingsPage = () => {
	const intl = useIntl();
	const [functionDrawForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.FunctionDraw]>();
	const [trayIconForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.FunctionTrayIcon]>();
	const [screenshotForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.FunctionScreenshot]>();
	const [outputForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.FunctionOutput]>();
	const [fullScreenDrawForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.FunctionFullScreenDraw]>();
	const [fixedContentForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.FunctionFixedContent]>();
	const [videoRecordForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.FunctionVideoRecord]>();
	const [functionGlobalShortcutForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.FunctionGlobalShortcut]>();
	const ocrSettings = useFunctionOcrSettings();

	const [appSettingsLoading, setAppSettingsLoading] = useState(true);

	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData, preSettings?: AppSettingsData) => {
				setAppSettingsLoading(false);

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.FunctionDraw] !==
						settings[AppSettingsGroup.FunctionDraw]
				) {
					functionDrawForm.setFieldsValue(
						settings[AppSettingsGroup.FunctionDraw],
					);
				}

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.FunctionScreenshot] !==
						settings[AppSettingsGroup.FunctionScreenshot]
				) {
					screenshotForm.setFieldsValue(
						settings[AppSettingsGroup.FunctionScreenshot],
					);

					const screenshotSettings =
						settings[AppSettingsGroup.FunctionScreenshot];
					if (!screenshotSettings.saveFileDirectory) {
						getImageSaveDirectory(settings).then((saveDirectory) => {
							screenshotSettings.saveFileDirectory = saveDirectory;
							screenshotForm.setFieldsValue(screenshotSettings);
						});
					}
				}

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.FunctionOutput] !==
						settings[AppSettingsGroup.FunctionOutput]
				) {
					outputForm.setFieldsValue(settings[AppSettingsGroup.FunctionOutput]);
				}

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.FunctionFixedContent] !==
						settings[AppSettingsGroup.FunctionFixedContent]
				) {
					fixedContentForm.setFieldsValue(
						settings[AppSettingsGroup.FunctionFixedContent],
					);
				}

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.FunctionFullScreenDraw] !==
						settings[AppSettingsGroup.FunctionFullScreenDraw]
				) {
					fullScreenDrawForm.setFieldsValue(
						settings[AppSettingsGroup.FunctionFullScreenDraw],
					);
				}

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.FunctionVideoRecord] !==
						settings[AppSettingsGroup.FunctionVideoRecord]
				) {
					const videoRecordSettings =
						settings[AppSettingsGroup.FunctionVideoRecord];
					videoRecordForm.setFieldsValue(
						settings[AppSettingsGroup.FunctionVideoRecord],
					);
					if (!videoRecordSettings.saveDirectory) {
						getVideoRecordSaveDirectory(settings).then((saveDirectory) => {
							videoRecordSettings.saveDirectory = saveDirectory;
							videoRecordForm.setFieldsValue(videoRecordSettings);
						});
					}
				}

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.FunctionTrayIcon] !==
						settings[AppSettingsGroup.FunctionTrayIcon]
				) {
					trayIconForm.setFieldsValue(
						settings[AppSettingsGroup.FunctionTrayIcon],
					);
				}

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.FunctionGlobalShortcut] !==
						settings[AppSettingsGroup.FunctionGlobalShortcut]
				) {
					functionGlobalShortcutForm.setFieldsValue(
						settings[AppSettingsGroup.FunctionGlobalShortcut],
					);
				}
			},
			[
				functionDrawForm,
				screenshotForm,
				outputForm,
				fixedContentForm,
				fullScreenDrawForm,
				videoRecordForm,
				trayIconForm,
				functionGlobalShortcutForm,
			],
		),
		true,
	);

	const [microphoneDeviceNameOptions, setMicrophoneDeviceNameOptions] =
		useState<{ label: string; value: string }[]>([]);

	const [currentPlatform] = usePlatform();

	const { isReadyStatus } = usePluginServiceContext();

	const initedMicrophoneDeviceNameOptions = useRef(false);
	useEffect(() => {
		if (initedMicrophoneDeviceNameOptions.current) {
			return;
		}

		if (!isReadyStatus?.(PLUGIN_ID_FFMPEG)) {
			return;
		}

		initedMicrophoneDeviceNameOptions.current = true;

		const options: { label: string; value: string }[] = [
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.videoRecordSettings.microphoneDeviceName.default",
				}),
				value: "",
			},
		];

		videoRecordGetMicrophoneDeviceNames()
			.then((microphoneDeviceNames) => {
				for (const microphoneDeviceName of microphoneDeviceNames) {
					const macosDeviceName =
						currentPlatform === "macos"
							? microphoneDeviceName.match(/\[\d+\]\s+(.+)/)?.[1]?.trim()
							: undefined;
					options.push({
						label: macosDeviceName ?? microphoneDeviceName,
						value: microphoneDeviceName,
					});
				}
			})
			.finally(() => {
				setMicrophoneDeviceNameOptions(options);
			});
	}, [currentPlatform, intl, isReadyStatus]);

	const videoMaxSizeOptions = useMemo(() => {
		return [
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.videoRecordSettings.videoMaxSize.p2160",
				}),
				value: VideoMaxSize.P2160,
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.videoRecordSettings.videoMaxSize.p1440",
				}),
				value: VideoMaxSize.P1440,
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.videoRecordSettings.videoMaxSize.p1080",
				}),
				value: VideoMaxSize.P1080,
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.videoRecordSettings.videoMaxSize.p720",
				}),
				value: VideoMaxSize.P720,
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.videoRecordSettings.videoMaxSize.p480",
				}),
				value: VideoMaxSize.P480,
			},
		];
	}, [intl]);

	const gifMaxSizeOptions = videoMaxSizeOptions.slice(-3);

	const gifFormatOptions = useMemo(() => {
		return [
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.videoRecordSettings.gifFormat.gif",
				}),

				value: GifFormat.Gif,
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.videoRecordSettings.gifFormat.apng",
				}),

				value: GifFormat.Apng,
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.videoRecordSettings.gifFormat.webp",
				}),

				value: GifFormat.Webp,
			},
		];
	}, [intl]);

	const trayIconClickActionOptions = useMemo(() => {
		return [
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.trayIconSettings.iconClickAction.screenshot",
				}),
				value: TrayIconClickAction.Screenshot,
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.trayIconSettings.iconClickAction.showMainWindow",
				}),
				value: TrayIconClickAction.ShowMainWindow,
			},
		];
	}, [intl]);

	const disableQuickSelectElementToolListOptions = useMemo(() => {
		return [
			{
				label: intl.formatMessage({
					id: "draw.rectTool",
				}),
				value: DrawState.Rect,
			},
			{
				label: intl.formatMessage({
					id: "draw.diamondTool",
				}),
				value: DrawState.Diamond,
			},
			{
				label: intl.formatMessage({
					id: "draw.ellipseTool",
				}),
				value: DrawState.Ellipse,
			},
			{
				label: intl.formatMessage({
					id: "draw.arrowTool",
				}),
				value: DrawState.Arrow,
			},
			{
				label: intl.formatMessage({
					id: "draw.lineTool",
				}),
				value: DrawState.Line,
			},
			{
				label: intl.formatMessage({
					id: "draw.penTool",
				}),
				value: DrawState.Pen,
			},
			{
				label: intl.formatMessage({
					id: "draw.serialNumberTool",
				}),
				value: DrawState.SerialNumber,
			},
			{
				label: intl.formatMessage({
					id: "draw.blurTool",
				}),
				value: DrawState.Blur,
			},
		];
	}, [intl]);

	const ocrAfterActionOptions = useMemo(() => {
		return [
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.screenshotSettings.ocrAfterAction.none",
				}),
				value: OcrDetectAfterAction.None,
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.screenshotSettings.ocrAfterAction.copyText",
				}),
				value: OcrDetectAfterAction.CopyText,
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.screenshotSettings.ocrAfterAction.copyTextAndCloseWindow",
				}),
				value: OcrDetectAfterAction.CopyTextAndCloseWindow,
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.screenshotSettings.ocrAfterAction.ocrDetectCopyText",
				}),
				value: OcrDetectAfterAction.OcrDetectCopyText,
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.screenshotSettings.ocrAfterAction.ocrDetectCopyTextAndCloseWindow",
				}),
				value: OcrDetectAfterAction.OcrDetectCopyTextAndCloseWindow,
			},
		];
	}, [intl]);

	const initialPositionOptions = useMemo(() => {
		return [
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
		];
	}, [intl]);

	const fullScreenDrawDefaultToolOptions = useMemo(() => {
		return [
			{
				label: intl.formatMessage({
					id: "draw.selectTool",
				}),
				value: DrawState.Select,
			},
			{
				label: intl.formatMessage({
					id: "draw.penTool",
				}),
				value: DrawState.Pen,
			},
			{
				label: intl.formatMessage({
					id: "draw.laserPointerTool",
				}),
				value: DrawState.LaserPointer,
			},
		];
	}, [intl]);

	const encoderPresetOptions = useMemo(() => {
		return [
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.videoRecordSettings.encoderPreset.ultrafast",
				}),
				value: "ultrafast",
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.videoRecordSettings.encoderPreset.veryfast",
				}),
				value: "veryfast",
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.videoRecordSettings.encoderPreset.medium",
				}),
				value: "medium",
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.videoRecordSettings.encoderPreset.slower",
				}),
				value: "slower",
			},
			{
				label: intl.formatMessage({
					id: "settings.functionSettings.videoRecordSettings.encoderPreset.placebo",
				}),
				value: "placebo",
			},
		];
	}, [intl]);

	const doubleClickActionOptions = useMemo(() => {
		return [
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
		];
	}, [intl]);

	return (
		<ContentWrap className="settings-wrap">
			<ScreenshotSettingsSection
				form={screenshotForm}
				loading={appSettingsLoading}
				currentPlatform={currentPlatform}
				ocrReady={ocrSettings.ocrReady}
				ocrAfterActionOptions={ocrAfterActionOptions}
				doubleClickActionOptions={doubleClickActionOptions}
			/>

			<FunctionDrawSettingsSection
				form={functionDrawForm}
				loading={appSettingsLoading}
				disableQuickSelectElementToolListOptions={
					disableQuickSelectElementToolListOptions
				}
			/>

			<FixedContentSettingsSection
				form={fixedContentForm}
				loading={appSettingsLoading}
				ocrReady={ocrSettings.ocrReady}
				initialPositionOptions={initialPositionOptions}
			/>

			<OcrSettingsSection {...ocrSettings} />

			<TranslationSettingsSection />

			<ChatSettingsSection />

			<FullScreenDrawSettingsSection
				form={fullScreenDrawForm}
				loading={appSettingsLoading}
				defaultToolOptions={fullScreenDrawDefaultToolOptions}
			/>

			<VideoRecordSettingsSection
				form={videoRecordForm}
				loading={appSettingsLoading}
				ffmpegReady={isReadyStatus?.(PLUGIN_ID_FFMPEG)}
				currentPlatform={currentPlatform}
				videoMaxSizeOptions={videoMaxSizeOptions}
				gifMaxSizeOptions={gifMaxSizeOptions}
				gifFormatOptions={gifFormatOptions}
				microphoneDeviceNameOptions={microphoneDeviceNameOptions}
				encoderPresetOptions={encoderPresetOptions}
			/>

			<TrayIconSettingsSection
				form={trayIconForm}
				loading={appSettingsLoading}
				iconClickActionOptions={trayIconClickActionOptions}
			/>

			<GlobalShortcutSettingsSection
				form={functionGlobalShortcutForm}
				loading={appSettingsLoading}
			/>

			<OutputSettingsSection form={outputForm} loading={appSettingsLoading} />

			<style jsx>{`
                :global(.api-config-list .ant-pro-form-list-container) {
                    width: 100%;
                }

                :global(.api-config-list .api-config-list-item) {
                    min-width: 0;
                }

                :global(.api-config-list .api-config-list-item-content) {
                    flex: 1 1 0;
                    min-width: 0;
                }

                :global(.api-config-list .api-config-list-item-action) {
                    display: flex;
                    flex: 0 0 auto;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                    max-width: 100%;
                }

                @container snow-content (max-width: 700px) {
                    :global(.api-config-list .api-config-list-item) {
                        align-items: stretch !important;
                        flex-direction: column;
                    }

                    :global(.api-config-list .api-config-list-item-content) {
                        width: 100%;
                    }

                    :global(.api-config-list .api-config-list-item-action) {
                        align-self: flex-end;
                    }
                }
            `}</style>
		</ContentWrap>
	);
};
