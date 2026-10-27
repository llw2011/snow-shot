import { DeleteOutlined } from "@ant-design/icons";
import { Conversations } from "@ant-design/x";
import { Button, Drawer } from "antd";
import type React from "react";
import { useContext } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { AntdContext } from "@/contexts/antdContext";
import type { ChatSession } from "../hooks/useChatSessions";

/** Conversation history, docked to the left edge of the chat tool. */
export const SessionDrawer: React.FC<{
	open: boolean;
	onClose: () => void;
	sessions: ChatSession[];
	currentSession: string | undefined;
	onSelect: (key: string) => void;
	onClear: () => void;
}> = ({ open, onClose, sessions, currentSession, onSelect, onClear }) => {
	const intl = useIntl();
	const { modal } = useContext(AntdContext);

	return (
		<Drawer
			open={open}
			placement="left"
			getContainer={false}
			width={280}
			title={<FormattedMessage id="tools.chat.sessions" />}
			onClose={onClose}
			maskClosable
			closeIcon={false}
			styles={{ body: { padding: "4px 8px" } }}
			extra={
				<Button
					type="text"
					danger
					icon={<DeleteOutlined />}
					aria-label={intl.formatMessage({ id: "tools.chat.session.clear" })}
					onClick={() => {
						modal.confirm({
							title: intl.formatMessage({ id: "tools.chat.session.clear" }),
							content: intl.formatMessage({
								id: "tools.chat.session.clear.tip",
							}),
							okButtonProps: { danger: true },
							onOk: () => {
								onClear();
								onClose();
							},
						});
					}}
				/>
			}
		>
			<Conversations
				items={sessions}
				activeKey={currentSession}
				groupable
				onActiveChange={(key) => {
					onSelect(key);
					onClose();
				}}
				styles={{ item: { padding: "0 8px" } }}
				className="chat-sessions"
			/>
		</Drawer>
	);
};
