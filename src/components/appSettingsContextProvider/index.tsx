import { emit } from "@tauri-apps/api/event";
import {
	type Window as AppWindow,
	getCurrentWindow,
} from "@tauri-apps/api/window";
import { App as AntdApp, ConfigProvider, type ThemeConfig, theme } from "antd";
import enUS from "antd/es/locale/en_US";
import zhCN from "antd/es/locale/zh_CN";
import zhTW from "antd/es/locale/zh_TW";
import { debounce, isEqual } from "es-toolkit";
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { IntlProvider } from "react-intl";
import { createDrawWindow } from "@/commands/core";
import { createDir, textFileRead, textFileWrite } from "@/commands/file";
import {
	nativeRuntimeBindDraw,
	nativeRuntimeSettingsReady,
} from "@/commands/nativeAction";
import { defaultAppSettingsData } from "@/constants/appSettings";
import {
	APP_THEME_RADIUS,
	colorWithAlpha,
	createThemeCssVariables,
	getAppThemeRuntime,
} from "@/constants/themePresets";
import { AppContext } from "@/contexts/appContext";
import {
	AppSettingsActionContext,
	AppSettingsLoadingPublisher,
	AppSettingsPublisher,
} from "@/contexts/appSettingsActionContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { releaseDrawPage } from "@/functions/screenshot";
import { withStatePublisher } from "@/hooks/useStatePublisher";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { messages } from "@/messages/map";
import {
	type AppSettingsData,
	AppSettingsGroup,
	AppSettingsLanguage,
	AppSettingsTheme,
} from "@/types/appSettings";
import { getConfigDirPath } from "@/utils/environment";
import { appError, appWarn, formatErrorDetails } from "@/utils/log";
import { normalizeAppSettingsGroup } from "./settingsGroupNormalizers";
import { preserveReadableThemeColors } from "./themeAlgorithm";

const getFilePath = async (group: AppSettingsGroup) => {
	const configDirPath = await getConfigDirPath();
	return `${configDirPath}/${group}.json`;
};

const AppSettingsContextProviderCore: React.FC<{
	children: React.ReactNode;
}> = ({ children }) => {
	const appWindowRef = useRef<AppWindow>(undefined);
	const [currentSystemTheme, setCurrentSystemTheme] =
		useState<AppSettingsTheme>(AppSettingsTheme.Light);
	const themeUnlisten = useRef<() => void>(() => {});
	const InitedAppContext = useRef<boolean>(false);
	const initAppContext = useCallback(async () => {
		if (InitedAppContext.current) {
			return;
		}
		InitedAppContext.current = true;

		appWindowRef.current = getCurrentWindow();
		appWindowRef.current.theme().then((theme) => {
			setCurrentSystemTheme(
				theme === "dark" ? AppSettingsTheme.Dark : AppSettingsTheme.Light,
			);
		});
		themeUnlisten.current = await appWindowRef.current.onThemeChanged(
			({ payload: theme }) => {
				setCurrentSystemTheme(
					theme === "dark" ? AppSettingsTheme.Dark : AppSettingsTheme.Light,
				);
			},
		);
	}, []);
	useEffect(() => {
		initAppContext();

		return () => {
			themeUnlisten.current();
		};
	}, [initAppContext]);

	const [appSettings, _setAppSettings] = useState<AppSettingsData>(
		defaultAppSettingsData,
	);
	const appSettingsRef = useRef<AppSettingsData>(defaultAppSettingsData);
	const [, setAppSettingsStatePublisher] = useStateSubscriber(
		AppSettingsPublisher,
		undefined,
	);
	const [, setAppSettingsLoadingPublisher] = useStateSubscriber(
		AppSettingsLoadingPublisher,
		undefined,
	);
	const setAppSettings = useCallback(
		(
			newSettings: AppSettingsData,
			ignoreState?: boolean,
			ignorePublisher?: boolean,
		) => {
			appSettingsRef.current = newSettings;
			if (!ignorePublisher) {
				setAppSettingsStatePublisher(newSettings);
			}
			if (!ignoreState) {
				_setAppSettings(newSettings);
			}
		},
		[setAppSettingsStatePublisher],
	);
	const writeAppSettingsQueuesRef = useRef(
		new Map<AppSettingsGroup, Promise<void>>(),
	);

	const writeAppSettings = useCallback(
		async (
			group: AppSettingsGroup,
			data: AppSettingsData[typeof group],
			syncAllWindow: boolean,
		) => {
			const previousWrite =
				writeAppSettingsQueuesRef.current.get(group) ?? Promise.resolve();
			const queuedWrite = previousWrite
				.catch(() => undefined)
				.then(async () => {
					let filePath = "";
					try {
						filePath = await getFilePath(group);
						await textFileWrite(filePath, JSON.stringify(data));
					} catch (error) {
						appError(
							`[writeAppSettings] write file ${filePath || group} failed: ${JSON.stringify(error)}`,
						);
					}

					if (syncAllWindow) {
						try {
							await emit("reload-app-settings");
						} catch (error) {
							appError("[writeAppSettings] emit reload failed", error);
						}
					}
				});

			writeAppSettingsQueuesRef.current.set(group, queuedWrite);
			queuedWrite.then(() => {
				if (writeAppSettingsQueuesRef.current.get(group) === queuedWrite) {
					writeAppSettingsQueuesRef.current.delete(group);
				}
			});

			return queuedWrite;
		},
		[],
	);
	const writeAppSettingsDebounce = useMemo(
		() =>
			debounce(
				(
					group: AppSettingsGroup,
					data: AppSettingsData[typeof group],
					syncAllWindow: boolean,
				) => {
					writeAppSettings(group, data, syncAllWindow);
				},
				1000,
			),
		[writeAppSettings],
	);

	const { isReady } = usePluginServiceContext();
	const updateAppSettings = useCallback(
		(
			group: AppSettingsGroup,
			val: Partial<AppSettingsData[typeof group]> | string,
			debounce: boolean,
			/** 是否保存到文件 */
			saveToFile: boolean,
			/** 是否同步到所有窗口 */
			syncAllWindow: boolean,
			/** 是否忽略状态更新 */
			ignoreState?: boolean,
			/** 是否忽略 publisher 更新 */
			ignorePublisher?: boolean,
		): AppSettingsData[typeof group] => {
			let newSettings: Partial<AppSettingsData[typeof group]>;
			if (typeof val === "string") {
				try {
					const parsedObj = JSON.parse(val);
					newSettings =
						typeof parsedObj === "object"
							? parsedObj
							: defaultAppSettingsData[group];
				} catch {
					newSettings = defaultAppSettingsData[group];
				}
			} else {
				newSettings = val;
			}

			const settings = normalizeAppSettingsGroup(
				group,
				newSettings,
				appSettingsRef.current,
				isReady,
			);

			setAppSettings(
				{
					...appSettingsRef.current,
					[group]: settings,
				},
				ignoreState,
				ignorePublisher,
			);

			if (saveToFile) {
				if (debounce) {
					writeAppSettingsDebounce(group, settings, syncAllWindow);
				} else {
					writeAppSettings(group, settings, syncAllWindow);
				}
			}

			return settings;
		},
		[setAppSettings, isReady, writeAppSettingsDebounce, writeAppSettings],
	);

	const reloadAppSettings = useCallback(async () => {
		setAppSettingsLoadingPublisher(true);

		const groups = Object.keys(defaultAppSettingsData) as AppSettingsGroup[];

		const settings: AppSettingsData = {} as AppSettingsData;

		// 启动时验证下目录是否存在
		let configDirPath = "";
		try {
			configDirPath = await getConfigDirPath();
			await createDir(configDirPath);
		} catch (error) {
			appError(
				`[reloadAppSettings] create dir ${configDirPath || "unknown"} failed`,
				error,
			);
			setAppSettingsLoadingPublisher(false);
			return false;
		}

		const loadAppSettingsGroup = async (group: AppSettingsGroup) => {
			let fileContent = "";
			try {
				// 创建文件夹成功的话，文件不存在，则不读取
				fileContent = await textFileRead(await getFilePath(group));
			} catch (error) {
				appWarn(
					`[reloadAppSettings] read file ${await getFilePath(group)} failed: ${JSON.stringify(error)}`,
				);
			}

			const saveToFile = appWindowRef.current?.label === "main";
			settings[group] = updateAppSettings(
				group,
				fileContent || defaultAppSettingsData[group],
				false,
				saveToFile,
				false,
				true,
				true,
				// biome-ignore lint/suspicious/noExplicitAny: any is used to avoid type errors
			) as any;
		};

		const cacheGroup = AppSettingsGroup.Cache;
		const translationCacheGroup = AppSettingsGroup.FunctionTranslationCache;
		const deferredGroups = [cacheGroup, translationCacheGroup];
		await Promise.all(
			groups
				.filter((group) => !deferredGroups.includes(group))
				.map(loadAppSettingsGroup),
		);
		await loadAppSettingsGroup(cacheGroup);
		await loadAppSettingsGroup(translationCacheGroup);

		if (isEqual(appSettingsRef.current, settings)) {
			setAppSettings(settings);
		}

		setAppSettingsLoadingPublisher(false);
		return true;
	}, [setAppSettingsLoadingPublisher, updateAppSettings, setAppSettings]);

	const initedAppSettings = useRef(false);
	const appSettingsBootstrapActiveRef = useRef(false);
	useEffect(() => {
		appSettingsBootstrapActiveRef.current = true;
		if (!initedAppSettings.current) {
			initedAppSettings.current = true;

			void (async () => {
				const settingsLoaded = await reloadAppSettings();
				if (
					!appSettingsBootstrapActiveRef.current ||
					!settingsLoaded ||
					appWindowRef.current?.label !== "main"
				) {
					return;
				}

				await nativeRuntimeSettingsReady();
				if (!appSettingsBootstrapActiveRef.current) {
					return;
				}
				await releaseDrawPage(true);
				if (!appSettingsBootstrapActiveRef.current) {
					return;
				}
				const drawWindowLabel = await createDrawWindow();
				if (appSettingsBootstrapActiveRef.current) {
					await nativeRuntimeBindDraw(drawWindowLabel);
				}
			})().catch((error) => {
				appError(
					"[AppSettingsContextProvider] runtime bootstrap failed",
					error,
				);
			});
		}

		return () => {
			appSettingsBootstrapActiveRef.current = false;
		};
	}, [reloadAppSettings]);

	const currentLanguage = appSettings[AppSettingsGroup.Common].language;
	const antdLocale = useMemo(() => {
		switch (currentLanguage) {
			case AppSettingsLanguage.ZHHans:
				return zhCN;
			case AppSettingsLanguage.ZHHant:
				return zhTW;
			default:
				return enUS;
		}
	}, [currentLanguage]);

	const appSettingsContextValue = useMemo(() => {
		return {
			...appSettings,
			updateAppSettings,
			reloadAppSettings,
		};
	}, [appSettings, updateAppSettings, reloadAppSettings]);

	const appSettingsTheme = appSettings[AppSettingsGroup.Common].theme;
	const appContextValue = useMemo(() => {
		return {
			appWindowRef,
			currentTheme:
				appSettingsTheme === AppSettingsTheme.System
					? currentSystemTheme
					: appSettingsTheme,
		};
	}, [appSettingsTheme, currentSystemTheme]);
	const currentThemeRuntime = useMemo(
		() =>
			getAppThemeRuntime(
				defaultAppSettingsData[AppSettingsGroup.Common].themePreset,
				appContextValue.currentTheme,
			),
		[appContextValue.currentTheme],
	);
	const currentPrimaryColor = currentThemeRuntime.recommendedAccent;

	useEffect(() => {
		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			try {
				const reason = event.reason;
				const { message: errorMessage, details: errorDetails } =
					formatErrorDetails(reason);

				// 添加基础的上下文信息
				const fullDetails: Record<string, unknown> = {
					reason: reason,
					timestamp: new Date().toISOString(),
					userAgent: navigator.userAgent,
					url: location.href,
					...errorDetails, // 合并错误对象的详细信息
				};

				appError(`Unhandled Promise Rejection: ${errorMessage}`, fullDetails);
			} catch {
				appError(`Failed to handle unhandled promise rejection`);
			}
		};

		const handleGlobalError = (event: ErrorEvent) => {
			try {
				const error = event.error;
				const { message: errorMessage, details: errorDetails } =
					formatErrorDetails(error);

				// 合并 ErrorEvent 的信息和错误对象的详细信息
				const fullDetails: Record<string, unknown> = {
					message: event.message,
					filename: event.filename,
					lineno: event.lineno,
					colno: event.colno,
					timestamp: new Date().toISOString(),
					userAgent: navigator.userAgent,
					url: location.href,
					...errorDetails, // 合并错误对象的详细信息
				};

				appError(`Global Error: ${errorMessage}`, fullDetails);
			} catch {
				appError(`Failed to handle global error`);
			}
		};

		window.addEventListener("unhandledrejection", handleUnhandledRejection);
		window.addEventListener("error", handleGlobalError);

		return () => {
			window.removeEventListener(
				"unhandledrejection",
				handleUnhandledRejection,
			);
			window.removeEventListener("error", handleGlobalError);
		};
	}, []);

	const antdTheme = useMemo((): ThemeConfig => {
		return {
			algorithm: [
				appContextValue.currentTheme === AppSettingsTheme.Dark
					? theme.darkAlgorithm
					: theme.defaultAlgorithm,
				preserveReadableThemeColors,
			],
			token: {
				...currentThemeRuntime.antTokens,
				colorTextSecondary: currentThemeRuntime.palette.body,
				colorTextTertiary: currentThemeRuntime.palette.muted,
				colorTextQuaternary: currentThemeRuntime.palette.ash,
				colorTextPlaceholder: currentThemeRuntime.palette.muted,
				colorTextDisabled: currentThemeRuntime.palette.ash,
				colorIcon: currentThemeRuntime.palette.muted,
				colorPrimary: currentPrimaryColor,
				colorPrimaryBg: colorWithAlpha(currentPrimaryColor, 0.12),
				colorPrimaryBgHover: colorWithAlpha(currentPrimaryColor, 0.2),
				colorPrimaryBorder: colorWithAlpha(currentPrimaryColor, 0.42),
				colorLink: currentPrimaryColor,
				borderRadius: APP_THEME_RADIUS,
				borderRadiusSM: APP_THEME_RADIUS - 2,
				borderRadiusLG: APP_THEME_RADIUS + 2,
				controlHeight: 32,
				fontFamily: "var(--snow-shot-font-ui)",
				fontSize: 14,
				fontSizeSM: 13,
				fontSizeLG: 16,
				lineHeight: 1.5,
				motionDurationFast: "0.12s",
				motionDurationMid: "0.18s",
				wireframe: false,
			},
			components: {
				App: {
					fontSize: 14,
					lineHeight: 1.5,
				},
				Badge: {
					textFontSize: 12,
					textFontSizeSM: 12,
				},
				Button: {
					primaryColor: currentThemeRuntime.palette.canvas,
					dangerColor: currentThemeRuntime.palette.canvas,
					contentFontSize: 14,
					contentLineHeight: 1.5,
					paddingInline: 14,
					primaryShadow: "none",
					defaultShadow: "none",
					dangerShadow: "none",
				},
				Menu: {
					itemColor: currentThemeRuntime.palette.body,
					itemHoverColor: currentThemeRuntime.palette.ink,
					itemSelectedColor: currentThemeRuntime.palette.ink,
					subMenuItemSelectedColor: currentThemeRuntime.palette.ink,
					itemSelectedBg: colorWithAlpha(currentPrimaryColor, 0.13),
					popupBg: currentThemeRuntime.palette.surfaceElevated,
				},
				Switch: {
					handleBg: "#FFFFFF",
				},
				Input: {
					activeShadow: `0 0 0 3px ${colorWithAlpha(currentPrimaryColor, 0.14)}`,
				},
				Select: {
					activeOutlineColor: colorWithAlpha(currentPrimaryColor, 0.14),
				},
				Modal: {
					contentBg: currentThemeRuntime.palette.surface,
					headerBg: currentThemeRuntime.palette.surface,
				},
				Tabs: {
					itemActiveColor: currentThemeRuntime.palette.ink,
					itemHoverColor: currentThemeRuntime.palette.ink,
					itemSelectedColor: currentThemeRuntime.palette.ink,
				},
			},
		};
	}, [appContextValue.currentTheme, currentPrimaryColor, currentThemeRuntime]);

	useEffect(() => {
		const isDarkMode = appContextValue.currentTheme === AppSettingsTheme.Dark;
		const root = document.documentElement;
		const cssVariables = createThemeCssVariables(
			currentThemeRuntime,
			currentPrimaryColor,
			APP_THEME_RADIUS,
			false,
		);

		root.dataset.snowTheme = appSettings[AppSettingsGroup.Common].themePreset;
		root.dataset.snowThemeMode = isDarkMode ? "dark" : "light";
		root.style.colorScheme = isDarkMode ? "dark" : "light";
		for (const [name, value] of Object.entries(cssVariables)) {
			root.style.setProperty(name, value);
		}

		document.body.classList.toggle("app-dark", isDarkMode);
		document.body.classList.toggle("app-light", !isDarkMode);
	}, [
		appContextValue.currentTheme,
		appSettings[AppSettingsGroup.Common].themePreset,
		currentPrimaryColor,
		currentThemeRuntime,
	]);

	return (
		<AppSettingsActionContext.Provider value={appSettingsContextValue}>
			<ConfigProvider theme={antdTheme} locale={antdLocale}>
				<AntdApp>
					<IntlProvider
						locale={currentLanguage}
						messages={messages[currentLanguage]}
						defaultLocale={AppSettingsLanguage.ZHHans}
					>
						<AppContext.Provider value={appContextValue}>
							{children}
						</AppContext.Provider>
					</IntlProvider>
				</AntdApp>
			</ConfigProvider>
		</AppSettingsActionContext.Provider>
	);
};

export const AppSettingsContextProvider = React.memo(
	withStatePublisher(
		withStatePublisher(AppSettingsContextProviderCore, AppSettingsPublisher),
		AppSettingsLoadingPublisher,
	),
);
