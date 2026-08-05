import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { hotLoadPageAddPage } from "@/commands/hotLoadPage";
import { EventListenerContext } from "@/components/eventListener";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { appWarn } from "@/utils/log";

export const useIdlePage = (
	enable: boolean,
	onNavigate: (url: string) => void,
) => {
	const [appSettingsReady, setAppSettingsReady] = useState(false);
	useAppSettingsLoad(
		useCallback(() => {
			setAppSettingsReady(true);
		}, []),
	);

	const { addListener, removeListener, listenersReady } =
		useContext(EventListenerContext);
	const [routeListenerReady, setRouteListenerReady] = useState(false);
	const registeredRef = useRef(false);

	useEffect(() => {
		if (!enable) {
			return;
		}

		const listenerId = addListener("hot-load-page-route-push", (args) => {
			const payload = (
				args as {
					payload: {
						label: string;
						url: string;
					};
				}
			).payload;

			if (payload.label !== getCurrentWindow().label) {
				return;
			}

			onNavigate(payload.url);
		});
		setRouteListenerReady(true);

		return () => {
			removeListener(listenerId);
		};
	}, [addListener, removeListener, enable, onNavigate]);

	useEffect(() => {
		if (
			!enable ||
			!appSettingsReady ||
			!listenersReady ||
			!routeListenerReady ||
			registeredRef.current
		) {
			return;
		}

		registeredRef.current = true;
		void hotLoadPageAddPage().catch((error) => {
			registeredRef.current = false;
			appWarn("[useIdlePage] register idle page failed", error);
		});
	}, [appSettingsReady, enable, listenersReady, routeListenerReady]);

	return;
};
