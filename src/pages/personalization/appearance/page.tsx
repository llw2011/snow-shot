"use client";

import { Form, Select, Spin, theme } from "antd";
import { debounce } from "es-toolkit";
import { useCallback, useContext, useId, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { ContentWrap } from "@/components/contentWrap";
import { IconLabel } from "@/components/iconLable";
import { DarkModeIcon } from "@/components/icons";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { useStateRef } from "@/hooks/useStateRef";
import {
	type AppSettingsData,
	AppSettingsGroup,
	AppSettingsTheme,
} from "@/types/appSettings";

export const AppearancePage = () => {
	const intl = useIntl();
	const { token } = theme.useToken();
	const appearanceTitleId = useId();
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const [commonForm] = Form.useForm<AppSettingsData[AppSettingsGroup.Common]>();
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
			},
			[commonForm, setAppSettingsLoading],
		),
		true,
	);

	const themeOptions = useMemo(
		() => [
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
		],
		[intl],
	);

	const updateAppSettingsDebounce = useMemo(
		() => debounce(updateAppSettings, 1_000),
		[updateAppSettings],
	);

	return (
		<ContentWrap className="settings-wrap appearance-workspace">
			<section className="appearance-board" aria-labelledby={appearanceTitleId}>
				<header className="appearance-board-header">
					<h1 id={appearanceTitleId}>
						<FormattedMessage id="appearance.title" />
					</h1>
					<ResetSettingsButton
						title={<FormattedMessage id="appearance.title" key="appearance" />}
						appSettingsGroup={AppSettingsGroup.Common}
					/>
				</header>
				<Form
					className="settings-form common-settings-form"
					form={commonForm}
					onValuesChange={(_, values) => {
						updateAppSettingsDebounce(
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
					</Spin>
				</Form>
			</section>

			<style jsx global>{`
                .appearance-workspace {
                    margin-top: ${token.margin}px;
                }

                .appearance-board {
                    width: min(100%, 720px);
                    padding: 0 0 28px;
                    border-top: 1px solid var(--snow-shot-hairline);
                }

                .appearance-board-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    min-height: 56px;
                    border-bottom: 1px solid var(--snow-shot-hairline-soft);
                }

                .appearance-board-header h1 {
                    margin: 0;
                    color: var(--snow-shot-ink);
                    font-size: 16px;
                    font-weight: 600;
                    line-height: 24px;
                }

                .appearance-board .ant-form {
                    padding-top: 20px;
                }
            `}</style>
		</ContentWrap>
	);
};
