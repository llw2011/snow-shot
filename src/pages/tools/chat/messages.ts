import type { BubbleDataType as AntdBubbleDataType } from "@ant-design/x/es/bubble/BubbleList";
import type { ChatModel } from "@/services/tools/chat";
import type { ChatApiConfig } from "@/types/appSettings";
import type { ChatMessage, ChatMessageFlowConfig } from "./types";

export type BubbleDataType = AntdBubbleDataType & {
	flow_config?: ChatMessageFlowConfig;
};

export type ChatModelConfig = ChatModel & {
	customConfig?: ChatApiConfig;
};

/** Plain text of a message; reasoning is quoted unless it is ignored. */
export const getMessageContent = (
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
		const reasoning =
			!ignoreReasoningContent && message.content.reasoning_content
				? `${message.content.reasoning_content
						.split("\n")
						.map((line) => `> ${line}`)
						.join("\n")}\n\n`
				: "";
		return `${reasoning}${message.content.content}`;
	}

	return "";
};

/**
 * Drop failed exchanges from the context and collapse repeated roles, so a
 * retry after an error does not resend the broken turn.
 */
export const filterErrorMessages = (messages: BubbleDataType[] | undefined) => {
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

	for (const currentMessage of newMessages) {
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
