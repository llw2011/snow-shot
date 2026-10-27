import ProForm, { ProFormSlider, ProFormSwitch } from "@ant-design/pro-form";
import { Spin } from "antd";
import { FormattedMessage } from "react-intl";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import { AppSettingsGroup } from "@/types/appSettings";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

const label = (id: string, withTip = false) => (
	<IconLabel
		label={<FormattedMessage id={id} />}
		tooltipTitle={withTip ? <FormattedMessage id={`${id}.tip`} /> : undefined}
	/>
);

/** Session behavior of the AI chat window. */
export const ChatSessionSection = () => {
	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.FunctionChat,
	);

	return (
		<SettingsGroup
			title={<FormattedMessage id="workbench.group.chatSessions" />}
		>
			<Spin spinning={loading}>
				<ProForm
					form={form}
					submitter={false}
					autoFocusFirstInput={false}
					layout="horizontal"
					onValuesChange={(changedValues) => save(changedValues)}
				>
					<ProFormSwitch
						name="autoCreateNewSession"
						label={label(
							"settings.functionSettings.chatSettings.autoCreateNewSession",
						)}
					/>
					<ProFormSwitch
						name="autoCreateNewSessionOnCloseWindow"
						label={label(
							"settings.functionSettings.chatSettings.autoCreateNewSessionOnCloseWindow",
						)}
					/>
				</ProForm>
			</Spin>
		</SettingsGroup>
	);
};

/** Sampling and length limits applied to every chat request. */
export const ChatGenerationSection = () => {
	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.SystemChat,
		{ syncAllWindow: false },
	);

	return (
		<SettingsGroup
			title={<FormattedMessage id="workbench.group.chatGeneration" />}
			extra={
				<ResetSettingsButton
					title={<FormattedMessage id="settings.chatSettings" />}
					appSettingsGroup={AppSettingsGroup.SystemChat}
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
					<ProFormSlider
						name="maxTokens"
						label={label("settings.chatSettings.maxTokens", true)}
						min={512}
						max={8192}
						step={128}
						marks={{ 512: "512", 4096: "4096", 8192: "8192" }}
					/>
					<ProFormSlider
						name="temperature"
						label={label("settings.chatSettings.temperature", true)}
						min={0}
						max={2}
						step={0.1}
						marks={{ 0: "0", 1: "1", 2: "2" }}
					/>
					<ProFormSlider
						name="thinkingBudgetTokens"
						label={label("settings.chatSettings.thinkingBudgetTokens", true)}
						min={1024}
						max={8192}
						step={128}
						marks={{ 1024: "1024", 4096: "4096", 8192: "8192" }}
					/>
				</ProForm>
			</Spin>
		</SettingsGroup>
	);
};
