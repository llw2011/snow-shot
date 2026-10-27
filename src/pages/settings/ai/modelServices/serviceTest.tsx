import { Button } from "antd";
import OpenAI from "openai";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { WorkbenchIcon } from "@/components/workbench/icons";
import { AppSettingsPublisher } from "@/contexts/appSettingsActionContext";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { appFetch } from "@/services/tools";
import { getDisableReasoningParams } from "@/services/tools/reasoning";
import { translateTextDeepL } from "@/services/tools/translation";
import { AppSettingsGroup } from "@/types/appSettings";
import type { ModelService } from "./serviceModel";

type TestKind = "chat" | "translation";

type TestResult = {
	kind: TestKind;
	status: "running" | "ok" | "error";
	text: string;
	firstTokenMs?: number;
	totalMs?: number;
	error?: string;
};

const SAMPLE_TEXT =
	"Snow Shot captures the screen, recognizes text and translates it in seconds.";

const describeError = (error: unknown) =>
	error instanceof Error ? error.message : `${error}`;

/** Sends one real request to the service and reports latency inline. */
export const ServiceTest: React.FC<{ service: ModelService }> = ({
	service,
}) => {
	const intl = useIntl();
	const [getAppSettings] = useStateSubscriber(AppSettingsPublisher, undefined);
	const [result, setResult] = useState<TestResult>();
	const abortRef = useRef<AbortController>(undefined);

	const run = useCallback(
		async (kind: TestKind) => {
			abortRef.current?.abort();
			const abortController = new AbortController();
			abortRef.current = abortController;

			const started = performance.now();
			setResult({ kind, status: "running", text: "" });

			try {
				if (service.kind === "deepl") {
					const response = await translateTextDeepL(
						service.apiUri,
						service.apiKey,
						[SAMPLE_TEXT],
						"EN",
						"ZH",
						service.deeplPreferQualityOptimized,
					);
					const text =
						response?.translations.map((item) => item.text).join("\n") ?? "";
					setResult({
						kind,
						status: text ? "ok" : "error",
						text,
						totalMs: Math.round(performance.now() - started),
						error: text
							? undefined
							: intl.formatMessage({ id: "workbench.models.test.empty" }),
					});
					return;
				}

				const client = new OpenAI({
					apiKey: service.apiKey || "snow-shot",
					baseURL: service.apiUri,
					dangerouslyAllowBrowser: true,
					fetch: appFetch,
				});
				const appSettings = getAppSettings();
				const targetLanguage =
					appSettings[AppSettingsGroup.FunctionTranslation].targetLanguage;
				const messages: OpenAI.Chat.ChatCompletionMessageParam[] =
					kind === "chat"
						? [
								{
									role: "user",
									content: intl.formatMessage({
										id: "workbench.models.test.chatPrompt",
									}),
								},
							]
						: [
								{
									role: "system",
									content: `Translate the user's text into ${targetLanguage}. Output only the translation.`,
								},
								{ role: "user", content: SAMPLE_TEXT },
							];

				const stream = await client.chat.completions.create(
					{
						model: service.apiModel,
						messages,
						stream: true,
						temperature: 0.2,
						max_completion_tokens: 512,
						...getDisableReasoningParams(service.supportThinking),
					},
					{ signal: abortController.signal, timeout: 120_000, maxRetries: 0 },
				);

				let text = "";
				let firstTokenMs: number | undefined;
				for await (const event of stream) {
					const delta = event.choices[0]?.delta?.content;
					if (!delta) {
						continue;
					}
					firstTokenMs ??= Math.round(performance.now() - started);
					text += delta;
					setResult({ kind, status: "running", text, firstTokenMs });
				}

				setResult({
					kind,
					status: text ? "ok" : "error",
					text,
					firstTokenMs,
					totalMs: Math.round(performance.now() - started),
					error: text
						? undefined
						: intl.formatMessage({ id: "workbench.models.test.empty" }),
				});
			} catch (error) {
				if (abortController.signal.aborted) {
					return;
				}
				setResult({
					kind,
					status: "error",
					text: "",
					totalMs: Math.round(performance.now() - started),
					error: describeError(error),
				});
			}
		},
		[getAppSettings, intl, service],
	);

	const canChat = service.kind === "openai";
	const running = result?.status === "running";

	return (
		<div className="service-test">
			<div className="service-test-actions">
				{canChat && (
					<Button
						size="small"
						icon={<WorkbenchIcon name="chat" size={14} />}
						loading={running && result?.kind === "chat"}
						disabled={running && result?.kind !== "chat"}
						onClick={() => run("chat")}
					>
						<FormattedMessage id="workbench.models.test.chat" />
					</Button>
				)}
				<Button
					size="small"
					icon={<WorkbenchIcon name="translate" size={14} />}
					loading={running && result?.kind === "translation"}
					disabled={running && result?.kind !== "translation"}
					onClick={() => run("translation")}
				>
					<FormattedMessage id="workbench.models.test.translation" />
				</Button>
			</div>
			{result && (
				<div className={`service-test-result is-${result.status}`}>
					<div className="service-test-meta">
						{result.status === "error" ? (
							<FormattedMessage id="workbench.models.test.failed" />
						) : result.status === "ok" ? (
							<FormattedMessage id="workbench.models.test.passed" />
						) : (
							<FormattedMessage id="workbench.models.test.running" />
						)}
						{result.firstTokenMs !== undefined && (
							<span>
								<FormattedMessage
									id="workbench.models.test.firstToken"
									values={{ ms: result.firstTokenMs }}
								/>
							</span>
						)}
						{result.totalMs !== undefined && (
							<span>
								<FormattedMessage
									id="workbench.models.test.total"
									values={{ ms: result.totalMs }}
								/>
							</span>
						)}
					</div>
					{result.text && (
						<div className="service-test-text">{result.text}</div>
					)}
					{result.error && (
						<div className="service-test-error">{result.error}</div>
					)}
				</div>
			)}
		</div>
	);
};
