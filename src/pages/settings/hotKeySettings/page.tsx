"use client";

import { Col, Divider, Form, Row, Spin, theme } from "antd";
import { useCallback, useContext, useMemo, useState } from "react";
import { FormattedMessage } from "react-intl";
import { GroupTitle } from "@/components/groupTitle";
import { KeyButton } from "@/components/keyButton";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
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
	PLUGIN_ID_RAPID_OCR,
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

export const HotKeySettingsPage = () => {
	const { token } = theme.useToken();

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
					return isReadyStatus?.(PLUGIN_ID_RAPID_OCR);
				}

				if (key === DrawToolbarKeyEventKey.OcrTranslateTool) {
					return (
						isReadyStatus?.(PLUGIN_ID_RAPID_OCR) &&
						isReadyStatus?.(PLUGIN_ID_TRANSLATE)
					);
				}

				return true;
			})
			.map((key) => {
				const span = 12;
				const config = drawToolbarKeyEvent[key as DrawToolbarKeyEventKey];
				const componentConfig =
					defaultDrawToolbarKeyEventComponentConfig[
						key as DrawToolbarKeyEventKey
					];

				return (
					<Col key={`draw-toolbar-key-event_col-${key}`} span={span}>
						<Form.Item
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
					</Col>
				);
			});
	}, [currentPlatform, drawToolbarKeyEvent, isReadyStatus, updateAppSettings]);

	const keyEventFormItemList = useMemo(() => {
		const groupFormItemMap: Record<CommonKeyEventGroup, React.ReactNode[]> = {
			[CommonKeyEventGroup.Translation]: [],
			[CommonKeyEventGroup.Chat]: [],
			[CommonKeyEventGroup.FixedContent]: [],
		};

		Object.keys(defaultCommonKeyEventSettings).forEach((key) => {
			const span = 12;
			const config = commonKeyEvent[key as CommonKeyEventKey];
			const componentConfig =
				defaultCommonKeyEventComponentConfig[key as CommonKeyEventKey];

			if (!groupFormItemMap[config.group]) {
				groupFormItemMap[config.group] = [];
			}

			groupFormItemMap[config.group].push(
				<Col key={`key-event_col-${key}`} span={span}>
					<Form.Item
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
				</Col>,
			);
		});

		return groupFormItemMap;
	}, [commonKeyEvent, updateAppSettings]);

	const keyEventFormItemListKeys = Object.keys(
		keyEventFormItemList,
	) as CommonKeyEventGroup[];
	return (
		<div className="settings-wrap">
			{/* 这里用 form 控制值的更新和保存的话反而很麻烦，所以 */}
			<Form
				className="settings-form common-settings-form"
				form={commonKeyEventForm}
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
							<div key={configGroup}>
								<GroupTitle
									id={configGroup}
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
								>
									<FormattedMessage
										id={`settings.hotKeySettings.${configGroup}`}
									/>
								</GroupTitle>
								<Spin spinning={appSettingsLoading}>
									<Row gutter={token.marginLG}>
										{keyEventFormItemList[configGroup as CommonKeyEventGroup]}
									</Row>
								</Spin>

								{index !== keyEventFormItemListKeys.length - 1 && <Divider />}
							</div>
						);
					})}
			</Form>

			<Divider />

			<GroupTitle
				id="drawingHotKey"
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
				<FormattedMessage id="settings.drawingHotKey" />
			</GroupTitle>

			<Form
				className="settings-form common-settings-form"
				form={drawToolbarKeyEventForm}
			>
				<Spin spinning={appSettingsLoading}>
					<Row gutter={token.marginLG}>{drawToolbarKeyEventFormItemList}</Row>
				</Spin>
			</Form>

			<div className="hot-key-settings-form"></div>
		</div>
	);
};
