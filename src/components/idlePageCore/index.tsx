import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useContext, useEffect } from "react";
import { hotLoadPageAddPage } from "@/commands/hotLoadPage";
import { EventListenerContext } from "@/components/eventListener";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";

export const useIdlePage = (
	enable: boolean,
	onNavigate: (url: string) => void,
) => {
	useAppSettingsLoad(
		useCallback(() => {
			hotLoadPageAddPage();
		}, []),
	);

	const { addListener, removeListener } = useContext(EventListenerContext);

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

		return () => {
			removeListener(listenerId);
		};
	}, [addListener, removeListener, enable, onNavigate]);

	return;
};
