"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Button, theme } from "antd";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormattedMessage } from "react-intl";
import ScrollShadow from "@/components/scrollShadow";
import {
	type ChatWorkflowConfig,
	ChatWorkflowConfigStore,
} from "@/utils/appStore";
import type { ChatMessageFlowConfig } from "../../types";
import { UpdateOrCreateWorkflow } from "../updateOrCreateWorkflow";
import { WorkflowButton } from "../workflowButton";

export type SendMessageActionType = (
	message: string,
	flow?: ChatMessageFlowConfig,
) => void;

export const WorkflowList: React.FC<{
	sendMessageAction: SendMessageActionType;
}> = ({ sendMessageAction }) => {
	const { token } = theme.useToken();
	const chatWorkflowConfigStoreRef = useRef<
		ChatWorkflowConfigStore | undefined
	>(undefined);

	const [configList, setConfigList] = useState<ChatWorkflowConfig[]>([]);

	const updateConfigListPendingRef = useRef(false);

	const updateConfigList = useCallback(async () => {
		if (updateConfigListPendingRef.current) {
			return;
		}
		updateConfigListPendingRef.current = true;

		if (!chatWorkflowConfigStoreRef.current) {
			chatWorkflowConfigStoreRef.current = new ChatWorkflowConfigStore();
			await chatWorkflowConfigStoreRef.current.init();
		}
		const list: ChatWorkflowConfig[] = [];
		for (const [
			,
			value,
		] of await chatWorkflowConfigStoreRef.current.entries()) {
			list.push({
				...value,
			});
		}
		setConfigList(list.sort((a, b) => a.name.localeCompare(b.name)));

		updateConfigListPendingRef.current = false;
	}, []);

	useEffect(() => {
		updateConfigList();
	}, [updateConfigList]);

	return (
		<div className="send-actions">
			<div className="workflow-actions-wrap">
				<ScrollShadow
					style={{
						display: "flex",
						gap: token.paddingXS,
					}}
					className="workflow-actions"
				>
					{configList.map((config) => (
						<WorkflowButton
							key={config.id}
							config={config}
							onUpdateAction={updateConfigList}
							sendMessageAction={sendMessageAction}
						/>
					))}

					<UpdateOrCreateWorkflow
						trigger={
							<Button
								size="small"
								style={{ color: token.colorPrimary }}
								icon={<PlusOutlined />}
							>
								<FormattedMessage id="tools.chat.createWorkflow" />
							</Button>
						}
						onUpdateAction={updateConfigList}
					/>
				</ScrollShadow>
			</div>

			<style jsx>{`
                .send-actions {
                }
                .workflow-actions-wrap {
                    display: flex;
                    align-items: center;
                    padding: ${token.marginXS}px 0;
                    overflow-x: hidden;
                    width: 100%;
                }
            `}</style>
		</div>
	);
};
