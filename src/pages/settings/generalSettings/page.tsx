"use client";

import ProForm, {
	ProFormRadio,
	ProFormSelect,
	ProFormSlider,
	ProFormSwitch,
} from "@ant-design/pro-form";
import { resourceDir } from "@tauri-apps/api/path";
import {
	type CheckboxOptionType,
	Col,
	ColorPicker,
	Form,
	Image,
	Row,
	Select,
	Spin,
	theme,
} from "antd";
import type { AggregationColor } from "antd/es/color-picker/color";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { ContentWrap } from "@/components/contentWrap";
import { IconLabel } from "@/components/iconLable";
import { DarkModeIcon, LanguageIcon } from "@/components/icons";
import { PathInput } from "@/components/pathInput";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsSection } from "@/components/settingsSection";
import { getDefaultIconPath } from "@/components/trayIconLoader";
import { defaultAppSettingsData } from "@/constants/appSettings";
import {
	PLUGIN_ID_GLM_OCR,
	PLUGIN_ID_RAPID_OCR,
} from "@/constants/pluginService";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { useStateRef } from "@/hooks/useStateRef";
import {
	AppSettingsControlNode,
	type AppSettingsData,
	AppSettingsGroup,
	AppSettingsLanguage,
	AppSettingsTheme,
	ColorPickerShowMode,
	TrayIconDefaultIcon,
} from "@/types/appSettings";
import { DrawState } from "@/types/draw";
import { canUseOcr } from "@/utils/ocr";

const { Option } = Select;

export const GeneralSettingsPage = () => {
	const intl = useIntl();
	const { token } = theme.useToken();

	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const [currentAppSettings, setCurrentAppSettings] = useState<AppSettingsData>(
		defaultAppSettingsData,
	);
	const [commonForm] = Form.useForm<AppSettingsData[AppSettingsGroup.Common]>();
	const [screenshotForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.Screenshot]>();
	const [fixedContentForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.FixedContent]>();
	const [trayIconForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.CommonTrayIcon]>();

	const [appSettingsLoading, setAppSettingsLoading] = useStateRef(true);
	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData, preSettings?: AppSettingsData) => {
				setCurrentAppSettings(settings);
				setAppSettingsLoading(false);
				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.Common] !==
						settings[AppSettingsGroup.Common]
				) {
					commonForm.setFieldsValue(settings[AppSettingsGroup.Common]);
				}

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.Screenshot] !==
						settings[AppSettingsGroup.Screenshot]
				) {
					screenshotForm.setFieldsValue(settings[AppSettingsGroup.Screenshot]);
				}

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.CommonTrayIcon] !==
						settings[AppSettingsGroup.CommonTrayIcon]
				) {
					trayIconForm.setFieldsValue(
						settings[AppSettingsGroup.CommonTrayIcon],
					);
				}

				if (
					preSettings === undefined ||
					preSettings[AppSettingsGroup.FixedContent] !==
						settings[AppSettingsGroup.FixedContent]
				) {
					fixedContentForm.setFieldsValue(
						settings[AppSettingsGroup.FixedContent],
					);
				}
			},
			[
				commonForm,
				fixedContentForm,
				screenshotForm,
				setAppSettingsLoading,
				trayIconForm,
			],
		),
		true,
	);

	const { isReadyStatus } = usePluginServiceContext();

	const customToolbarToolListOptions = useMemo(() => {
		if (!isReadyStatus) {
			return [];
		}

		return [
			{
				label: intl.formatMessage({ id: "draw.selectTool" }),
				value: DrawState.Select,
			},
			{
				label: intl.formatMessage({ id: "draw.ellipseTool" }),
				value: DrawState.Ellipse,
			},
			{
				label: intl.formatMessage({ id: "draw.arrowTool" }),
				value: DrawState.Arrow,
			},
			{
				label: intl.formatMessage({ id: "draw.penTool" }),
				value: DrawState.Pen,
			},
			{
				label: intl.formatMessage({ id: "draw.textTool" }),
				value: DrawState.Text,
			},
			{
				label: intl.formatMessage({ id: "draw.serialNumberTool" }),
				value: DrawState.SerialNumber,
			},
			{
				label: intl.formatMessage({ id: "draw.blurTool" }),
				value: DrawState.Blur,
			},
			{
				label: intl.formatMessage({ id: "draw.eraserTool" }),
				value: DrawState.Eraser,
			},
			{
				label: intl.formatMessage({ id: "draw.watermarkTool" }),
				value: DrawState.Watermark,
			},
			{
				label: intl.formatMessage({ id: "draw.highlightTool" }),
				value: DrawState.Highlight,
			},
			{
				label: intl.formatMessage({ id: "draw.redoUndoTool" }),
				value: DrawState.Redo,
			},
			{
				label: intl.formatMessage({ id: "draw.fixedTool" }),
				value: DrawState.Fixed,
			},
			{
				label: intl.formatMessage({ id: "draw.ocrDetectTool" }),
				value: DrawState.OcrDetect,
			},
			{
				label: intl.formatMessage({ id: "draw.ocrTranslateTool" }),
				value: DrawState.OcrTranslate,
			},
			{
				label: intl.formatMessage({ id: "draw.scrollScreenshotTool" }),
				value: DrawState.ScrollScreenshot,
			},
		].filter((item) => {
			if (
				item.value === DrawState.OcrDetect ||
				item.value === DrawState.OcrTranslate
			) {
				return canUseOcr(
					currentAppSettings,
					isReadyStatus(PLUGIN_ID_GLM_OCR),
					isReadyStatus(PLUGIN_ID_RAPID_OCR),
				);
			}

			return true;
		});
	}, [intl, isReadyStatus, currentAppSettings]);

	const [defaultIconsOptions, setDefaultIconsOptions] = useState<
		CheckboxOptionType<TrayIconDefaultIcon>[]
	>([]);
	const initDefaultIconsOptions = useCallback(async () => {
		const appDataDir = await resourceDir();
		const [
			defaultIconPath,
			lightIconPath,
			darkIconPath,
			snowDefaultIconPath,
			snowLightIconPath,
			snowDarkIconPath,
		] = await Promise.all([
			getDefaultIconPath(TrayIconDefaultIcon.Default, appDataDir),
			getDefaultIconPath(TrayIconDefaultIcon.Light, appDataDir),
			getDefaultIconPath(TrayIconDefaultIcon.Dark, appDataDir),
			getDefaultIconPath(TrayIconDefaultIcon.SnowDefault, appDataDir),
			getDefaultIconPath(TrayIconDefaultIcon.SnowLight, appDataDir),
			getDefaultIconPath(TrayIconDefaultIcon.SnowDark, appDataDir),
		]);

		const iconSize = 18;
		const renderIconOptionLabel = (
			messageId: string,
			src: string,
			alt: string,
		) => (
			<span className="tray-icon-option">
				<span>
					{intl.formatMessage({
						id: messageId,
					})}
				</span>
				<span className="tray-icon-preview">
					<Image
						preview={false}
						src={src}
						width={iconSize}
						height={iconSize}
						alt={alt}
					/>
				</span>
			</span>
		);
		setDefaultIconsOptions([
			{
				label: renderIconOptionLabel(
					"settings.commonSettings.trayIconSettings.defaultIcons.default",
					defaultIconPath.web_path,
					"default",
				),
				title: intl.formatMessage({
					id: "settings.commonSettings.trayIconSettings.defaultIcons.default",
				}),
				value: TrayIconDefaultIcon.Default,
			},
			{
				label: renderIconOptionLabel(
					"settings.commonSettings.trayIconSettings.defaultIcons.light",
					lightIconPath.web_path,
					"light",
				),
				title: intl.formatMessage({
					id: "settings.commonSettings.trayIconSettings.defaultIcons.light",
				}),
				value: TrayIconDefaultIcon.Light,
			},
			{
				label: renderIconOptionLabel(
					"settings.commonSettings.trayIconSettings.defaultIcons.dark",
					darkIconPath.web_path,
					"dark",
				),
				title: intl.formatMessage({
					id: "settings.commonSettings.trayIconSettings.defaultIcons.dark",
				}),
				value: TrayIconDefaultIcon.Dark,
			},
			{
				label: renderIconOptionLabel(
					"settings.commonSettings.trayIconSettings.defaultIcons.snowDefault",
					snowDefaultIconPath.web_path,
					"snow-default",
				),
				title: intl.formatMessage({
					id: "settings.commonSettings.trayIconSettings.defaultIcons.snowDefault",
				}),
				value: TrayIconDefaultIcon.SnowDefault,
			},

			{
				label: renderIconOptionLabel(
					"settings.commonSettings.trayIconSettings.defaultIcons.snowLight",
					snowLightIconPath.web_path,
					"snow-light",
				),
				title: intl.formatMessage({
					id: "settings.commonSettings.trayIconSettings.defaultIcons.snowLight",
				}),
				value: TrayIconDefaultIcon.SnowLight,
			},
			{
				label: renderIconOptionLabel(
					"settings.commonSettings.trayIconSettings.defaultIcons.snowDark",
					snowDarkIconPath.web_path,
					"snow-dark",
				),
				title: intl.formatMessage({
					id: "settings.commonSettings.trayIconSettings.defaultIcons.snowDark",
				}),
				value: TrayIconDefaultIcon.SnowDark,
			},
		]);
	}, [intl]);

	const themeOptions = useMemo(() => {
		return [
			{
				label: intl.formatMessage({ id: "settings.theme.light" }),
				value: AppSettingsTheme.Light,
			},
			{
				label: intl.formatMessage({ id: "settings.theme.dark" }),
				value: AppSettingsTheme.Dark,
			},
			{
				label: intl.formatMessage({ id: "settings.theme.system" }),
				value: AppSettingsTheme.System,
			},
		];
	}, [intl]);

	useEffect(() => {
		initDefaultIconsOptions();
	}, [initDefaultIconsOptions]);

	return (
		<ContentWrap className="settings-wrap">
			<SettingsSection
				sectionId="commonSettings"
				title={<FormattedMessage id="settings.commonSettings" />}
				extra={
					<ResetSettingsButton
						title={
							<FormattedMessage
								id="settings.commonSettings"
								key="commonSettings"
							/>
						}
						appSettingsGroup={AppSettingsGroup.Common}
					/>
				}
				defaultOpen
			>
				<Form
					className="settings-form common-settings-form"
					form={commonForm}
					onValuesChange={(_, values) => {
						updateAppSettings(
							AppSettingsGroup.Common,
							values,
							true,
							true,
							true,
						);
					}}
					layout="vertical"
				>
					<Spin spinning={appSettingsLoading}>
						<Row gutter={token.marginLG}>
							<Col span={12}>
								<Form.Item
									label={
										<IconLabel
											icon={<DarkModeIcon />}
											label={<FormattedMessage id="settings.theme" />}
										/>
									}
									name="theme"
								>
									<Select options={themeOptions} />
								</Form.Item>
							</Col>
							<Col span={12}>
								<Form.Item
									className="settings-wrap-language"
									name="language"
									label={
										<IconLabel
											icon={<LanguageIcon />}
											label={<FormattedMessage id="settings.language" />}
										/>
									}
									required={false}
									rules={[{ required: true }]}
								>
									<Select>
										<Option value={AppSettingsLanguage.EN}>English</Option>
										<Option value={AppSettingsLanguage.ZHHant}>繁体中文</Option>
										<Option value={AppSettingsLanguage.ZHHans}>简体中文</Option>
									</Select>
								</Form.Item>
							</Col>
						</Row>
					</Spin>
				</Form>
			</SettingsSection>

			<SettingsSection
				sectionId="screenshotSettings"
				title={<FormattedMessage id="settings.screenshotSettings" />}
				extra={
					<ResetSettingsButton
						title={intl.formatMessage({ id: "settings.screenshotSettings" })}
						appSettingsGroup={AppSettingsGroup.Screenshot}
					/>
				}
			>
				<ProForm<AppSettingsData[AppSettingsGroup.Screenshot]>
					className="settings-form screenshot-settings-form"
					form={screenshotForm}
					submitter={false}
					onValuesChange={(_, values) => {
						if (typeof values.fullScreenAuxiliaryLineColor === "object") {
							values.fullScreenAuxiliaryLineColor = (
								values.fullScreenAuxiliaryLineColor as AggregationColor
							).toHexString();
						}

						if (typeof values.monitorCenterAuxiliaryLineColor === "object") {
							values.monitorCenterAuxiliaryLineColor = (
								values.monitorCenterAuxiliaryLineColor as AggregationColor
							).toHexString();
						}

						if (
							typeof values.colorPickerCenterAuxiliaryLineColor === "object"
						) {
							values.colorPickerCenterAuxiliaryLineColor = (
								values.colorPickerCenterAuxiliaryLineColor as AggregationColor
							).toHexString();
						}

						if (typeof values.selectRectMaskColor === "object") {
							values.selectRectMaskColor = (
								values.selectRectMaskColor as AggregationColor
							).toHexString();
						}

						updateAppSettings(
							AppSettingsGroup.Screenshot,
							values,
							true,
							true,
							true,
							true,
							false,
						);
					}}
					layout="vertical"
				>
					<Spin spinning={appSettingsLoading}>
						<Row gutter={token.marginLG}>
							<Col span={12}>
								<ProFormSlider
									name="uiScale"
									label={
										<FormattedMessage id="settings.commonSettings.screenshotSettings.uiScale" />
									}
									min={25}
									max={100}
									step={1}
									marks={{
										25: "25%",
										100: "100%",
									}}
								/>
							</Col>

							<Col span={12}>
								<ProFormSlider
									name="toolbarUiScale"
									label={
										<FormattedMessage id="settings.commonSettings.screenshotSettings.toolbarUiScale" />
									}
									min={25}
									max={100}
									step={1}
									marks={{
										25: "25%",
										100: "100%",
									}}
								/>
							</Col>

							<Col span={12}>
								<ProForm.Item
									className="settings-wrap-language"
									name="controlNode"
									label={
										<IconLabel
											label={<FormattedMessage id="settings.controlNode" />}
										/>
									}
									required={false}
									rules={[{ required: true }]}
								>
									<Select>
										<Option value={AppSettingsControlNode.Circle}>
											<FormattedMessage id="settings.controlNode.circle" />
										</Option>
									</Select>
								</ProForm.Item>
							</Col>

							<Col span={12}>
								<ProFormSwitch
									name="disableAnimation"
									label={<FormattedMessage id="settings.disableAnimation" />}
								/>
							</Col>

							<Col span={12}>
								<ProFormRadio.Group
									name="colorPickerShowMode"
									layout="horizontal"
									label={
										<FormattedMessage id="settings.functionSettings.screenshotSettings.colorPickerShowMode" />
									}
									options={[
										{
											label: (
												<FormattedMessage id="settings.functionSettings.screenshotSettings.beyondSelectRect" />
											),
											value: ColorPickerShowMode.BeyondSelectRect,
										},
										{
											label: (
												<FormattedMessage id="settings.functionSettings.screenshotSettings.alwaysShowColorPicker" />
											),
											value: ColorPickerShowMode.Always,
										},
										{
											label: (
												<FormattedMessage id="settings.functionSettings.screenshotSettings.neverShowColorPicker" />
											),
											value: ColorPickerShowMode.Never,
										},
									]}
								/>
							</Col>

							<Col span={12}>
								<ProForm.Item
									name="selectRectMaskColor"
									label={
										<IconLabel
											label={
												<FormattedMessage id="settings.selectRectMaskColor" />
											}
										/>
									}
									required={false}
								>
									<ColorPicker showText placement="bottom" />
								</ProForm.Item>
							</Col>

							<Col span={12}>
								<ProFormSlider
									label={
										<IconLabel
											label={
												<FormattedMessage id="settings.functionSettings.screenshotSettings.beyondSelectRectElementOpacity" />
											}
											tooltipTitle={
												<FormattedMessage id="settings.functionSettings.screenshotSettings.beyondSelectRectElementOpacity.tip" />
											}
										/>
									}
									name="beyondSelectRectElementOpacity"
									min={0}
									max={100}
									step={1}
									marks={{
										0: "0%",
										100: "100%",
									}}
								/>
							</Col>

							<Col span={12}>
								<ProFormSlider
									label={
										<IconLabel
											label={
												<FormattedMessage id="settings.functionSettings.screenshotSettings.hotKeyTipOpacity" />
											}
										/>
									}
									name="hotKeyTipOpacity"
									min={0}
									max={100}
									step={1}
									marks={{
										0: "0%",
										100: "100%",
									}}
								/>
							</Col>
						</Row>

						<Row gutter={token.marginLG}>
							<Col span={12}>
								<ProForm.Item
									name="fullScreenAuxiliaryLineColor"
									label={
										<IconLabel
											label={
												<FormattedMessage id="settings.fullScreenAuxiliaryLineColor" />
											}
										/>
									}
									required={false}
								>
									<ColorPicker showText placement="bottom" />
								</ProForm.Item>
							</Col>

							<Col span={12}>
								<ProForm.Item
									name="monitorCenterAuxiliaryLineColor"
									label={
										<IconLabel
											label={
												<FormattedMessage id="settings.monitorCenterAuxiliaryLineColor" />
											}
										/>
									}
									required={false}
								>
									<ColorPicker showText placement="bottom" />
								</ProForm.Item>
							</Col>

							<Col span={12}>
								<ProForm.Item
									name="colorPickerCenterAuxiliaryLineColor"
									label={
										<IconLabel
											label={
												<FormattedMessage id="settings.colorPickerCenterAuxiliaryLineColor" />
											}
										/>
									}
									required={false}
								>
									<ColorPicker showText placement="bottom" />
								</ProForm.Item>
							</Col>
						</Row>

						<Row gutter={token.marginLG}>
							<Col span={24}>
								<ProFormSelect
									name="toolbarHiddenToolList"
									label={
										<FormattedMessage id="settings.customToolbarToolList" />
									}
									options={customToolbarToolListOptions}
									mode="multiple"
								/>
							</Col>
						</Row>
					</Spin>
				</ProForm>
			</SettingsSection>

			<SettingsSection
				sectionId="fixedContentSettings"
				title={<FormattedMessage id="settings.fixedContentSettings" />}
				extra={
					<ResetSettingsButton
						title={intl.formatMessage({ id: "settings.fixedContentSettings" })}
						appSettingsGroup={AppSettingsGroup.FixedContent}
					/>
				}
			>
				<ProForm<AppSettingsData[AppSettingsGroup.FixedContent]>
					className="settings-form fixed-content-settings-form"
					form={fixedContentForm}
					submitter={false}
					onValuesChange={(_, values) => {
						if (typeof values.borderColor === "object") {
							values.borderColor = (
								values.borderColor as AggregationColor
							).toHexString();
						}

						updateAppSettings(
							AppSettingsGroup.FixedContent,
							values,
							true,
							true,
							true,
							true,
							false,
						);
					}}
					layout="vertical"
				>
					<Spin spinning={appSettingsLoading}>
						<Row gutter={token.marginLG}>
							<Col span={12}>
								<ProForm.Item
									name="borderColor"
									label={
										<IconLabel
											label={
												<FormattedMessage id="settings.fixedContentSettings.borderColor" />
											}
										/>
									}
									required={false}
								>
									<ColorPicker showText placement="bottom" />
								</ProForm.Item>
							</Col>
						</Row>
					</Spin>
				</ProForm>
			</SettingsSection>

			<SettingsSection
				sectionId="trayIconSettings"
				title={
					<FormattedMessage id="settings.commonSettings.trayIconSettings" />
				}
				extra={
					<ResetSettingsButton
						title={intl.formatMessage({
							id: "settings.commonSettings.trayIconSettings",
						})}
						appSettingsGroup={AppSettingsGroup.CommonTrayIcon}
					/>
				}
			>
				<ProForm<AppSettingsData[AppSettingsGroup.CommonTrayIcon]>
					form={trayIconForm}
					submitter={false}
					onValuesChange={(_, values) => {
						updateAppSettings(
							AppSettingsGroup.CommonTrayIcon,
							values,
							true,
							true,
							true,
							true,
							false,
						);
					}}
					layout="horizontal"
				>
					<Spin spinning={appSettingsLoading}>
						<Row gutter={token.marginLG}>
							<Col span={12}>
								<ProFormSwitch
									name="enableTrayIcon"
									label={
										<IconLabel
											label={
												<FormattedMessage id="settings.commonSettings.trayIconSettings.enableTrayIcon" />
											}
											tooltipTitle={
												<FormattedMessage id="settings.commonSettings.trayIconSettings.enableTrayIconTip" />
											}
										/>
									}
								/>
							</Col>

							<Col span={24}>
								<ProFormRadio.Group
									name="defaultIcons"
									label={
										<FormattedMessage id="settings.commonSettings.trayIconSettings.defaultIcons" />
									}
									fieldProps={{
										className: "tray-icon-radio-group",
									}}
									options={defaultIconsOptions}
								/>
							</Col>

							<Col span={24}>
								<ProForm.Item
									name="iconPath"
									label={
										<IconLabel
											label={
												<FormattedMessage id="settings.commonSettings.trayIconSettings.iconPath" />
											}
											tooltipTitle={
												<FormattedMessage id="settings.commonSettings.trayIconSettings.iconPath.tip" />
											}
										/>
									}
									required={false}
								>
									<PathInput
										filters={[
											{ name: "PNG(*.png)", extensions: ["png"] },
											{ name: "ICO(*.ico)", extensions: ["ico"] },
										]}
									/>
								</ProForm.Item>
							</Col>

							<Col span={24}>
								<ProFormRadio.Group
									name="defaultIconsDark"
									label={
										<FormattedMessage id="settings.commonSettings.trayIconSettings.defaultIcons.darkDefault" />
									}
									fieldProps={{
										className: "tray-icon-radio-group",
									}}
									options={defaultIconsOptions}
								/>
							</Col>

							<Col span={24}>
								<ProForm.Item
									name="iconPathDark"
									label={
										<IconLabel
											label={
												<FormattedMessage id="settings.commonSettings.trayIconSettings.iconPath.darkDefault" />
											}
											tooltipTitle={
												<FormattedMessage id="settings.commonSettings.trayIconSettings.iconPath.tip" />
											}
										/>
									}
									required={false}
								>
									<PathInput
										filters={[
											{ name: "PNG(*.png)", extensions: ["png"] },
											{ name: "ICO(*.ico)", extensions: ["ico"] },
										]}
									/>
								</ProForm.Item>
							</Col>
						</Row>
					</Spin>
				</ProForm>
			</SettingsSection>

			<style jsx>{`
                :global(.settings-form)
                    :global(.settings-wrap-language)
                    :global(.ant-form-item-control) {
                    flex-grow: unset !important;
                    min-width: 128px;
                }

                :global(.tray-icon-radio-group) {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px 12px;
                    align-items: center;
                }

                :global(.tray-icon-radio-group .ant-radio-wrapper) {
                    margin-inline-end: 0;
                    align-items: center;
                    white-space: nowrap;
                }

                :global(.tray-icon-radio-group .ant-radio + span) {
                    padding-inline-start: 4px;
                }

                :global(.tray-icon-option) {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    line-height: 22px;
                    white-space: nowrap;
                }

                :global(.tray-icon-preview) {
                    width: 22px;
                    height: 22px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    flex: 0 0 auto;
                    border: 1px solid ${token.colorBorderSecondary};
                    border-radius: ${token.borderRadiusSM}px;
                    background-color: ${token.colorBgContainer};
                    background-image:
                        linear-gradient(45deg, ${token.colorFillSecondary} 25%, transparent 25%),
                        linear-gradient(-45deg, ${token.colorFillSecondary} 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, ${token.colorFillSecondary} 75%),
                        linear-gradient(-45deg, transparent 75%, ${token.colorFillSecondary} 75%);
                    background-size: 8px 8px;
                    background-position: 0 0, 0 4px, 4px -4px, -4px 0;
                }

                :global(.tray-icon-preview .ant-image) {
                    width: 18px;
                    height: 18px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }

                :global(.tray-icon-preview img) {
                    display: block;
                    object-fit: contain;
                }
            `}</style>
		</ContentWrap>
	);
};
