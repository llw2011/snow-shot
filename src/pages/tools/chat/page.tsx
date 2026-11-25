"use client";

import type { SenderRef } from "@ant-design/x/es/sender";
import { useSearch } from "@tanstack/react-router";
import { last } from "es-toolkit";
import {
	Suspense,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { FormattedMessage, useIntl } from "react-intl";
import { EventListenerContext } from "@/components/eventListener";
import { ToolPage } from "@/components/workbench";
import { AntdContext } from "@/contexts/antdContext";
import { AppSettingsPublisher } from "@/contexts/appSettingsActionContext";
import { finishScreenshot } from "@/functions/screenshot";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { useStateRef } from "@/hooks/useStateRef";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { AppSettingsGroup } from "@/types/appSettings";
import {
	CommonKeyEventKey,
	type CommonKeyEventValue,
} from "@/types/core/commonKeyEvent";
import { decodeParamsValue } from "@/utils/base64";
import { copyText, copyTextAndHide } from "@/utils/clipboard";
import { ChatComposer } from "./components/chatComposer";
import { ChatToolbar } from "./components/chatToolbar";
import { MessageList } from "./components/messageList";
import { SessionDrawer } from "./components/sessionDrawer";
import { useChatAgent } from "./hooks/useChatAgent";
import { useChatModels } from "./hooks/useChatModels";
import { useChatSessions } from "./hooks/useChatSessions";
import { getMessageContent } from "./messages";
import type { ChatMessageFlowConfig, SendQueueMessage } from "./types";
import "./chat.css";

const HOTKEY_OPTIONS = {
	keyup: false,
	keydown: true,
	preventDefault: true,
	enableOnFormTags: ["INPUT", "TEXTAREA", "SELECT"],
} as const;

const Chat = () => {
	const intl = useIntl();
	const { message } = useContext(AntdContext);
	const [getAppSettings] = useStateSubscriber(AppSettingsPublisher, undefined);

	const [hotKeys, setHotKeys] =
		useState<Record<CommonKeyEventKey, CommonKeyEventValue>>();
	useAppSettingsLoad(
		useCallback((appSettings) => {
			setHotKeys(appSettings[AppSettingsGroup.CommonKeyEvent]);
		}, []),
		true,
	);

	const models = useChatModels();
	const agent = useChatAgent({
		supportedModels: models.supportedModels,
		supportedModelsRef: models.supportedModelsRef,
		selectedModelRef: models.selectedModelRef,
		enableThinkingRef: models.enableThinkingRef,
		getAppSettings,
	});
	const { messages, onRequest, setMessages, loading } = agent;

	const [sendQueue, setSendQueue, sendQueueRef] = useStateRef<
		SendQueueMessage[]
	>([]);
	const abortChat = useCallback(() => {
		agent.abort();
		setSendQueue([]);
	}, [agent, setSendQueue]);

	const sessions = useChatSessions({ messages, setMessages, abortChat });
	const {
		createNewSession,
		curSessionRef,
		inputValue,
		setInputValue,
		claimInputRequest,
		handledInputRequest,
	} = sessions;

	const messagesRef = useRef(messages);
	messagesRef.current = messages;

	const senderRef = useRef<SenderRef>(null);
	const mountedRef = useRef(true);
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);
	const userSendingRef = useRef(false);
	const [followSignal, setFollowSignal] = useState(0);
	const [sessionsOpen, setSessionsOpen] = useState(false);

	const startNewSession = useCallback(() => {
		if (messagesRef.current.length > 0) {
			createNewSession();
		} else {
			message.error(intl.formatMessage({ id: "tools.chat.newSession.tip" }));
		}
	}, [createNewSession, intl, message]);

	const submit = useCallback(
		async (
			value: string,
			flowConfig?: ChatMessageFlowConfig,
			consumeDraft = true,
		) => {
			if (sessions.storeLoading) {
				return;
			}
			if (!models.selectedModelRef.current) {
				message.error(intl.formatMessage({ id: "tools.chat.noSelectedModel" }));
				return;
			}

			const consumedDraft = consumeDraft
				? sessions.captureInputDraft()
				: undefined;
			if (!curSessionRef.current) {
				if (!(await createNewSession())) {
					return;
				}
				if (consumedDraft) {
					consumedDraft.session = curSessionRef.current;
				}
			}

			onRequest({
				stream: true,
				message: { content: value, role: "user", flow_config: flowConfig },
			});
			sessions.nameCurrentSession(value);
			if (consumedDraft) {
				sessions.consumeInputDraft(consumedDraft);
			}
			setFollowSignal((signal) => signal + 1);
			agent.newestMessage.current = undefined;
		},
		[
			agent.newestMessage,
			createNewSession,
			curSessionRef,
			intl,
			message,
			models.selectedModelRef,
			onRequest,
			sessions,
		],
	);

	const busy = loading || sendQueue.length > 0;

	// Drain the queue one message at a time once the current answer is done.
	useEffect(() => {
		if (!loading && sendQueueRef.current.length > 0) {
			const [next] = sendQueueRef.current;
			submit(next.content, next.flow_config, false);
			setSendQueue((previous) => previous.slice(1));
		}
	}, [loading, submit, sendQueueRef, setSendQueue]);

	useEffect(() => {
		if (!busy) {
			userSendingRef.current = false;
		}
	}, [busy]);

	const queueMessage = useCallback(
		(content: string, flowConfig?: ChatMessageFlowConfig) => {
			setSendQueue((previous) =>
				previous.concat({
					content,
					title:
						flowConfig?.name ??
						intl.formatMessage({ id: "tools.chat.sendQueue.userMessage" }),
					flow_config: flowConfig,
				}),
			);
		},
		[intl, setSendQueue],
	);

	const runWorkflow = useCallback(
		(content: string, baseFlowConfig?: ChatMessageFlowConfig) => {
			const globalVariable = new Map<string, string>([
				["{{USER_INPUT}}", inputValue],
			]);
			const flowConfig = baseFlowConfig
				? { ...baseFlowConfig, globalVariable }
				: undefined;

			if (userSendingRef.current) {
				queueMessage(content, flowConfig);
				return;
			}

			userSendingRef.current = true;
			submit(content, flowConfig);
		},
		[inputValue, queueMessage, submit],
	);

	const copyLast = useCallback((hide: boolean) => {
		const lastMessage = last(messagesRef.current);
		const text = lastMessage ? getMessageContent(lastMessage.message) : "";
		if (hide) {
			copyTextAndHide(text);
		} else {
			copyText(text);
		}
	}, []);

	useHotkeys(
		hotKeys?.[CommonKeyEventKey.ChatCopyAndHide]?.hotKey ?? "",
		() => copyLast(true),
		HOTKEY_OPTIONS,
	);
	useHotkeys(
		hotKeys?.[CommonKeyEventKey.ChatCopy]?.hotKey ?? "",
		() => copyLast(false),
		HOTKEY_OPTIONS,
	);
	useHotkeys(
		hotKeys?.[CommonKeyEventKey.ChatNewSession]?.hotKey ?? "",
		startNewSession,
		HOTKEY_OPTIONS,
	);

	// Closing the window can start a fresh session for the next question.
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
	}, [addListener, createNewSession, getAppSettings, removeListener]);

	// "Ask about selected text" opens this route with the text in the URL.
	const { t: requestSign, selectText } = useSearch({
		from: "/_layout/tools/chat",
	}) as { t?: string; selectText?: string };
	const handledSignRef = useRef<string | null>(null);
	useEffect(() => {
		if (
			sessions.storeLoading ||
			handledSignRef.current === (requestSign ?? null)
		) {
			return;
		}
		const sign = requestSign ?? null;
		handledSignRef.current = sign;
		if (sign && handledInputRequest === sign) {
			return;
		}

		(async () => {
			if (selectText) {
				const currentSession = curSessionRef.current;
				const hasHistory =
					!!currentSession &&
					(sessions.messageHistoryRef.current?.[currentSession]?.length ?? 0) >
						0;
				const newSession =
					hasHistory &&
					getAppSettings()[AppSettingsGroup.FunctionChat].autoCreateNewSession
						? createNewSession()
						: undefined;

				await finishScreenshot();
				if (newSession && !(await newSession)) {
					return;
				}
				if (!mountedRef.current || handledSignRef.current !== sign) {
					return;
				}
				setInputValue(decodeParamsValue(selectText).substring(0, 10000));
			}
			if (sign && mountedRef.current && handledSignRef.current === sign) {
				claimInputRequest(sign);
			}

			setTimeout(() => {
				if (mountedRef.current && handledSignRef.current === sign) {
					senderRef.current?.focus();
				}
			}, 64);
		})();
	}, [
		createNewSession,
		curSessionRef,
		getAppSettings,
		requestSign,
		selectText,
		setInputValue,
		sessions.messageHistoryRef,
		sessions.storeLoading,
		claimInputRequest,
		handledInputRequest,
	]);

	return (
		<ToolPage
			icon="chat"
			title={<FormattedMessage id="workbench.item.chat" />}
			className="chat-tool"
			actions={
				<ChatToolbar
					hasSessions={sessions.sessionList.length > 0}
					onOpenSessions={() => setSessionsOpen(true)}
					models={models.supportedModels}
					selectedModel={models.selectedModel}
					onSelectModel={models.selectModel}
					thinkingSupported={models.selectedModelSupportThinking}
					thinkingEnabled={models.enableThinking}
					onToggleThinking={models.toggleThinking}
					busy={loading}
					canStartNewSession={messages.length > 0}
					onNewSession={startNewSession}
					hotKeys={hotKeys}
					onCopy={() => copyLast(false)}
					onCopyAndHide={() => copyLast(true)}
				/>
			}
		>
			<div className="chat-layout">
				<MessageList
					messages={messages}
					sessionKey={sessions.curSession}
					followSignal={followSignal}
				/>
				<ChatComposer
					senderRef={senderRef}
					value={inputValue}
					onChange={setInputValue}
					disabled={sessions.storeLoading}
					loading={loading}
					busy={busy || userSendingRef.current}
					queue={sendQueue}
					onSubmit={(value) => submit(value)}
					onWorkflow={runWorkflow}
					onQueue={(value) => {
						const draft = sessions.captureInputDraft();
						queueMessage(value);
						sessions.consumeInputDraft(draft);
					}}
					onCancel={abortChat}
				/>
			</div>
			<SessionDrawer
				open={sessionsOpen}
				onClose={() => setSessionsOpen(false)}
				sessions={sessions.sessionList}
				currentSession={sessions.curSession}
				onSelect={(key) => {
					sessions.switchSession(key);
					setFollowSignal((signal) => signal + 1);
				}}
				onClear={sessions.clearSessions}
			/>
		</ToolPage>
	);
};

export const ChatPage = () => (
	<Suspense>
		<Chat />
	</Suspense>
);
