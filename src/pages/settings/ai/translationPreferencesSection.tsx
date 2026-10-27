import ProForm, {
	ProFormDigit,
	ProFormSwitch,
	ProFormTextArea,
} from "@ant-design/pro-form";
import { Select, Spin } from "antd";
import { FormattedMessage, useIntl } from "react-intl";
import { IconLabel } from "@/components/iconLable";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import {
	useLanguageOptions,
	useTranslationDomainOptions,
	useTranslationTypeOptions,
} from "@/components/translator";
import {
	SOURCE_LANGUAGE_ENV_VARIABLE,
	TARGET_LANGUAGE_ENV_VARIABLE,
	TRANSLATION_DOMAIN_ENV_VARIABLE,
} from "@/constants/components/translation";
import { useTranslationRequest } from "@/core/translations";
import { AppSettingsGroup } from "@/types/appSettings";
import { SettingsLine } from "../shared/settingsLine";
import { useSettingsGroupForm } from "../shared/useSettingsGroupForm";

const prefix = "settings.functionSettings.translationSettings";
const POPUP_STYLES = { popup: { root: { minWidth: 200 } } };

/** Default languages, engine and domain used by every translation entry. */
export const TranslationDefaultsSection = () => {
	const {
		sourceLanguage,
		updateSourceLanguage,
		targetLanguage,
		updateTargetLanguage,
		translationDomain,
		updateTranslationDomain,
		translationType,
		updateTranslationType,
		supportedTranslationTypes,
	} = useTranslationRequest();
	const { sourceLanguageOptions, targetLanguageOptions } = useLanguageOptions();
	const translationDomainOptions = useTranslationDomainOptions();
	const { translationTypeOptions } = useTranslationTypeOptions(
		supportedTranslationTypes,
	);

	return (
		<SettingsGroup
			title={<FormattedMessage id="workbench.group.translationDefaults" />}
			rows={false}
		>
			<SettingsLine
				label={<FormattedMessage id="tools.translation.type" />}
				description={<FormattedMessage id="workbench.translation.typeHint" />}
				control={
					<Select
						value={translationType}
						onChange={updateTranslationType}
						options={translationTypeOptions}
						style={{ width: 220 }}
						styles={POPUP_STYLES}
					/>
				}
			/>
			<SettingsLine
				label={<FormattedMessage id="tools.translation.sourceLanguage" />}
				control={
					<Select
						value={sourceLanguage}
						onChange={updateSourceLanguage}
						options={sourceLanguageOptions}
						style={{ width: 220 }}
						styles={POPUP_STYLES}
						showSearch
						optionFilterProp="label"
					/>
				}
			/>
			<SettingsLine
				label={<FormattedMessage id="tools.translation.targetLanguage" />}
				control={
					<Select
						value={targetLanguage}
						onChange={updateTargetLanguage}
						options={targetLanguageOptions}
						style={{ width: 220 }}
						styles={POPUP_STYLES}
						showSearch
						optionFilterProp="label"
					/>
				}
			/>
			<SettingsLine
				label={<FormattedMessage id="tools.translation.domain" />}
				control={
					<Select
						value={translationDomain}
						onChange={updateTranslationDomain}
						options={translationDomainOptions}
						style={{ width: 220 }}
					/>
				}
			/>
		</SettingsGroup>
	);
};

/** Generation parameters and the system prompt for AI translation. */
export const TranslationModelSection = () => {
	const intl = useIntl();
	const { form, loading, save } = useSettingsGroupForm(
		AppSettingsGroup.FunctionTranslation,
	);

	const label = (key: string) => (
		<IconLabel
			label={<FormattedMessage id={`${prefix}.${key}`} />}
			tooltipTitle={<FormattedMessage id={`${prefix}.${key}.tip`} />}
		/>
	);

	return (
		<Spin spinning={loading}>
			<ProForm
				form={form}
				submitter={false}
				autoFocusFirstInput={false}
				layout="horizontal"
				onValuesChange={(changedValues) => save(changedValues)}
			>
				<SettingsGroup
					title={<FormattedMessage id="workbench.group.aiTranslation" />}
					extra={
						<ResetSettingsButton
							title={<FormattedMessage id={prefix} />}
							appSettingsGroup={AppSettingsGroup.FunctionTranslation}
							filter={(settings) => {
								// Never reset the service list from here.
								const { translationApiConfigList: _, ...rest } = settings;
								return rest;
							}}
						/>
					}
				>
					<ProFormSwitch
						name="optimizeAiTranslationLayout"
						label={label("optimizeAiTranslationLayout")}
					/>
					<ProFormDigit
						name="translationTemperature"
						label={label("temperature")}
						min={0}
						max={2}
						fieldProps={{ precision: 1, step: 0.1 }}
					/>
					<ProFormDigit
						name="translationTopP"
						label={label("topP")}
						min={0}
						max={1}
						fieldProps={{ precision: 2, step: 0.05 }}
					/>
					<ProFormDigit
						name="translationMaxTokens"
						label={label("maxTokens")}
						min={512}
						max={8192}
						fieldProps={{ precision: 0 }}
					/>
					<ProFormDigit
						name="translationTimeoutMs"
						label={label("timeoutMs")}
						min={5000}
						max={300000}
						fieldProps={{ precision: 0, suffix: "ms" }}
					/>
				</SettingsGroup>

				<SettingsGroup
					title={<FormattedMessage id={`${prefix}.chatPrompt`} />}
					description={
						<FormattedMessage
							id="workbench.translation.promptVariables"
							values={{
								source: (
									<code key="source">{SOURCE_LANGUAGE_ENV_VARIABLE}</code>
								),
								target: (
									<code key="target">{TARGET_LANGUAGE_ENV_VARIABLE}</code>
								),
								domain: (
									<code key="domain">{TRANSLATION_DOMAIN_ENV_VARIABLE}</code>
								),
							}}
						/>
					}
				>
					<ProFormTextArea
						name="translationSystemPrompt"
						label={label("chatPrompt")}
						rules={[
							{
								required: true,
								message: intl.formatMessage({
									id: `${prefix}.chatPrompt.required`,
								}),
							},
						]}
						fieldProps={{ autoSize: { minRows: 4, maxRows: 14 } }}
					/>
				</SettingsGroup>
			</ProForm>
		</Spin>
	);
};
