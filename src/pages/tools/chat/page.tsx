"use client";

import {
	ArrowLeftOutlined,
	CloseOutlined,
	CopyOutlined,
	DeleteOutlined,
	MinusOutlined,
	PlusOutlined,
} from "@ant-design/icons";
import {
	Bubble,
	Conversations,
	Sender,
	Suggestion,
	useXAgent,
	useXChat,
	Welcome,
	XRequest,
} from "@ant-design/x";
import type { BubbleDataType as AntdBubbleDataType } from "@ant-design/x/es/bubble/BubbleList";
import type { Conversation } from "@ant-design/x/es/conversations";
import type { SenderRef } from "@ant-design/x/es/sender";
import type { MessageInfo } from "@ant-design/x/es/use-x-chat";
import { useRouter, useSearch } from "@tanstack/react-router";
import {
	type Window as AppWindow,
	getCurrentWindow,
} from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
	Button,
	Card,
	Drawer,
	Select,
	type SelectProps,
	Space,
	Spin,
	Typography,
	theme,
} from "antd";
import dayjs from "dayjs";
import { debounce, last, throttle } from "es-toolkit";
import type React from "react";
import {
	Suspense,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { FormattedMessage, useIntl } from "react-intl";
import Markdown, { type ExtraProps } from "react-markdown";
import RSC, { type Scrollbar } from "react-scrollbars-custom";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import urlJoin from "url-join";
import { EventListenerContext } from "@/components/eventListener";
import { HotkeysMenu } from "@/components/hotkeysMenu";
import { BotIcon, SidebarIcon, ThinkingIcon } from "@/components/icons";
import { CUSTOM_MODEL_PREFIX } from "@/constants/buildFlavor";
import { AntdContext } from "@/contexts/antdContext";
import {
	AppSettingsActionContext,
	AppSettingsPublisher,
} from "@/contexts/appSettingsActionContext";
import { finishScreenshot } from "@/functions/screenshot";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { usePlatform } from "@/hooks/usePlatform";
import { useStateRef } from "@/hooks/useStateRef";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { appFetch, ServiceResponse } from "@/services/tools";
import type { ChatModel } from "@/services/tools/chat";
import {
	type AppSettingsData,
	AppSettingsGroup,
	type ChatApiConfig,
} from "@/types/appSettings";
import {
	CommonKeyEventKey,
	type CommonKeyEventValue,
} from "@/types/core/commonKeyEvent";
import { isUsableChatApiConfig } from "@/utils/apiConfig";
import { ChatHistoryStore } from "@/utils/appStore";
import { decodeParamsValue } from "@/utils/base64";
import {
	copyText,
	copyTextAndHide,
	writeTextToClipboard,
} from "@/utils/clipboard";
import { formatKey } from "@/utils/format";
import { appError } from "@/utils/log";
import { ModelSelectLabel } from "./components/modelSelectLabel";
import { SendQueueMessageList } from "./components/sendQueueMessageList";
import { WorkflowList } from "./components/workflowList";
import type {
	ChatMessage,
	ChatMessageFlowConfig,
	SendQueueMessage,
} from "./types";

type BubbleDataType = AntdBubbleDataType & {
	flow_config?: ChatMessageFlowConfig;
};

const MONOCHROME_PRISM_STYLE = {
	'code[class*="language-"]': {
		background: "var(--snow-shot-surface-elevated)",
		color: "var(--snow-shot-body)",
		fontFamily: "var(--snow-shot-font-mono)",
		lineHeight: "1.55",
	},
	'pre[class*="language-"]': {
		margin: "0.5em 0",
		padding: "1em",
		overflow: "auto",
		borderRadius: "var(--snow-shot-radius-sm)",
		background: "var(--snow-shot-surface-elevated)",
		color: "var(--snow-shot-body)",
		fontFamily: "var(--snow-shot-font-mono)",
		lineHeight: "1.55",
	},
	comment: {
		color: "var(--snow-shot-muted)",
		fontStyle: "italic",
	},
	prolog: { color: "var(--snow-shot-muted)" },
	cdata: { color: "var(--snow-shot-muted)" },
	punctuation: { color: "var(--snow-shot-body)" },
	entity: { color: "var(--snow-shot-body)" },
	"attr-name": { color: "var(--snow-shot-body)" },
	"class-name": { color: "var(--snow-shot-body)" },
	boolean: { color: "var(--snow-shot-body)" },
	constant: { color: "var(--snow-shot-body)" },
	number: { color: "var(--snow-shot-body)" },
	keyword: { color: "var(--snow-shot-ink)", fontWeight: 600 },
	property: { color: "var(--snow-shot-ink)" },
	tag: { color: "var(--snow-shot-ink)" },
	selector: { color: "var(--snow-shot-ink)" },
	string: { color: "var(--snow-shot-body)" },
	char: { color: "var(--snow-shot-body)" },
	builtin: { color: "var(--snow-shot-body)" },
	variable: { color: "var(--snow-shot-body)" },
	operator: { color: "var(--snow-shot-ink)" },
	function: { color: "var(--snow-shot-ink)", fontWeight: 600 },
} satisfies Record<string, React.CSSProperties>;

const getMessageContent = (
	msg: ChatMessage | BubbleDataType,
	ignoreReasoningContent = false,
) => {
	const message = msg as ChatMessage;

	if (!message.content) {
		return "";
	}

	if (typeof message.content === "string") {
		return message.content;
	}

	if (
		typeof message.content === "object" &&
		"reasoning_content" in message.content &&
		"content" in message.content
	) {
		return `${
			!ignoreReasoningContent && message.content.reasoning_content
				? `${message.content.reasoning_content
						.split("\n")
						.map((line) => {
							return `> ${line}`;
						})
						.join("\n")}\n\n`
				: ""
		}${message.content.content}`;
	}

	return "";
};

const CodeCard: React.FC<{
	props: React.ClassAttributes<HTMLElement> &
		React.HTMLAttributes<HTMLElement> &
		ExtraProps;
	language: string;
}> = ({ props, language }) => {
	const { children, ...rest } = props;
	return (
		<Card
			title={language}
			size="small"
			styles={{ body: { padding: 0, margin: "-0.5em 0" } }}
			extra={
				<Space>
					<Button
						type="text"
						icon={<CopyOutlined />}
						onClick={() => {
							copyText(String(children).replace(/\n$/, ""));
						}}
					/>
				</Space>
			}
		>
			<SyntaxHighlighter
				{...rest}
				ref={undefined}
				language={language}
				style={MONOCHROME_PRISM_STYLE}
				wrapLongLines
			>
				{String(children).replace(/\n$/, "")}
			</SyntaxHighlighter>
		</Card>
	);
};

export const MarkdownContent: React.FC<{
	content: string;
	clipboardContent: string;
	/** @deprecated The code surface now follows shared monochrome CSS tokens. */
	darkMode?: boolean;
	disableCodeCard?: boolean;
}> = ({ content, disableCodeCard }) => {
	return (
		<Typography>
			<div className="markdown-body">
				<Markdown
					components={{
						code(props) {
							const { children, className, ...rest } = props;
							const match = /language-(\w+)/.exec(className || "");
							return match && !disableCodeCard ? (
								<CodeCard language={match[1]} props={props} />
							) : (
								<code {...rest} className={className}>
									{children}
								</code>
							);
						},
						a: (props) => {
							return (
								<a
									{...props}
									onClick={(e) => {
										e.preventDefault();
										if (props.href) {
											openUrl(props.href);
										}
									}}
								/>
							);
						},
					}}
					remarkPlugins={[remarkMath, remarkGfm]}
					rehypePlugins={[rehypeKatex]}
				>
					{content}
				</Markdown>
			</div>

			<style jsx>{`
                :global(.ant-typography pre) {
                    background-color: transparent;
                    padding: 0;
                }

                :global(.ant-typography pre > div) {
                    margin: 0 !important;
                }

                :global(.markdown-body) {
                    background: transparent !important;
                }
            `}</style>
		</Typography>
	);
};

type ChatModelConfig = ChatModel & {
	customConfig?: ChatApiConfig;
};

const fliterErrorMessages = (messages: BubbleDataType[] | undefined) => {
	if (!messages) {
		return [];
	}

	const newMessages = [];
	for (let i = 0; i < messages.length; i += 2) {
		const userMessage = messages[i];
		const assistantMessage = messages[i + 1];

		if (!userMessage) {
			break;
		}

		if (!assistantMessage) {
			newMessages.push(userMessage);
			continue;
		}

		if (
			assistantMessage.content &&
			typeof assistantMessage.content === "object" &&
			"response_error" in assistantMessage.content &&
			assistantMessage.content.response_error
		) {
			continue;
		}

		newMessages.push(userMessage);
		newMessages.push(assistantMessage);
	}

	const finalMessages = [];
	let lastRole: string | undefined;
	let consecutiveCount = 0;

	for (let i = 0; i < newMessages.length; i++) {
		const currentMessage = newMessages[i];

		if (currentMessage.role === lastRole) {
			consecutiveCount++;
			if (consecutiveCount >= 2) {
				finalMessages[finalMessages.length - 1] = currentMessage;
			} else {
				finalMessages.push(currentMessage);
			}
		} else {
			consecutiveCount = 1;
			lastRole = currentMessage.role;
			finalMessages.push(currentMessage);
		}
	}

	return finalMessages;
};

const Chat = () => {
	const intl = useIntl();
	const router = useRouter();
	const [currentPlatform] = usePlatform();
	const appWindowRef = useRef<AppWindow | undefined>(undefined);
	useEffect(() => {
		appWindowRef.current = getCurrentWindow();
	}, []);

	const handleNavigateBack = useCallback(() => {
		if (window.history.length > 1) {
			router.history.back();
		} else {
			router.navigate({ to: "/" });
		}
	}, [router]);

	useHotkeys("esc", handleNavigateBack, {
		enableOnFormTags: false,
		preventDefault: true,
	});

	const [hotKeys, setHotKeys] =
		useState<Record<CommonKeyEventKey, CommonKeyEventValue>>();
	useAppSettingsLoad(
		useCallback((appSettings) => {
			setHotKeys(appSettings[AppSettingsGroup.CommonKeyEvent]);
		}, []),
		true,
	);

	const { token } = theme.useToken();
	const { message, modal } = useContext(AntdContext);
	const chatHistoryStoreRef = useRef<ChatHistoryStore | undefined>(undefined);
	const [sessionStoreLoading, setSessionStoreLoading] = useState(true);
	const [customModelConfigList, setCustomModelConfigList] = useState<
		ChatApiConfig[]
	>([]);
	const [supportedModels, setSupportedModels, supportedModelsRef] = useStateRef<
		ChatModelConfig[]
	>([]);
	const [selectedModel, setSelectedModel, selectedModelRef] = useStateRef<
		string | undefined
	>(undefined);
	const [enableThinking, setEnableThinking, enableThinkingRef] =
		useStateRef<boolean>(false);
	const [sendQueueMessages, setSendQueueMessages, sendQueueMessagesRef] =
		useStateRef<SendQueueMessage[]>([]);

	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const [getAppSettings] = useStateSubscriber(AppSettingsPublisher, undefined);
	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData) => {
				setSelectedModel(settings[AppSettingsGroup.Cache].chatModel);
				setEnableThinking(
					settings[AppSettingsGroup.Cache].chatModelEnableThinking,
				);
				setCustomModelConfigList(
					settings[AppSettingsGroup.FunctionChat].chatApiConfigList.filter(
						isUsableChatApiConfig,
					),
				);
			},
			[setSelectedModel, setEnableThinking],
		),
		true,
	);

	useEffect(() => {
		setSupportedModels([
			...customModelConfigList.map((item) => {
				return {
					model: `${CUSTOM_MODEL_PREFIX}${item.api_model}`,
					name: item.model_name,
					thinking: item.support_thinking,
					customConfig: item,
					support_vision: item.support_vision ?? false,
				};
			}),
		]);
	}, [setSupportedModels, customModelConfigList]);

	const abortController = useRef<AbortController>(null);
	const selectedModelConfig = useMemo(
		() => supportedModels.find((item) => item.model === selectedModel),
		[supportedModels, selectedModel],
	);
	const selectedModelSupportThinking = !!selectedModelConfig?.thinking;

	const [messageHistory, setMessageHistory, messageHistoryRef] = useStateRef<
		Record<string, MessageInfo<BubbleDataType>[]>
	>({});

	const [sessionList, setSessionList, sessionListRef] = useStateRef<
		(Conversation & { isDefaultSession: boolean })[]
	>([]);
	const [curSession, setCurSession, curSessionRef] = useStateRef<
		string | undefined
	>(undefined);

	const [inputValue, setInputValue] = useState("");
	const senderRef = useRef<SenderRef>(null);

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

			const baseURL = urlJoin(customConfig.api_uri, "chat/completions");
			return {
				request: XRequest({
					baseURL,
					dangerouslyApiKey: `Bearer ${customConfig.api_key}`,
					fetch: appFetch,
				}),
				config: customConfig,
			};
		},
		[supportedModelsRef],
	);
	const modelAgentConfig: Parameters<typeof useXAgent<BubbleDataType>>[0] =
		useMemo(() => {
			return {
				request: (input, callbacks) => {
					const selectedModel = selectedModelRef.current;
					if (!selectedModel) {
						message.error(
							intl.formatMessage({ id: "tools.chat.noSelectedModel" }),
						);
						return;
					}

					const inputMessages = input.messages?.slice(-20);
					let newInputMessages = fliterErrorMessages(inputMessages);

					// 处理消息变量
					const variables: Map<string, string> = new Map();
					// 遍历消息，如果用户消息指定了变量，那么将对应的输出变量添加到变量列表中
					for (let i = 0; i < newInputMessages.length; i++) {
						const message = newInputMessages[i];
						if (message.role === "user" && "flow_config" in message) {
							const flowConfig = message.flow_config as ChatMessageFlowConfig;
							if (!flowConfig) {
								continue;
							}

							if (flowConfig.globalVariable) {
								flowConfig.globalVariable.forEach((value, key) => {
									variables.set(key, value);
								});
							}

							if (flowConfig.flow.variable_name && newInputMessages[i + 1]) {
								variables.set(
									`{{${flowConfig.flow.variable_name}}}`,
									getMessageContent(newInputMessages[i + 1], true),
								);
							}
						}
					}

					const userInput = last(newInputMessages);
					if (!userInput) {
						appError("[modelAgentConfig] userInput is undefined");
						return;
					}

					if (userInput.flow_config) {
						if (userInput.flow_config.flow.ignore_context) {
							// 忽略上下文
							newInputMessages = newInputMessages.slice(-1);
						}
					}

					newInputMessages.forEach((item) => {
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
					});

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

					return customModelRequest.request.create(
						{
							messages: newInputMessages?.map((item) => ({
								role: item.role ?? "",
								content: getMessageContent(item, true),
							})),
							model: selectedModel
								.substring(CUSTOM_MODEL_PREFIX.length)
								.replace("_thinking", ""),
							temperature:
								getAppSettings()[AppSettingsGroup.SystemChat].temperature,
							max_tokens:
								getAppSettings()[AppSettingsGroup.SystemChat].maxTokens,
							enable_thinking: enableThinking ? true : undefined,
							stream_options: {
								include_usage: true,
							},
							thinking_budget:
								getAppSettings()[AppSettingsGroup.SystemChat]
									.thinkingBudgetTokens,
							reasoning:
								enableThinking && customModelRequest?.config?.support_thinking
									? { effort: "medium" }
									: undefined,
							stream: true,
						},
						callbacks,
					);
				},
			};
		}, [
			getAppSettings,
			getCustomModelRequest,
			selectedModelRef,
			intl,
			message,
			enableThinkingRef.current,
			supportedModels,
		]);
	const [agent] = useXAgent<BubbleDataType>(modelAgentConfig);
	const loading = agent.isRequesting();

	const newestMessage = useRef<ChatMessage>(undefined);
	const { messages, onRequest, setMessages } = useXChat({
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
			} else if (
				error.message.startsWith("Unknown error") &&
				newestMessage.current &&
				typeof newestMessage.current.content === "object"
			) {
				return {
					content: {
						...newestMessage.current.content,
					},
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
					? {
							...originMessage.content,
						}
					: {
							reasoning_content: "",
							content: "",
							response_error: false,
						}
			) as ChatMessage["content"];
			if (typeof messageContent === "string") {
				throw new Error("messageContent is string");
			}

			try {
				if (chunk?.data && !chunk?.data.includes("DONE")) {
					const message = JSON.parse(chunk?.data);

					if (
						"type" in message &&
						message.type === "content_block_delta" &&
						"delta" in message
					) {
						// Claude 格式的响应
						if (message.delta.type === "text_delta") {
							messageContent.content += message.delta.text ?? "";
						} else if (message.delta.type === "thinking_delta") {
							messageContent.reasoning_content += message.delta.thinking ?? "";
						}
					} else {
						// OpenAI 格式的响应
						const choiceDelta = message?.choices?.[0]?.delta;
						if (choiceDelta) {
							if (choiceDelta?.reasoning_content) {
								messageContent.reasoning_content =
									messageContent.reasoning_content +
									choiceDelta?.reasoning_content;
							} else {
								messageContent.content += choiceDelta?.content ?? "";
							}
						}
					}
				}
			} catch (error) {
				appError("[transformMessage] error", error);
			}

			newestMessage.current = {
				content: messageContent,
				role: "assistant",
			};

			return {
				content: {
					...messageContent,
				},
				role: "assistant",
			};
		},
		resolveAbortController: (controller) => {
			abortController.current = controller;
		},
	});

	const abortChat = useCallback(() => {
		abortController.current?.abort();
		setSendQueueMessages([]);
	}, [setSendQueueMessages]);

	const createNewSession = useCallback(async () => {
		return new Promise<void>((resolve) => {
			const currentDate = dayjs().format("YYYY-MM-DD");
			const sessionKey = `${currentDate}-${Date.now()}`;
			abortChat();
			setTimeout(() => {
				setSessionList((prev) => [
					{
						key: sessionKey,
						label: intl.formatMessage({ id: "tools.chat.newSession" }),
						group: currentDate,
						timestamp: Date.now(),
						isDefaultSession: true,
					},
					...prev,
				]);
				setCurSession(sessionKey);
				setMessages([]);

				resolve();
			}, 100);
		});
	}, [abortChat, intl, setCurSession, setMessages, setSessionList]);

	const onNewSessionClick = useCallback(() => {
		if (messagesRef.current && messagesRef.current.length > 0) {
			createNewSession();
		} else {
			message.error(intl.formatMessage({ id: "tools.chat.newSession.tip" }));
		}
	}, [createNewSession, intl, message]);

	const [openSession, setOpenSession] = useState(false);

	const modelSelectOptions = useMemo<SelectProps["options"]>(() => {
		const customOptions: SelectProps["options"] = [];
		const officialOptions: SelectProps["options"] = [];
		for (const item of supportedModels) {
			if (item.customConfig) {
				customOptions.push({
					label: (
						<ModelSelectLabel modelName={item.name} reasoner={item.thinking} />
					),
					value: item.model,
				});
			} else {
				officialOptions.push({
					label: (
						<ModelSelectLabel modelName={item.name} reasoner={item.thinking} />
					),
					value: item.model,
				});
			}
		}

		return [
			customOptions.length > 0
				? {
						label: <FormattedMessage id="tools.chat.custom" />,
						options: customOptions,
					}
				: undefined,
			officialOptions.length > 0
				? {
						label: <FormattedMessage id="tools.chat.official" />,
						options: officialOptions,
					}
				: undefined,
		].filter(Boolean) as SelectProps["options"];
	}, [supportedModels]);

	const chatHeader = (
		<div
			className={`chatHeader ${currentPlatform === "macos" ? "is-macos" : ""}`}
			data-tauri-drag-region
		>
			<Drawer
				open={openSession}
				placement="left"
				title={<FormattedMessage id="tools.chat.sessions" />}
				onClose={() => setOpenSession(false)}
				maskClosable
				closeIcon={false}
				styles={{
					body: { padding: `${token.paddingXS}px ${token.padding}px` },
				}}
				extra={
					<Button
						type="text"
						icon={<DeleteOutlined style={{ color: token.colorError }} />}
						onClick={() => {
							modal.confirm({
								title: intl.formatMessage({
									id: "tools.chat.session.clear",
								}),
								content: intl.formatMessage({
									id: "tools.chat.session.clear.tip",
								}),
								onOk: () => {
									setMessages([]);
									setCurSession(undefined);
									setSessionList([]);
									setMessageHistory({});
									setOpenSession(false);
									chatHistoryStoreRef.current?.clear();
									abortChat();
								},
							});
						}}
					/>
				}
			>
				<RSC>
					<Conversations
						items={sessionList?.map((i) =>
							i.key === curSession
								? {
										...i,
										label: (
											<div
												style={{ color: token.colorPrimary }}
											>{`[${intl.formatMessage({ id: "tools.chat.session.current" })}] ${i.label}`}</div>
										),
									}
								: i,
						)}
						activeKey={curSession}
						groupable
						onActiveChange={async (val) => {
							abortChat();
							// The abort execution will trigger an asynchronous requestFallback, which may lead to timing issues.
							// In future versions, the sessionId capability will be added to resolve this problem.
							setTimeout(() => {
								setCurSession(val);
								setMessages(
									(messageHistory?.[val] || []) as MessageInfo<ChatMessage>[],
								);
							}, 100);

							autoScrollRef.current = true;
						}}
						styles={{ item: { padding: "0 8px" } }}
						className="conversations"
					/>
				</RSC>
			</Drawer>

			<Space className="chatHeaderLeft" align="center">
				<Button
					type="text"
					icon={<ArrowLeftOutlined />}
					className="chatHeaderBackButton"
					onClick={handleNavigateBack}
					title={intl.formatMessage({
						id: "tools.chat.backTip",
						defaultMessage: "返回首页 (Esc)",
					})}
				>
					<FormattedMessage id="tools.chat.back" defaultMessage="返回" />
				</Button>

				<span className="chatHeaderDivider" />

				<Button
					type="text"
					icon={<SidebarIcon />}
					disabled={sessionList.length === 0}
					className="chatHeaderHeaderButton"
					onClick={() => setOpenSession(true)}
					title={intl.formatMessage({
						id: "tools.chat.sessions",
						defaultMessage: "历史会话",
					})}
				/>

				<Select
					value={selectedModel}
					options={modelSelectOptions}
					variant="underlined"
					disabled={loading}
					onChange={(val) => {
						updateAppSettings(
							AppSettingsGroup.Cache,
							{ chatModel: val },
							true,
							true,
							false,
							true,
							false,
						);
					}}
					styles={{ popup: { root: { minWidth: 200 } } }}
				/>

				<Button
					type="text"
					icon={
						<ThinkingIcon
							style={{
								color:
									selectedModelSupportThinking && enableThinking
										? token.colorPrimary
										: token.colorTextDisabled,
							}}
						/>
					}
					className="chatHeaderThinkingButton"
					disabled={!selectedModelSupportThinking || loading}
					onClick={() => {
						if (!selectedModelSupportThinking) {
							return;
						}

						updateAppSettings(
							AppSettingsGroup.Cache,
							{ chatModelEnableThinking: !enableThinkingRef.current },
							true,
							true,
							false,
							true,
							false,
						);
					}}
					title={intl.formatMessage({
						id: selectedModelSupportThinking
							? "tools.chat.thinking"
							: "tools.chat.thinking.unsupported",
					})}
				/>
			</Space>

			<div className="chatHeaderCenter" data-tauri-drag-region />

			<Space className="chatHeaderRight" align="center">
				<Button
					type="text"
					icon={<PlusOutlined />}
					onClick={onNewSessionClick}
					disabled={!(messages && messages.length > 0)}
					title={intl.formatMessage(
						{
							id: "draw.keyEventTooltip",
						},
						{
							message: intl.formatMessage({ id: "tools.chat.newSession" }),
							key: formatKey(
								hotKeys?.[CommonKeyEventKey.ChatNewSession]?.hotKey,
							),
						},
					)}
				>
					<FormattedMessage id="tools.chat.newSession" />
				</Button>

				{currentPlatform !== "macos" && (
					<>
						<span className="chatHeaderDivider" />
						<Button
							className="window-command-button chatWindowBtn"
							type="text"
							size="small"
							icon={<MinusOutlined />}
							aria-label="Minimize"
							title="Minimize"
							onClick={() => {
								appWindowRef.current?.minimize();
							}}
						/>
						<Button
							className="window-command-button chatWindowBtn"
							type="text"
							size="small"
							icon={<CloseOutlined />}
							aria-label="Hide Snow Shot"
							title="Hide Snow Shot"
							onClick={() => {
								appWindowRef.current?.hide();
								appWindowRef.current?.emit("on-hide-main-window");
							}}
						/>
					</>
				)}
			</Space>
		</div>
	);

	const bubbleItems = useMemo((): BubbleDataType[] | undefined => {
		if (!messages || messages.length === 0) return undefined;

		const botAvatar = {
			icon: <BotIcon />,
			style: {
				color: token.colorPrimary,
				backgroundColor: "transparent",
				fontSize: "2em",
			},
		};
		const list = messages.map((i): BubbleDataType => {
			if (i.status === "loading") {
				return {
					loading: true,
					role: "assistant",
					avatar: botAvatar,
					variant: "borderless",
				};
			}

			const content = getMessageContent(i.message);

			return {
				role: i.message.role,
				placement: i.message.role === "assistant" ? "start" : "end",
				content,
				variant: i.message.role === "assistant" ? "borderless" : "filled",
				messageRender:
					i.message.role === "assistant"
						? () => {
								return (
									<MarkdownContent
										content={content}
										clipboardContent={content}
									/>
								);
							}
						: undefined,
				avatar: i.message.role === "assistant" ? botAvatar : undefined,
				// typing: i.status === 'loading' ? { step: 2, interval: 50 } : false,
			};
		});

		return list;
	}, [messages, token.colorPrimary]);

	useEffect(() => {
		if (chatHistoryStoreRef.current) {
			return;
		}

		chatHistoryStoreRef.current = new ChatHistoryStore();
		setSessionStoreLoading(true);
		chatHistoryStoreRef.current.init().then(async () => {
			setSessionStoreLoading(false);

			const chatHistory = (
				(await chatHistoryStoreRef.current?.entries()) ?? []
			).sort((a, b) => {
				return b[1].session.key.localeCompare(a[1].session.key);
			});
			const sessionList = [];
			const messageHistory = {} as Record<
				string,
				MessageInfo<BubbleDataType>[]
			>;
			for (const [key, value] of chatHistory) {
				sessionList.push({
					...value.session,
					isDefaultSession: false,
				});
				messageHistory[key] = value.messages;
			}
			setSessionList(sessionList);
			setMessageHistory(messageHistory);
		});
	}, [setSessionList, setMessageHistory]);

	const scrollbarRef = useRef<Scrollbar | null>(null);
	const autoScrollRef = useRef<boolean>(true);

	const enableAutoScroll = useMemo(() => {
		return debounce(() => {
			autoScrollRef.current = true;
		}, 3000);
	}, []);

	const { addListener, removeListener } = useContext(EventListenerContext);

	useEffect(() => {
		const listener = addListener("on-hide-main-window", () => {
			if (
				getAppSettings()[AppSettingsGroup.FunctionChat]
					.autoCreateNewSessionOnCloseWindow
			) {
				createNewSession();
			}
		});

		return () => {
			removeListener(listener);
		};
	}, [getAppSettings, createNewSession, addListener, removeListener]);

	const chatList = (
		<div className="chatList">
			<RSC
				ref={scrollbarRef as never}
				onWheel={() => {
					autoScrollRef.current = false;
					enableAutoScroll();
				}}
			>
				{bubbleItems ? (
					/** 消息列表 */
					<Bubble.List
						style={{ height: "100%", paddingInline: 16 }}
						items={bubbleItems}
						key={curSession}
						roles={{
							assistant: {
								placement: "start",
								loadingRender: () => (
									<Space>
										<Spin size="small" />
										<FormattedMessage id="tools.chat.agentPlaceholder" />
									</Space>
								),
								footer: (content) => (
									<div style={{ display: "flex" }}>
										<Button
											type="text"
											size="small"
											icon={<CopyOutlined />}
											onClick={() => {
												let textContent = "";
												if (
													content &&
													typeof content === "object" &&
													"props" in content
												) {
													textContent = content.props.clipboardContent;
												} else if (typeof content === "string") {
													textContent = content;
												} else {
													return;
												}

												writeTextToClipboard(textContent);
											}}
										/>
									</div>
								),
							},
							user: { placement: "end" },
						}}
					/>
				) : (
					<div className="chatWelcomeWrap">
						<Welcome
							variant="borderless"
							title={intl.formatMessage({ id: "tools.chat.welcome.title" })}
							description={intl.formatMessage({
								id: "tools.chat.welcome.description",
							})}
						/>
					</div>
				)}
			</RSC>
		</div>
	);

	const messagesRef = useRef<MessageInfo<BubbleDataType>[]>([]);
	useEffect(() => {
		messagesRef.current = messages;
	}, [messages]);

	const onCopy = useCallback(() => {
		const lastMessage = last(messagesRef.current);
		copyText(lastMessage ? getMessageContent(lastMessage.message) : "");
	}, []);
	const onCopyAndHide = useCallback(() => {
		const lastMessage = last(messagesRef.current);
		copyTextAndHide(lastMessage ? getMessageContent(lastMessage.message) : "");
	}, []);

	useHotkeys(
		hotKeys?.[CommonKeyEventKey.ChatCopyAndHide]?.hotKey ?? "",
		onCopyAndHide,
		{
			keyup: false,
			keydown: true,
			preventDefault: true,
			enableOnFormTags: ["INPUT", "TEXTAREA", "SELECT"],
		},
	);

	useHotkeys(hotKeys?.[CommonKeyEventKey.ChatCopy]?.hotKey ?? "", onCopy, {
		keyup: false,
		keydown: true,
		preventDefault: true,
		enableOnFormTags: ["INPUT", "TEXTAREA", "SELECT"],
	});

	useHotkeys(
		hotKeys?.[CommonKeyEventKey.ChatNewSession]?.hotKey ?? "",
		onNewSessionClick,
		{
			keyup: false,
			keydown: true,
			preventDefault: true,
			enableOnFormTags: ["INPUT", "TEXTAREA", "SELECT"],
		},
	);

	const senderLoading = loading || sendQueueMessages.length > 0;

	const handleUserSubmit = useCallback(
		(val: string, flowConfig?: ChatMessageFlowConfig) => {
			onRequest({
				stream: true,
				message: {
					content: val,
					role: "user",
					flow_config: flowConfig,
				},
			});

			if (
				sessionListRef.current.find((i) => i.key === curSessionRef.current)
					?.isDefaultSession
			) {
				setSessionList((prev) =>
					prev.map((i) =>
						i.key !== curSessionRef.current
							? i
							: {
									...i,
									label: val?.replace(/\s+/g, " ").trim().slice(0, 20),
									isDefaultSession: false,
								},
					),
				);
			}
		},
		[onRequest, sessionListRef, curSessionRef, setSessionList],
	);

	const userSendingRef = useRef<boolean>(false);
	const onSenderSubmit = useCallback(
		async (value: string, flowConfig?: ChatMessageFlowConfig) => {
			if (!selectedModelRef.current) {
				message.error(intl.formatMessage({ id: "tools.chat.noSelectedModel" }));
				return;
			}

			if (!curSessionRef.current) {
				await createNewSession();
			}

			handleUserSubmit(value, flowConfig);
			setInputValue("");
			autoScrollRef.current = true;
			newestMessage.current = undefined;
		},
		[
			curSessionRef,
			handleUserSubmit,
			createNewSession,
			selectedModelRef,
			message,
			intl,
		],
	);

	useEffect(() => {
		if (!loading && sendQueueMessagesRef.current.length > 0) {
			onSenderSubmit(
				sendQueueMessagesRef.current[0].content,
				sendQueueMessagesRef.current[0].flow_config,
			);
			setSendQueueMessages((prev) => prev.slice(1));
		}
	}, [loading, onSenderSubmit, sendQueueMessagesRef, setSendQueueMessages]);

	useEffect(() => {
		if (!senderLoading) {
			userSendingRef.current = false;
		}
	}, [senderLoading]);

	const chatSender = (
		<div className="chatSend">
			<WorkflowList
				sendMessageAction={(message, _flowConfig) => {
					const globalVariable = new Map<string, string>();
					globalVariable.set("{{USER_INPUT}}", inputValue);
					const flowConfig = _flowConfig
						? {
								..._flowConfig,
								globalVariable,
							}
						: undefined;

					if (userSendingRef.current) {
						setSendQueueMessages((prev) =>
							prev.concat({
								content: message,
								title:
									flowConfig?.name ??
									intl.formatMessage({
										id: "tools.chat.sendQueue.userMessage",
									}),
								flow_config: flowConfig,
							}),
						);
						return;
					}

					userSendingRef.current = true;

					onSenderSubmit(message, flowConfig);
				}}
			/>

			<div className="chatSendHotkeysMenu">
				<HotkeysMenu
					menu={{
						items: [
							{
								label: (
									<FormattedMessage
										id="settings.hotKeySettings.keyEventTooltip"
										values={{
											message: <FormattedMessage id="tools.chat.chatCopy" />,
											key: formatKey(
												hotKeys?.[CommonKeyEventKey.ChatCopy]?.hotKey,
											),
										}}
									/>
								),
								key: "copy",
								onClick: onCopy,
							},
							{
								label: (
									<FormattedMessage
										id="settings.hotKeySettings.keyEventTooltip"
										values={{
											message: (
												<FormattedMessage id="tools.chat.chatCopyAndHide" />
											),
											key: formatKey(
												hotKeys?.[CommonKeyEventKey.ChatCopyAndHide]?.hotKey,
											),
										}}
									/>
								),
								key: "copyAndHide",
								onClick: onCopyAndHide,
							},
						],
					}}
				/>
			</div>
			{/** 输入框 */}
			<Suggestion
				items={[]}
				onSelect={(itemVal) => setInputValue(`[${itemVal}]:`)}
			>
				{({ onKeyDown }) => (
					<Sender
						ref={senderRef}
						loading={senderLoading}
						value={inputValue}
						onChange={(v) => {
							if (v.length > 10000) {
								setInputValue(v.substring(0, 10000));
							} else {
								setInputValue(v);
							}
						}}
						disabled={sessionStoreLoading}
						onSubmit={async (message) => {
							if (!curSessionRef.current) {
								await createNewSession();
							}

							onSenderSubmit(message);
						}}
						onCancel={abortChat}
						placeholder={intl.formatMessage({ id: "tools.chat.placeholder" })}
						onKeyDown={(e) => {
							if (
								e.key === "Enter" &&
								(senderLoading || userSendingRef.current)
							) {
								setSendQueueMessages((prev) =>
									prev.concat({
										content: inputValue,
										title: intl.formatMessage({
											id: "tools.chat.sendQueue.userMessage",
										}),
									}),
								);
								setInputValue("");
							}

							onKeyDown(e);
						}}
						actions={(_, info) => {
							const { SendButton, LoadingButton } = info.components;
							return (
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: token.marginXS,
									}}
								>
									<SendQueueMessageList queue={sendQueueMessages} />
									{loading ? (
										<LoadingButton type="default" />
									) : (
										<SendButton type="primary" />
									)}
								</div>
							);
						}}
					/>
				)}
			</Suggestion>
		</div>
	);

	const updateHistory = useCallback(
		(msgList: MessageInfo<BubbleDataType>[] | undefined) => {
			const currentSession = curSessionRef.current;
			if (msgList && msgList.length > 0 && currentSession) {
				setMessageHistory((prev) => ({
					...prev,
					[currentSession]: msgList,
				}));

				const session = sessionListRef.current.find(
					(i) => i.key === currentSession,
				);
				if (!session) {
					appError("[updateHistory] session is undefined");
					return;
				}
				chatHistoryStoreRef.current?.set(currentSession, {
					session,
					messages: msgList,
				});
			}
		},
		[curSessionRef, sessionListRef, setMessageHistory],
	);
	const updateHistoryDebounce = useMemo(
		() => debounce(updateHistory, 1000),
		[updateHistory],
	);

	const scrollToBottom = useMemo(() => {
		return throttle(() => {
			if (!autoScrollRef.current || !scrollbarRef.current) {
				return;
			}
			scrollbarRef.current.scrollToBottom();
		}, 100);
	}, []);

	useEffect(() => {
		updateHistoryDebounce(messages);
		scrollToBottom();
	}, [messages, updateHistoryDebounce, scrollToBottom]);

	const searchParams = useSearch({ from: "/_layout/tools/chat" }) as {
		t?: string;
		selectText?: string;
	};
	const { t: searchParamsSign, selectText: searchParamsSelectText } =
		searchParams;
	const prevSearchParamsSign = useRef<string | null>(null);
	const handleSelectedText = useCallback(async () => {
		if (prevSearchParamsSign.current === searchParamsSign) {
			return;
		}

		if (searchParamsSelectText) {
			let newSessionPromise: Promise<void> | undefined;
			if (
				messageHistoryRef.current &&
				curSessionRef.current &&
				messageHistoryRef.current[curSessionRef.current].length > 0 &&
				getAppSettings()[AppSettingsGroup.FunctionChat].autoCreateNewSession
			) {
				newSessionPromise = createNewSession();
			}

			await finishScreenshot();

			if (newSessionPromise) {
				await newSessionPromise;
			}
			setInputValue(
				decodeParamsValue(searchParamsSelectText).substring(0, 10000),
			);
		}

		setTimeout(() => {
			senderRef.current?.focus();
			prevSearchParamsSign.current = searchParamsSign ?? null;
		}, 64);
	}, [
		searchParamsSign,
		searchParamsSelectText,
		messageHistoryRef,
		curSessionRef,
		getAppSettings,
		createNewSession,
	]);
	useEffect(() => {
		handleSelectedText();
	}, [handleSelectedText]);

	return (
		<div className="copilotChat">
			{/** 对话区 - header */}
			{chatHeader}

			{/** 对话区 - 消息列表 */}
			{chatList}

			{/** 对话区 - 输入框 */}
			{chatSender}

			<style jsx>{`
                :global(.copilotChat) {
                    display: flex;
                    width: 100%;
                    flex-direction: column;
                    background: var(--snow-shot-surface);
                    color: var(--snow-shot-ink);
                }
                :global(.chatHeader) {
                    height: 52px;
                    box-sizing: border-box;
                    border-bottom: 1px solid var(--snow-shot-hairline);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 14px;
                    background: var(--snow-shot-header-bg);
                    user-select: none;
                }
                :global(.chatHeader.is-macos) {
                    padding-inline-start: 76px !important;
                }
                :global(.chatHeaderLeft),
                :global(.chatHeaderRight) {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                :global(.chatHeaderCenter) {
                    flex: 1 1 auto;
                    height: 100%;
                    min-width: 16px;
                }
                :global(.chatHeaderBackButton) {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-weight: 500;
                    color: var(--snow-shot-ink) !important;
                }
                :global(.chatHeaderBackButton:hover) {
                    background-color: var(--snow-shot-surface-elevated) !important;
                }
                :global(.chatHeaderDivider) {
                    display: inline-block;
                    width: 1px;
                    height: 18px;
                    background: var(--snow-shot-hairline);
                    margin: 0 4px;
                }
                :global(.chatWindowBtn) {
                    color: var(--snow-shot-muted) !important;
                }
                :global(.chatWindowBtn:hover) {
                    color: var(--snow-shot-ink) !important;
                    background-color: var(--snow-shot-surface-elevated) !important;
                }
                :global(.headerTitle) {
                    font-weight: 600;
                    font-size: 15px;
                }
                :global(.chatHeaderHeaderButton) {
                    font-size: 1.4em !important;
                }
                :global(.chatHeaderThinkingButton) {
                    font-size: 1.4em !important;
                }
                :global(.conversations) {
                    box-sizing: border-box;
                    padding: 0 !important;
                }
                :global(.conversations .ant-conversations-list) {
                    padding-inline-start: 0;
                }
                :global(.chatList) {
                    overflow: auto;
                    height: 100%;
                    padding: 0 ${token.padding}px;
                }

                :global(.chatWelcomeWrap) {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding-bottom: 11.8%;
                }
                :global(.chatSend) {
                    padding: 0px;
                    padding: ${token.padding}px;
                    position: relative;
                }
                :global(.chatSendHotkeysMenu) {
                    position: absolute;
                    right: 0;
                    transform: translateY(-100%) translateX(${-token.padding}px);
                    top: ${16}px;
                }
                :global(.speechButton) {
                    font-size: 18px;
                    color: var(--snow-shot-ink) !important;
                }

                /* @ant-design/x does not inherit the app's compact form chrome.
                   Keep the sender as a single dark field rather than a bright
                   inset outline with a white-filled submit control. */
                :global(.copilotChat .ant-sender) {
                    border: 1px solid var(--snow-shot-hairline) !important;
                    border-radius: var(--snow-shot-radius) !important;
                    background: var(--snow-shot-surface) !important;
                    box-shadow: none !important;
                }

                :global(.copilotChat .ant-sender:focus-within) {
                    border-color: var(--snow-shot-primary-strong) !important;
                    box-shadow: 0 0 0 1px var(--snow-shot-primary-soft) !important;
                }

                :global(.copilotChat .ant-sender .ant-sender-input) {
                    background: transparent !important;
                    box-shadow: none !important;
                    color: var(--snow-shot-ink) !important;
                }

                :global(.copilotChat .ant-sender-actions-btn.ant-btn-primary) {
                    border-color: var(--snow-shot-hairline-strong) !important;
                    background: var(--snow-shot-surface-elevated) !important;
                    color: var(--snow-shot-ink) !important;
                }

                :global(.copilotChat .ant-sender-actions-btn.ant-btn-primary:hover) {
                    border-color: var(--snow-shot-primary-strong) !important;
                    background: var(--snow-shot-surface-card) !important;
                }

                :global(.ant-bubble-content-wrapper .ant-bubble-footer) {
                    opacity: 0;
                    transition: opacity ${token.motionDurationFast} ${token.motionEaseInOut};
                }

                :global(.ant-bubble-content-wrapper:hover .ant-bubble-footer) {
                    opacity: 1;
                }

                :global(.ant-bubble-content .ant-typography > p):first-child {
                    margin-top: ${token.marginXXS}px;
                }
            `}</style>
		</div>
	);
};

export const ChatPage = () => {
	return (
		<Suspense>
			<div className="copilotWrapper">
				<Chat />
				<style jsx>{`
                    :global(.copilotWrapper) {
                        position: fixed;
                        inset: 0;
                        display: flex;
                        width: 100%;
                        height: 100%;
                    }
                `}</style>
			</div>
		</Suspense>
	);
};
