"use client";

import ProForm from "@ant-design/pro-form";
import {
	Col,
	ColorPicker,
	Form,
	Row,
	Select,
	Slider,
	Spin,
	Switch,
	theme,
} from "antd";
import type { AggregationColor } from "antd/es/color-picker/color";
import TextArea from "antd/es/input/TextArea";
import { debounce } from "es-toolkit";
import { useCallback, useContext, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { ContentWrap } from "@/components/contentWrap";
import { IconLabel } from "@/components/iconLable";
import { DarkModeIcon } from "@/components/icons";
import { PathInput } from "@/components/pathInput";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsSection } from "@/components/settingsSection";
import {
	getAppThemePreset,
	getAppThemeRuntime,
	isAppThemePreset,
} from "@/constants/themePresets";
import { AppContext } from "@/contexts/appContext";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { useStateRef } from "@/hooks/useStateRef";
import {
	type AppSettingsData,
	AppSettingsGroup,
	AppSettingsTheme,
} from "@/types/appSettings";
import { ThemePresetSelector } from "./components/themePresetSelector";

export const AppearancePage = () => {
	const intl = useIntl();
	const { token } = theme.useToken();
	const { currentTheme } = useContext(AppContext);

	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const [commonForm] = Form.useForm<AppSettingsData[AppSettingsGroup.Common]>();
	const [themeSkinForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.ThemeSkin]>();
	const skinPath = Form.useWatch("skinPath", themeSkinForm);
	const hasSkinImage =
		typeof skinPath === "string" && skinPath.trim().length > 0;

	const [appSettingsLoading, setAppSettingsLoading] = useStateRef(true);
	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData, preSettings?: AppSettingsData) => {
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
					preSettings[AppSettingsGroup.ThemeSkin] !==
						settings[AppSettingsGroup.ThemeSkin]
				) {
					themeSkinForm.setFieldsValue(settings[AppSettingsGroup.ThemeSkin]);
				}
			},
			[commonForm, themeSkinForm, setAppSettingsLoading],
		),
		true,
	);

	const skinPositionOptions = useMemo(() => {
		return [
			{
				label: intl.formatMessage({
					id: "settings.themeSkinSettings.skinPosition.top",
				}),
				value: "top",
			},
			{
				label: intl.formatMessage({
					id: "settings.themeSkinSettings.skinPosition.bottom",
				}),
				value: "bottom",
			},
			{
				label: intl.formatMessage({
					id: "settings.themeSkinSettings.skinPosition.left",
				}),
				value: "left",
			},
			{
				label: intl.formatMessage({
					id: "settings.themeSkinSettings.skinPosition.right",
				}),
				value: "right",
			},
			{
				label: intl.formatMessage({
					id: "settings.themeSkinSettings.skinPosition.center",
				}),
				value: "center",
			},
		];
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

	const skinImageSizeOptions = useMemo(() => {
		return [
			{
				label: intl.formatMessage({
					id: "settings.themeSkinSettings.skinImageSize.cover",
				}),
				value: "cover",
			},
			{
				label: intl.formatMessage({
					id: "settings.themeSkinSettings.skinImageSize.contain",
				}),
				value: "contain",
			},
		];
	}, [intl]);

	const updateAppSettingsDebounce = useMemo(() => {
		return debounce(updateAppSettings, 1 * 1000);
	}, [updateAppSettings]);

	return (
		<ContentWrap className="settings-wrap">
			<SettingsSection
				sectionId="commonSettings"
				title={<FormattedMessage id="appearance.title" />}
				extra={
					<ResetSettingsButton
						title={<FormattedMessage id="appearance.title" key="appearance" />}
						appSettingsGroup={AppSettingsGroup.Common}
					/>
				}
				defaultOpen
			>
				<Form
					className="settings-form common-settings-form"
					form={commonForm}
					onValuesChange={(changedValues, values) => {
						const themePresetChanged = isAppThemePreset(
							changedValues.themePreset,
						);
						if (themePresetChanged) {
							const preset = getAppThemePreset(changedValues.themePreset);
							const runtime = getAppThemeRuntime(
								changedValues.themePreset,
								currentTheme,
							);
							values.mainColor = runtime.recommendedAccent;
							values.borderRadius = preset.recommendedRadius;
							commonForm.setFieldsValue({
								mainColor: runtime.recommendedAccent,
								borderRadius: preset.recommendedRadius,
							});
						}

						if (typeof values.mainColor === "object") {
							values.mainColor = (
								values.mainColor as AggregationColor
							).toHexString();
						}

						const updateCommonSettings = themePresetChanged
							? updateAppSettings
							: updateAppSettingsDebounce;
						updateCommonSettings(
							AppSettingsGroup.Common,
							values,
							true,
							true,
							true,
							false,
							false,
						);
					}}
					layout="vertical"
				>
					<Spin spinning={appSettingsLoading}>
						<Row gutter={token.marginLG}>
							<Col span={24}>
								<Form.Item
									name="themePreset"
									label={
										<IconLabel
											label={
												<FormattedMessage id="appearance.themePreset.title" />
											}
										/>
									}
									extra={
										<FormattedMessage id="appearance.themePreset.description" />
									}
								>
									<ThemePresetSelector mode={currentTheme} />
								</Form.Item>
							</Col>
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
								<ProForm.Item
									name="mainColor"
									label={
										<IconLabel
											label={<FormattedMessage id="settings.theme.mainColor" />}
										/>
									}
								>
									<ColorPicker showText placement="bottom" />
								</ProForm.Item>
							</Col>
							<Col span={12}>
								<ProForm.Item
									name="borderRadius"
									label={<FormattedMessage id="settings.borderRadius" />}
								>
									<Slider
										min={0}
										max={16}
										step={1}
										marks={{ 0: "0px", 16: "16px" }}
									/>
								</ProForm.Item>
							</Col>
							<Col span={12}>
								<ProForm.Item
									name="enableCompactLayout"
									label={<FormattedMessage id="settings.compactLayout" />}
								>
									<Switch />
								</ProForm.Item>
							</Col>
						</Row>
					</Spin>
				</Form>
			</SettingsSection>

			<SettingsSection
				sectionId="themeSkinSettings"
				title={<FormattedMessage id="appearance.themeSkinSettings" />}
				extra={
					<ResetSettingsButton
						title={intl.formatMessage({ id: "settings.themeSkinSettings" })}
						appSettingsGroup={AppSettingsGroup.ThemeSkin}
					/>
				}
			>
				<Form
					className="settings-form theme-skin-settings-form"
					form={themeSkinForm}
					onValuesChange={(_, values) => {
						updateAppSettingsDebounce(
							AppSettingsGroup.ThemeSkin,
							values,
							true,
							true,
							true,
							false,
							false,
						);
					}}
					layout="vertical"
				>
					<Spin spinning={appSettingsLoading}>
						<Row gutter={token.marginLG}>
							<Col span={24}>
								<ProForm.Item
									name="skinPath"
									label={
										<IconLabel
											label={
												<FormattedMessage id="appearance.customBackground.path.label" />
											}
											tooltipTitle={
												<FormattedMessage id="appearance.customBackground.path.tip" />
											}
										/>
									}
									extra={
										<FormattedMessage id="appearance.customBackground.path.description" />
									}
									required={false}
								>
									<PathInput
										placeholder={intl.formatMessage({
											id: "appearance.customBackground.path.placeholder",
										})}
										filters={[
											{
												name: "Image(*.png,*.jpg,*.gif,*webp,*.avif)",
												extensions: ["png", "jpg", "gif", "webp", "avif"],
											},
										]}
									/>
								</ProForm.Item>
							</Col>
							<Col span={12}>
								<ProForm.Item
									name="skinImageSize"
									label={
										<FormattedMessage id="settings.themeSkinSettings.skinImageSize" />
									}
								>
									<Select
										disabled={!hasSkinImage}
										options={skinImageSizeOptions}
									/>
								</ProForm.Item>
							</Col>
							<Col span={12}>
								<ProForm.Item
									name="skinPosition"
									label={
										<FormattedMessage id="settings.themeSkinSettings.skinPosition" />
									}
								>
									<Select
										disabled={!hasSkinImage}
										options={skinPositionOptions}
									/>
								</ProForm.Item>
							</Col>
							<Col span={12}>
								<ProForm.Item
									name="skinOpacity"
									label={
										<FormattedMessage id="settings.themeSkinSettings.skinOpacity" />
									}
								>
									<Slider
										disabled={!hasSkinImage}
										min={0}
										max={100}
										step={1}
										marks={{ 0: "0%", 100: "100%" }}
									/>
								</ProForm.Item>
							</Col>
							<Col span={12}>
								<ProForm.Item
									name="skinBlur"
									label={
										<FormattedMessage id="settings.themeSkinSettings.skinBlur" />
									}
								>
									<Slider
										disabled={!hasSkinImage}
										min={0}
										max={32}
										step={1}
										marks={{ 0: "0px", 32: "32px" }}
									/>
								</ProForm.Item>
							</Col>
							<Col span={12}>
								<ProForm.Item
									name="skinMaskOpacity"
									label={
										<FormattedMessage id="settings.themeSkinSettings.skinMaskOpacity" />
									}
								>
									<Slider
										disabled={!hasSkinImage}
										min={0}
										max={100}
										step={1}
										marks={{ 0: "0%", 100: "100%" }}
									/>
								</ProForm.Item>
							</Col>
							<Col span={12}>
								<ProForm.Item
									name="skinMaskBlur"
									label={
										<FormattedMessage id="settings.themeSkinSettings.skinMaskBlur" />
									}
								>
									<Slider
										disabled={!hasSkinImage}
										min={0}
										max={32}
										step={1}
										marks={{ 0: "0px", 32: "32px" }}
									/>
								</ProForm.Item>
							</Col>
							<Col span={24}>
								<ProForm.Item
									name="customCss"
									label={
										<FormattedMessage id="settings.themeSkinSettings.customCss" />
									}
									extra={
										<FormattedMessage id="appearance.customBackground.customCss.description" />
									}
								>
									<TextArea
										autoSize={{
											minRows: 10,
											maxRows: 20,
										}}
									/>
								</ProForm.Item>
							</Col>
						</Row>
					</Spin>
				</Form>
			</SettingsSection>

			<style jsx>{`
                :global(.settings-wrap) {
                    margin-top: ${token.margin}px;
                }

                :global(.settings-form)
                    :global(.settings-wrap-language)
                    :global(.ant-form-item-control) {
                    flex-grow: unset !important;
                    min-width: 128px;
                }
            `}</style>
		</ContentWrap>
	);
};
