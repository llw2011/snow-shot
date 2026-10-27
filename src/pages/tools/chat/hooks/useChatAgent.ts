import { useXAgent, useXChat, XRequest } from "@ant-design/x";
import { last } from "es-toolkit";
import type React from "react";
import { useCallback, useContext, useMemo, useRef } from "react";
import { useIntl } from "react-intl";
import urlJoin from "url-join";
import { CUSTOM_MODEL_PREFIX } from "@/constants/buildFlavor";
import { AntdContext } from "@/contexts/antdContext";
import { appFetch, ServiceResponse } from "@/services/tools";
import { getDisableReasoningParams } from "@/services/tools/reasoning";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";
import { appError } from "@/utils/log";
import {
	type BubbleDataType,
	type ChatModelConfig,
	filterErrorMessages,
	getMessageContent,
} from "../messages";
import type { ChatMessage, ChatMessageFlowConfig } from "../types";

type UseChatAgentOptions = {
	supportedModels: ChatModelConfig[];
	supportedModelsRef: React.RefObject<ChatModelConfig[]>;
	selectedModelRef: React.RefObject<string | undefined>;
	enableThinkingRef: React.RefObject<boolean>;
	getAppSettings: () => AppSettingsData;
};

/** Collect `{{variable}}` outputs from workflow steps earlier in the thread. */
const resolveWorkflowVariables = (messages: BubbleDataType[]) => {
	const variables = new Map<string, string>();
	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];
		if (message.role !== "user" || !("flow_config" in message)) {
			continue;
		}

		const flowConfig = message.flow_config as ChatMessageFlowConfig;
		if (!flowConfig) {
			continue;
		}

		flowConfig.globalVariable?.forEach((value, key) => {
			variables.set(key, value);
		});

		if (flowConfig.flow.variable_name && messages[i + 1]) {
			variables.set(
				`{{${flowConfig.flow.variable_name}}}`,
				getMessageContent(messages[i + 1], true),
			);
		}
	}
	return variables;
};

/** Parse one streamed chunk (OpenAI or Claude format) into the message. */
const applyStreamChunk = (
	messageContent: Exclude<ChatMessage["content"], string>,
	data: string,
) => {
	const message = JSON.parse(data);
	if (
		"type" in message &&
		message.type === "content_block_delta" &&
		"delta" in message
	) {
		if (message.delta.type === "text_delta") {
			messageContent.content += message.delta.text ?? "";
		} else if (message.delta.type === "thinking_delta") {
			messageContent.reasoning_content += message.delta.thinking ?? "";
		}
		return;
	}

	const choiceDelta = message?.choices?.[0]?.delta;
	if (!choiceDelta) {
		return;
	}
	if (choiceDelta.reasoning_content) {
		messageContent.reasoning_content += choiceDelta.reasoning_content;
	} else {
		messageContent.content += choiceDelta.content ?? "";
	}
};

/**
 * The request pipeline of the chat window: builds the OpenAI-compatible request
 * from the selected model, streams the answer and maps errors into messages.
 */
export const useChatAgent = ({
	supportedModels,
	supportedModelsRef,
	selectedModelRef,
	enableThinkingRef,
	getAppSettings,
}: UseChatAgentOptions) => {
	const intl = useIntl();
	const { message } = useContext(AntdContext);
	const abortController = useRef<AbortController>(null);
	const newestMessage = useRef<ChatMessage>(undefined);

	const getCustomModelRequest = useCallback(
		(model: string) => {
			if (!model.startsWith(CUSTOM_MODEL_PREFIX)) {
				return undefined;
			}

			const customConfig = supportedModelsRef.current.find(
				(item) => item.model === model,
			)?.customConfig;
			if (!customConfig) {
				return undefined;
			}

			return {
				request: XRequest({
					baseURL: urlJoin(customConfig.api_uri, "chat/completions"),
					dangerouslyApiKey: `Bearer ${customConfig.api_key}`,
					fetch: appFetch,
				}),
				config: customConfig,
			};
		},
		[supportedModelsRef],
	);

	const modelAgentConfig: Parameters<typeof useXAgent<BubbleDataType>>[0] =
		useMemo(
			() => ({
				request: (input, callbacks) => {
					const selectedModel = selectedModelRef.current;
					if (!selectedModel) {
						message.error(
							intl.formatMessage({ id: "tools.chat.noSelectedModel" }),
						);
						return;
					}

					let inputMessages = filterErrorMessages(input.messages?.slice(-20));
					const variables = resolveWorkflowVariables(inputMessages);

					const userInput = last(inputMessages);
					if (!userInput) {
						appError("[modelAgentConfig] userInput is undefined");
						return;
					}

					if (userInput.flow_config?.flow.ignore_context) {
						inputMessages = inputMessages.slice(-1);
					}

					for (const item of inputMessages) {
						let content = getMessageContent(item, true);
						variables.forEach((value, key) => {
							content = content.replace(new RegExp(key, "g"), value);
						});

						if (typeof item.content === "string") {
							item.content = content;
						} else if (
							item.content &&
							typeof item.content === "object" &&
							"content" in item.content
						) {
							item.content.content = content;
						}
					}

					const customModelRequest = getCustomModelRequest(selectedModel);
					if (!customModelRequest) {
						message.error(
							intl.formatMessage({ id: "tools.chat.noSelectedModel" }),
						);
						return;
					}

					const enableThinking =
						enableThinkingRef.current &&
						!!supportedModels.find((item) => item.model === selectedModel)
							?.thinking;
					const systemChat = getAppSettings()[AppSettingsGroup.SystemChat];

					return customModelRequest.request.create(
						{
							messages: inputMessages.map((item) => ({
								role: item.role ?? "",
								content: getMessageContent(item, true),
							})),
							model: selectedModel
								.substring(CUSTOM_MODEL_PREFIX.length)
								.replace("_thinking", ""),
							temperature: systemChat.temperature,
							max_tokens: systemChat.maxTokens,
							enable_thinking: enableThinking ? true : undefined,
							stream_options: { include_usage: true },
							thinking_budget: systemChat.thinkingBudgetTokens,
							reasoning:
								enableThinking && customModelRequest.config.support_thinking
									? { effort: "medium" }
									: undefined,
							...(enableThinking
								? {}
								: getDisableReasoningParams(
										customModelRequest.config.support_thinking,
									)),
							stream: true,
						},
						callbacks,
					);
				},
			}),
			[
				enableThinkingRef,
				getAppSettings,
				getCustomModelRequest,
				intl,
				message,
				selectedModelRef,
				supportedModels,
			],
		);

	const [agent] = useXAgent<BubbleDataType>(modelAgentConfig);

	const chat = useXChat({
		agent,
		requestFallback: (...params): ChatMessage => {
			const [, { error }] = params;

			if (error.name === "AbortError") {
				return {
					content: {
						reasoning_content: "",
						content: intl.formatMessage({ id: "tools.chat.requestAborted" }),
						response_error: true,
					},
					role: "assistant",
				};
			}

			if (
				error.message.startsWith("Unknown error") &&
				newestMessage.current &&
				typeof newestMessage.current.content === "object"
			) {
				return {
					content: { ...newestMessage.current.content },
					role: "assistant",
				};
			}

			return {
				content: {
					reasoning_content: "",
					content: `${intl.formatMessage({ id: "tools.chat.requestFailed" })}: ${error.message}`,
					response_error: true,
				},
				role: "assistant",
			};
		},
		transformMessage: (info): ChatMessage => {
			const { originMessage, chunk } = info || {};
			if (chunk && "code" in chunk && "message" in chunk) {
				const chatResponse = ServiceResponse.serviceError(
					{ status: 200, statusText: "Service Error" } as Response,
					chunk.code as number,
					chunk.message as string,
				);
				chatResponse.success();
				return {
					content: {
						reasoning_content: "",
						content: chatResponse.message ?? "Service Error",
						response_error: true,
					},
					role: "assistant",
				};
			}

			if (typeof originMessage?.content === "string") {
				return {
					content: {
						reasoning_content: "",
						content: originMessage.content,
						response_error: false,
					},
					role: originMessage.role as ChatMessage["role"],
				};
			}

			const messageContent = (
				originMessage?.content
					? { ...originMessage.content }
					: { reasoning_content: "", content: "", response_error: false }
			) as ChatMessage["content"];
			if (typeof messageContent === "string") {
				throw new Error("messageContent is string");
			}

			try {
				if (chunk?.data && !chunk.data.includes("DONE")) {
					applyStreamChunk(messageContent, chunk.data);
				}
			} catch (error) {
				appError("[transformMessage] error", error);
			}

			newestMessage.current = { content: messageContent, role: "assistant" };
			return { content: { ...messageContent }, role: "assistant" };
		},
		resolveAbortController: (controller) => {
			abortController.current = controller;
		},
	});

	return {
		...chat,
		loading: agent.isRequesting(),
		newestMessage,
		abort: () => abortController.current?.abort(),
	};
};
