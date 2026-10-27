import ProForm, {
	ProFormRadio,
	ProFormSelect,
	ProFormSlider,
	ProFormSwitch,
} from "@ant-design/pro-form";
import { ColorPicker, Select, Spin } from "antd";
import type { AggregationColor } from "antd/es/color-picker/color";
import { useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import {
	AppSettingsControlNode,
	type AppSettingsData,
	AppSettingsGroup,
	ColorPickerShowMode,
} from "@/types/appSettings";
import { DrawState } from "@/types/draw";
import { useOcrReady } from "../shared/hooks";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

type ScreenshotUiSettings = AppSettingsData[AppSettingsGroup.Screenshot];

const COLOR_FIELDS = [
	"fullScreenAuxiliaryLineColor",
	"monitorCenterAuxiliaryLineColor",
	"colorPickerCenterAuxiliaryLineColor",
	"selectRectMaskColor",
] as const satisfies ReadonlyArray<keyof ScreenshotUiSettings>;

const PERCENT_MARKS = { 0: "0%", 100: "100%" };
const SCALE_MARKS = { 25: "25%", 100: "100%" };

/** Appearance of the selection overlay and its toolbar. */
export const ScreenshotUiSection = () => {
	const intl = useIntl();
	const ocrReady = useOcrReady();
	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.Screenshot,
	);

	const toolbarToolOptions = useMemo(() => {
		const tools: [string, DrawState][] = [
			["draw.selectTool", DrawState.Select],
			["draw.ellipseTool", DrawState.Ellipse],
			["draw.arrowTool", DrawState.Arrow],
			["draw.penTool", DrawState.Pen],
			["draw.textTool", DrawState.Text],
			["draw.serialNumberTool", DrawState.SerialNumber],
			["draw.blurTool", DrawState.Blur],
			["draw.eraserTool", DrawState.Eraser],
			["draw.watermarkTool", DrawState.Watermark],
			["draw.highlightTool", DrawState.Highlight],
			["draw.redoUndoTool", DrawState.Redo],
			["draw.fixedTool", DrawState.Fixed],
			["draw.ocrDetectTool", DrawState.OcrDetect],
			["draw.ocrTranslateTool", DrawState.OcrTranslate],
			["draw.scrollScreenshotTool", DrawState.ScrollScreenshot],
		];

		return tools
			.filter(
				([, value]) =>
					ocrReady ||
					(value !== DrawState.OcrDetect && value !== DrawState.OcrTranslate),
			)
			.map(([id, value]) => ({ label: intl.formatMessage({ id }), value }));
	}, [intl, ocrReady]);

	return (
		<SettingsGroup
			title={<FormattedMessage id="workbench.group.selectionOverlay" />}
			extra={
				<ResetSettingsButton
					title={intl.formatMessage({ id: "settings.screenshotSettings" })}
					appSettingsGroup={AppSettingsGroup.Screenshot}
				/>
			}
		>
			<Spin spinning={loading}>
				<ProForm<ScreenshotUiSettings>
					form={form}
					submitter={false}
					autoFocusFirstInput={false}
					layout="horizontal"
					onValuesChange={(_, values) => {
						for (const field of COLOR_FIELDS) {
							if (typeof values[field] === "object") {
								values[field] = (
									values[field] as unknown as AggregationColor
								).toHexString();
							}
						}
						save(values);
					}}
				>
					<ProFormSlider
						name="uiScale"
						label={
							<FormattedMessage id="settings.commonSettings.screenshotSettings.uiScale" />
						}
						min={25}
						max={100}
						step={1}
						marks={SCALE_MARKS}
					/>
					<ProFormSlider
						name="toolbarUiScale"
						label={
							<FormattedMessage id="settings.commonSettings.screenshotSettings.toolbarUiScale" />
						}
						min={25}
						max={100}
						step={1}
						marks={SCALE_MARKS}
					/>
					<ProForm.Item
						name="controlNode"
						label={<FormattedMessage id="settings.controlNode" />}
						required={false}
						rules={[{ required: true }]}
					>
						<Select
							options={[
								{
									label: intl.formatMessage({
										id: "settings.controlNode.circle",
									}),
									value: AppSettingsControlNode.Circle,
								},
							]}
						/>
					</ProForm.Item>
					<ProFormSwitch
						name="disableAnimation"
						label={<FormattedMessage id="settings.disableAnimation" />}
					/>
					<ProFormRadio.Group
						name="colorPickerShowMode"
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
					<ProFormSlider
						name="beyondSelectRectElementOpacity"
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
						min={0}
						max={100}
						step={1}
						marks={PERCENT_MARKS}
					/>
					<ProFormSlider
						name="hotKeyTipOpacity"
						label={
							<FormattedMessage id="settings.functionSettings.screenshotSettings.hotKeyTipOpacity" />
						}
						min={0}
						max={100}
						step={1}
						marks={PERCENT_MARKS}
					/>
					<ProForm.Item
						name="selectRectMaskColor"
						label={<FormattedMessage id="settings.selectRectMaskColor" />}
						required={false}
					>
						<ColorPicker showText placement="bottomRight" />
					</ProForm.Item>
					<ProForm.Item
						name="fullScreenAuxiliaryLineColor"
						label={
							<FormattedMessage id="settings.fullScreenAuxiliaryLineColor" />
						}
						required={false}
					>
						<ColorPicker showText placement="bottomRight" />
					</ProForm.Item>
					<ProForm.Item
						name="monitorCenterAuxiliaryLineColor"
						label={
							<FormattedMessage id="settings.monitorCenterAuxiliaryLineColor" />
						}
						required={false}
					>
						<ColorPicker showText placement="bottomRight" />
					</ProForm.Item>
					<ProForm.Item
						name="colorPickerCenterAuxiliaryLineColor"
						label={
							<FormattedMessage id="settings.colorPickerCenterAuxiliaryLineColor" />
						}
						required={false}
					>
						<ColorPicker showText placement="bottomRight" />
					</ProForm.Item>
					<ProFormSelect
						name="toolbarHiddenToolList"
						label={<FormattedMessage id="settings.customToolbarToolList" />}
						options={toolbarToolOptions}
						mode="multiple"
					/>
				</ProForm>
			</Spin>
		</SettingsGroup>
	);
};
