import { theme } from "antd";
import { debounce } from "es-toolkit";
import React, {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
} from "react";
import { FormattedMessage } from "react-intl";
import {
	AppSettingsActionContext,
	AppSettingsPublisher,
} from "@/contexts/appSettingsActionContext";
import { useStateRef } from "@/hooks/useStateRef";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";

const ChangeDelaySecondsCore = () => {
	const { token } = theme.useToken();
	const [
		delayScreenshotSeconds,
		setDelayScreenshotSeconds,
		delayScreenshotSecondsRef,
	] = useStateRef(0);
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	useStateSubscriber(
		AppSettingsPublisher,
		useCallback(
			(settings: AppSettingsData) => {
				setDelayScreenshotSeconds(
					settings[AppSettingsGroup.Cache].delayScreenshotSeconds,
				);
			},
			[setDelayScreenshotSeconds],
		),
	);

	const saveAppSettings = useMemo(() => {
		return debounce(() => {
			updateAppSettings(
				AppSettingsGroup.Cache,
				{
					delayScreenshotSeconds: delayScreenshotSecondsRef.current,
				},
				true,
				true,
				true,
				true,
				false,
			);
		}, 512);
	}, [updateAppSettings, delayScreenshotSecondsRef]);

	const containerRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			event.stopPropagation();

			setDelayScreenshotSeconds(
				Math.max(
					0,
					Math.min(
						delayScreenshotSecondsRef.current + (event.deltaY > 0 ? -1 : 1),
						10,
					),
				),
			);
			saveAppSettings();
		};

		container.addEventListener("wheel", onWheel, { passive: false });

		return () => {
			container.removeEventListener("wheel", onWheel);
		};
	}, [delayScreenshotSecondsRef, setDelayScreenshotSeconds, saveAppSettings]);
	return (
		<div className="change-delay-seconds" ref={containerRef}>
			<FormattedMessage
				id="home.screenshotFunction.screenshotDelay.seconds"
				values={{ seconds: delayScreenshotSeconds }}
			/>
			<style jsx>
				{`
                    .change-delay-seconds {
                        display: inline-block;
                        position: relative;
                        cursor: row-resize;
                        touch-action: none;
                    }

                    .change-delay-seconds::after {
                        position: absolute;
                        content: '';
                        left: 0;
                        right: 0;
                        bottom: -2px;
                        height: 2px;
                        border-radius: 1px;
                        background-color: ${token.colorPrimaryHover};
                        opacity: 0;
                        transition: opacity ${token.motionDurationFast} ${token.motionEaseInOut};
                    }

                    .change-delay-seconds:hover::after {
                        opacity: 1;
                    }
                `}
			</style>
		</div>
	);
};

export const ChangeDelaySeconds = React.memo(ChangeDelaySecondsCore);
