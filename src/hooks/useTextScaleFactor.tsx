import {
	type Dispatch,
	type RefObject,
	type SetStateAction,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { TextScaleFactorContext } from "@/contexts/textScaleFactorContext";
import { AppSettingsGroup } from "@/types/appSettings";
import { useAppSettingsLoad } from "./useAppSettingsLoad";
import { useStateRef } from "./useStateRef";

/**
 * 获取文本缩放比例
 */
export const useTextScaleFactor = (): [number, number, RefObject<number>] => {
	const { textScaleFactor, textScaleFactorRef, devicePixelRatio } = useContext(
		TextScaleFactorContext,
	);

	return [textScaleFactor, devicePixelRatio, textScaleFactorRef];
};

/**
 * 计算内容缩放比例
 * @param monitorScaleFactor 显示器缩放比例
 * @param textScaleFactor 文本缩放比例
 * @param devicePixelRatio 设备像素比
 * @returns 内容缩放比例
 */
const calculateContentScale = (
	monitorScaleFactor: number,
	textScaleFactor: number,
	devicePixelRatio: number,
) => {
	if (monitorScaleFactor === 0) {
		return 1;
	}

	return (monitorScaleFactor * textScaleFactor) / devicePixelRatio;
};

/**
 * 内容缩放比例
 * @returns 缩放比例
 */
export const useContentScale = (
	monitorScaleFactor: number,
	isToolbar?: boolean,
): [number, Dispatch<SetStateAction<number>>, RefObject<number>] => {
	const [textScaleFactor, devicePixelRatio] = useTextScaleFactor();
	const [contentScale, setContentScale, contentScaleRef] = useStateRef(1);

	const [uiScale, setUiScale] = useState<number>();
	const [toolbarUiScale, setToolbarUiScale] = useState<number>();

	useAppSettingsLoad(
		useCallback((settings) => {
			setUiScale(settings[AppSettingsGroup.Screenshot].uiScale);
			setToolbarUiScale(settings[AppSettingsGroup.Screenshot].toolbarUiScale);
		}, []),
		true,
	);

	useEffect(() => {
		if (!uiScale || !toolbarUiScale) {
			return;
		}

		setContentScale(
			calculateContentScale(
				monitorScaleFactor,
				textScaleFactor,
				devicePixelRatio,
			) *
				(uiScale / 100) *
				(isToolbar ? toolbarUiScale / 100 : 1),
		);
	}, [
		devicePixelRatio,
		isToolbar,
		monitorScaleFactor,
		setContentScale,
		textScaleFactor,
		toolbarUiScale,
		uiScale,
	]);

	return [contentScale, setContentScale, contentScaleRef];
};
