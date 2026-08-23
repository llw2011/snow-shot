import {
	currentMonitor,
	getCurrentWindow,
	LogicalSize,
	PhysicalPosition,
	primaryMonitor,
} from "@tauri-apps/api/window";
import { Button, Tooltip } from "antd";
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useIntl } from "react-intl";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { AppSettingsGroup, MainWindowSizeTier } from "@/types/appSettings";
import { appError } from "@/utils/log";
import {
	getAvailableMainWindowSizeTiers,
	getClampedMainWindowPosition,
	getMainWindowMonitorKey,
	getResponsiveMainWindowSizeTier,
	MAIN_WINDOW_SIZE_PRESETS,
	MAIN_WINDOW_SIZE_TIERS,
} from "@/utils/mainWindowSize";

const TIER_LABELS: Record<MainWindowSizeTier, string> = {
	[MainWindowSizeTier.Compact]: "S",
	[MainWindowSizeTier.Standard]: "M",
	[MainWindowSizeTier.Large]: "L",
};

const getActiveMonitor = async () =>
	(await currentMonitor()) ?? primaryMonitor();

export const MainWindowSizeControl = () => {
	const intl = useIntl();
	const appWindow = useMemo(() => getCurrentWindow(), []);
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const preferredTierRef = useRef(MainWindowSizeTier.Large);
	const monitorKeyRef = useRef("");
	const applySequenceRef = useRef(0);
	const applyQueueRef = useRef<Promise<void>>(Promise.resolve());
	const [appliedTier, setAppliedTier] = useState(MainWindowSizeTier.Large);
	const [availableTiers, setAvailableTiers] = useState<MainWindowSizeTier[]>([
		...MAIN_WINDOW_SIZE_TIERS,
	]);

	const applyPreferredTier = useCallback(
		(preferredTier: MainWindowSizeTier) => {
			const sequence = ++applySequenceRef.current;
			const run = async () => {
				if (sequence !== applySequenceRef.current) {
					return;
				}

				const monitor = await getActiveMonitor();
				if (sequence !== applySequenceRef.current) {
					return;
				}

				const nextAvailableTiers = getAvailableMainWindowSizeTiers(monitor);
				const nextTier = getResponsiveMainWindowSizeTier(
					preferredTier,
					monitor,
				);
				const preset = MAIN_WINDOW_SIZE_PRESETS[nextTier];
				await appWindow.setSize(new LogicalSize(preset.width, preset.height));
				if (sequence !== applySequenceRef.current) {
					return;
				}

				if (monitor) {
					const [position, windowSize] = await Promise.all([
						appWindow.outerPosition(),
						appWindow.outerSize(),
					]);
					if (sequence !== applySequenceRef.current) {
						return;
					}

					const clampedPosition = getClampedMainWindowPosition(
						monitor,
						position,
						windowSize,
					);
					if (
						clampedPosition.x !== position.x ||
						clampedPosition.y !== position.y
					) {
						await appWindow.setPosition(
							new PhysicalPosition(clampedPosition.x, clampedPosition.y),
						);
						if (sequence !== applySequenceRef.current) {
							return;
						}
					}
				}

				monitorKeyRef.current = getMainWindowMonitorKey(monitor);
				setAvailableTiers(nextAvailableTiers);
				setAppliedTier(nextTier);
			};

			const queued = applyQueueRef.current.catch(() => undefined).then(run);
			applyQueueRef.current = queued;
			return queued;
		},
		[appWindow],
	);

	useAppSettingsLoad(
		useCallback(
			(settings, previousSettings) => {
				const preferredTier =
					settings[AppSettingsGroup.Common].mainWindowSizeTier;
				preferredTierRef.current = preferredTier;
				if (
					previousSettings?.[AppSettingsGroup.Common].mainWindowSizeTier ===
					preferredTier
				) {
					return;
				}

				applyPreferredTier(preferredTier).catch((error) => {
					appError("[MainWindowSizeControl] apply window size failed", error);
				});
			},
			[applyPreferredTier],
		),
		true,
	);

	useEffect(() => {
		let disposed = false;
		const unlisteners: Array<() => void> = [];

		const refreshForEnvironment = async (force: boolean) => {
			const monitor = await getActiveMonitor();
			if (
				disposed ||
				(!force && getMainWindowMonitorKey(monitor) === monitorKeyRef.current)
			) {
				return;
			}

			await applyPreferredTier(preferredTierRef.current);
		};

		const register = (listener: Promise<() => void>, errorMessage: string) => {
			listener
				.then((unlisten) => {
					if (disposed) {
						unlisten();
						return;
					}
					unlisteners.push(unlisten);
				})
				.catch((error) => {
					appError(errorMessage, error);
				});
		};

		register(
			appWindow.onMoved(() => {
				refreshForEnvironment(false).catch((error) => {
					appError(
						"[MainWindowSizeControl] refresh moved window failed",
						error,
					);
				});
			}),
			"[MainWindowSizeControl] listen window move failed",
		);
		register(
			appWindow.onScaleChanged(() => {
				refreshForEnvironment(true).catch((error) => {
					appError("[MainWindowSizeControl] refresh scale failed", error);
				});
			}),
			"[MainWindowSizeControl] listen scale change failed",
		);
		register(
			appWindow.onFocusChanged(({ payload: focused }) => {
				if (focused) {
					refreshForEnvironment(true).catch((error) => {
						appError("[MainWindowSizeControl] refresh focus failed", error);
					});
				}
			}),
			"[MainWindowSizeControl] listen focus change failed",
		);

		refreshForEnvironment(true).catch((error) => {
			appError("[MainWindowSizeControl] initial resize failed", error);
		});

		return () => {
			disposed = true;
			for (const unlisten of unlisteners) {
				unlisten();
			}
		};
	}, [appWindow, applyPreferredTier]);

	const selectTier = useCallback(
		(tier: MainWindowSizeTier) => {
			if (!availableTiers.includes(tier)) {
				return;
			}

			preferredTierRef.current = tier;
			updateAppSettings(
				AppSettingsGroup.Common,
				{ mainWindowSizeTier: tier },
				false,
				true,
				true,
			);
		},
		[availableTiers, updateAppSettings],
	);

	return (
		<fieldset
			className="window-size-control"
			aria-label={intl.formatMessage({ id: "window.size.control" })}
		>
			{MAIN_WINDOW_SIZE_TIERS.map((tier) => {
				const unavailable = !availableTiers.includes(tier);
				const preset = MAIN_WINDOW_SIZE_PRESETS[tier];
				const title = intl.formatMessage(
					{ id: `window.size.${tier}` },
					{ width: preset.width, height: preset.height },
				);

				return (
					<Tooltip
						key={tier}
						title={
							unavailable
								? `${title} · ${intl.formatMessage({ id: "window.size.unavailable" })}`
								: title
						}
					>
						<span>
							<Button
								type="text"
								size="small"
								disabled={unavailable}
								className={appliedTier === tier ? "is-active" : ""}
								aria-label={title}
								aria-pressed={appliedTier === tier}
								onClick={() => selectTier(tier)}
							>
								{TIER_LABELS[tier]}
							</Button>
						</span>
					</Tooltip>
				);
			})}

			<style jsx global>{`
				.window-size-control {
					display: inline-flex;
					align-items: center;
					min-width: 0;
					margin: 0;
					padding: 0;
					overflow: hidden;
					border: 1px solid var(--snow-shot-hairline);
					border-radius: var(--snow-shot-radius-sm);
					background: var(--snow-shot-surface);
				}

				.window-size-control > span {
					display: flex;
				}

				.window-size-control .ant-btn {
					width: 28px;
					height: 28px;
					padding: 0;
					border: 0;
					border-inline-end: 1px solid var(--snow-shot-hairline-soft);
					border-radius: 0;
					color: var(--snow-shot-muted);
					font-size: 13px;
					font-weight: 600;
				}

				.window-size-control > span:last-child .ant-btn {
					border-inline-end: 0;
				}

				.window-size-control .ant-btn.is-active {
					background: var(--snow-shot-ink);
					color: var(--snow-shot-canvas);
				}

				.window-size-control .ant-btn:not(:disabled):hover {
					background: var(--snow-shot-surface-elevated);
					color: var(--snow-shot-ink);
				}

				.window-size-control .ant-btn.is-active:not(:disabled):hover {
					background: var(--snow-shot-ink);
					color: var(--snow-shot-canvas);
				}
			`}</style>
		</fieldset>
	);
};
