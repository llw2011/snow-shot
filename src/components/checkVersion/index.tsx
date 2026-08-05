import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";

export const getLatestVersion = async () => undefined;

export const CheckVersion: React.FC = () => {
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const clearIntervalRef = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	}, []);

	const checkVersionCore = useCallback(async () => undefined, []);

	const checkVersionLoadingRef = useRef(false);
	const checkVersion = useCallback(async () => {
		if (checkVersionLoadingRef.current) {
			return;
		}

		checkVersionLoadingRef.current = true;
		await checkVersionCore();
		checkVersionLoadingRef.current = false;
	}, [checkVersionCore]);

	const [autoCheckVersion, setAutoCheckVersion] = useState<boolean | undefined>(
		undefined,
	);
	useAppSettingsLoad(
		useCallback((appSettings: AppSettingsData) => {
			setAutoCheckVersion(
				appSettings[AppSettingsGroup.SystemCommon].autoCheckVersion,
			);
		}, []),
		true,
	);

	const hasCheckedVersionRef = useRef(false);
	useEffect(() => {
		if (autoCheckVersion === undefined) {
			return;
		}

		if (autoCheckVersion) {
			if (!hasCheckedVersionRef.current) {
				checkVersion();
				hasCheckedVersionRef.current = true;
			}

			clearIntervalRef();

			intervalRef.current = setInterval(checkVersion, 1000 * 60 * 60);
		} else {
			clearIntervalRef();
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [autoCheckVersion, checkVersion, clearIntervalRef]);

	return undefined;
};
