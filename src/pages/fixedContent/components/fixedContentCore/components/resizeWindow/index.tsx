import { getCurrentWindow } from "@tauri-apps/api/window";
import { throttle } from "es-toolkit";
import type React from "react";
import { useCallback, useContext, useEffect } from "react";
import { startResizeWindow } from "@/commands/core";
import { EventListenerContext } from "@/components/eventListener";
import { ResizeWindowSide } from "@/utils/types";

const SIDE_WIDTH = 5;

export const ResizeWindow: React.FC<{
	getAspectRatio: () => number;
	getMinWidth: () => number;
	getMaxWidth: () => number;
	onResize: (size: { width: number; height: number }) => void;
	disabled?: boolean;
}> = ({ getAspectRatio, getMinWidth, getMaxWidth, onResize, disabled }) => {
	const onSideMouseDown = useCallback(
		(event: React.MouseEvent<HTMLDivElement>, side: ResizeWindowSide) => {
			event.preventDefault();
			event.stopPropagation();

			if (disabled) {
				return;
			}

			startResizeWindow(side, getAspectRatio(), getMinWidth(), getMaxWidth());
		},
		[disabled, getAspectRatio, getMinWidth, getMaxWidth],
	);

	const { addListener, removeListener } = useContext(EventListenerContext);

	useEffect(() => {
		if (disabled) {
			return;
		}

		const onResizeThrottle = throttle(onResize, 1000 / 15);
		const windowLabel = getCurrentWindow().label;
		const listenerId = addListener(
			"resize-window-service:resize-window",
			(args) => {
				const payload = (
					args as {
						payload: {
							size: { width: number; height: number };
							label: string;
						};
					}
				).payload;

				if (payload.label !== windowLabel) {
					return;
				}

				onResizeThrottle(payload.size);
			},
		);

		return () => {
			removeListener(listenerId);
			onResizeThrottle.cancel();
		};
	}, [addListener, disabled, onResize, removeListener]);

	return (
		<div
			className={`resize-window-container ${
				disabled ? "resize-window-container-disabled" : ""
			}`}
		>
			<div
				className="resize-window-container-top"
				onMouseDown={(e) => onSideMouseDown(e, ResizeWindowSide.Top)}
			></div>
			<div
				className="resize-window-container-bottom"
				onMouseDown={(e) => onSideMouseDown(e, ResizeWindowSide.Bottom)}
			></div>
			<div
				className="resize-window-container-left"
				onMouseDown={(e) => onSideMouseDown(e, ResizeWindowSide.Left)}
			></div>
			<div
				className="resize-window-container-right"
				onMouseDown={(e) => onSideMouseDown(e, ResizeWindowSide.Right)}
			></div>

			<style jsx>{`
                .resize-window-container {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                }

                .resize-window-container > :global(div) {
                    pointer-events: auto;
                }

				.resize-window-container-disabled > :global(div) {
					pointer-events: none;
				}

                .resize-window-container-top {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: ${SIDE_WIDTH}px;
                    cursor: n-resize;
                }

                .resize-window-container-bottom {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: ${SIDE_WIDTH}px;
                    cursor: s-resize;
                }

                .resize-window-container-left {
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: ${SIDE_WIDTH}px;
                    cursor: w-resize;
                }

                .resize-window-container-right {
                    position: absolute;
                    right: 0;
                    top: 0;
                    bottom: 0;
                    width: ${SIDE_WIDTH}px;
                    cursor: e-resize;
                }
            `}</style>
		</div>
	);
};
