import { Button, List, Modal, theme } from "antd";
import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import RSC from "react-scrollbars-custom";
import type { SendQueueMessage } from "../types";

const MessageContent: React.FC<{
	content: string;
}> = ({ content }) => {
	return <div style={{ whiteSpace: "pre-wrap" }}>{content}</div>;
};

export const SendQueueMessageList: React.FC<{
	queue: SendQueueMessage[];
}> = ({ queue }) => {
	const { token } = theme.useToken();

	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (queue.length === 0) {
			setOpen(false);
		}
	}, [queue]);

	if (queue.length === 0) {
		return null;
	}

	return (
		<div className="send-queue-container">
			<Button type="text" size="small" onClick={() => setOpen(true)}>
				<div className="send-queue-btn-text">
					<FormattedMessage
						id="tools.chat.sendQueue"
						values={{ count: queue.length }}
					/>
				</div>
			</Button>

			<Modal
				open={open}
				onCancel={() => setOpen(false)}
				onOk={() => setOpen(false)}
				title={<FormattedMessage id="tools.chat.sendQueue.title" />}
				cancelButtonProps={{ style: { display: "none" } }}
				width={"83vw"}
			>
				<div style={{ height: "42vh" }}>
					<RSC>
						<List
							itemLayout="horizontal"
							dataSource={queue}
							renderItem={(item, index) => (
								<List.Item>
									<List.Item.Meta
										title={
											<div className="send-queue-item-title">
												{index + 1}. {item.title}
											</div>
										}
										description={<MessageContent content={item.content} />}
									/>
								</List.Item>
							)}
						/>
					</RSC>
				</div>
			</Modal>
			<style jsx>
				{`
                    .send-queue-btn-text {
                        color: ${token.colorTextSecondary};
                        opacity: 0.42;
                        transition: opacity ${token.motionDurationFast} ${token.motionEaseInOut};
                    }

                    .send-queue-container :global(.ant-btn:hover) .send-queue-btn-text {
                        opacity: 1;
                    }
                `}
			</style>
		</div>
	);
};
