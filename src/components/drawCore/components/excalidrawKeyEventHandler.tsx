import React, { useCallback, useMemo, useState } from "react";
import { defaultDrawToolbarKeyEventSettings } from "@/constants/drawToolbarKeyEvent";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { useHotkeysApp } from "@/hooks/useHotkeysApp";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { AppSettingsGroup } from "@/types/appSettings";
import { DrawToolbarKeyEventKey } from "@/types/components/drawToolbar";
import { HotkeysScope } from "@/types/core/appHotKeys";
import { type ExcalidrawKeyEvent, ExcalidrawKeyEventPublisher } from "../extra";

type HotKeys = {
	[key in keyof ExcalidrawKeyEvent]: string;
};

const defaultHotKeys: HotKeys = {
	rotateWithDiscreteAngle:
		defaultDrawToolbarKeyEventSettings[
			DrawToolbarKeyEventKey.RotateWithDiscreteAnglePicker
		].hotKey,
	resizeFromCenter:
		defaultDrawToolbarKeyEventSettings[
			DrawToolbarKeyEventKey.ResizeFromCenterPicker
		].hotKey,
	maintainAspectRatio:
		defaultDrawToolbarKeyEventSettings[
			DrawToolbarKeyEventKey.MaintainAspectRatioPicker
		].hotKey,
	autoAlign:
		defaultDrawToolbarKeyEventSettings[DrawToolbarKeyEventKey.AutoAlignPicker]
			.hotKey,
};

const ExcalidrawKeyEventHandlerCore = () => {
	const [getExcalidrawKeyEvent, setExcalidrawKeyEvent] = useStateSubscriber(
		ExcalidrawKeyEventPublisher,
		undefined,
	);
	const [hotKeys, setHotKeys] = useState<HotKeys>(defaultHotKeys);
	useAppSettingsLoad(
		useCallback((appSettings) => {
			setHotKeys({
				rotateWithDiscreteAngle:
					appSettings[AppSettingsGroup.DrawToolbarKeyEvent]
						.rotateWithDiscreteAnglePicker.hotKey,
				resizeFromCenter:
					appSettings[AppSettingsGroup.DrawToolbarKeyEvent]
						.resizeFromCenterPicker.hotKey,
				maintainAspectRatio:
					appSettings[AppSettingsGroup.DrawToolbarKeyEvent]
						.maintainAspectRatioPicker.hotKey,
				autoAlign:
					appSettings[AppSettingsGroup.DrawToolbarKeyEvent].autoAlignPicker
						.hotKey,
			});
		}, []),
		true,
	);

	const switchKeyEvent = useCallback(
		(field: keyof ExcalidrawKeyEvent, targetValue: boolean) => {
			return () => {
				if (getExcalidrawKeyEvent()[field] === targetValue) {
					return;
				}
				setExcalidrawKeyEvent({
					...getExcalidrawKeyEvent(),
					[field]: targetValue,
				});
			};
		},
		[getExcalidrawKeyEvent, setExcalidrawKeyEvent],
	);

	useHotkeysApp(
		hotKeys.rotateWithDiscreteAngle,
		switchKeyEvent("rotateWithDiscreteAngle", true),
		useMemo(
			() => ({
				preventDefault: true,
				keyup: false,
				keydown: true,
				scopes: HotkeysScope.DrawTool,
			}),
			[],
		),
	);
	useHotkeysApp(
		hotKeys.rotateWithDiscreteAngle,
		switchKeyEvent("rotateWithDiscreteAngle", false),
		useMemo(
			() => ({
				preventDefault: true,
				keyup: true,
				keydown: false,
				scopes: HotkeysScope.DrawTool,
			}),
			[],
		),
	);
	useHotkeysApp(
		hotKeys.maintainAspectRatio,
		switchKeyEvent("maintainAspectRatio", true),
		useMemo(
			() => ({
				preventDefault: true,
				keyup: false,
				keydown: true,
				scopes: HotkeysScope.DrawTool,
			}),
			[],
		),
	);
	useHotkeysApp(
		hotKeys.maintainAspectRatio,
		switchKeyEvent("maintainAspectRatio", false),
		useMemo(
			() => ({
				preventDefault: true,
				keyup: true,
				keydown: false,
				scopes: HotkeysScope.DrawTool,
			}),
			[],
		),
	);
	useHotkeysApp(
		hotKeys.resizeFromCenter,
		switchKeyEvent("resizeFromCenter", true),
		useMemo(
			() => ({
				preventDefault: true,
				keyup: false,
				keydown: true,
				scopes: HotkeysScope.DrawTool,
			}),
			[],
		),
	);
	useHotkeysApp(
		hotKeys.resizeFromCenter,
		switchKeyEvent("resizeFromCenter", false),
		useMemo(
			() => ({
				preventDefault: true,
				keyup: true,
				keydown: false,
				scopes: HotkeysScope.DrawTool,
			}),
			[],
		),
	);
	useHotkeysApp(
		hotKeys.autoAlign,
		switchKeyEvent("autoAlign", true),
		useMemo(
			() => ({
				preventDefault: true,
				keyup: false,
				keydown: true,
				scopes: HotkeysScope.DrawTool,
			}),
			[],
		),
	);
	useHotkeysApp(
		hotKeys.autoAlign,
		switchKeyEvent("autoAlign", false),
		useMemo(
			() => ({
				preventDefault: true,
				keyup: true,
				keydown: false,
				scopes: HotkeysScope.DrawTool,
			}),
			[],
		),
	);

	return undefined;
};

export const ExcalidrawKeyEventHandler = React.memo(
	ExcalidrawKeyEventHandlerCore,
);
