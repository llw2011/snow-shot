import type { Conversation } from "@ant-design/x/es/conversations";
import type { MessageInfo } from "@ant-design/x/es/use-x-chat";
import { load } from "@tauri-apps/plugin-store";
import dayjs from "dayjs";
import { debounce } from "es-toolkit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { getAppConfigBaseDir } from "@/commands/file";
import { useStateRef } from "@/hooks/useStateRef";
import { ChatHistoryStore } from "@/utils/appStore";
import { appError } from "@/utils/log";
import { ChatDrafts, type ConsumedChatDraft } from "../drafts";
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
	const [inputValue, setInputValueState] = useState("");
	const drafts = useMemo(() => {
		let storePromise: ReturnType<typeof load> | undefined;
		const getStore = () => {
			storePromise ??= getAppConfigBaseDir()
				.then((directory) =>
					load(`${directory}/stores/chat-drafts.json`, {
						autoSave: false,
						defaults: {},
					}),
				)
				.catch((error) => {
					storePromise = undefined;
					throw error;
				});
			return storePromise;
		};
		return new ChatDrafts(
			{
				read: async () => (await getStore()).get("state"),
				write: async (snapshot) => {
					const store = await getStore();
					await store.set("state", snapshot);
					await store.save();
				},
			},
			(error) => appError("[ChatDrafts] draft storage failed", error),
		);
	}, []);
	const [sessionList, setSessionList, sessionListRef] = useStateRef<
		ChatSession[]
	>([]);
	const [curSession, setCurSession, curSessionRef] = useStateRef<
		string | undefined
	>(undefined);
	const [, setMessageHistory, messageHistoryRef] = useStateRef<
		Record<string, MessageInfo<BubbleDataType>[]>
	>({});
	const initializationRef = useRef<Promise<void> | undefined>(undefined);
	const activeRef = useRef(false);
	const sessionTransitionRef = useRef(0);

	useEffect(() => {
		activeRef.current = true;
		initializationRef.current ??= (async () => {
			storeRef.current = new ChatHistoryStore();
			await Promise.all([
				storeRef.current.init().catch((error) => {
					appError("[useChatSessions] history storage failed", error);
				}),
				drafts.init(),
			]);
		})();
		let disposed = false;
		void initializationRef.current
			.then(async () => {
				const entries = await storeRef.current?.entries().catch((error) => {
					appError("[useChatSessions] history read failed", error);
					return [];
				});
				if (disposed) {
					return;
				}
				const sessions: ChatSession[] = [];
				const history: Record<string, MessageInfo<BubbleDataType>[]> = {};
				for (const [key, value] of entries ?? []) {
					sessions.push({ ...value.session, isDefaultSession: false });
					history[key] = value.messages;
				}
				// A new thread can have a saved draft before its first history entry.
				for (const [key, text] of Object.entries(drafts.snapshot.drafts)) {
					if (key && !history[key]) {
						sessions.push({
							key,
							label: text.replace(/\s+/g, " ").trim().slice(0, 20),
							isDefaultSession: true,
						});
						history[key] = [];
					}
				}
				sessions.sort((a, b) => b.key.localeCompare(a.key));
				const restoredSession = drafts.snapshot.activeSession;
				const selected =
					restoredSession && history[restoredSession]
						? restoredSession
						: undefined;
				drafts.select(selected);
				setSessionList(sessions);
				setMessageHistory(history);
				setCurSession(selected);
				setMessages(
					(history[selected ?? ""] ?? []) as MessageInfo<ChatMessage>[],
				);
				setInputValueState(drafts.text());
				setStoreLoading(false);
			})
			.catch((error) => {
				appError("[useChatSessions] initialization failed", error);
				if (!disposed) {
					setStoreLoading(false);
					setInputValueState(drafts.text());
				}
			});
		return () => {
			disposed = true;
			activeRef.current = false;
			sessionTransitionRef.current++;
		};
	}, [drafts, setCurSession, setSessionList, setMessageHistory, setMessages]);

	const setInputValue = useCallback(
		(value: string) => {
			drafts.set(value, curSessionRef.current);
			setInputValueState(value);
		},
		[drafts, curSessionRef],
	);
	const captureInputDraft = useCallback(
		(): ConsumedChatDraft => ({
			session: curSessionRef.current,
			text: drafts.text(curSessionRef.current),
		}),
		[curSessionRef, drafts],
	);
	const consumeInputDraft = useCallback(
		(draft: ConsumedChatDraft) => {
			drafts.consume(draft);
			setInputValueState(drafts.text());
		},
		[drafts],
	);
	const claimInputRequest = useCallback(
		(sign: string) => drafts.claimRequest(sign),
		[drafts],
	);

	const createNewSession = useCallback(async () => {
		if (storeLoading) {
			return false;
		}
		const transition = ++sessionTransitionRef.current;
		const currentDate = dayjs().format("YYYY-MM-DD");
		const sessionKey = `${currentDate}-${Date.now()}`;
		abortChat();
		// Aborting resolves the old request asynchronously; switch afterwards.
		await new Promise<void>((resolve) => setTimeout(resolve, 100));
		if (!activeRef.current || transition !== sessionTransitionRef.current) {
			return false;
		}
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
		drafts.createSession(sessionKey);
		setInputValueState(drafts.text());
		return true;
	}, [
		abortChat,
		drafts,
		intl,
		setCurSession,
		setMessages,
		setSessionList,
		storeLoading,
	]);

	const switchSession = useCallback(
		(key: string) => {
			if (storeLoading) {
				return;
			}
			const transition = ++sessionTransitionRef.current;
			abortChat();
			setTimeout(() => {
				if (!activeRef.current || transition !== sessionTransitionRef.current) {
					return;
				}
				setCurSession(key);
				setMessages(
					(messageHistoryRef.current?.[key] ||
						[]) as MessageInfo<ChatMessage>[],
				);
				drafts.select(key);
				setInputValueState(drafts.text());
			}, 100);
		},
		[
			abortChat,
			drafts,
			messageHistoryRef,
			setCurSession,
			setMessages,
			storeLoading,
		],
	);

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
		(currentSession: string, messageList: MessageInfo<BubbleDataType>[]) => {
			const session = sessionListRef.current.find(
				(item) => item.key === currentSession,
			);
			if (!session) {
				return;
			}
			void storeRef.current
				?.set(currentSession, { session, messages: messageList })
				.catch((error) =>
					appError("[saveHistory] history write failed", error),
				);
		},
		[sessionListRef],
	);
	const saveHistoryDebounced = useMemo(
		() => debounce(saveHistory, 1000),
		[saveHistory],
	);
	const clearSessions = useCallback(() => {
		sessionTransitionRef.current++;
		saveHistoryDebounced.cancel();
		drafts.clear();
		setInputValueState("");
		setMessages([]);
		setCurSession(undefined);
		setSessionList([]);
		setMessageHistory({});
		void storeRef.current
			?.clear()
			.catch((error) =>
				appError("[useChatSessions] history clear failed", error),
			);
		abortChat();
	}, [
		abortChat,
		drafts,
		saveHistoryDebounced,
		setCurSession,
		setMessageHistory,
		setMessages,
		setSessionList,
	]);

	useEffect(() => {
		if (curSession && messages.length > 0 && !storeLoading) {
			setMessageHistory((previous) => ({
				...previous,
				[curSession]: messages,
			}));
			saveHistoryDebounced(curSession, messages);
		}
	}, [
		curSession,
		messages,
		saveHistoryDebounced,
		setMessageHistory,
		storeLoading,
	]);
	useEffect(() => {
		if (curSession) {
			return () => saveHistoryDebounced.flush();
		}
	}, [curSession, saveHistoryDebounced]);

	return {
		storeLoading,
		inputValue,
		setInputValue,
		captureInputDraft,
		consumeInputDraft,
		claimInputRequest,
		handledInputRequest: drafts.snapshot.handledRequest,
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
