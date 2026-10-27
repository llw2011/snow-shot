import ProForm, {
	ProFormRadio,
	ProFormSelect,
	ProFormSwitch,
} from "@ant-design/pro-form";
import { resourceDir } from "@tauri-apps/api/path";
import { type CheckboxOptionType, Image, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { IconLabel } from "@/components/iconLable";
import { PathInput } from "@/components/pathInput";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import { getDefaultIconPath } from "@/components/trayIconLoader";
import {
	AppSettingsGroup,
	TrayIconClickAction,
	TrayIconDefaultIcon,
} from "@/types/appSettings";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

const ICON_FILTERS = [
	{ name: "PNG(*.png)", extensions: ["png"] },
	{ name: "ICO(*.ico)", extensions: ["ico"] },
];

const DEFAULT_ICONS: [TrayIconDefaultIcon, string][] = [
	[TrayIconDefaultIcon.Default, "default"],
	[TrayIconDefaultIcon.Light, "light"],
	[TrayIconDefaultIcon.Dark, "dark"],
	[TrayIconDefaultIcon.SnowDefault, "snowDefault"],
	[TrayIconDefaultIcon.SnowLight, "snowLight"],
	[TrayIconDefaultIcon.SnowDark, "snowDark"],
];

const prefix = "settings.commonSettings.trayIconSettings";

const useDefaultIconOptions = () => {
	const intl = useIntl();
	const [options, setOptions] = useState<
		CheckboxOptionType<TrayIconDefaultIcon>[]
	>([]);

	useEffect(() => {
		let canceled = false;
		(async () => {
			const appDataDir = await resourceDir();
			const paths = await Promise.all(
				DEFAULT_ICONS.map(([icon]) => getDefaultIconPath(icon, appDataDir)),
			);
			if (canceled) {
				return;
			}

			setOptions(
				DEFAULT_ICONS.map(([icon, messageKey], index) => {
					const title = intl.formatMessage({
						id: `${prefix}.defaultIcons.${messageKey}`,
					});
					return {
						title,
						value: icon,
						label: (
							<span className="tray-icon-option">
								<span className="tray-icon-preview">
									<Image
										preview={false}
										src={paths[index].web_path}
										width={16}
										height={16}
										alt=""
									/>
								</span>
								<span>{title}</span>
							</span>
						),
					};
				}),
			);
		})();

		return () => {
			canceled = true;
		};
	}, [intl]);

	return options;
};

/** Tray icon visibility, artwork and click behavior. */
export const TraySection = () => {
	const intl = useIntl();
	const defaultIconOptions = useDefaultIconOptions();
	// The tray group is split over two forms so the click action can sit
	// between the toggle and the artwork; each form saves only its own fields.
	const icon = useSettingsGroupForm(AppSettingsGroup.CommonTrayIcon);
	const artwork = useSettingsGroupForm(AppSettingsGroup.CommonTrayIcon);
	const click = useSettingsGroupForm(AppSettingsGroup.FunctionTrayIcon, {
		syncAllWindow: false,
	});

	const clickActionOptions = useMemo(
		() => [
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
		],
		[intl],
	);

	return (
		<SettingsGroup
			title={<FormattedMessage id={prefix} />}
			extra={
				<ResetSettingsButton
					title={<FormattedMessage id={prefix} />}
					appSettingsGroup={AppSettingsGroup.CommonTrayIcon}
				/>
			}
		>
			<Spin spinning={icon.loading || artwork.loading || click.loading}>
				<ProForm
					form={icon.form}
					submitter={false}
					autoFocusFirstInput={false}
					layout="horizontal"
					onValuesChange={(_, values) => icon.save(values)}
				>
					<ProFormSwitch
						name="enableTrayIcon"
						label={
							<IconLabel
								label={<FormattedMessage id={`${prefix}.enableTrayIcon`} />}
								tooltipTitle={
									<FormattedMessage id={`${prefix}.enableTrayIconTip`} />
								}
							/>
						}
					/>
				</ProForm>
				<ProForm
					form={click.form}
					submitter={false}
					autoFocusFirstInput={false}
					layout="horizontal"
					onValuesChange={(_, values) => click.save(values)}
				>
					<ProFormSelect
						name="iconClickAction"
						label={
							<FormattedMessage id="settings.functionSettings.trayIconSettings.iconClickAction" />
						}
						options={clickActionOptions}
						allowClear={false}
					/>
				</ProForm>
				<ProForm
					form={artwork.form}
					submitter={false}
					autoFocusFirstInput={false}
					layout="horizontal"
					onValuesChange={(_, values) => artwork.save(values)}
				>
					<ProFormRadio.Group
						name="defaultIcons"
						label={<FormattedMessage id={`${prefix}.defaultIcons`} />}
						options={defaultIconOptions}
					/>
					<ProForm.Item
						name="iconPath"
						label={
							<IconLabel
								label={<FormattedMessage id={`${prefix}.iconPath`} />}
								tooltipTitle={
									<FormattedMessage id={`${prefix}.iconPath.tip`} />
								}
							/>
						}
						required={false}
					>
						<PathInput filters={ICON_FILTERS} />
					</ProForm.Item>
					<ProFormRadio.Group
						name="defaultIconsDark"
						label={
							<FormattedMessage id={`${prefix}.defaultIcons.darkDefault`} />
						}
						options={defaultIconOptions}
					/>
					<ProForm.Item
						name="iconPathDark"
						label={
							<IconLabel
								label={
									<FormattedMessage id={`${prefix}.iconPath.darkDefault`} />
								}
								tooltipTitle={
									<FormattedMessage id={`${prefix}.iconPath.tip`} />
								}
							/>
						}
						required={false}
					>
						<PathInput filters={ICON_FILTERS} />
					</ProForm.Item>
				</ProForm>
			</Spin>
			<style jsx global>{`
				.tray-icon-option {
					display: inline-flex;
					align-items: center;
					gap: 6px;
					white-space: nowrap;
				}

				.tray-icon-preview {
					display: inline-flex;
					align-items: center;
					justify-content: center;
					width: 22px;
					height: 22px;
					border: 1px solid var(--snow-shot-hairline-soft);
					border-radius: 5px;
					background: var(--snow-shot-surface-elevated);
				}

				.tray-icon-preview img {
					display: block;
					object-fit: contain;
				}
			`}</style>
		</SettingsGroup>
	);
};
