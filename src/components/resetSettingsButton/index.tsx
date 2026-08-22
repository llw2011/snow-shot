import { Button, Popconfirm } from "antd";
import { useContext } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { defaultAppSettingsData } from "@/constants/appSettings";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import type { AppSettingsGroup } from "@/types/appSettings";
import { ResetIcon } from "../icons";

export const ResetSettingsButton: React.FC<{
	onReset?: () => void;
	appSettingsGroup?: AppSettingsGroup;
	title: React.ReactNode;
	filter?: (groupSettings: Record<string, unknown>) => Record<string, unknown>;
}> = ({ onReset, title, appSettingsGroup, filter }) => {
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const intl = useIntl();
	const resetLabel = intl.formatMessage({ id: "settings.resetSettingsAction" });
	return (
		<>
			<Popconfirm
				title={
					<FormattedMessage id="settings.resetSettings" values={{ title }} />
				}
				onConfirm={() => {
					onReset?.();

					if (appSettingsGroup) {
						updateAppSettings(
							appSettingsGroup,
							filter
								? filter(defaultAppSettingsData[appSettingsGroup])
								: defaultAppSettingsData[appSettingsGroup],
							false,
							true,
							true,
							false,
						);
					}
				}}
			>
				<Button
					type="text"
					className="reset-settings-button"
					aria-label={resetLabel}
					title={resetLabel}
				>
					<ResetIcon />
					<span className="reset-settings-button-label">{resetLabel}</span>
				</Button>
			</Popconfirm>

			<style jsx global>{`
				.reset-settings-button.ant-btn {
					display: inline-flex;
					align-items: center;
					gap: 6px;
					min-width: 0;
					padding-inline: 9px;
					color: var(--snow-shot-muted);
					font-size: 13px;
				}

				.reset-settings-button.ant-btn:hover {
					color: var(--snow-shot-ink);
					background: var(--snow-shot-surface-elevated);
				}

				@media (max-width: 520px) {
					.reset-settings-button.ant-btn {
						width: 32px;
						padding-inline: 0;
					}

					.reset-settings-button-label {
						display: none;
					}
				}
			`}</style>
		</>
	);
};
