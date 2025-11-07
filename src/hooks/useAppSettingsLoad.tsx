import { debounce } from "es-toolkit";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
	AppSettingsLoadingPublisher,
	AppSettingsPublisher,
} from "@/contexts/appSettingsActionContext";
import type { AppSettingsData } from "@/types/appSettings";
import { useStateSubscriber } from "./useStateSubscriber";

/**
 * 应用设置加载完毕后执行
 * @param onLoad 加载回调
 */
export function useAppSettingsLoad(
	onLoad: (settings: AppSettingsData, preSettings?: AppSettingsData) => void,
	subscribe: boolean = false,
) {
	const preSettingsRef = useRef<AppSettingsData | undefined>(undefined);

	const hasLoadedRef = useRef(false);
	const invokeOnLoadCore = useMemo(
		() =>
			debounce((settings: AppSettingsData) => {
				onLoad(settings, preSettingsRef.current);
				preSettingsRef.current = settings;
			}, 0),
		[onLoad],
	);
	const invokeOnLoad = useCallback(
		(settings: AppSettingsData) => {
			if (hasLoadedRef.current && !subscribe) {
				return;
			}

			invokeOnLoadCore(settings);
			hasLoadedRef.current = true;
		},
		[invokeOnLoadCore, subscribe],
	);

	const [getAppSettingsLoading] = useStateSubscriber(
		AppSettingsLoadingPublisher,
		undefined,
	);
	const [getAppSettings] = useStateSubscriber(
		AppSettingsPublisher,
		useCallback(
			(settings: AppSettingsData) => {
				if (getAppSettingsLoading()) {
					return;
				}

				invokeOnLoad(settings);
			},
			[getAppSettingsLoading, invokeOnLoad],
		),
	);

	useStateSubscriber(
		AppSettingsLoadingPublisher,
		useCallback(
			(loading: boolean) => {
				if (loading) {
					return;
				}

				invokeOnLoad(getAppSettings());
			},
			[getAppSettings, invokeOnLoad],
		),
	);

	useEffect(() => {
		if (getAppSettingsLoading()) {
			return;
		}

		invokeOnLoad(getAppSettings());
	}, [getAppSettings, getAppSettingsLoading, invokeOnLoad]);
}
