import { withCache } from "@/utils/cache";
import { serviceFetch } from ".";

export interface ChatModel {
	model: string;
	name: string;
	thinking: boolean;
	support_vision: boolean;
}

export const getChatModels = async () => {
	return serviceFetch<ChatModel[]>("/api/v1/chat/models", {
		method: "GET",
	});
};

// 内部函数：获取聊天模型数据
const fetchChatModels = async (): Promise<ChatModel[] | undefined> => {
	const resp = await getChatModels();
	if (resp.success()) {
		return resp.data ?? [];
	}
	return undefined;
};

export const getChatModelsWithCache = withCache(fetchChatModels, {
	key: "getChatModels",
	duration: 60 * 60 * 1000, // 缓存 1 小时
});
