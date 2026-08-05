import { defaultWindowIcon } from "@tauri-apps/api/app";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Image } from "@tauri-apps/api/image";
import { Menu, type MenuItem } from "@tauri-apps/api/menu";
import { join, resourceDir } from "@tauri-apps/api/path";
import { TrayIcon } from "@tauri-apps/api/tray";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isEqual } from "es-toolkit";
import React, { useCallback, useContext, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import {
	nativeShortcutSetDisabled,
	nativeTraySetClickAction,
	nativeTraySetEnabled,
} from "@/commands/nativeAction";
import { defaultAppSettingsData } from "@/constants/appSettings";
import {
	PLUGIN_ID_AI_CHAT,
	PLUGIN_ID_FFMPEG,
	PLUGIN_ID_GLM_OCR,
	PLUGIN_ID_RAPID_OCR,
	PLUGIN_ID_TRANSLATE,
} from "@/constants/pluginService";
import { AntdContext } from "@/contexts/antdContext";
import { AppContext } from "@/contexts/appContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { createPublisher } from "@/hooks/useStatePublisher";
import { useStateRef } from "@/hooks/useStateRef";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import {
	type AppSettingsData,
	AppSettingsGroup,
	AppSettingsTheme,
	TrayIconDefaultIcon,
} from "@/types/appSettings";
import {
	AppFunction,
	type AppFunctionConfig,
} from "@/types/components/appFunction";
import { formatKey } from "@/utils/format";
import { appError } from "@/utils/log";
import { canUseOcr } from "@/utils/ocr";
import { getPlatformValue } from "@/utils/platform";

export const TrayIconStatePublisher = createPublisher<{
	disableShortcut: boolean;
}>({
	disableShortcut: false,
});

type TrayResources = {
	trayIconMenu: Menu | undefined;
};

let trayMutationTail: Promise<void> = Promise.resolve();

const runTrayMutation = <T,>(mutation: () => Promise<T>) => {
	const result = trayMutationTail.then(mutation, mutation);
	trayMutationTail = result.then(
		() => undefined,
		() => undefined,
	);
	return result;
};

const closeImageResource = async (image: Image | null | undefined) => {
	try {
		await image?.close();
	} catch (error) {
		appError("[TrayIconLoader] close tray image resource failed", error);
	}
};

const closeMenuResource = async (menu: Menu | undefined) => {
	try {
		await menu?.close();
	} catch (error) {
		appError("[TrayIconLoader] close tray menu resource failed", error);
	}
};

const updateTrayIcon = async (id: string, icon: Image | null, menu: Menu) => {
	const trayIcon = await TrayIcon.getById(id);
	if (!trayIcon) {
		throw new Error(`native tray icon ${id} is unavailable`);
	}

	if (icon) {
		await trayIcon.setIcon(icon);
	}
	await trayIcon.setMenu(menu);
	await trayIcon.setTooltip("Snow Shot");
	await trayIcon.setShowMenuOnLeftClick(false);
	await trayIcon.setVisible(true);
	// Tauri getById exposes the manager-owned RID. Calling close() here would
	// remove the Rust fallback tray itself; the lookup does not allocate a clone.
};

const closeTrayResources = async ({ trayIconMenu }: TrayResources) => {
	await closeMenuResource(trayIconMenu);
};

export const getDefaultIconPath = async (
	defaultIcon: TrayIconDefaultIcon,
	resourceDirPath?: string,
): Promise<{
	web_path: string;
	native_path: string;
}> => {
	const basePath = resourceDirPath ?? (await resourceDir());

	const nativePath = await join(
		basePath,
		"app-icons",
		`snow-shot-tray-${defaultIcon}.png`,
	);
	const defaultIconPath = convertFileSrc(nativePath);

	return {
		web_path: defaultIconPath,
		native_path: nativePath,
	};
};

const TrayIconLoaderComponent = () => {
	const intl = useIntl();
	const { message } = useContext(AntdContext);
	const [disableShortcut, _setDisableShortcut] = useState(false);
	const [, setTrayIconState] = useStateSubscriber(
		TrayIconStatePublisher,
		useCallback((state: { disableShortcut: boolean }) => {
			_setDisableShortcut(state.disableShortcut);
		}, []),
	);

	const { currentTheme } = useContext(AppContext);

	const [delayScreenshotSeconds, setDelayScreenshotSeconds] = useState(0);
	const [shortcutKeys, setShortcutKeys, shortcutKeysRef] = useStateRef<
		Record<AppFunction, AppFunctionConfig> | undefined
	>(undefined);
	const [iconPath, setIconPath] = useState("");
	const [iconPathDark, setIconPathDark] = useState("");
	const [defaultIcon, setDefaultIcon] = useState<TrayIconDefaultIcon>(
		TrayIconDefaultIcon.Default,
	);
	const [defaultIconDark, setDefaultIconDark] = useState<TrayIconDefaultIcon>(
		TrayIconDefaultIcon.Default,
	);
	const [enableTrayIcon, setEnableTrayIcon] = useState(false);
	const [currentAppSettings, setCurrentAppSettings] = useState<AppSettingsData>(
		defaultAppSettingsData,
	);
	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData, previous: AppSettingsData | undefined) => {
				setCurrentAppSettings(settings);
				if (
					shortcutKeysRef.current === undefined ||
					!isEqual(
						settings[AppSettingsGroup.AppFunction],
						previous?.[AppSettingsGroup.AppFunction],
					)
				) {
					setShortcutKeys(settings[AppSettingsGroup.AppFunction]);
				}

				setIconPath(settings[AppSettingsGroup.CommonTrayIcon].iconPath);
				setIconPathDark(settings[AppSettingsGroup.CommonTrayIcon].iconPathDark);
				setDefaultIcon(settings[AppSettingsGroup.CommonTrayIcon].defaultIcons);
				setDefaultIconDark(
					settings[AppSettingsGroup.CommonTrayIcon].defaultIconsDark,
				);
				setEnableTrayIcon(
					settings[AppSettingsGroup.CommonTrayIcon].enableTrayIcon,
				);
				setDelayScreenshotSeconds(
					settings[AppSettingsGroup.Cache].delayScreenshotSeconds,
				);
			},
			[setShortcutKeys, shortcutKeysRef],
		),
		true,
	);

	useEffect(() => {
		void nativeShortcutSetDisabled(disableShortcut).catch((error) => {
			appError("[TrayIconLoader] sync shortcut disabled state failed", error);
		});
	}, [disableShortcut]);

	useEffect(() => {
		void nativeTraySetClickAction(
			currentAppSettings[AppSettingsGroup.FunctionTrayIcon].iconClickAction,
		).catch((error) => {
			appError("[TrayIconLoader] sync tray click action failed", error);
		});
	}, [currentAppSettings]);

	const { isReadyStatus } = usePluginServiceContext();
	const initTrayIcon = useCallback(async (): Promise<
		TrayResources | undefined
	> => {
		if (!isReadyStatus) {
			return;
		}

		if (!shortcutKeys) {
			return;
		}

		await nativeTraySetEnabled(enableTrayIcon);
		if (!enableTrayIcon) {
			return;
		}

		const appWindow = getCurrentWindow();

		let iconImage: Image | undefined;
		try {
			let targetIconPath = iconPath;
			if (currentTheme === AppSettingsTheme.Dark && iconPathDark) {
				targetIconPath = iconPathDark;
			}

			if (targetIconPath) {
				iconImage = await Image.fromPath(targetIconPath);
			}
		} catch {
			message.error(intl.formatMessage({ id: "home.trayIcon.error4" }));
			return;
		}

		if (iconImage) {
			const size = await iconImage.size().catch(async (error) => {
				await closeImageResource(iconImage);
				throw error;
			});
			if (size.width > 128 || size.height > 128) {
				message.error(intl.formatMessage({ id: "home.trayIcon.error3" }));
				await closeImageResource(iconImage);
				return;
			}
		}

		const menu = await Menu.new({
			id: `${appWindow.label}-trayIconMenu`,
			items: [
				{
					id: `${appWindow.label}-screenshot`,
					text: intl.formatMessage({ id: "home.screenshot" }),
					accelerator: disableShortcut
						? undefined
						: formatKey(shortcutKeys[AppFunction.Screenshot].shortcutKey),
				},
				{
					id: `${appWindow.label}-screenshot-delay`,
					text: intl.formatMessage(
						{
							id: "home.screenshotFunction.screenshotDelay",
						},
						{
							seconds: intl.formatMessage(
								{
									id: "home.screenshotFunction.screenshotDelay.seconds",
								},
								{
									seconds: delayScreenshotSeconds,
								},
							),
						},
					),
					accelerator: disableShortcut
						? undefined
						: formatKey(shortcutKeys[AppFunction.ScreenshotDelay].shortcutKey),
				},
				{
					id: `${appWindow.label}-screenshot-fixedTool`,
					text: intl.formatMessage({ id: "draw.fixedTool" }),
					accelerator: disableShortcut
						? undefined
						: formatKey(shortcutKeys[AppFunction.ScreenshotFixed].shortcutKey),
				},
				...(canUseOcr(
					currentAppSettings,
					isReadyStatus(PLUGIN_ID_GLM_OCR),
					isReadyStatus(PLUGIN_ID_RAPID_OCR),
				)
					? [
							{
								id: `${appWindow.label}-screenshot-ocr`,
								text: intl.formatMessage({ id: "draw.ocrDetectTool" }),
								accelerator: disableShortcut
									? undefined
									: formatKey(
											shortcutKeys[AppFunction.ScreenshotOcr].shortcutKey,
										),
							},
							{
								id: `${appWindow.label}-screenshot-ocr-translate`,
								text: intl.formatMessage({ id: "draw.ocrTranslateTool" }),
								accelerator: disableShortcut
									? undefined
									: formatKey(
											shortcutKeys[AppFunction.ScreenshotOcrTranslate]
												.shortcutKey,
										),
							},
						]
					: []),
				{
					id: `${appWindow.label}-screenshot-copy`,
					text: intl.formatMessage({
						id: "home.screenshotFunction.screenshotCopy",
					}),
					accelerator: disableShortcut
						? undefined
						: formatKey(shortcutKeys[AppFunction.ScreenshotCopy].shortcutKey),
				},
				...(shortcutKeys[AppFunction.ScreenshotFocusedWindow].shortcutKey
					? [
							{
								id: `${appWindow.label}-screenshot-focused-window`,
								text: intl.formatMessage({
									id: "home.screenshotFunction.screenshotFocusedWindow",
								}),
								accelerator: disableShortcut
									? undefined
									: formatKey(
											shortcutKeys[AppFunction.ScreenshotFocusedWindow]
												.shortcutKey,
										),
							},
						]
					: []),
				{
					id: `${appWindow.label}-screenshot-fullScreen`,
					text: intl.formatMessage({
						id: "home.screenshotFunction.screenshotFullScreen",
					}),
					accelerator: disableShortcut
						? undefined
						: formatKey(
								shortcutKeys[AppFunction.ScreenshotFullScreen].shortcutKey,
							),
				},
				...(isReadyStatus(PLUGIN_ID_AI_CHAT)
					? [
							{
								item: "Separator",
							} as unknown as MenuItem,
							{
								id: `${appWindow.label}-chat`,
								text: intl.formatMessage({ id: "home.chat" }),
								accelerator: disableShortcut
									? undefined
									: formatKey(shortcutKeys[AppFunction.Chat].shortcutKey),
							},
							...(shortcutKeys[AppFunction.ChatSelectText].shortcutKey
								? [
										{
											id: `${appWindow.label}-chat-selectText`,
											text: intl.formatMessage({ id: "home.chatSelectText" }),
											accelerator: disableShortcut
												? undefined
												: formatKey(
														shortcutKeys[AppFunction.ChatSelectText]
															.shortcutKey,
													),
										},
									]
								: []),
						]
					: []),
				...(isReadyStatus(PLUGIN_ID_TRANSLATE)
					? [
							{
								item: "Separator",
							} as unknown as MenuItem,
							{
								id: `${appWindow.label}-translation`,
								text: intl.formatMessage({ id: "home.translation" }),
								accelerator: disableShortcut
									? undefined
									: formatKey(
											shortcutKeys[AppFunction.Translation].shortcutKey,
										),
							},
							...(shortcutKeys[AppFunction.TranslationSelectText].shortcutKey
								? [
										{
											id: `${appWindow.label}-translation-selectText`,
											text: intl.formatMessage({
												id: "home.translationSelectText",
											}),
											accelerator: disableShortcut
												? undefined
												: formatKey(
														shortcutKeys[AppFunction.TranslationSelectText]
															.shortcutKey,
													),
										},
									]
								: []),
						]
					: []),
				...(isReadyStatus(PLUGIN_ID_FFMPEG)
					? [
							{
								item: "Separator",
							} as unknown as MenuItem,
						]
					: []),
				...(isReadyStatus(PLUGIN_ID_FFMPEG)
					? [
							{
								id: `${appWindow.label}-screenshot-videoRecord`,
								text: intl.formatMessage({
									id: "draw.extraTool.videoRecord",
								}),
								accelerator: disableShortcut
									? undefined
									: formatKey(
											shortcutKeys[AppFunction.VideoRecord].shortcutKey,
										),
							},
							{
								id: `${appWindow.label}-screenshot-videoRecord-copy`,
								text: intl.formatMessage({
									id: "home.videoRecordFunction.copyVideo",
								}),
							},
						]
					: []),
				{
					item: "Separator",
				},
				{
					id: `${appWindow.label}-screenshot-fixedContent`,
					text: intl.formatMessage({ id: "home.fixedContent" }),
					accelerator: disableShortcut
						? undefined
						: formatKey(shortcutKeys[AppFunction.FixedContent].shortcutKey),
				},
				...getPlatformValue(
					[
						{
							id: `${appWindow.label}-screenshot-topWindow`,
							text: intl.formatMessage({ id: "home.topWindow" }),
							accelerator: disableShortcut
								? undefined
								: formatKey(shortcutKeys[AppFunction.TopWindow].shortcutKey),
						},
					],
					[],
				),
				{
					id: `${appWindow.label}-screenshot-fullScreenDraw`,
					text: intl.formatMessage({ id: "home.fullScreenDraw" }),
					accelerator: disableShortcut
						? undefined
						: formatKey(shortcutKeys[AppFunction.FullScreenDraw].shortcutKey),
				},
				{
					id: `${appWindow.label}-open-image-save-folder`,
					text: intl.formatMessage({ id: "home.openImageSaveFolder" }),
				},
				{
					id: `${appWindow.label}-open-capture-history`,
					text: intl.formatMessage({ id: "home.openCaptureHistory" }),
				},
				{
					item: "Separator",
				},
				{
					id: `${appWindow.label}-disableShortcut`,
					text: intl.formatMessage({ id: "home.disableShortcut" }),
					checked: disableShortcut,
					action: async () => {
						setTrayIconState({
							disableShortcut: !disableShortcut,
						});
					},
				},
				{
					id: `${appWindow.label}-show-main-window`,
					text: intl.formatMessage({ id: "home.showMainWindow" }),
				},
				{
					item: "Separator",
				},
				{
					id: `${appWindow.label}-exit`,
					text: intl.formatMessage({ id: "home.exit" }),
				},
			],
		}).catch(async (error) => {
			await closeImageResource(iconImage);
			throw error;
		});

		const trayIconId = `${appWindow.label}-trayIcon`;
		let trayIconImage: Image | null = iconImage ?? null;
		try {
			if (!trayIconImage) {
				trayIconImage =
					(await (async () => {
						let targetDefaultIcon = defaultIcon;
						if (currentTheme === AppSettingsTheme.Dark && defaultIconDark) {
							targetDefaultIcon = defaultIconDark;
						}

						const { native_path } = await getDefaultIconPath(targetDefaultIcon);

						const iconImage = await Image.fromPath(native_path);

						return iconImage;
					})()) ?? (await defaultWindowIcon());
			}

			await updateTrayIcon(trayIconId, trayIconImage, menu);
			return { trayIconMenu: menu };
		} catch (error) {
			await closeMenuResource(menu);
			throw error;
		} finally {
			await closeImageResource(trayIconImage);
		}
	}, [
		shortcutKeys,
		enableTrayIcon,
		intl,
		disableShortcut,
		delayScreenshotSeconds,
		iconPath,
		message,
		currentAppSettings,
		defaultIcon,
		setTrayIconState,
		isReadyStatus,
		currentTheme,
		defaultIconDark,
		iconPathDark,
	]);

	useEffect(() => {
		if (!isReadyStatus) {
			return;
		}

		if (!shortcutKeys) {
			return;
		}

		const trayIconPromise = runTrayMutation(initTrayIcon).catch((error) => {
			appError("[TrayIconLoader] update native tray icon failed", error);
			return undefined;
		});
		let trayResourcesClosed = false;

		const closeTrayIcon = (errorContext: string) => {
			if (trayResourcesClosed) {
				return;
			}
			trayResourcesClosed = true;
			void runTrayMutation(async () => {
				const trayIcon = await trayIconPromise;
				if (trayIcon) {
					await closeTrayResources(trayIcon);
				}
			}).catch((error) => {
				appError(`[TrayIconLoader] ${errorContext}`, error);
			});
		};
		const handleBeforeUnload = () => {
			closeTrayIcon("beforeunload event failed");
		};

		window.addEventListener("beforeunload", handleBeforeUnload);

		return () => {
			closeTrayIcon("close tray icon failed");
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, [initTrayIcon, isReadyStatus, shortcutKeys]);

	return null;
};

export const TrayIconLoader = React.memo(TrayIconLoaderComponent);
