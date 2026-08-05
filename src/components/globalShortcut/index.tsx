import {
	AppstoreOutlined,
	FieldTimeOutlined,
	FolderOutlined,
	HistoryOutlined,
} from "@ant-design/icons";
import { useDeepCompareEffect } from "@ant-design/pro-components";
import { Tooltip } from "antd";
import React, {
	createContext,
	useCallback,
	useMemo,
	useRef,
	useState,
} from "react";
import { FormattedMessage } from "react-intl";
import {
	createFixedContentWindow,
	createFullScreenDrawWindow,
} from "@/commands/core";
import { getCaptureState } from "@/commands/globalSate";
import {
	nativeShortcutRegisterAction,
	nativeShortcutResetActions,
	nativeShortcutSetFullScreenPolicy,
	nativeShortcutSetInputActive,
} from "@/commands/nativeAction";
import { IconLabel } from "@/components/iconLable";
import {
	ChatIcon,
	ClipboardIcon,
	FixedIcon,
	FocusedWindowIcon,
	FullScreenDrawIcon,
	FullScreenIcon,
	OcrDetectIcon,
	OcrTranslateIcon,
	ScreenshotIcon,
	SelectTextIcon,
	TopWindowIcon,
	TranslationIcon,
	VideoRecordIcon,
} from "@/components/icons";
import { defaultAppFunctionConfigs } from "@/constants/appFunction";
import { defaultAppSettingsData } from "@/constants/appSettings";
import {
	PLUGIN_ID_AI_CHAT,
	PLUGIN_ID_FFMPEG,
	PLUGIN_ID_GLM_OCR,
	PLUGIN_ID_RAPID_OCR,
	PLUGIN_ID_TRANSLATE,
} from "@/constants/pluginService";
import { AppSettingsPublisher } from "@/contexts/appSettingsActionContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import {
	executeScreenshot,
	executeScreenshotFocusedWindow,
} from "@/functions/screenshot";
import {
	executeChat,
	executeChatSelectedText,
	executeTranslate,
	executeTranslateSelectedText,
	openCaptureHistory,
	openImageSaveFolder,
	showOrHideMainWindow,
} from "@/functions/tools";
import { startOrCopyVideo } from "@/functions/videoRecord";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import {
	type AppSettingsData,
	AppSettingsGroup,
	ShortcutKeyStatus,
} from "@/types/appSettings";
import {
	AppFunction,
	type AppFunctionComponentConfig,
	type AppFunctionConfig,
	type AppFunctionGroup,
} from "@/types/components/appFunction";
import { appError } from "@/utils/log";
import { canUseOcr } from "@/utils/ocr";
import { ScreenshotType } from "@/utils/types";
import { ChangeDelaySeconds } from "./components/changeDelaySeconds";

const getShortcutConflictKey = (shortcut: string) =>
	shortcut
		.split("+")
		.map((part) => part.trim().toLowerCase())
		.sort()
		.join("+");

export type GlobalShortcutContextType = {
	setShortcutInputActive: (active: boolean) => void;
	defaultAppFunctionComponentGroupConfigs: Record<
		AppFunctionGroup,
		AppFunctionComponentConfig[]
	>;
	shortcutKeyStatus: Record<AppFunction, ShortcutKeyStatus> | undefined;
	updateShortcutKeyStatusLoading: boolean;
	appSettingsLoading: boolean;
	appFunctionSettings:
		| AppSettingsData[AppSettingsGroup.AppFunction]
		| undefined;
};

export const GlobalShortcutContext = createContext<GlobalShortcutContextType>({
	setShortcutInputActive: () => {},
	defaultAppFunctionComponentGroupConfigs: {} as Record<
		AppFunctionGroup,
		AppFunctionComponentConfig[]
	>,
	shortcutKeyStatus: {} as Record<AppFunction, ShortcutKeyStatus>,
	updateShortcutKeyStatusLoading: true,
	appSettingsLoading: true,
	appFunctionSettings: {} as AppSettingsData[AppSettingsGroup.AppFunction],
});

const GlobalShortcutCore = ({ children }: { children: React.ReactNode }) => {
	const disableShortcutKeyRef = useRef(false);
	const setShortcutInputActive = useCallback((active: boolean) => {
		disableShortcutKeyRef.current = active;
		void nativeShortcutSetInputActive(active).catch((error) => {
			appError("[GlobalShortcut] sync shortcut input state failed", error);
		});
	}, []);

	const [getAppSettings] = useStateSubscriber(
		AppSettingsPublisher,
		// useCallback((settings: AppSettingsData) => {}, []),
		undefined,
	);
	const [currentAppSettings, setCurrentAppSettings] = useState<AppSettingsData>(
		defaultAppSettingsData,
	);

	const { isReadyStatus } = usePluginServiceContext();
	const {
		configs: defaultAppFunctionComponentConfigs,
		groupConfigs: defaultAppFunctionComponentGroupConfigs,
	}: {
		configs: Record<AppFunction, AppFunctionComponentConfig>;
		groupConfigs: Record<AppFunctionGroup, AppFunctionComponentConfig[]>;
	} = useMemo(() => {
		const configs = Object.keys(defaultAppFunctionConfigs)
			.filter((key) => {
				if (
					key === AppFunction.VideoRecord ||
					key === AppFunction.VideoRecordCopy
				) {
					return isReadyStatus?.(PLUGIN_ID_FFMPEG);
				}

				if (key === AppFunction.ScreenshotOcr) {
					return canUseOcr(
						currentAppSettings,
						isReadyStatus?.(PLUGIN_ID_GLM_OCR),
						isReadyStatus?.(PLUGIN_ID_RAPID_OCR),
					);
				}

				if (key === AppFunction.Chat) {
					return isReadyStatus?.(PLUGIN_ID_AI_CHAT);
				}

				if (key === AppFunction.Translation) {
					return isReadyStatus?.(PLUGIN_ID_TRANSLATE);
				}

				if (key === AppFunction.ScreenshotOcrTranslate) {
					return (
						canUseOcr(
							currentAppSettings,
							isReadyStatus?.(PLUGIN_ID_GLM_OCR),
							isReadyStatus?.(PLUGIN_ID_RAPID_OCR),
						) && isReadyStatus?.(PLUGIN_ID_TRANSLATE)
					);
				}

				return true;
			})
			.reduce(
				(configs, key) => {
					let buttonTitle: React.ReactNode;
					let buttonIcon: React.ReactNode;
					let buttonOnClick: () => void | Promise<void>;
					switch (key) {
						case AppFunction.ScreenshotFixed:
							buttonTitle = <FormattedMessage id="draw.fixedTool" />;
							buttonIcon = <FixedIcon style={{ fontSize: "1.3em" }} />;
							buttonOnClick = () => executeScreenshot(ScreenshotType.Fixed);
							break;
						case AppFunction.ScreenshotDelay:
							buttonTitle = (
								<Tooltip
									title={
										<FormattedMessage id="home.screenshotFunction.screenshotDelay.tip" />
									}
									key="screenshot-delay"
								>
									<div>
										<FormattedMessage
											id="home.screenshotFunction.screenshotDelay"
											values={{
												seconds: (
													<ChangeDelaySeconds key="screenshot-delay-seconds" />
												),
											}}
										/>
									</div>
								</Tooltip>
							);
							buttonIcon = <FieldTimeOutlined />;
							buttonOnClick = () => executeScreenshot(ScreenshotType.Delay);
							break;
						case AppFunction.ScreenshotOcr:
							buttonTitle = <FormattedMessage id="draw.ocrDetectTool" />;
							buttonIcon = <OcrDetectIcon />;
							buttonOnClick = () => executeScreenshot(ScreenshotType.OcrDetect);
							break;
						case AppFunction.ScreenshotOcrTranslate:
							buttonTitle = <FormattedMessage id="draw.ocrTranslateTool" />;
							buttonIcon = <OcrTranslateIcon style={{ fontSize: "1.2em" }} />;
							buttonOnClick = () =>
								executeScreenshot(ScreenshotType.OcrTranslate);
							break;
						case AppFunction.ScreenshotFullScreen:
							buttonTitle = (
								<FormattedMessage id="home.screenshotFunction.screenshotFullScreen" />
							);
							buttonIcon = <FullScreenIcon />;
							buttonOnClick = () =>
								executeScreenshot(ScreenshotType.CaptureFullScreen);
							break;
						case AppFunction.ScreenshotFocusedWindow:
							buttonTitle = (
								<IconLabel
									label={
										<FormattedMessage id="home.screenshotFunction.screenshotFocusedWindow" />
									}
								/>
							);
							buttonIcon = <FocusedWindowIcon />;
							buttonOnClick = async () => {
								executeScreenshotFocusedWindow(getAppSettings());
							};
							break;
						case AppFunction.ScreenshotCopy:
							buttonTitle = (
								<FormattedMessage id="home.screenshotFunction.screenshotCopy" />
							);
							buttonIcon = <ClipboardIcon style={{ fontSize: "1.1em" }} />;
							buttonOnClick = () => executeScreenshot(ScreenshotType.Copy);
							break;
						case AppFunction.TranslationSelectText:
							buttonTitle = (
								<FormattedMessage id="home.translationSelectText" />
							);
							buttonIcon = <SelectTextIcon style={{ fontSize: "1em" }} />;
							buttonOnClick = async () => {
								executeTranslateSelectedText();
							};
							break;
						case AppFunction.Translation:
							buttonTitle = <FormattedMessage id="home.translation" />;
							buttonIcon = <TranslationIcon />;
							buttonOnClick = () => {
								executeTranslate();
							};
							break;
						case AppFunction.ChatSelectText:
							buttonTitle = <FormattedMessage id="home.chatSelectText" />;
							buttonIcon = <SelectTextIcon style={{ fontSize: "1em" }} />;
							buttonOnClick = async () => {
								executeChatSelectedText();
							};
							break;
						case AppFunction.Chat:
							buttonTitle = <FormattedMessage id="home.chat" />;
							buttonIcon = <ChatIcon />;
							buttonOnClick = () => {
								executeChat();
							};
							break;
						case AppFunction.TopWindow:
							buttonTitle = <FormattedMessage id="home.topWindow" />;
							buttonIcon = <TopWindowIcon />;
							buttonOnClick = () => executeScreenshot(ScreenshotType.TopWindow);
							break;
						case AppFunction.FixedContent:
							buttonTitle = <FormattedMessage id="home.fixedContent" />;
							buttonIcon = <ClipboardIcon style={{ fontSize: "1.1em" }} />;
							buttonOnClick = async () => {
								if ((await getCaptureState()).capturing) {
									return;
								}

								createFixedContentWindow();
							};
							break;
						case AppFunction.FullScreenDraw:
							buttonTitle = <FormattedMessage id="home.fullScreenDraw" />;
							buttonIcon = <FullScreenDrawIcon style={{ fontSize: "1.2em" }} />;
							buttonOnClick = () => createFullScreenDrawWindow();
							break;
						case AppFunction.ShowOrHideMainWindow:
							buttonTitle = <FormattedMessage id="home.showOrHideMainWindow" />;
							buttonIcon = <AppstoreOutlined />;
							buttonOnClick = () => showOrHideMainWindow();
							break;
						case AppFunction.OpenImageSaveFolder:
							buttonTitle = <FormattedMessage id="home.openImageSaveFolder" />;
							buttonIcon = <FolderOutlined />;
							buttonOnClick = () => openImageSaveFolder();
							break;
						case AppFunction.OpenCaptureHistory:
							buttonTitle = <FormattedMessage id="home.openCaptureHistory" />;
							buttonIcon = <HistoryOutlined />;
							buttonOnClick = () => openCaptureHistory();
							break;
						case AppFunction.VideoRecord:
							buttonTitle = (
								<FormattedMessage id="home.videoRecordFunction.videoRecord" />
							);
							buttonIcon = <VideoRecordIcon style={{ fontSize: "1.1em" }} />;
							buttonOnClick = () =>
								executeScreenshot(ScreenshotType.VideoRecord);
							break;
						case AppFunction.VideoRecordCopy:
							buttonTitle = (
								<FormattedMessage id="home.videoRecordFunction.copyVideo" />
							);
							buttonIcon = <ClipboardIcon style={{ fontSize: "1.1em" }} />;
							buttonOnClick = () => {
								startOrCopyVideo();
							};
							break;
						case AppFunction.Screenshot:
							buttonTitle = <FormattedMessage id="home.screenshot" />;
							buttonIcon = <ScreenshotIcon />;
							buttonOnClick = () => executeScreenshot();
							break;
					}

					const onClick = async () => {
						if (disableShortcutKeyRef.current) {
							return;
						}

						await buttonOnClick();
					};
					configs[key as AppFunction] = {
						...defaultAppFunctionConfigs[key as AppFunction],
						configKey: key as AppFunction,
						title: buttonTitle,
						icon: buttonIcon,
						onClick,
						onKeyChange: async (value: string) => {
							if (!value) {
								return false;
							}

							// Rust registers directly through GlobalShortcutExt without creating a
							// WebView Channel. The returned false also catches parsed shortcut aliases.
							return await nativeShortcutRegisterAction(
								value,
								key as AppFunction,
							);
						},
					};

					return configs;
				},
				{} as Record<AppFunction, AppFunctionComponentConfig>,
			);

		const groupConfigs = Object.values(configs).reduce(
			(groupConfigs, config) => {
				if (!groupConfigs[config.group]) {
					groupConfigs[config.group] = [];
				}

				groupConfigs[config.group].push(config);
				return groupConfigs;
			},
			{} as Record<AppFunctionGroup, AppFunctionComponentConfig[]>,
		);

		return { configs, groupConfigs };
	}, [currentAppSettings, getAppSettings, isReadyStatus]);

	const [shortcutKeyStatus, setShortcutKeyStatus] =
		useState<Record<AppFunction, ShortcutKeyStatus>>();

	const [updateShortcutKeyStatusLoading, setUpdateShortcutKeyStatusLoading] =
		useState(true);

	const appFunctionComponentConfigsKeys = useMemo(
		() => Object.keys(defaultAppFunctionComponentConfigs),
		[defaultAppFunctionComponentConfigs],
	);

	const updateShortcutKeyStatus = useCallback(
		async (settings: Record<AppFunction, AppFunctionConfig>) => {
			setUpdateShortcutKeyStatusLoading(true);
			const keyStatus: Record<AppFunction, ShortcutKeyStatus> = {} as Record<
				AppFunction,
				ShortcutKeyStatus
			>;

			try {
				// Reconcile the complete desired state in a stable order. Registration is
				// native-only, so a stale WebView Channel cannot delay the Rust handler.
				await nativeShortcutResetActions();

				const shortcutOwners = new Map<string, AppFunction[]>();
				for (const key of appFunctionComponentConfigsKeys) {
					const appFunction = key as AppFunction;
					const shortcut = settings[appFunction].shortcutKey;
					if (!shortcut) {
						continue;
					}

					const conflictKey = getShortcutConflictKey(shortcut);
					const owners = shortcutOwners.get(conflictKey) ?? [];
					owners.push(appFunction);
					shortcutOwners.set(conflictKey, owners);
				}
				const duplicateShortcuts = new Set(
					Array.from(shortcutOwners.entries())
						.filter(([, owners]) => owners.length > 1)
						.map(([shortcut]) => shortcut),
				);

				for (const key of appFunctionComponentConfigsKeys) {
					const appFunction = key as AppFunction;
					const config = defaultAppFunctionComponentConfigs[appFunction];
					const currentShortcutKey = settings[appFunction].shortcutKey;

					if (!currentShortcutKey) {
						keyStatus[appFunction] = ShortcutKeyStatus.None;
						continue;
					}
					if (
						duplicateShortcuts.has(getShortcutConflictKey(currentShortcutKey))
					) {
						keyStatus[appFunction] = ShortcutKeyStatus.Unregistered;
						continue;
					}

					try {
						const isSuccess = await config.onKeyChange(currentShortcutKey, "");
						keyStatus[appFunction] = isSuccess
							? currentShortcutKey === "PrintScreen"
								? ShortcutKeyStatus.PrintScreen
								: ShortcutKeyStatus.Registered
							: ShortcutKeyStatus.Unregistered;
					} catch (error) {
						appError(`[GlobalShortcut] register ${appFunction} failed`, error);
						keyStatus[appFunction] = ShortcutKeyStatus.Error;
					}
				}
			} catch (error) {
				appError("[GlobalShortcut] reset shortcut state failed", error);
				for (const key of appFunctionComponentConfigsKeys) {
					const appFunction = key as AppFunction;
					keyStatus[appFunction] = settings[appFunction].shortcutKey
						? ShortcutKeyStatus.Error
						: ShortcutKeyStatus.None;
				}
			} finally {
				setShortcutKeyStatus(keyStatus);
				setUpdateShortcutKeyStatusLoading(false);
			}
		},
		[appFunctionComponentConfigsKeys, defaultAppFunctionComponentConfigs],
	);

	const [appFunctionSettings, setAppFunctionSettings] =
		useState<AppSettingsData[AppSettingsGroup.AppFunction]>();

	const shortcutSettingsLoadQueueRef = useRef<Promise<void>>(Promise.resolve());
	useAppSettingsLoad(
		useCallback((settings: AppSettingsData) => {
			setCurrentAppSettings(settings);
			shortcutSettingsLoadQueueRef.current =
				shortcutSettingsLoadQueueRef.current
					.then(async () => {
						try {
							await nativeShortcutSetFullScreenPolicy(
								settings[AppSettingsGroup.FunctionGlobalShortcut]
									.disableOnFocusedFullScreenWindow,
							);
						} catch (error) {
							appError(
								"[GlobalShortcut] sync full-screen policy failed",
								error,
							);
						}

						setAppFunctionSettings(settings[AppSettingsGroup.AppFunction]);
					})
					.catch((error) => {
						appError("[GlobalShortcut] load shortcut settings failed", error);
					});
		}, []),
		true,
	);

	const updateShortcutKeyStatusQueueRef = useRef<Promise<void>>(
		Promise.resolve(),
	);
	useDeepCompareEffect(() => {
		if (!appFunctionSettings || !isReadyStatus) {
			return;
		}

		const settings = appFunctionSettings;
		updateShortcutKeyStatusQueueRef.current =
			updateShortcutKeyStatusQueueRef.current
				.then(() => updateShortcutKeyStatus(settings))
				.catch((error) => {
					appError("[GlobalShortcut] update shortcut state failed", error);
				});
	}, [appFunctionSettings, isReadyStatus, updateShortcutKeyStatus]);

	const contextValue = useMemo((): GlobalShortcutContextType => {
		return {
			setShortcutInputActive,
			defaultAppFunctionComponentGroupConfigs,
			shortcutKeyStatus,
			updateShortcutKeyStatusLoading,
			appSettingsLoading: appFunctionSettings === undefined,
			appFunctionSettings,
		};
	}, [
		setShortcutInputActive,
		defaultAppFunctionComponentGroupConfigs,
		shortcutKeyStatus,
		updateShortcutKeyStatusLoading,
		appFunctionSettings,
	]);

	return (
		<GlobalShortcutContext.Provider value={contextValue}>
			{children}
		</GlobalShortcutContext.Provider>
	);
};

export const GlobalShortcut = React.memo(GlobalShortcutCore);
