"use client";

import { ModalForm } from "@ant-design/pro-form";
import {
	Alert,
	Button,
	Input,
	Space,
	Spin,
	Tag,
	Typography,
	theme,
} from "antd";
import OpenAI from "openai";
import type React from "react";
import { useCallback, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { TestChatIcon } from "@/components/icons";
import { AppSettingsPublisher } from "@/contexts/appSettingsActionContext";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { appFetch } from "@/services/tools";
import { probeOpenAiCompatibleModels } from "@/services/tools/chat";
import { translateTextDeepL } from "@/services/tools/translation";
import {
	AppSettingsGroup,
	type TranslationApiConfig,
	TranslationApiType,
} from "@/types/appSettings";
import { appError } from "@/utils/log";

type TestStatus = {
	type: "success" | "info" | "warning" | "error";
	message: string;
	description?: string;
};

const formatErrorMessage = (error: unknown) =>
	error instanceof Error ? error.message : `Unknown error: ${error}`;

const DEFAULT_TEST_TEXT =
	"Snow Shot is an elegant and powerful productivity tool.";

export const TestTranslation: React.FC<{ config: TranslationApiConfig }> = ({
	config,
}) => {
	const intl = useIntl();
	const { token } = theme.useToken();
	const [testText, setTestText] = useState(DEFAULT_TEST_TEXT);
	const [result, setResult] = useState("");
	const [status, setStatus] = useState<TestStatus | undefined>(undefined);
	const [loading, setLoading] = useState(false);
	const [latency, setLatency] = useState<number | undefined>(undefined);

	const [getAppSettings] = useStateSubscriber(AppSettingsPublisher, undefined);

	const handleTest = useCallback(
		async (customText?: string) => {
			const textToTranslate = (customText ?? testText).trim();
			if (!textToTranslate) {
				return;
			}

			setLoading(true);
			setResult("");
			setStatus(undefined);
			setLatency(undefined);

			const startTime = performance.now();

			try {
				if (config.api_type === TranslationApiType.DeepL) {
					// Test DeepL API
					const res = await translateTextDeepL(
						config.api_uri,
						config.api_key || "",
						[textToTranslate],
						"EN",
						"ZH",
						Boolean(config.deepl_prefer_quality_optimized),
					);

					const elapsed = Math.round(performance.now() - startTime);
					setLatency(elapsed);

					if (res?.translations && res.translations.length > 0) {
						const translated = res.translations
							.map((item) => item.text)
							.join("\n");
						setResult(translated);
						setStatus({
							type: "success",
							message: intl.formatMessage(
								{
									id: "settings.functionSettings.translationSettings.test.success",
									defaultMessage: "翻译测试成功（耗时: {latency} ms）",
								},
								{ latency: elapsed },
							),
							description: intl.formatMessage({
								id: "settings.functionSettings.translationSettings.test.deeplConnected",
								defaultMessage: "DeepL 服务已成功连接并返回译文",
							}),
						});
					} else {
						setStatus({
							type: "warning",
							message: intl.formatMessage({
								id: "settings.functionSettings.translationSettings.test.emptyResult",
								defaultMessage: "服务已响应，但未返回译文内容",
							}),
						});
					}
				} else {
					// OpenAI Compatible (local models or cloud endpoints)
					let modelProbe = { models: [] as string[], errorMessage: "" };
					try {
						modelProbe = await probeOpenAiCompatibleModels(
							config.api_uri,
							config.api_key || "",
						);
					} catch (e) {
						appError("[TestTranslation] probe error", e);
					}

					const configuredModelListed = modelProbe.models.includes(
						config.api_model || "",
					);

					const client = new OpenAI({
						apiKey: config.api_key || "dummy",
						baseURL: config.api_uri,
						dangerouslyAllowBrowser: true,
						fetch: appFetch,
					});

					const appSettings = getAppSettings();
					const temperature =
						appSettings?.[AppSettingsGroup.FunctionTranslation]
							?.translationTemperature ?? 0.2;
					const maxTokens =
						appSettings?.[AppSettingsGroup.FunctionTranslation]
							?.translationMaxTokens ?? 1024;

					const completion = await client.chat.completions.create({
						model: config.api_model || "",
						messages: [
							{
								role: "system",
								content:
									"You are a professional translator. Translate the given text into Simplified Chinese directly without any explanation.",
							},
							{
								role: "user",
								content: textToTranslate,
							},
						],
						temperature,
						max_completion_tokens: maxTokens,
					});

					const elapsed = Math.round(performance.now() - startTime);
					setLatency(elapsed);

					const translated =
						completion.choices?.[0]?.message?.content?.trim() || "";
					setResult(translated);

					if (modelProbe.models.length === 0) {
						setStatus({
							type: "info",
							message: intl.formatMessage(
								{
									id: "settings.functionSettings.translationSettings.test.successWithoutProbe",
									defaultMessage: "翻译测试成功（耗时: {latency} ms）",
								},
								{ latency: elapsed },
							),
							description: modelProbe.errorMessage
								? intl.formatMessage(
										{
											id: "settings.functionSettings.translationSettings.test.probeWarning",
											defaultMessage:
												"模型列表接口返回: {err}，但对话翻译接口调用成功。",
										},
										{ err: modelProbe.errorMessage },
									)
								: undefined,
						});
					} else if (configuredModelListed) {
						setStatus({
							type: "success",
							message: intl.formatMessage(
								{
									id: "settings.functionSettings.translationSettings.test.successMatched",
									defaultMessage:
										"翻译测试成功，模型匹配正常（耗时: {latency} ms）",
								},
								{ latency: elapsed },
							),
							description: intl.formatMessage(
								{
									id: "settings.functionSettings.chatSettings.testModelProbe.available",
									defaultMessage: "可用模型: {models}",
								},
								{ models: modelProbe.models.join(", ") },
							),
						});
					} else {
						setStatus({
							type: "warning",
							message: intl.formatMessage(
								{
									id: "settings.functionSettings.translationSettings.test.notListedWarning",
									defaultMessage:
										"翻译成功（耗时: {latency} ms），但配置的模型未在端点可用列表中",
								},
								{ latency: elapsed },
							),
							description: intl.formatMessage(
								{
									id: "settings.functionSettings.chatSettings.testModelProbe.available",
									defaultMessage: "可用模型: {models}",
								},
								{ models: modelProbe.models.join(", ") },
							),
						});
					}
				}
			} catch (error) {
				setStatus({
					type: "error",
					message: intl.formatMessage({
						id: "settings.functionSettings.translationSettings.test.failed",
						defaultMessage: "翻译测试失败",
					}),
					description: formatErrorMessage(error),
				});
				appError("[TestTranslation] error", error);
			} finally {
				setLoading(false);
			}
		},
		[
			config.api_key,
			config.api_model,
			config.api_type,
			config.api_uri,
			config.deepl_prefer_quality_optimized,
			getAppSettings,
			intl,
			testText,
		],
	);

	return (
		<ModalForm
			title={
				<Space>
					<FormattedMessage
						id="settings.functionSettings.translationSettings.test.title"
						defaultMessage="测试翻译能力"
					/>
					{config.model_name && <Tag>{config.model_name}</Tag>}
				</Space>
			}
			trigger={
				<span
					onClick={() => handleTest()}
					className="anticon ant-pro-form-list-action-icon"
					title={intl.formatMessage({
						id: "settings.functionSettings.translationSettings.test.actionTip",
						defaultMessage: "测试翻译连接与效果",
					})}
				>
					<TestChatIcon />
				</span>
			}
			onFinish={async () => true}
			modalProps={{
				destroyOnClose: true,
			}}
		>
			<div style={{ marginBottom: token.marginSM }}>
				<Typography.Text type="secondary">
					<FormattedMessage
						id="settings.functionSettings.translationSettings.test.desc"
						defaultMessage="对当前配置的服务发送一次测试翻译请求，验证网络连通性、模型可用性与翻译结果。"
					/>
				</Typography.Text>
			</div>

			<div style={{ marginBottom: token.margin }}>
				<Space.Compact orientation="horizontal" style={{ width: "100%" }}>
					<Input
						value={testText}
						onChange={(e) => setTestText(e.target.value)}
						placeholder={intl.formatMessage({
							id: "settings.functionSettings.translationSettings.test.placeholder",
							defaultMessage: "输入测试文本",
						})}
						onPressEnter={() => handleTest()}
					/>
					<Button type="primary" loading={loading} onClick={() => handleTest()}>
						<FormattedMessage
							id="settings.functionSettings.translationSettings.test.runButton"
							defaultMessage="开始测试"
						/>
					</Button>
				</Space.Compact>
			</div>

			<Spin spinning={loading}>
				{result && (
					<div
						style={{
							padding: `${token.paddingSM}px ${token.padding}px`,
							background: "var(--snow-shot-surface-elevated)",
							borderRadius: "var(--snow-shot-radius)",
							border: "1px solid var(--snow-shot-hairline-soft)",
							marginBottom: token.marginSM,
						}}
					>
						<Typography.Text
							strong
							style={{ display: "block", marginBottom: 4 }}
						>
							<FormattedMessage
								id="settings.functionSettings.translationSettings.test.outputLabel"
								defaultMessage="翻译结果："
							/>
							{latency !== undefined && (
								<Tag style={{ marginLeft: 8 }} color="blue">
									{latency} ms
								</Tag>
							)}
						</Typography.Text>
						<Typography.Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>
							{result}
						</Typography.Paragraph>
					</div>
				)}
			</Spin>

			{status && (
				<Alert
					type={status.type}
					message={status.message}
					description={status.description}
					style={{ marginTop: token.marginSM }}
					showIcon
				/>
			)}
		</ModalForm>
	);
};
