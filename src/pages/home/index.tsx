import { InfoCircleOutlined } from "@ant-design/icons";
import { Spin, Tooltip, theme } from "antd";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FormattedMessage } from "react-intl";
import { CheckPermissions } from "@/components/checkPermissions";
import { ContentWrap } from "@/components/contentWrap";
import { FunctionButton } from "@/components/functionButton";
import { GlobalShortcutContext } from "@/components/globalShortcut";
import { GroupTitle } from "@/components/groupTitle";
import { KeyButton } from "@/components/keyButton";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import {
	PLUGIN_ID_AI_CHAT,
	PLUGIN_ID_FFMPEG,
	PLUGIN_ID_GLM_OCR,
	PLUGIN_ID_RAPID_OCR,
	PLUGIN_ID_TRANSLATE,
} from "@/constants/pluginService";
import {
	AppSettingsActionContext,
	AppSettingsPublisher,
} from "@/contexts/appSettingsActionContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { usePlatform } from "@/hooks/usePlatform";
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
	AppFunctionGroup,
} from "@/types/components/appFunction";
import { canUseOcr } from "@/utils/ocr";
import {
	convertShortcutKeyStatusToButtonColor,
	convertShortcutKeyStatusToTip,
} from "./extra";

const CAPTURE_DECK_FUNCTIONS = [
	AppFunction.Screenshot,
	AppFunction.ScreenshotFocusedWindow,
	AppFunction.ScreenshotFullScreen,
	AppFunction.ScreenshotDelay,
] as const;

const SECONDARY_WORKSPACE_GROUPS = [
	AppFunctionGroup.Chat,
	AppFunctionGroup.Translation,
	AppFunctionGroup.VideoRecord,
	AppFunctionGroup.Other,
] as const;

const CAPTURE_DECK_FUNCTION_SET = new Set<AppFunction>(CAPTURE_DECK_FUNCTIONS);

const getSpecialKeys = (group: AppFunctionGroup) => {
	switch (group) {
		case AppFunctionGroup.Screenshot:
		case AppFunctionGroup.Translation:
		case AppFunctionGroup.Chat:
		case AppFunctionGroup.Other:
			return ["PrintScreen"];
		default:
			return undefined;
	}
};

const getWorkspaceMeta = (group: AppFunctionGroup) => {
	switch (group) {
		case AppFunctionGroup.Translation:
			return {
				id: "translationFunction",
				labelId: "home.translationFunction",
			};
		case AppFunctionGroup.Chat:
			return {
				id: "chatFunction",
				labelId: "home.chatFunction",
			};
		case AppFunctionGroup.VideoRecord:
			return {
				id: "videoRecordFunction",
				labelId: "home.videoRecordFunction",
			};
		case AppFunctionGroup.Other:
			return {
				id: "otherFunction",
				labelId: "home.otherFunction",
			};
		default:
			return undefined;
	}
};

export const HomePage = () => {
	const { token } = theme.useToken();

	const { updateAppSettings } = useContext(AppSettingsActionContext);

	const resetFliter = useCallback((group: AppFunctionGroup) => {
		return (settings: Record<string, unknown>) => {
			const newSettings: Partial<
				AppSettingsData[AppSettingsGroup.AppFunction]
			> = {};

			Object.keys(settings).forEach((key) => {
				if ((settings[key] as AppFunctionConfig).group !== group) {
					return;
				}

				newSettings[key as AppFunction] = settings[key] as AppFunctionConfig;
			});

			return newSettings;
		};
	}, []);

	const [currentPlatform] = usePlatform();

	const {
		defaultAppFunctionComponentGroupConfigs,
		updateShortcutKeyStatusLoading,
		appSettingsLoading,
		appFunctionSettings,
		shortcutKeyStatus,
		setShortcutInputActive,
	} = useContext(GlobalShortcutContext);
	useEffect(() => {
		return () => {
			setShortcutInputActive(false);
		};
	}, [setShortcutInputActive]);

	const { isReadyStatus } = usePluginServiceContext();
	const [currentAppSettings, setCurrentAppSettings] =
		useState<AppSettingsData>();
	useStateSubscriber(AppSettingsPublisher, setCurrentAppSettings);
	const ocrReady = currentAppSettings
		? canUseOcr(
				currentAppSettings,
				isReadyStatus?.(PLUGIN_ID_GLM_OCR),
				isReadyStatus?.(PLUGIN_ID_RAPID_OCR),
			)
		: false;

	const isGroupEnabled = useCallback(
		(group: AppFunctionGroup) => {
			switch (group) {
				case AppFunctionGroup.VideoRecord:
					return isReadyStatus?.(PLUGIN_ID_FFMPEG);
				case AppFunctionGroup.Chat:
					return isReadyStatus?.(PLUGIN_ID_AI_CHAT);
				case AppFunctionGroup.Translation:
					return isReadyStatus?.(PLUGIN_ID_TRANSLATE);
				default:
					return true;
			}
		},
		[isReadyStatus],
	);

	const getVisibleConfigs = useCallback(
		(group: AppFunctionGroup) => {
			return (defaultAppFunctionComponentGroupConfigs[group] ?? []).filter(
				(config) => {
					if (
						currentPlatform === "macos" &&
						config.configKey === AppFunction.TopWindow
					) {
						return false;
					}

					if (
						config.configKey === AppFunction.ScreenshotOcr ||
						config.configKey === AppFunction.ScreenshotOcrTranslate
					) {
						return ocrReady;
					}

					return true;
				},
			);
		},
		[currentPlatform, defaultAppFunctionComponentGroupConfigs, ocrReady],
	);

	const captureDeck = useMemo(() => {
		const screenshotConfigs = getVisibleConfigs(AppFunctionGroup.Screenshot);
		const getConfig = (configKey: AppFunction) =>
			screenshotConfigs.find((config) => config.configKey === configKey);

		return {
			primary: getConfig(AppFunction.Screenshot),
			modes: CAPTURE_DECK_FUNCTIONS.slice(1).flatMap((configKey) => {
				const config = getConfig(configKey);
				return config ? [config] : [];
			}),
			secondary: screenshotConfigs.filter(
				(config) => !CAPTURE_DECK_FUNCTION_SET.has(config.configKey),
			),
		};
	}, [getVisibleConfigs]);

	const secondaryWorkspaces = useMemo(() => {
		return SECONDARY_WORKSPACE_GROUPS.flatMap((group) => {
			const meta = getWorkspaceMeta(group);
			const configs = getVisibleConfigs(group);
			if (!meta || !isGroupEnabled(group) || configs.length === 0) {
				return [];
			}

			return [{ configs, group, meta }];
		});
	}, [getVisibleConfigs, isGroupEnabled]);

	const renderCommand = (
		config: AppFunctionComponentConfig,
		group: AppFunctionGroup,
		variant: "standard" | "primary" | "compact",
	) => {
		const key = config.configKey;
		const currentShortcutKey =
			appFunctionSettings?.[key as AppFunction]?.shortcutKey;
		const statusColor = appSettingsLoading
			? undefined
			: convertShortcutKeyStatusToButtonColor(
					shortcutKeyStatus?.[key as AppFunction],
				);

		const statusTip = appSettingsLoading
			? undefined
			: convertShortcutKeyStatusToTip(shortcutKeyStatus?.[key as AppFunction]);

		let children = <></>;
		if (shortcutKeyStatus?.[key as AppFunction] === ShortcutKeyStatus.None) {
			children = (
				<div
					style={{
						color: token.colorTextDescription,
					}}
				>
					<FormattedMessage id="home.shortcut.none" />
				</div>
			);
		} else if (statusTip) {
			children = (
				<Tooltip
					title={convertShortcutKeyStatusToTip(
						shortcutKeyStatus?.[key as AppFunction],
					)}
				>
					<InfoCircleOutlined />
				</Tooltip>
			);
		}

		return (
			<div className="home-command-item" key={`${group}-${key}`}>
				<FunctionButton
					label={config.title}
					icon={config.icon}
					onClick={config.onClick}
					variant={variant}
				>
					<KeyButton
						speicalKeys={getSpecialKeys(group)}
						title={config.title}
						maxWidth={200}
						keyValue={currentShortcutKey ?? ""}
						buttonProps={{
							variant: "dashed",
							color: statusColor,
							children,
							onClick: () => {
								setShortcutInputActive(true);
							},
						}}
						onCancel={() => {
							setShortcutInputActive(false);
						}}
						onKeyChange={async (value) => {
							setShortcutInputActive(false);
							updateAppSettings(
								AppSettingsGroup.AppFunction,
								{
									[key as AppFunction]: {
										...appFunctionSettings,
										shortcutKey: value,
									},
								},
								false,
								true,
								false,
								false,
							);
						}}
						maxLength={1}
					/>
				</FunctionButton>
			</div>
		);
	};

	return (
		<ContentWrap className="home-wrap">
			<CheckPermissions />

			<section className="capture-deck" aria-labelledby="screenshotFunction">
				<GroupTitle
					id="screenshotFunction"
					extra={
						<ResetSettingsButton
							title={
								<FormattedMessage
									id="home.screenshotFunction"
									key="screenshotFunction"
								/>
							}
							appSettingsGroup={AppSettingsGroup.AppFunction}
							filter={resetFliter(AppFunctionGroup.Screenshot)}
						/>
					}
				>
					<FormattedMessage
						id="home.screenshotFunction"
						key="screenshotFunction"
					/>
				</GroupTitle>

				<Spin spinning={updateShortcutKeyStatusLoading || appSettingsLoading}>
					<div className="capture-deck-console">
						{captureDeck.primary && (
							<div className="capture-deck-primary">
								{renderCommand(
									captureDeck.primary,
									AppFunctionGroup.Screenshot,
									"primary",
								)}
							</div>
						)}
						{captureDeck.modes.length > 0 && (
							<div className="capture-deck-modes">
								{captureDeck.modes.map((config) =>
									renderCommand(config, AppFunctionGroup.Screenshot, "compact"),
								)}
							</div>
						)}
						{captureDeck.secondary.length > 0 && (
							<div className="capture-secondary-workflows">
								{captureDeck.secondary.map((config) =>
									renderCommand(config, AppFunctionGroup.Screenshot, "compact"),
								)}
							</div>
						)}
					</div>
				</Spin>
			</section>

			<div className="home-workspace-grid">
				{secondaryWorkspaces.map(({ configs, group, meta }) => (
					<section
						className="home-command-group"
						key={group}
						aria-labelledby={meta.id}
					>
						<GroupTitle
							id={meta.id}
							extra={
								<ResetSettingsButton
									title={<FormattedMessage id={meta.labelId} />}
									appSettingsGroup={AppSettingsGroup.AppFunction}
									filter={resetFliter(group)}
								/>
							}
						>
							<FormattedMessage id={meta.labelId} />
						</GroupTitle>
						<Spin
							spinning={updateShortcutKeyStatusLoading || appSettingsLoading}
						>
							<div className="home-command-list">
								{configs.map((config) =>
									renderCommand(config, group, "compact"),
								)}
							</div>
						</Spin>
					</section>
				))}
			</div>
			<style jsx global>{`
                :global(.home-wrap) {
                    padding-top: 2px;
                }

                .capture-deck,
                .home-command-group {
                    min-width: 0;
                    padding: 0;
                    border: 0;
                    background: transparent;
                }

                .capture-deck {
                    margin-bottom: 24px;
                }

                .capture-deck :global(.components_group-title-row),
                .home-command-group :global(.components_group-title-row) {
                    margin-bottom: 8px !important;
                }

						.capture-deck-console,
                .capture-deck-primary,
                .capture-deck-modes,
                .capture-secondary-workflows,
                .home-workspace-grid,
                .home-command-list {
                    min-width: 0;
                }

						.capture-deck-modes,
						.capture-secondary-workflows {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 6px;
                }

                .home-command-list {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr);
                    gap: 6px;
                }

						.capture-secondary-workflows {
							padding-top: 10px;
							border-top: 1px solid var(--snow-shot-hairline-soft);
						}

                .home-workspace-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr);
                    gap: 20px;
                }

                .home-command-item {
                    min-width: 0;
                }

						@container snow-content (min-width: 901px) {
							.capture-deck-modes {
								grid-template-columns: repeat(3, minmax(0, 1fr));
							}

							.home-workspace-grid {
								grid-template-columns: repeat(2, minmax(0, 1fr));
								column-gap: 16px;
								row-gap: 24px;
							}
						}

						@container snow-content (min-width: 1180px) {
							.capture-deck-console {
								display: grid;
								grid-template-areas:
									"primary modes"
									"secondary secondary";
								grid-template-columns: minmax(252px, 0.82fr) minmax(0, 1.72fr);
								gap: 10px 12px;
							}

							.capture-deck-primary {
								grid-area: primary;
								display: flex;
								min-width: 0;
							}

							.capture-deck-primary .home-command-item {
								display: flex;
								flex: 1 1 auto;
							}

							/* Preserve FunctionButton's action/shortcut grid. Turning this
							   row into flex made the block action compete with its keycap. */
							.capture-deck-primary :global(.snow-command-row--primary) {
								flex: 1 1 auto;
								align-items: stretch;
								min-height: 112px;
							}

							.capture-deck-primary :global(.snow-command-action.ant-btn) {
								height: 100%;
							}

							.capture-deck-modes {
								grid-area: modes;
							}

							.capture-secondary-workflows {
								grid-area: secondary;
								margin-top: 0;
							}

						}

						@container snow-content (max-width: 1179px) {
							.capture-deck-primary {
								margin-bottom: 8px;
							}
						}

						@container snow-content (max-width: 700px) {
                    .capture-deck-modes,
                    .capture-secondary-workflows {
                        grid-template-columns: minmax(0, 1fr);
                    }
                }
            `}</style>
		</ContentWrap>
	);
};
