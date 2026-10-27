import { useCallback, useContext, useMemo, useState } from "react";
import { FormattedMessage } from "react-intl";
import { KeyButton } from "@/components/keyButton";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsGroup } from "@/components/settingsGroup";
import {
	defaultCommonKeyEventComponentConfig,
	defaultCommonKeyEventSettings,
} from "@/constants/commonKeyEvent";
import {
	defaultDrawToolbarKeyEventComponentConfig,
	defaultDrawToolbarKeyEventSettings,
} from "@/constants/drawToolbarKeyEvent";
import {
	PLUGIN_ID_AI_CHAT,
	PLUGIN_ID_TRANSLATE,
} from "@/constants/pluginService";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { usePlatform } from "@/hooks/usePlatform";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";
import { DrawToolbarKeyEventKey } from "@/types/components/drawToolbar";
import {
	CommonKeyEventGroup,
	type CommonKeyEventKey,
} from "@/types/core/commonKeyEvent";
import { useOcrReady } from "../shared/hooks";
import { SettingsLine } from "../shared/settingsLine";

// macOS WebViews do not deliver keydown for bare modifier keys.
const MACOS_UNSUPPORTED_DRAW_KEYS = new Set<string>([
	DrawToolbarKeyEventKey.ResizeFromCenterPicker,
	DrawToolbarKeyEventKey.MaintainAspectRatioPicker,
	DrawToolbarKeyEventKey.RotateWithDiscreteAnglePicker,
	DrawToolbarKeyEventKey.AutoAlignPicker,
]);

const COMMON_GROUPS = [
	CommonKeyEventGroup.Translation,
	CommonKeyEventGroup.Chat,
	CommonKeyEventGroup.FixedContent,
];

/** Shortcuts that only act inside the translation, chat, pin and capture windows. */
export const InWindowHotkeysSection = () => {
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const { isReadyStatus } = usePluginServiceContext();
	const [currentPlatform] = usePlatform();
	const ocrReady = useOcrReady();

	const [commonKeyEvent, setCommonKeyEvent] = useState<
		AppSettingsData[AppSettingsGroup.CommonKeyEvent]
	>(defaultCommonKeyEventSettings);
	const [drawToolbarKeyEvent, setDrawToolbarKeyEvent] = useState<
		AppSettingsData[AppSettingsGroup.DrawToolbarKeyEvent]
	>(defaultDrawToolbarKeyEventSettings);

	useAppSettingsLoad(
		useCallback((settings: AppSettingsData, preSettings?: AppSettingsData) => {
			if (
				preSettings?.[AppSettingsGroup.CommonKeyEvent] !==
				settings[AppSettingsGroup.CommonKeyEvent]
			) {
				setCommonKeyEvent(settings[AppSettingsGroup.CommonKeyEvent]);
			}
			if (
				preSettings?.[AppSettingsGroup.DrawToolbarKeyEvent] !==
				settings[AppSettingsGroup.DrawToolbarKeyEvent]
			) {
				setDrawToolbarKeyEvent(settings[AppSettingsGroup.DrawToolbarKeyEvent]);
			}
		}, []),
		true,
	);

	const visibleCommonGroups = COMMON_GROUPS.filter((group) => {
		if (group === CommonKeyEventGroup.Chat) {
			return isReadyStatus?.(PLUGIN_ID_AI_CHAT);
		}
		if (group === CommonKeyEventGroup.Translation) {
			return isReadyStatus?.(PLUGIN_ID_TRANSLATE);
		}
		return true;
	});

	const drawKeys = useMemo(
		() =>
			(
				Object.keys(
					defaultDrawToolbarKeyEventSettings,
				) as DrawToolbarKeyEventKey[]
			).filter((key) => {
				if (
					currentPlatform === "macos" &&
					MACOS_UNSUPPORTED_DRAW_KEYS.has(key)
				) {
					return false;
				}
				if (key === DrawToolbarKeyEventKey.OcrDetectTool) {
					return ocrReady;
				}
				if (key === DrawToolbarKeyEventKey.OcrTranslateTool) {
					return ocrReady && !!isReadyStatus?.(PLUGIN_ID_TRANSLATE);
				}
				return true;
			}),
		[currentPlatform, isReadyStatus, ocrReady],
	);

	return (
		<>
			{visibleCommonGroups.map((group) => {
				const keys = (
					Object.keys(defaultCommonKeyEventSettings) as CommonKeyEventKey[]
				).filter((key) => commonKeyEvent[key]?.group === group);

				return (
					<SettingsGroup
						key={group}
						title={<FormattedMessage id={`settings.hotKeySettings.${group}`} />}
						rows={false}
						extra={
							<ResetSettingsButton
								title={
									<FormattedMessage id={`settings.hotKeySettings.${group}`} />
								}
								appSettingsGroup={AppSettingsGroup.CommonKeyEvent}
								filter={(settings) =>
									Object.fromEntries(
										Object.entries(settings).filter(
											([key]) =>
												commonKeyEvent[key as CommonKeyEventKey]?.group ===
												group,
										),
									)
								}
							/>
						}
					>
						{keys.map((key) => {
							const config = commonKeyEvent[key];
							const messageId =
								defaultCommonKeyEventComponentConfig[key].messageId;
							return (
								<SettingsLine
									key={key}
									label={<FormattedMessage id={messageId} />}
									control={
										<KeyButton
											title={<FormattedMessage id={messageId} />}
											keyValue={config.hotKey}
											maxWidth={120}
											maxLength={2}
											onKeyChange={async (value) => {
												updateAppSettings(
													AppSettingsGroup.CommonKeyEvent,
													{ [key]: { ...config, hotKey: value } },
													false,
													true,
													true,
												);
											}}
										/>
									}
								/>
							);
						})}
					</SettingsGroup>
				);
			})}

			<SettingsGroup
				title={<FormattedMessage id="settings.drawingHotKey" />}
				description={<FormattedMessage id="workbench.drawingHotKey.desc" />}
				rows={false}
				extra={
					<ResetSettingsButton
						title={<FormattedMessage id="settings.drawingHotKey" />}
						appSettingsGroup={AppSettingsGroup.DrawToolbarKeyEvent}
					/>
				}
			>
				<div className="hotkey-grid">
					{drawKeys.map((key) => {
						const config = drawToolbarKeyEvent[key];
						const messageId =
							defaultDrawToolbarKeyEventComponentConfig[key].messageId;
						return (
							<SettingsLine
								key={key}
								label={<FormattedMessage id={messageId} />}
								control={
									<KeyButton
										title={<FormattedMessage id={messageId} />}
										keyValue={config.hotKey}
										maxWidth={100}
										maxLength={2}
										onKeyChange={async (value) => {
											updateAppSettings(
												AppSettingsGroup.DrawToolbarKeyEvent,
												{ [key]: { ...config, hotKey: value } },
												false,
												true,
												true,
											);
										}}
									/>
								}
							/>
						);
					})}
				</div>
			</SettingsGroup>
			<style jsx global>{`
				.hotkey-grid {
					display: grid;
					grid-template-columns: repeat(2, minmax(0, 1fr));
					column-gap: 24px;
				}

				/* Both cells of the first grid row sit directly under the title. */
				.hotkey-grid > .settings-line:nth-child(2) {
					border-top: 0;
				}

				@container snow-detail (max-width: 640px) {
					.hotkey-grid {
						grid-template-columns: minmax(0, 1fr);
					}

					.hotkey-grid > .settings-line:nth-child(2) {
						border-top: 1px solid var(--snow-shot-hairline-soft);
					}
				}
			`}</style>
		</>
	);
};
