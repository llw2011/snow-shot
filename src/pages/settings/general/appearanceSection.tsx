import ProForm from "@ant-design/pro-form";
import { Segmented, Select, Spin } from "antd";
import { useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import {
	AppSettingsGroup,
	AppSettingsLanguage,
	AppSettingsTheme,
} from "@/types/appSettings";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

const LANGUAGE_OPTIONS = [
	{ label: "简体中文", value: AppSettingsLanguage.ZHHans },
	{ label: "繁體中文", value: AppSettingsLanguage.ZHHant },
	{ label: "English", value: AppSettingsLanguage.EN },
];

/** Interface language and light/dark mode. */
export const AppearanceSection = () => {
	const intl = useIntl();
	// Language and theme re-render the whole application, so state updates
	// must not be skipped.
	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.Common,
		{ ignoreState: false },
	);

	const themeOptions = useMemo(
		() => [
			{
				label: intl.formatMessage({ id: "settings.theme.system" }),
				value: AppSettingsTheme.System,
			},
			{
				label: intl.formatMessage({ id: "settings.theme.light" }),
				value: AppSettingsTheme.Light,
			},
			{
				label: intl.formatMessage({ id: "settings.theme.dark" }),
				value: AppSettingsTheme.Dark,
			},
		],
		[intl],
	);

	return (
		<SettingsGroup
			title={<FormattedMessage id="appearance.title" />}
			extra={
				<ResetSettingsButton
					title={<FormattedMessage id="appearance.title" />}
					appSettingsGroup={AppSettingsGroup.Common}
				/>
			}
		>
			<Spin spinning={loading}>
				<ProForm
					form={form}
					submitter={false}
					autoFocusFirstInput={false}
					layout="horizontal"
					onValuesChange={(changedValues) => save(changedValues)}
				>
					<ProForm.Item
						name="language"
						label={<FormattedMessage id="settings.language" />}
						required={false}
						rules={[{ required: true }]}
					>
						<Select options={LANGUAGE_OPTIONS} />
					</ProForm.Item>
					<ProForm.Item
						name="theme"
						label={<FormattedMessage id="settings.theme" />}
					>
						<Segmented options={themeOptions} />
					</ProForm.Item>
				</ProForm>
			</Spin>
		</SettingsGroup>
	);
};
