import { useCallback, useEffect, useRef, useState } from "react";
import {
	autoStartDisable,
	autoStartEnable,
	initUiElements,
	setEnableProxy,
	setRunLog,
} from "@/commands/core";
import { hotLoadPageInit } from "@/commands/hotLoadPage";
import { ocrInit } from "@/commands/ocr";
import { videoRecordInit } from "@/commands/videoRecord";
import {
	PLUGIN_ID_FFMPEG,
	PLUGIN_ID_RAPID_OCR,
} from "@/constants/pluginService";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";
import { CaptureHistory } from "@/utils/captureHistory";
import { appWarn } from "@/utils/log";
import { isRapidOcrModel } from "@/utils/ocr";

export const InitService = () => {
	// 清除无效的截图历史
	const clearCaptureHistory = useCallback(
		async (appSettings: AppSettingsData) => {
			const captureHistory = new CaptureHistory();
			await captureHistory.init();
			await captureHistory.clearExpired(appSettings);
		},
		[],
	);

	const hasInitOcr = useRef(false);
	const hasClearedCaptureHistory = useRef(false);
	const hasInitAutoStart = useRef(false);
	const hasInitEnableProxy = useRef(false);
	const hasInitRunLog = useRef(false);
	const hasInitHotLoadPage = useRef(false);

	const [appSettings, setAppSettings] = useState<AppSettingsData | undefined>(
		undefined,
	);
	const [prevAppSettings, setPrevAppSettings] = useState<
		AppSettingsData | undefined
	>(undefined);

	const { isReadyStatus, pluginConfigRef } = usePluginServiceContext();

	const initServices = useCallback(async () => {
		if (!appSettings || !isReadyStatus) {
			return;
		}

		const ocrModel = appSettings[AppSettingsGroup.FunctionOcr].ocrModel;
		if (
			isRapidOcrModel(ocrModel) &&
			(!hasInitOcr.current ||
				(prevAppSettings &&
					(ocrModel !==
						prevAppSettings[AppSettingsGroup.FunctionOcr].ocrModel ||
						appSettings[AppSettingsGroup.SystemScreenshot].ocrHotStart !==
							prevAppSettings[AppSettingsGroup.SystemScreenshot].ocrHotStart ||
						appSettings[AppSettingsGroup.SystemScreenshot]
							.ocrModelWriteToMemory !==
							prevAppSettings[AppSettingsGroup.SystemScreenshot]
								.ocrModelWriteToMemory))) &&
			isReadyStatus(PLUGIN_ID_RAPID_OCR)
		) {
			if (pluginConfigRef.current) {
				try {
					await ocrInit(
						await pluginConfigRef.current.getPluginDirPath(PLUGIN_ID_RAPID_OCR),
						ocrModel,
						appSettings[AppSettingsGroup.SystemScreenshot].ocrHotStart,
						appSettings[AppSettingsGroup.SystemScreenshot]
							.ocrModelWriteToMemory,
					);
					hasInitOcr.current = true;
				} catch (error) {
					appWarn("[InitService] init ocr failed", error);
				}
			} else {
				appWarn("[InitService] pluginConfigRef.current is not set");
			}
		}

		if (!hasClearedCaptureHistory.current) {
			hasClearedCaptureHistory.current = true;

			void clearCaptureHistory(appSettings).catch((error) => {
				appWarn("[InitService] clear capture history failed", error);
			});
		}

		if (
			!hasInitEnableProxy.current ||
			(prevAppSettings &&
				appSettings[AppSettingsGroup.SystemNetwork].enableProxy !==
					prevAppSettings[AppSettingsGroup.SystemNetwork].enableProxy)
		) {
			hasInitEnableProxy.current = true;

			void setEnableProxy(
				appSettings[AppSettingsGroup.SystemNetwork].enableProxy,
			).catch((error) => {
				appWarn("[InitService] set proxy state failed", error);
			});
		}

		if (
			process.env.NODE_ENV !== "development" &&
			(!hasInitAutoStart.current ||
				(prevAppSettings &&
					appSettings[AppSettingsGroup.SystemCommon].autoStart !==
						prevAppSettings[AppSettingsGroup.SystemCommon].autoStart))
		) {
			hasInitAutoStart.current = true;

			if (appSettings[AppSettingsGroup.SystemCommon].autoStart) {
				void autoStartEnable().catch((error) => {
					appWarn("[InitService] enable auto start failed", error);
				});
			} else {
				void autoStartDisable().catch((error) => {
					appWarn("[InitService] disable auto start failed", error);
				});
			}
		}

		if (
			!hasInitRunLog.current ||
			(prevAppSettings &&
				appSettings[AppSettingsGroup.SystemCommon].runLog !==
					prevAppSettings[AppSettingsGroup.SystemCommon].runLog)
		) {
			hasInitRunLog.current = true;

			void setRunLog(appSettings[AppSettingsGroup.SystemCommon].runLog).catch(
				(error) => {
					appWarn("[InitService] set run log state failed", error);
				},
			);
		}

		if (
			!hasInitHotLoadPage.current ||
			(prevAppSettings &&
				appSettings[AppSettingsGroup.SystemCore].hotLoadPageCount !==
					prevAppSettings[AppSettingsGroup.SystemCore].hotLoadPageCount)
		) {
			hasInitHotLoadPage.current = true;

			void hotLoadPageInit(
				appSettings[AppSettingsGroup.SystemCore].hotLoadPageCount,
			).catch((error) => {
				appWarn("[InitService] init hot load pages failed", error);
			});
		}
	}, [
		appSettings,
		clearCaptureHistory,
		pluginConfigRef,
		isReadyStatus,
		prevAppSettings,
	]);

	useAppSettingsLoad(
		useCallback((appSettings, prevAppSettings) => {
			setAppSettings(appSettings);
			setPrevAppSettings(prevAppSettings);
		}, []),
		true,
	);

	const inited = useRef(false);

	useEffect(() => {
		if (inited.current) {
			return;
		}
		inited.current = true;

		void initUiElements().catch((error) => {
			appWarn("[InitService] init UI elements failed", error);
		});
	}, []);

	useEffect(() => {
		void initServices().catch((error) => {
			appWarn("[InitService] init services failed", error);
		});
	}, [initServices]);

	const initedVideoRecordDirRef = useRef<string | undefined>(undefined);
	const ffmpegReady = isReadyStatus?.(PLUGIN_ID_FFMPEG) ?? false;
	useEffect(() => {
		if (!ffmpegReady) {
			initedVideoRecordDirRef.current = undefined;
			return;
		}

		const pluginConfig = pluginConfigRef.current;
		if (!pluginConfig) {
			appWarn("[InitService] pluginConfigRef.current is not set");
			return;
		}

		let cancelled = false;
		void pluginConfig
			.getPluginDirPath(PLUGIN_ID_FFMPEG)
			.then(async (ffmpegPluginDir) => {
				if (cancelled || initedVideoRecordDirRef.current === ffmpegPluginDir) {
					return;
				}
				await videoRecordInit(ffmpegPluginDir);
				if (!cancelled) {
					initedVideoRecordDirRef.current = ffmpegPluginDir;
				}
			})
			.catch((error) => {
				appWarn("[InitService] init video record failed", error);
			});

		return () => {
			cancelled = true;
		};
	}, [ffmpegReady, pluginConfigRef]);

	return null;
};
