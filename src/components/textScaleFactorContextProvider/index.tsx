import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";
import { TextScaleFactorContext } from "@/contexts/textScaleFactorContext";
import { useStateRef } from "@/hooks/useStateRef";
import { listenDevicePixelRatio } from "@/utils/environment";

let useTextScaleFactorDataCache_textScaleFactor = 1;
let useTextScaleFactorDataCache_devicePixelRatio = 1;
export const TextScaleFactorContextProvider: React.FC<{
	children: React.ReactNode;
}> = ({ children }) => {
	const [textScaleFactor, setTextScaleFactor, textScaleFactorRef] = useStateRef(
		useTextScaleFactorDataCache_textScaleFactor,
	);
	const [devicePixelRatio, setDevicePixelRatio] = useState(
		useTextScaleFactorDataCache_devicePixelRatio,
	);

	const initTextScaleFactor = useCallback(
		async (devicePixelRatio: number) => {
			const scaleFactor = await getCurrentWindow().scaleFactor();
			useTextScaleFactorDataCache_textScaleFactor =
				devicePixelRatio / scaleFactor;
			useTextScaleFactorDataCache_devicePixelRatio = devicePixelRatio;
			setTextScaleFactor(useTextScaleFactorDataCache_textScaleFactor);
			setDevicePixelRatio(useTextScaleFactorDataCache_devicePixelRatio);
		},
		[setTextScaleFactor],
	);

	useEffect(() => {
		initTextScaleFactor(window.devicePixelRatio);
		const stopListen = listenDevicePixelRatio((ratio) => {
			initTextScaleFactor(ratio);
		});
		return () => {
			stopListen();
		};
	}, [initTextScaleFactor]);

	return (
		<TextScaleFactorContext.Provider
			value={{ textScaleFactor, textScaleFactorRef, devicePixelRatio }}
		>
			{children}
		</TextScaleFactorContext.Provider>
	);
};
