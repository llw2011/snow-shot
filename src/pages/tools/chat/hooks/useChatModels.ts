import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CUSTOM_MODEL_PREFIX } from "@/constants/buildFlavor";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { useStateRef } from "@/hooks/useStateRef";
import {
	type AppSettingsData,
	AppSettingsGroup,
	type ChatApiConfig,
} from "@/types/appSettings";
import { isUsableChatApiConfig } from "@/utils/apiConfig";
import type { ChatModelConfig } from "../messages";

/** Chat models from the model services, the selected one and its thinking toggle. */
export const useChatModels = () => {
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const [customModelConfigList, setCustomModelConfigList] = useState<
		ChatApiConfig[]
	>([]);
	const [supportedModels, setSupportedModels, supportedModelsRef] = useStateRef<
		ChatModelConfig[]
	>([]);
	const [selectedModel, setSelectedModel, selectedModelRef] = useStateRef<
		string | undefined
	>(undefined);
	const [enableThinking, setEnableThinking, enableThinkingRef] =
		useStateRef<boolean>(false);

	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData) => {
				setSelectedModel(settings[AppSettingsGroup.Cache].chatModel);
				setEnableThinking(
					settings[AppSettingsGroup.Cache].chatModelEnableThinking,
				);
				setCustomModelConfigList(
					settings[AppSettingsGroup.FunctionChat].chatApiConfigList.filter(
						isUsableChatApiConfig,
					),
				);
			},
			[setSelectedModel, setEnableThinking],
		),
		true,
	);

	useEffect(() => {
		setSupportedModels(
			customModelConfigList.map((item) => ({
				model: `${CUSTOM_MODEL_PREFIX}${item.api_model}`,
				name: item.model_name,
				thinking: item.support_thinking,
				customConfig: item,
				support_vision: item.support_vision ?? false,
			})),
		);
	}, [setSupportedModels, customModelConfigList]);

	const selectedModelConfig = useMemo(
		() => supportedModels.find((item) => item.model === selectedModel),
		[supportedModels, selectedModel],
	);

	const selectModel = useCallback(
		(model: string) => {
			updateAppSettings(
				AppSettingsGroup.Cache,
				{ chatModel: model },
				true,
				true,
				false,
				true,
				false,
			);
		},
		[updateAppSettings],
	);

	const toggleThinking = useCallback(() => {
		updateAppSettings(
			AppSettingsGroup.Cache,
			{ chatModelEnableThinking: !enableThinkingRef.current },
			true,
			true,
			false,
			true,
			false,
		);
	}, [enableThinkingRef, updateAppSettings]);

	return {
		supportedModels,
		supportedModelsRef,
		selectedModel,
		selectedModelRef,
		selectedModelSupportThinking: !!selectedModelConfig?.thinking,
		enableThinking,
		enableThinkingRef,
		selectModel,
		toggleThinking,
	};
};
