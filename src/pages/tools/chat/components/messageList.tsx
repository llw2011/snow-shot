import { CopyOutlined } from "@ant-design/icons";
import { Bubble, Welcome } from "@ant-design/x";
import type { MessageInfo } from "@ant-design/x/es/use-x-chat";
import { Button, Space, Spin } from "antd";
import { debounce, throttle } from "es-toolkit";
import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import RSC, { type Scrollbar } from "react-scrollbars-custom";
import { BotIcon } from "@/components/icons";
import { MarkdownContent } from "@/components/markdownContent";
import { writeTextToClipboard } from "@/utils/clipboard";
import { type BubbleDataType, getMessageContent } from "../messages";

const BOT_AVATAR = {
	icon: <BotIcon />,
	style: {
		color: "var(--snow-shot-primary)",
		backgroundColor: "transparent",
		fontSize: "1.8em",
	},
};

const copyBubble = (content: unknown) => {
	if (content && typeof content === "object" && "props" in content) {
		writeTextToClipboard(
			(content as { props: { clipboardContent: string } }).props
				.clipboardContent,
		);
	} else if (typeof content === "string") {
		writeTextToClipboard(content);
	}
};

/**
 * The thread of the current session. It follows new tokens until the user
 * scrolls, and resumes following a few seconds after scrolling stops.
 */
export const MessageList: React.FC<{
	messages: MessageInfo<BubbleDataType>[];
	sessionKey: string | undefined;
	/** Changes whenever the view should jump back to the newest message. */
	followSignal: number;
}> = ({ messages, sessionKey, followSignal }) => {
	const intl = useIntl();
	const scrollbarRef = useRef<Scrollbar | null>(null);
	const followRef = useRef(true);

	const resumeFollowing = useMemo(
		() =>
			debounce(() => {
				followRef.current = true;
			}, 3000),
		[],
	);
	const scrollToBottom = useMemo(
		() =>
			throttle(() => {
				if (followRef.current) {
					scrollbarRef.current?.scrollToBottom();
				}
			}, 100),
		[],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: the signal is the trigger
	useEffect(() => {
		followRef.current = true;
		scrollToBottom();
	}, [followSignal, sessionKey, scrollToBottom]);

	useEffect(() => {
		if (messages.length > 0) {
			scrollToBottom();
		}
	}, [messages, scrollToBottom]);

	const items = useMemo((): BubbleDataType[] | undefined => {
		if (messages.length === 0) {
			return undefined;
		}

		return messages.map((item): BubbleDataType => {
			if (item.status === "loading") {
				return {
					loading: true,
					role: "assistant",
					avatar: BOT_AVATAR,
					variant: "borderless",
				};
			}

			const content = getMessageContent(item.message);
			const isAssistant = item.message.role === "assistant";
			return {
				role: item.message.role,
				placement: isAssistant ? "start" : "end",
				content,
				variant: isAssistant ? "borderless" : "filled",
				messageRender: isAssistant
					? () => (
							<MarkdownContent content={content} clipboardContent={content} />
						)
					: undefined,
				avatar: isAssistant ? BOT_AVATAR : undefined,
			};
		});
	}, [messages]);

	return (
		<div className="chat-list">
			<RSC
				ref={scrollbarRef as never}
				onWheel={() => {
					followRef.current = false;
					resumeFollowing();
				}}
			>
				{items ? (
					<Bubble.List
						style={{ height: "100%", paddingInline: 20, paddingBlock: 16 }}
						items={items}
						key={sessionKey}
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
									<Button
										type="text"
										size="small"
										icon={<CopyOutlined />}
										onClick={() => copyBubble(content)}
									/>
								),
							},
							user: { placement: "end" },
						}}
					/>
				) : (
					<div className="chat-welcome">
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
};
