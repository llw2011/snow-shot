import ProForm, { ProFormDependency, ProFormText } from "@ant-design/pro-form";
import {
	Alert,
	Col,
	type FormInstance,
	Row,
	Spin,
	Typography,
	theme,
} from "antd";
import { Fragment, useContext } from "react";
import { FormattedMessage } from "react-intl";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsSection } from "@/components/settingsSection";
import { FOCUS_WINDOW_APP_NAME_ENV_VARIABLE } from "@/constants/components/chat";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";
import { generateImageFileName } from "@/utils/file";

type OutputSettings = AppSettingsData[AppSettingsGroup.FunctionOutput];
const FILE_NAME_FIELDS = [
	"manualSaveFileNameFormat",
	"autoSaveFileNameFormat",
	"fastSaveFileNameFormat",
	"focusedWindowFileNameFormat",
	"fullScreenFileNameFormat",
	"videoRecordFileNameFormat",
] as const satisfies ReadonlyArray<keyof OutputSettings>;

export const OutputSettingsSection = ({
	form,
	loading,
}: {
	form: FormInstance<OutputSettings>;
	loading: boolean;
}) => {
	const { token } = theme.useToken();
	const { updateAppSettings } = useContext(AppSettingsActionContext);

	return (
		<SettingsSection
			sectionId="outputSettings"
			title={<FormattedMessage id="settings.functionSettings.outputSettings" />}
			extra={
				<ResetSettingsButton
					title={
						<FormattedMessage id="settings.functionSettings.outputSettings" />
					}
					appSettingsGroup={AppSettingsGroup.FunctionOutput}
				/>
			}
		>
			<Alert
				message={
					<Typography>
						<Row>
							<Col span={24}>
								<FormattedMessage id="settings.functionSettings.outputSettings.variables" />
							</Col>
							<Col span={12}>
								<FormattedMessage id="settings.functionSettings.outputSettings.variables.date" />
								<code>{"{{YYYY-MM-DD_HH-mm-ss}}"}</code>
							</Col>
							<Col span={12}>
								<FormattedMessage id="settings.functionSettings.outputSettings.variables.focusedWindowAppName" />
								<code>{FOCUS_WINDOW_APP_NAME_ENV_VARIABLE}</code>
							</Col>
						</Row>
					</Typography>
				}
				type="info"
				style={{ marginBottom: token.margin }}
			/>

			<Spin spinning={loading}>
				<ProForm
					form={form}
					onValuesChange={(_, values) => {
						updateAppSettings(
							AppSettingsGroup.FunctionOutput,
							values,
							true,
							true,
							true,
							true,
							false,
						);
					}}
					submitter={false}
					layout="horizontal"
				>
					<Row gutter={token.marginLG}>
						{FILE_NAME_FIELDS.map((field) => (
							<Fragment key={field}>
								<Col span={24}>
									<ProFormText
										name={field}
										layout="horizontal"
										label={
											<FormattedMessage
												id={`settings.functionSettings.outputSettings.${field}`}
											/>
										}
									/>
								</Col>
								<ProFormDependency<OutputSettings> name={[field]}>
									{(values) => (
										<Col span={24}>
											<ProFormText
												layout="horizontal"
												readonly
												label={
													<FormattedMessage
														id={`settings.functionSettings.outputSettings.${field}Preview`}
													/>
												}
												fieldProps={{
													value: generateImageFileName(values[field]),
												}}
											/>
										</Col>
									)}
								</ProFormDependency>
							</Fragment>
						))}
					</Row>
				</ProForm>
			</Spin>
		</SettingsSection>
	);
};
