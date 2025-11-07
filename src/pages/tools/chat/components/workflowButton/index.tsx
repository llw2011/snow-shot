"use client";

import { Dropdown } from "antd";
import { useContext, useRef } from "react";
import { FormattedMessage } from "react-intl";
import { AntdContext } from "@/contexts/antdContext";
import {
	type ChatWorkflowConfig,
	ChatWorkflowConfigStore,
} from "@/utils/appStore";
import {
	UpdateOrCreateWorkflow,
	type UpdateOrCreateWorkflowActionType,
} from "../updateOrCreateWorkflow";
import type { SendMessageActionType } from "../workflowList";

export const WorkflowButton: React.FC<{
	config: ChatWorkflowConfig;
	onUpdateAction: () => void;
	sendMessageAction: SendMessageActionType;
}> = ({ config, onUpdateAction, sendMessageAction }) => {
	const { modal } = useContext(AntdContext);
	const actionRef = useRef<UpdateOrCreateWorkflowActionType | undefined>(
		undefined,
	);
	return (
		<div>
			<Dropdown.Button
				size="small"
				style={{ width: "auto" }}
				onClick={() => {
					config.flow_list.forEach((flow) => {
						sendMessageAction(flow.message, {
							...config,
							flow,
						});
					});
				}}
				menu={{
					items: [
						{
							key: "edit",
							label: <FormattedMessage id="common.edit" />,
							onClick: () => {
								actionRef.current?.setOpen(true);
							},
						},
						{
							key: "delete",
							label: <FormattedMessage id="common.delete" />,
							onClick: () => {
								modal.confirm({
									title: <FormattedMessage id="common.delete" />,
									content: (
										<FormattedMessage
											id="common.delete.tip"
											values={{ name: config.name }}
										/>
									),
									onOk: async () => {
										const chatWorkflowConfigStore =
											new ChatWorkflowConfigStore();
										await chatWorkflowConfigStore.init();
										await chatWorkflowConfigStore.delete(config.id);
										onUpdateAction();
									},
								});
							},
						},
					],
				}}
			>
				{config.name}
			</Dropdown.Button>
			<UpdateOrCreateWorkflow
				workflow={config}
				actionRef={actionRef}
				onUpdateAction={onUpdateAction}
			/>
		</div>
	);
};
