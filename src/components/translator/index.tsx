import { CloseOutlined, CopyOutlined, SwapOutlined } from "@ant-design/icons";
import { Button, Select, type SelectProps, Spin, theme } from "antd";
import TextArea, { type TextAreaRef } from "antd/es/input/TextArea";
import { debounce } from "es-toolkit";
import React, {
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";
import {
	type TranslationServiceConfig,
	useTranslationRequest,
} from "@/core/translations";
import { useStateRef } from "@/hooks/useStateRef";
import { ModelSelectLabel } from "@/pages/tools/chat/components/modelSelectLabel";
import { TranslationApiType } from "@/types/appSettings";
import { TranslationDomain } from "@/types/servies/translation";
import { writeTextToClipboard } from "@/utils/clipboard";

const SelectLabel: React.FC<{
	label: React.ReactNode;
	code: React.ReactNode;
}> = ({ label, code }) => {
	const { token } = theme.useToken();
	return (
		<div className="language-item">
			<div className="language-item-label">{label}</div>
			<div className="language-item-code">{code}</div>

			<style jsx>{`
                .language-item {
                    position: relative;
                }

                .language-item-label {
                    display: inline;
                }

                .language-item-code {
                    display: inline;
                    color: ${token.colorTextDescription};
                    margin-left: ${token.marginXS}px;
                    font-size: 12px;
                    position: relative;
                    bottom: 1px;
                }
            `}</style>
		</div>
	);
};

type LanguageItem = {
	code: string;
	label: string;
};

const convertLanguageListToOptions = (
	list: LanguageItem[],
): SelectProps["options"] => {
	// 按首字母分组
	const groupedLanguages = list.reduce(
		(acc, lang) => {
			if (lang.code === "") {
				return acc;
			}

			const firstChar = lang.code.charAt(0).toUpperCase();
			if (!acc[firstChar]) {
				acc[firstChar] = [];
			}
			acc[firstChar].push(lang);
			return acc;
		},
		{} as Record<string, LanguageItem[]>,
	);

	// 转换为 Select 选项格式
	return Object.entries(groupedLanguages).map(([key, languages]) => {
		return {
			label: <span>{key}</span>,
			title: key,
			options: languages.map((lang) => {
				const langCode = typeof lang.code === "string" ? lang.code : "";

				return {
					label: (
						<SelectLabel label={lang.label} code={langCode.toUpperCase()} />
					),
					title: `${lang.label}(${langCode.toLowerCase()})`,
					value: langCode,
				};
			}),
		};
	});
};

const selectFilterOption: SelectProps["filterOption"] = (input, option) => {
	if (!input || !option?.title) return false;
	const pattern = input.toLowerCase().split("").join(".*");
	const regex = new RegExp(pattern, "i");
	return regex.test(option.title.toString().toLowerCase());
};

export type TranslatorActionType = {
	setSourceContent: (content: string, ignoreDebounce?: boolean) => void;
	getSourceContentRef: () => TextAreaRef | null;
	getTranslatedContent: () => { content: string }[];
};

export const useLanguageOptions = () => {
	const intl = useIntl();

	const targetLanguageOptions = useMemo(() => {
		const languageList = [
			{
				code: "en",
				label: intl.formatMessage({ id: "tools.translation.language.english" }),
			},
			{
				code: "zh-CHS",
				label: intl.formatMessage({
					id: "tools.translation.language.simplifiedChinese",
				}),
			},
			{
				code: "zh-CHT",
				label: intl.formatMessage({
					id: "tools.translation.language.traditionalChinese",
				}),
			},
			{
				code: "es",
				label: intl.formatMessage({ id: "tools.translation.language.spanish" }),
			},
			{
				code: "fr",
				label: intl.formatMessage({ id: "tools.translation.language.french" }),
			},
			{
				code: "ar",
				label: intl.formatMessage({ id: "tools.translation.language.arabic" }),
			},
			{
				code: "de",
				label: intl.formatMessage({ id: "tools.translation.language.german" }),
			},
			{
				code: "it",
				label: intl.formatMessage({ id: "tools.translation.language.italian" }),
			},
			{
				code: "ja",
				label: intl.formatMessage({
					id: "tools.translation.language.japanese",
				}),
			},
			{
				code: "pt",
				label: intl.formatMessage({
					id: "tools.translation.language.portuguese",
				}),
			},
			{
				code: "ru",
				label: intl.formatMessage({ id: "tools.translation.language.russian" }),
			},
			{
				code: "tr",
				label: intl.formatMessage({ id: "tools.translation.language.turkish" }),
			},
		].sort((a, b) => {
			if (a.code === "auto") {
				return -1;
			}
			if (b.code === "auto") {
				return 1;
			}
			return a.code.localeCompare(b.code);
		});

		return convertLanguageListToOptions(languageList);
	}, [intl]);

	const sourceLanguageOptions = useMemo(() => {
		return [
			{
				label: intl.formatMessage({ id: "tools.translation.language.auto" }),
				value: "auto",
			},
			...(targetLanguageOptions ?? []),
		];
	}, [intl, targetLanguageOptions]);

	return {
		sourceLanguageOptions,
		targetLanguageOptions,
	};
};

export const useTranslationTypeOptions = (
	supportedTranslationTypes: TranslationServiceConfig[],
) => {
	const translationTypeOptions = useMemo((): SelectProps["options"] => {
		const customTranslationTypeOptions: SelectProps["options"] = [];
		const officialTranslationTypeOptions: SelectProps["options"] = [];

		supportedTranslationTypes.forEach((item) => {
			if (item.isOfficial) {
				officialTranslationTypeOptions.push({
					label: <ModelSelectLabel modelName={item.name} />,
					value: item.type,
				});
			} else {
				customTranslationTypeOptions.push({
					label: <ModelSelectLabel modelName={item.name} />,
					value: item.type,
				});
			}
		});

		return [
			customTranslationTypeOptions.length > 0
				? {
						label: <FormattedMessage id="tools.translation.type.custom" />,
						options: customTranslationTypeOptions,
					}
				: undefined,
			officialTranslationTypeOptions.length > 0
				? {
						label: <FormattedMessage id="tools.translation.type.official" />,
						options: officialTranslationTypeOptions,
					}
				: undefined,
		].filter(Boolean) as SelectProps["options"];
	}, [supportedTranslationTypes]);

	return {
		translationTypeOptions,
	};
};

export const useTranslationDomainOptions = () => {
	const intl = useIntl();

	return useMemo(
		() => [
			{
				label: intl.formatMessage({
					id: "tools.translation.domain.general",
				}),
				value: TranslationDomain.General,
			},
			{
				label: intl.formatMessage({
					id: "tools.translation.domain.computers",
				}),
				value: TranslationDomain.Computers,
			},
			{
				label: intl.formatMessage({
					id: "tools.translation.domain.medicine",
				}),
				value: TranslationDomain.Medicine,
			},
			{
				label: intl.formatMessage({
					id: "tools.translation.domain.finance",
				}),
				value: TranslationDomain.Finance,
			},
			{
				label: intl.formatMessage({
					id: "tools.translation.domain.game",
				}),
				value: TranslationDomain.Game,
			},
		],
		[intl],
	);
};

const TranslatorCore: React.FC<{
	actionRef: React.RefObject<TranslatorActionType | undefined>;
}> = ({ actionRef }) => {
	const intl = useIntl();

	const { sourceLanguageOptions, targetLanguageOptions } = useLanguageOptions();
	const translationDomainOptions = useTranslationDomainOptions();

	const translatedResultRef = useRef<{ content: string }[]>([]);
	const {
		sourceLanguage,
		targetLanguage,
		translationType,
		translationDomain,
		supportedTranslationTypes,
		startTranslateLoading,
		deltaTranslateLoading,
		updateSourceLanguage,
		updateTargetLanguage,
		updateTranslationType,
		updateTranslationDomain,
		supportedTranslationTypesLoading,
		requestTranslate,
		cancelTranslation,
		translatedContent,
		getTranslatedContent,
	} = useTranslationRequest(
		useMemo(() => {
			return {
				onComplete: (result) => {
					translatedResultRef.current = result;
				},
				enableCacheConfig: true,
			};
		}, []),
	);

	const ignoreDebounceRef = useRef<boolean>(false);
	const [sourceContent, setSourceContent] = useStateRef<string>("");

	const requestTranslateDebounce = useMemo(
		() => debounce(requestTranslate, 1500),
		[requestTranslate],
	);
	useEffect(() => {
		return () => {
			requestTranslateDebounce.cancel();
			cancelTranslation();
		};
	}, [requestTranslateDebounce, cancelTranslation]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 翻译相关配置变更的时候也要重新翻译
	useEffect(() => {
		if (sourceContent.trim() === "") {
			requestTranslateDebounce.cancel();
			translatedResultRef.current = [];
			cancelTranslation();
			return;
		}

		if (ignoreDebounceRef.current) {
			ignoreDebounceRef.current = false;
			setTimeout(() => {
				requestTranslate([sourceContent]);
			}, 17);
		} else {
			requestTranslateDebounce([sourceContent]);
		}
	}, [
		sourceContent,
		requestTranslateDebounce,
		requestTranslate,
		cancelTranslation,
		translationType,
		sourceLanguage,
		targetLanguage,
		translationDomain,
	]);

	const supportDomain = useMemo(() => {
		if (translationType === TranslationApiType.DeepL) {
			return false;
		}

		return true;
	}, [translationType]);

	const onCopy = useCallback(() => {
		if (!getTranslatedContent()) {
			return;
		}
		writeTextToClipboard(getTranslatedContent());
	}, [getTranslatedContent]);

	const hasSourceContent = !!sourceContent;
	const hasTranslatedContent = !!translatedContent;

	const { translationTypeOptions } = useTranslationTypeOptions(
		supportedTranslationTypes,
	);

	const sourceContentRef = useRef<TextAreaRef>(null);
	useImperativeHandle(
		actionRef,
		useCallback(
			() => ({
				setSourceContent: (content: string, ignoreDebounce?: boolean) => {
					setSourceContent(content);
					ignoreDebounceRef.current = ignoreDebounce ?? false;
				},
				getSourceContentRef: () => sourceContentRef.current,
				getTranslatedContent: () => translatedResultRef.current,
			}),
			[setSourceContent],
		),
	);

	const popupStyles = (minWidth: number) => ({
		popup: { root: { minWidth } },
	});

	return (
		<div className="translator">
			<div className="translator-bar">
				<div className="translator-languages">
					<Select
						className="translator-language"
						aria-label={intl.formatMessage({
							id: "tools.translation.sourceLanguage",
						})}
						value={sourceLanguage}
						showSearch
						onChange={(value) => updateSourceLanguage(value)}
						options={sourceLanguageOptions}
						filterOption={selectFilterOption}
						styles={popupStyles(200)}
					/>
					<Button
						className="translator-swap"
						type="text"
						disabled={
							sourceLanguage === "auto" || sourceLanguage === targetLanguage
						}
						icon={<SwapOutlined />}
						aria-label={intl.formatMessage({
							id: "workbench.translation.swap",
						})}
						title={intl.formatMessage({ id: "workbench.translation.swap" })}
						onClick={() => {
							updateSourceLanguage(targetLanguage);
							updateTargetLanguage(sourceLanguage);
						}}
					/>
					<Select
						className="translator-language"
						aria-label={intl.formatMessage({
							id: "tools.translation.targetLanguage",
						})}
						showSearch
						value={targetLanguage}
						onChange={(value) => updateTargetLanguage(value)}
						options={targetLanguageOptions}
						filterOption={selectFilterOption}
						styles={popupStyles(200)}
					/>
				</div>
				<div className="translator-engine">
					<Select
						className="translator-service"
						aria-label={intl.formatMessage({ id: "tools.translation.type" })}
						showSearch
						value={translationType}
						onChange={(value) => updateTranslationType(value)}
						options={translationTypeOptions}
						loading={supportedTranslationTypesLoading}
						filterOption={selectFilterOption}
						placeholder={intl.formatMessage({ id: "tools.translation.type" })}
						styles={popupStyles(220)}
					/>
					{supportDomain && (
						<Select
							className="translator-domain"
							aria-label={intl.formatMessage({
								id: "tools.translation.domain",
							})}
							showSearch
							value={translationDomain}
							onChange={(value) => updateTranslationDomain(value)}
							options={translationDomainOptions}
							filterOption={selectFilterOption}
							placeholder={intl.formatMessage({
								id: "tools.translation.domain",
							})}
							styles={popupStyles(160)}
						/>
					)}
				</div>
			</div>

			<div className="translator-panes">
				<div className="translator-pane">
					<TextArea
						maxLength={5000}
						showCount
						autoSize={{ minRows: 10 }}
						placeholder={intl.formatMessage({
							id: "tools.translation.placeholder",
						})}
						value={sourceContent}
						onChange={(e) => setSourceContent(e.target.value)}
						ref={sourceContentRef}
					/>
					<Button
						className="translator-pane-action translator-clear"
						type="text"
						size="small"
						icon={<CloseOutlined />}
						aria-label={intl.formatMessage({
							id: "workbench.translation.clear",
						})}
						onClick={() => setSourceContent("")}
					/>
				</div>
				<div className="translator-pane is-result">
					<Spin spinning={startTranslateLoading}>
						<TextArea
							variant="filled"
							autoSize={{ minRows: 10 }}
							readOnly
							value={translatedContent}
							aria-live="polite"
						/>
						{deltaTranslateLoading && (
							<Spin size="small" className="translator-streaming" />
						)}
						<Button
							className="translator-pane-action translator-copy"
							type="text"
							size="small"
							icon={<CopyOutlined />}
							aria-label={intl.formatMessage({ id: "tools.translation.copy" })}
							onClick={onCopy}
						/>
					</Spin>
				</div>
			</div>

			<style jsx>{`
				.translator {
					display: flex;
					flex-direction: column;
					gap: 12px;
					width: 100%;
				}

				.translator-bar {
					display: flex;
					flex-wrap: wrap;
					align-items: center;
					justify-content: space-between;
					gap: 8px 16px;
				}

				.translator-languages,
				.translator-engine {
					display: flex;
					align-items: center;
					gap: 6px;
					min-width: 0;
				}

				.translator :global(.translator-language) {
					width: 150px;
				}

				.translator :global(.translator-service) {
					width: 190px;
				}

				.translator :global(.translator-domain) {
					width: 120px;
				}

				.translator :global(.translator-swap) {
					color: var(--snow-shot-muted);
				}

				.translator-panes {
					display: grid;
					grid-template-columns: repeat(2, minmax(0, 1fr));
					gap: 12px;
				}

				.translator-pane {
					position: relative;
					min-width: 0;
				}

				.translator :global(.ant-input) {
					padding: 12px 40px 12px 14px;
					border-radius: 10px;
					font-size: 14px;
					line-height: 1.65;
				}

				.translator :global(.translator-pane-action) {
					position: absolute;
					right: 8px;
					z-index: 1;
					color: var(--snow-shot-muted);
					transition: opacity var(--snow-shot-motion-fast) ease;
				}

				.translator :global(.translator-clear) {
					top: 8px;
					opacity: ${hasSourceContent ? 1 : 0};
					pointer-events: ${hasSourceContent ? "auto" : "none"};
				}

				.translator :global(.translator-copy) {
					bottom: 8px;
					opacity: ${hasTranslatedContent ? 1 : 0};
					pointer-events: ${hasTranslatedContent ? "auto" : "none"};
				}

				.translator :global(.translator-streaming) {
					position: absolute;
					right: 44px;
					bottom: 12px;
				}

				@container snow-detail (max-width: 640px) {
					.translator-panes {
						grid-template-columns: minmax(0, 1fr);
					}

					.translator :global(.translator-language) {
						width: 128px;
					}
				}
			`}</style>
		</div>
	);
};
export const Translator = React.memo(TranslatorCore);
