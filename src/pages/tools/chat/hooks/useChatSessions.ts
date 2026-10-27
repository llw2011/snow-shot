import type { Conversation } from "@ant-design/x/es/conversations";
import type { MessageInfo } from "@ant-design/x/es/use-x-chat";
import dayjs from "dayjs";
import { debounce } from "es-toolkit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useStateRef } from "@/hooks/useStateRef";
import { ChatHistoryStore } from "@/utils/appStore";
import { appError } from "@/utils/log";
import type { BubbleDataType } from "../messages";
import type { ChatMessage } from "../types";

export type ChatSession = Conversation & { isDefaultSession: boolean };

type UseChatSessionsOptions = {
	messages: MessageInfo<BubbleDataType>[];
	setMessages: (messages: MessageInfo<ChatMessage>[]) => void;
	/** Stops the running request before the visible thread changes. */
	abortChat: () => void;
};

/** Persisted conversation list and the history of every session. */
export const useChatSessions = ({
	messages,
	setMessages,
	abortChat,
}: UseChatSessionsOptions) => {
	const intl = useIntl();
	const storeRef = useRef<ChatHistoryStore | undefined>(undefined);
	const [storeLoading, setStoreLoading] = useState(true);
	const [sessionList, setSessionList, sessionListRef] = useStateRef<
		ChatSession[]
	>([]);
	const [curSession, setCurSession, curSessionRef] = useStateRef<
		string | undefined
	>(undefined);
	const [, setMessageHistory, messageHistoryRef] = useStateRef<
		Record<string, MessageInfo<BubbleDataType>[]>
	>({});

	useEffect(() => {
		if (storeRef.current) {
			return;
		}

		storeRef.current = new ChatHistoryStore();
		setStoreLoading(true);
		storeRef.current.init().then(async () => {
			setStoreLoading(false);

			const entries = ((await storeRef.current?.entries()) ?? []).sort((a, b) =>
				b[1].session.key.localeCompare(a[1].session.key),
			);
			const sessions: ChatSession[] = [];
			const history: Record<string, MessageInfo<BubbleDataType>[]> = {};
			for (const [key, value] of entries) {
				sessions.push({ ...value.session, isDefaultSession: false });
				history[key] = value.messages;
			}
			setSessionList(sessions);
			setMessageHistory(history);
		});
	}, [setSessionList, setMessageHistory]);

	const createNewSession = useCallback(
		() =>
			new Promise<void>((resolve) => {
				const currentDate = dayjs().format("YYYY-MM-DD");
				const sessionKey = `${currentDate}-${Date.now()}`;
				abortChat();
				// Aborting resolves the old request asynchronously; switch afterwards.
				setTimeout(() => {
					setSessionList((previous) => [
						{
							key: sessionKey,
							label: intl.formatMessage({ id: "tools.chat.newSession" }),
							group: currentDate,
							timestamp: Date.now(),
							isDefaultSession: true,
						},
						...previous,
					]);
					setCurSession(sessionKey);
					setMessages([]);
					resolve();
				}, 100);
			}),
		[abortChat, intl, setCurSession, setMessages, setSessionList],
	);

	const switchSession = useCallback(
		(key: string) => {
			abortChat();
			setTimeout(() => {
				setCurSession(key);
				setMessages(
					(messageHistoryRef.current?.[key] ||
						[]) as MessageInfo<ChatMessage>[],
				);
			}, 100);
		},
		[abortChat, messageHistoryRef, setCurSession, setMessages],
	);

	const clearSessions = useCallback(() => {
		setMessages([]);
		setCurSession(undefined);
		setSessionList([]);
		setMessageHistory({});
		storeRef.current?.clear();
		abortChat();
	}, [
		abortChat,
		setCurSession,
		setMessageHistory,
		setMessages,
		setSessionList,
	]);

	/** The first user message names a fresh session. */
	const nameCurrentSession = useCallback(
		(text: string) => {
			const current = sessionListRef.current.find(
				(session) => session.key === curSessionRef.current,
			);
			if (!current?.isDefaultSession) {
				return;
			}

			setSessionList((previous) =>
				previous.map((session) =>
					session.key !== curSessionRef.current
						? session
						: {
								...session,
								label: text.replace(/\s+/g, " ").trim().slice(0, 20),
								isDefaultSession: false,
							},
				),
			);
		},
		[curSessionRef, sessionListRef, setSessionList],
	);

	const saveHistory = useCallback(
		(messageList: MessageInfo<BubbleDataType>[] | undefined) => {
			const currentSession = curSessionRef.current;
			if (!messageList || messageList.length === 0 || !currentSession) {
				return;
			}

			setMessageHistory((previous) => ({
				...previous,
				[currentSession]: messageList,
			}));

			const session = sessionListRef.current.find(
				(item) => item.key === currentSession,
			);
			if (!session) {
				appError("[saveHistory] session is undefined");
				return;
			}
			storeRef.current?.set(currentSession, { session, messages: messageList });
		},
		[curSessionRef, sessionListRef, setMessageHistory],
	);
	const saveHistoryDebounced = useMemo(
		() => debounce(saveHistory, 1000),
		[saveHistory],
	);

	useEffect(() => {
		saveHistoryDebounced(messages);
	}, [messages, saveHistoryDebounced]);

	return {
		storeLoading,
		sessionList,
		curSession,
		curSessionRef,
		messageHistoryRef,
		createNewSession,
		switchSession,
		clearSessions,
		nameCurrentSession,
	};
};
