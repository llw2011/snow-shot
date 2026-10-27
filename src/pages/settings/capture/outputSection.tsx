import ProForm, { ProFormText } from "@ant-design/pro-form";
import { Form, Spin } from "antd";
import { FormattedMessage } from "react-intl";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import { FOCUS_WINDOW_APP_NAME_ENV_VARIABLE } from "@/constants/components/chat";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";
import { generateImageFileName } from "@/utils/file";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

type OutputSettings = AppSettingsData[AppSettingsGroup.FunctionOutput];

const FILE_NAME_FIELDS = [
	"manualSaveFileNameFormat",
	"autoSaveFileNameFormat",
	"fastSaveFileNameFormat",
	"focusedWindowFileNameFormat",
	"fullScreenFileNameFormat",
	"videoRecordFileNameFormat",
] as const satisfies ReadonlyArray<keyof OutputSettings>;

const FileNamePreview: React.FC<{
	field: (typeof FILE_NAME_FIELDS)[number];
}> = ({ field }) => {
	const value = Form.useWatch(field);
	if (!value) {
		return null;
	}

	return (
		<span className="settings-file-name-preview">
			{generateImageFileName(value)}
		</span>
	);
};

/** File name templates for every way an image or video can be written. */
export const OutputSection = () => {
	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.FunctionOutput,
	);

	return (
		<SettingsGroup
			title={<FormattedMessage id="workbench.group.fileNames" />}
			description={
				<FormattedMessage
					id="workbench.outputVariables"
					values={{
						date: <code key="date">{"{{YYYY-MM-DD_HH-mm-ss}}"}</code>,
						app: <code key="app">{FOCUS_WINDOW_APP_NAME_ENV_VARIABLE}</code>,
					}}
				/>
			}
			extra={
				<ResetSettingsButton
					title={
						<FormattedMessage id="settings.functionSettings.outputSettings" />
					}
					appSettingsGroup={AppSettingsGroup.FunctionOutput}
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
					{FILE_NAME_FIELDS.map((field) => (
						<ProFormText
							key={field}
							name={field}
							label={
								<FormattedMessage
									id={`settings.functionSettings.outputSettings.${field}`}
								/>
							}
							extra={<FileNamePreview field={field} />}
							fieldProps={{ className: "settings-stack" }}
						/>
					))}
				</ProForm>
			</Spin>
			<style jsx global>{`
				.settings-file-name-preview {
					color: var(--snow-shot-muted);
					font-family: var(--snow-shot-font-mono);
					font-size: 12px;
				}
			`}</style>
		</SettingsGroup>
	);
};
