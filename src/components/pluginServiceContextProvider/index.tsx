import { isDeepEqualReact } from "@ant-design/pro-components";
import * as path from "@tauri-apps/api/path";
import { throttle } from "es-toolkit";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
	pluginGetPluginsStatus,
	pluginInit,
	pluginRegisterPlugin,
} from "@/commands/plugin";
import { getBuildPluginFileSources } from "@/constants/buildFlavor";
import {
	PLUGIN_ID_AI_CHAT,
	PLUGIN_ID_FFMPEG,
	PLUGIN_ID_GLM_OCR,
	PLUGIN_ID_RAPID_OCR,
	PLUGIN_ID_TRANSLATE,
} from "@/constants/pluginService";
import { PluginServiceContext } from "@/contexts/pluginServiceContext";
import { useStateRef } from "@/hooks/useStateRef";
import { PluginStatus, type PluginStatusResult } from "@/types/commands/plugin";
import {
	PluginConfig,
	type PluginItem,
	type PluginStatusRecord,
} from "@/types/components/pluginService";
import { getAppConfigBaseDirWithCache } from "@/utils/environment";
import { getPlatform } from "@/utils/platform";

export const PluginServiceContextProvider: React.FC<{
	children: React.ReactNode;
	autoInit: boolean;
}> = ({ children, autoInit }) => {
	const pluginList = useMemo<PluginItem[]>(() => {
		return [
			{
				id: PLUGIN_ID_GLM_OCR,
				file_list: [],
			},
			{
				id: PLUGIN_ID_RAPID_OCR,
				file_list: [
					"ch_ppocr_mobile_v2.0_cls_infer.onnx",
					"ch_PP-OCRv4_det_infer.onnx",
					"ch_PP-OCRv4_rec_infer.onnx",
					"ch_PP-OCRv5_rec_mobile_infer.onnx",
				],
				file_source_list: getBuildPluginFileSources(PLUGIN_ID_RAPID_OCR) ?? [
					{
						path: "ch_ppocr_mobile_v2.0_cls_infer.onnx",
						url: "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.9.0/onnx/PP-OCRv4/cls/ch_ppocr_mobile_v2.0_cls_mobile.onnx",
						sha256:
							"e47acedf663230f8863ff1ab0e64dd2d82b838fceb5957146dab185a89d6215c",
					},
					{
						path: "ch_PP-OCRv4_det_infer.onnx",
						url: "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.9.0/onnx/PP-OCRv4/det/ch_PP-OCRv4_det_mobile.onnx",
						sha256:
							"d2a7720d45a54257208b1e13e36a8479894cb74155a5efe29462512d42f49da9",
					},
					{
						path: "ch_PP-OCRv4_rec_infer.onnx",
						url: "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.9.0/onnx/PP-OCRv4/rec/ch_PP-OCRv4_rec_mobile.onnx",
						sha256:
							"48fc40f24f6d2a207a2b1091d3437eb3cc3eb6b676dc3ef9c37384005483683b",
					},
					{
						path: "ch_PP-OCRv5_rec_mobile_infer.onnx",
						url: "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.9.0/onnx/PP-OCRv5/rec/ch_PP-OCRv5_rec_mobile.onnx",
						sha256:
							"5825fc7ebf84ae7a412be049820b4d86d77620f204a041697b0494669b1742c5",
					},
				],
			},
			{
				id: PLUGIN_ID_FFMPEG,
				file_list: getPlatform() === "windows" ? ["ffmpeg.exe"] : ["ffmpeg"],
				file_source_list: getBuildPluginFileSources(PLUGIN_ID_FFMPEG),
			},
			{
				id: PLUGIN_ID_TRANSLATE,
				file_list: [],
			},
			{
				id: PLUGIN_ID_AI_CHAT,
				file_list: [],
			},
		];
	}, []);

	const [pluginConfig, setPluginConfig, pluginConfigRef] = useStateRef<
		PluginConfig | undefined
	>(undefined);
	const pluginStatusResultRef = useRef<PluginStatusResult[] | undefined>(
		undefined,
	);
	const [pluginStatus, setPluginStatus, pluginStatusRef] = useStateRef<
		PluginStatusRecord | undefined
	>(undefined);
	const [pluginReadyStatus, setPluginReadyStatus, pluginReadyStatusRef] =
		useStateRef<Record<string, boolean> | undefined>(undefined);

	const hasInitService = useRef(false);
	const initServiceReadyRef = useRef(false);
	const initPluginConfig = useCallback(async () => {
		const configDirPath = await getAppConfigBaseDirWithCache();

		const pluginConfig = new PluginConfig(
			pluginList,
			"20251005",
			await path.join(configDirPath, "plugins"),
			await path.join(configDirPath, "pluginsDownloads"),
		);
		setPluginConfig(pluginConfig);

		if (!hasInitService.current) {
			hasInitService.current = true;

			if (autoInit) {
				await pluginInit(
					pluginConfig.version,
					pluginConfig.plugin_install_dir,
					pluginConfig.plugin_download_dir,
				);
				await Promise.all(
					pluginList.map(async (plugin) => {
						await pluginRegisterPlugin(
							plugin.id,
							plugin.file_list,
							plugin.file_source_list,
						);
					}),
				);
			}

			initServiceReadyRef.current = true;
		}
	}, [setPluginConfig, pluginList, autoInit]);

	const refreshPluginStatus = useCallback(async () => {
		const pluginStatus = await pluginGetPluginsStatus();

		if (isDeepEqualReact(pluginStatus, pluginStatusResultRef.current)) {
			return;
		}

		pluginStatusResultRef.current = pluginStatus;

		setPluginStatus(
			pluginStatus.reduce((acc, plugin) => {
				acc[plugin.name] = plugin;
				return acc;
			}, {} as PluginStatusRecord),
		);

		const pluginReadyStatus = pluginStatus.reduce(
			(acc, plugin) => {
				acc[plugin.name] = plugin.status === PluginStatus.Installed;
				return acc;
			},
			{} as Record<string, boolean>,
		);

		if (isDeepEqualReact(pluginReadyStatus, pluginReadyStatusRef.current)) {
			return;
		}

		pluginReadyStatusRef.current = pluginReadyStatus;

		setPluginReadyStatus(pluginReadyStatus);
	}, [setPluginStatus, setPluginReadyStatus, pluginReadyStatusRef]);

	const refreshPluginStatusThrottle = useMemo(
		() => throttle(refreshPluginStatus, 1000),
		[refreshPluginStatus],
	);

	const initPluginPendingRef = useRef(false);
	useEffect(() => {
		if (initPluginPendingRef.current) {
			return;
		}

		initPluginPendingRef.current = true;
		initPluginConfig().then(() => {
			refreshPluginStatus();
			initPluginPendingRef.current = false;
		});
	}, [initPluginConfig, refreshPluginStatus]);

	const isReadyCore = useCallback(
		(pluginId: string) => {
			return pluginReadyStatusRef.current?.[pluginId] ?? false;
		},
		[pluginReadyStatusRef],
	);

	const isReadyStatusCore = useCallback(
		(pluginId: string) => {
			return pluginReadyStatus?.[pluginId] ?? false;
		},
		[pluginReadyStatus],
	);

	const contextValues = useMemo(() => {
		return {
			pluginConfig,
			pluginConfigRef,
			pluginStatus,
			pluginStatusRef,
			refreshPluginStatus,
			refreshPluginStatusThrottle,
			isReady: pluginStatus ? isReadyCore : undefined,
			isReadyStatus: pluginStatus ? isReadyStatusCore : undefined,
		};
	}, [
		isReadyCore,
		pluginConfig,
		pluginConfigRef,
		pluginStatus,
		pluginStatusRef,
		refreshPluginStatus,
		refreshPluginStatusThrottle,
		isReadyStatusCore,
	]);

	return (
		<PluginServiceContext.Provider value={contextValues}>
			{children}
		</PluginServiceContext.Provider>
	);
};
