"use client";

import { Form, Spin } from "antd";
import { useCallback, useContext, useMemo, useState } from "react";
import { FormattedMessage } from "react-intl";
import { KeyButton } from "@/components/keyButton";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import { SettingsSection } from "@/components/settingsSection";
import { defaultAppSettingsData } from "@/constants/appSettings";
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
	PLUGIN_ID_GLM_OCR,
	PLUGIN_ID_RAPID_OCR,
	PLUGIN_ID_TRANSLATE,
} from "@/constants/pluginService";
import {
	AppSettingsActionContext,
	AppSettingsPublisher,
} from "@/contexts/appSettingsActionContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { usePlatform } from "@/hooks/usePlatform";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";
import { DrawToolbarKeyEventKey } from "@/types/components/drawToolbar";
import {
	CommonKeyEventGroup,
	type CommonKeyEventKey,
} from "@/types/core/commonKeyEvent";
import { canUseOcr } from "@/utils/ocr";

export const HotKeySettingsPage = () => {
	const { updateAppSettings } = useContext(AppSettingsActionContext);

	const [appSettingsLoading, setAppSettingsLoading] = useState(true);

	const [drawToolbarKeyEventForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.DrawToolbarKeyEvent]>();
	const [commonKeyEventForm] =
		Form.useForm<AppSettingsData[AppSettingsGroup.CommonKeyEvent]>();

	const [drawToolbarKeyEvent, setDrawToolbarKeyEvent] = useState<
		AppSettingsData[AppSettingsGroup.DrawToolbarKeyEvent]
	>(defaultDrawToolbarKeyEventSettings);
	const [commonKeyEvent, setCommonKeyEvent] = useState<
		AppSettingsData[AppSettingsGroup.CommonKeyEvent]
	>(defaultCommonKeyEventSettings);
	const [currentAppSettings, setCurrentAppSettings] = useState<AppSettingsData>(
		defaultAppSettingsData,
	);
	useStateSubscriber(AppSettingsPublisher, setCurrentAppSettings);
	useAppSettingsLoad(
		useCallback((settings: AppSettingsData, preSettings?: AppSettingsData) => {
			setAppSettingsLoading(false);

			if (
				preSettings === undefined ||
				preSettings[AppSettingsGroup.DrawToolbarKeyEvent] !==
					settings[AppSettingsGroup.DrawToolbarKeyEvent]
			) {
				setDrawToolbarKeyEvent(settings[AppSettingsGroup.DrawToolbarKeyEvent]);
			}

			if (
				preSettings === undefined ||
				preSettings[AppSettingsGroup.DrawToolbarKeyEvent] !==
					settings[AppSettingsGroup.DrawToolbarKeyEvent]
			) {
				setCommonKeyEvent(settings[AppSettingsGroup.CommonKeyEvent]);
			}
		}, []),
		true,
	);

	const [currentPlatform] = usePlatform();

	const { isReadyStatus } = usePluginServiceContext();

	const drawToolbarKeyEventFormItemList = useMemo(() => {
		return Object.keys(defaultDrawToolbarKeyEventSettings)
			.filter((key) => {
				// macOS 下浏览器的 Ctrl 等键不会响应 keydown 事件，不支持自定义
				if (currentPlatform === "macos") {
					switch (key) {
						case DrawToolbarKeyEventKey.ResizeFromCenterPicker:
						case DrawToolbarKeyEventKey.MaintainAspectRatioPicker:
						case DrawToolbarKeyEventKey.RotateWithDiscreteAnglePicker:
						case DrawToolbarKeyEventKey.AutoAlignPicker:
							return false;
						default:
							return true;
					}
				}

				if (key === DrawToolbarKeyEventKey.OcrDetectTool) {
					return canUseOcr(
						currentAppSettings,
						isReadyStatus?.(PLUGIN_ID_GLM_OCR),
						isReadyStatus?.(PLUGIN_ID_RAPID_OCR),
					);
				}

				if (key === DrawToolbarKeyEventKey.OcrTranslateTool) {
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
			.map((key) => {
				const config = drawToolbarKeyEvent[key as DrawToolbarKeyEventKey];
				const componentConfig =
					defaultDrawToolbarKeyEventComponentConfig[
						key as DrawToolbarKeyEventKey
					];

				return (
					<div
						className="hotkey-matrix-item"
						key={`draw-toolbar-key-event_col-${key}`}
					>
						<Form.Item
							className="hotkey-matrix-form-item"
							label={<FormattedMessage id={componentConfig.messageId} />}
							name={key}
						>
							<KeyButton
								title={
									<FormattedMessage key={key} id={componentConfig.messageId} />
								}
								keyValue={config.hotKey}
								maxWidth={100}
								onKeyChange={async (value) => {
									updateAppSettings(
										AppSettingsGroup.DrawToolbarKeyEvent,
										{
											[key]: {
												...config,
												hotKey: value,
											},
										},
										false,
										true,
										true,
									);
								}}
								maxLength={2}
							/>
						</Form.Item>
					</div>
				);
			});
	}, [
		currentPlatform,
		currentAppSettings,
		drawToolbarKeyEvent,
		isReadyStatus,
		updateAppSettings,
	]);

	const keyEventFormItemList = useMemo(() => {
		const groupFormItemMap: Record<CommonKeyEventGroup, React.ReactNode[]> = {
			[CommonKeyEventGroup.Translation]: [],
			[CommonKeyEventGroup.Chat]: [],
			[CommonKeyEventGroup.FixedContent]: [],
		};

		Object.keys(defaultCommonKeyEventSettings).forEach((key) => {
			const config = commonKeyEvent[key as CommonKeyEventKey];
			const componentConfig =
				defaultCommonKeyEventComponentConfig[key as CommonKeyEventKey];

			if (!groupFormItemMap[config.group]) {
				groupFormItemMap[config.group] = [];
			}

			groupFormItemMap[config.group].push(
				<div className="hotkey-matrix-item" key={`key-event_col-${key}`}>
					<Form.Item
						className="hotkey-matrix-form-item"
						label={<FormattedMessage id={componentConfig.messageId} />}
						name={key}
					>
						<KeyButton
							title={
								<FormattedMessage key={key} id={componentConfig.messageId} />
							}
							keyValue={config.hotKey}
							maxWidth={100}
							onKeyChange={async (value) => {
								updateAppSettings(
									AppSettingsGroup.CommonKeyEvent,
									{
										[key]: {
											...config,
											hotKey: value,
										},
									},
									false,
									true,
									true,
								);
							}}
							maxLength={2}
						/>
					</Form.Item>
				</div>,
			);
		});

		return groupFormItemMap;
	}, [commonKeyEvent, updateAppSettings]);

	const keyEventFormItemListKeys = Object.keys(
		keyEventFormItemList,
	) as CommonKeyEventGroup[];
	return (
		<div className="settings-wrap hot-key-settings-page">
			{/* 这里用 form 控制值的更新和保存的话反而很麻烦，所以 */}
			<Form
				className="settings-form common-settings-form"
				form={commonKeyEventForm}
				layout="horizontal"
			>
				{keyEventFormItemListKeys
					.filter((configGroup) => {
						if (configGroup === CommonKeyEventGroup.Chat) {
							return isReadyStatus?.(PLUGIN_ID_AI_CHAT);
						}

						return true;
					})
					.map((configGroup, index) => {
						return (
							<SettingsSection
								key={configGroup}
								sectionId={configGroup}
								title={
									<FormattedMessage
										id={`settings.hotKeySettings.${configGroup}`}
									/>
								}
								extra={
									<ResetSettingsButton
										title={
											<FormattedMessage
												id={`settings.hotKeySettings.${configGroup}`}
												key={configGroup}
											/>
										}
										appSettingsGroup={AppSettingsGroup.CommonKeyEvent}
										filter={(settings) => {
											return Object.keys(settings).reduce(
												(acc, key) => {
													if (
														commonKeyEvent[key as CommonKeyEventKey].group ===
														configGroup
													) {
														acc[key] = settings[key];
													}
													return acc;
												},
												{} as Record<string, unknown>,
											);
										}}
									/>
								}
								defaultOpen={index === 0}
							>
								<Spin spinning={appSettingsLoading}>
									<div className="hotkey-matrix">
										{keyEventFormItemList[configGroup]}
									</div>
								</Spin>
							</SettingsSection>
						);
					})}
			</Form>

			<SettingsSection
				sectionId="drawingHotKey"
				title={<FormattedMessage id="settings.drawingHotKey" />}
				extra={
					<ResetSettingsButton
						title={
							<FormattedMessage
								id="settings.drawingHotKey"
								key="drawingHotKey"
							/>
						}
						appSettingsGroup={AppSettingsGroup.DrawToolbarKeyEvent}
					/>
				}
			>
				<Form
					className="settings-form common-settings-form"
					form={drawToolbarKeyEventForm}
					layout="horizontal"
				>
					<Spin spinning={appSettingsLoading}>
						<div className="hotkey-matrix">
							{drawToolbarKeyEventFormItemList}
						</div>
					</Spin>
				</Form>
			</SettingsSection>

			<div className="hot-key-settings-form"></div>
		</div>
	);
};
