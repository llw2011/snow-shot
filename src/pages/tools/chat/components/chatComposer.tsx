import { Sender, Suggestion } from "@ant-design/x";
import type { SenderRef } from "@ant-design/x/es/sender";
import type React from "react";
import { useIntl } from "react-intl";
import type { ChatMessageFlowConfig, SendQueueMessage } from "../types";
import { SendQueueMessageList } from "./sendQueueMessageList";
import { WorkflowList } from "./workflowList";

const MAX_INPUT_LENGTH = 10000;

/** Workflow shortcuts above the message input and its send queue. */
export const ChatComposer: React.FC<{
	senderRef: React.RefObject<SenderRef | null>;
	value: string;
	onChange: (value: string) => void;
	disabled: boolean;
	loading: boolean;
	busy: boolean;
	queue: SendQueueMessage[];
	onSubmit: (value: string, flowConfig?: ChatMessageFlowConfig) => void;
	onWorkflow: (message: string, flowConfig?: ChatMessageFlowConfig) => void;
	onQueue: (value: string) => void;
	onCancel: () => void;
}> = ({
	senderRef,
	value,
	onChange,
	disabled,
	loading,
	busy,
	queue,
	onSubmit,
	onWorkflow,
	onQueue,
	onCancel,
}) => {
	const intl = useIntl();

	return (
		<div className="chat-composer">
			<WorkflowList sendMessageAction={onWorkflow} />
			<Suggestion items={[]} onSelect={(item) => onChange(`[${item}]:`)}>
				{({ onKeyDown }) => (
					<Sender
						ref={senderRef}
						loading={busy}
						value={value}
						onChange={(next) => onChange(next.substring(0, MAX_INPUT_LENGTH))}
						disabled={disabled}
						onSubmit={(message) => onSubmit(message)}
						onCancel={onCancel}
						placeholder={intl.formatMessage({ id: "tools.chat.placeholder" })}
						onKeyDown={(event) => {
							// Enter while an answer streams queues the message.
							if (event.key === "Enter" && busy) {
								onQueue(value);
							}
							onKeyDown(event);
						}}
						actions={(_, info) => {
							const { SendButton, LoadingButton } = info.components;
							return (
								<div className="chat-composer-actions">
									<SendQueueMessageList queue={queue} />
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
};
