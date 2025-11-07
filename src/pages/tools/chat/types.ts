import type { ChatWorkflowConfig, ChatWorkflowFlow } from "@/utils/appStore";

export type SendQueueMessage = {
	title: string;
	content: string;
	flow_config?: ChatMessageFlowConfig;
};

export type ChatMessage = {
	content:
		| {
				reasoning_content: string;
				content: string;
				response_error: boolean;
		  }
		| string;
	role: "user" | "assistant";
	flow_config?: ChatMessageFlowConfig;
};

export type ChatMessageFlowConfig = Omit<ChatWorkflowConfig, "flow_list"> & {
	flow: ChatWorkflowFlow;
	globalVariable?: Map<string, string>;
};
