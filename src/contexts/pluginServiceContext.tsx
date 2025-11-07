import { createContext, useContext } from "react";
import {
	PluginConfig,
	type PluginStatusRecord,
} from "@/types/components/pluginService";

export type PluginServiceContextType = {
	pluginConfig: PluginConfig | undefined;
	pluginConfigRef: React.RefObject<PluginConfig | undefined>;
	pluginStatus: PluginStatusRecord | undefined;
	pluginStatusRef: React.RefObject<PluginStatusRecord | undefined>;
	/** 通过 Ref 判断，避免组件重复渲染 */
	isReady: ((pluginId: string) => boolean) | undefined;
	/** 通过状态判断，触发组件重新渲染 */
	isReadyStatus: ((pluginId: string) => boolean) | undefined;
	refreshPluginStatus: () => void;
	refreshPluginStatusThrottle: () => void;
};

export const PluginServiceContext = createContext<PluginServiceContextType>({
	pluginConfig: new PluginConfig([], "", "", "", ""),
	pluginConfigRef: { current: undefined },
	pluginStatus: undefined,
	pluginStatusRef: { current: undefined },
	isReady: undefined,
	isReadyStatus: undefined,
	refreshPluginStatus: () => {},
	refreshPluginStatusThrottle: () => {},
});

export const usePluginServiceContext = () => {
	return useContext(PluginServiceContext);
};
