export interface ChatModel {
	model: string;
	name: string;
	thinking: boolean;
	support_vision: boolean;
}

export const getChatModelsWithCache = async (): Promise<
	ChatModel[] | undefined
> => {
	return [];
};
