import { CheckOutlined } from "@ant-design/icons";
import type { CSSProperties } from "react";
import { useIntl } from "react-intl";
import {
	APP_THEME_PRESET_ORDER,
	getAppThemeRuntime,
} from "@/constants/themePresets";
import { type AppSettingsTheme, AppThemePreset } from "@/types/appSettings";

type ThemePresetSelectorProps = {
	value?: AppThemePreset;
	mode: AppSettingsTheme;
	disabled?: boolean;
	onChange?: (value: AppThemePreset) => void;
};

export const ThemePresetSelector = ({
	value = AppThemePreset.Obsidian,
	mode,
	disabled,
	onChange,
}: ThemePresetSelectorProps) => {
	const intl = useIntl();

	return (
		<fieldset className="theme-preset-selector" disabled={disabled}>
			<legend className="theme-preset-legend">
				{intl.formatMessage({ id: "appearance.themePreset.title" })}
			</legend>
			{APP_THEME_PRESET_ORDER.map((preset) => {
				const runtime = getAppThemeRuntime(preset, mode);
				const selected = value === preset;
				const name = intl.formatMessage({
					id: `appearance.themePreset.${preset}.name`,
				});
				const description = intl.formatMessage({
					id: `appearance.themePreset.${preset}.description`,
				});
				const previewStyle = {
					"--preview-canvas": runtime.palette.canvas,
					"--preview-surface": runtime.palette.surface,
					"--preview-elevated": runtime.palette.surfaceElevated,
					"--preview-card": runtime.palette.surfaceCard,
					"--preview-border": runtime.palette.hairline,
					"--preview-border-strong": runtime.palette.hairlineStrong,
					"--preview-ink": runtime.palette.ink,
					"--preview-body": runtime.palette.body,
					"--preview-muted": runtime.palette.muted,
					"--preview-accent": runtime.recommendedAccent,
					"--preview-alt-one": runtime.visuals.accentAltOne,
					"--preview-alt-two": runtime.visuals.accentAltTwo,
					"--preview-alt-three": runtime.visuals.accentAltThree,
					"--preview-atmosphere": runtime.visuals.atmosphere,
					"--preview-pattern": runtime.visuals.pattern,
					"--preview-pattern-size": runtime.visuals.patternSize,
					"--preview-panel": runtime.visuals.panelBackground,
					"--preview-logo": runtime.visuals.logoBackground,
					"--preview-shadow": runtime.visuals.cardShadow,
				} as CSSProperties;

				return (
					<button
						type="button"
						className={`theme-preset-card${selected ? " is-selected" : ""}`}
						key={preset}
						style={previewStyle}
						aria-pressed={selected}
						aria-label={`${name}。${description}`}
						disabled={disabled}
						onClick={() => onChange?.(preset)}
					>
						<span className="theme-preview-window" aria-hidden="true">
							<span className="theme-preview-sider">
								<span className="theme-preview-logo" />
								<span className="theme-preview-nav is-active" />
								<span className="theme-preview-nav" />
								<span className="theme-preview-nav is-short" />
							</span>
							<span className="theme-preview-main">
								<span className="theme-preview-header">
									<span />
									<span />
								</span>
								<span className="theme-preview-panel">
									<span className="theme-preview-title" />
									<span className="theme-preview-command is-primary">
										<span className="theme-preview-command-icon" />
										<span className="theme-preview-command-label" />
										<span className="theme-preview-keycap">F1</span>
									</span>
									<span className="theme-preview-command">
										<span className="theme-preview-command-icon" />
										<span className="theme-preview-command-label is-short" />
										<span className="theme-preview-keycap">⌘</span>
									</span>
								</span>
							</span>
						</span>

						<span className="theme-preset-meta">
							<span className="theme-preset-heading">
								<span className="theme-preset-name">{name}</span>
								{selected && (
									<span className="theme-preset-active">
										<CheckOutlined />
										{intl.formatMessage({
											id: "appearance.themePreset.active",
										})}
									</span>
								)}
							</span>
							<span className="theme-preset-description">{description}</span>
							<span className="theme-preset-swatches" aria-hidden="true">
								<span />
								<span />
								<span />
								<span />
							</span>
						</span>
					</button>
				);
			})}

			<style jsx>{`
                .theme-preset-selector {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 12px;
                    width: 100%;
                    min-width: 0;
                    margin: 0;
                    padding: 0;
                    border: 0;
                }

                .theme-preset-legend {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    overflow: hidden;
                    clip: rect(0 0 0 0);
                    clip-path: inset(50%);
                    white-space: nowrap;
                }

                .theme-preset-card {
                    appearance: none;
                    min-width: 0;
                    padding: 8px;
                    border: 1px solid var(--snow-shot-hairline);
                    border-radius: var(--snow-shot-radius-lg);
                    background: var(--snow-shot-surface-elevated);
                    color: var(--snow-shot-ink);
                    text-align: left;
                    cursor: pointer;
                    box-shadow: none;
                    transition:
                        transform 0.16s ease,
                        border-color 0.16s ease,
                        box-shadow 0.16s ease,
                        background-color 0.16s ease;
                }

                .theme-preset-card:hover:not(:disabled) {
                    transform: translateY(-2px);
                    border-color: var(--preview-border-strong);
                    box-shadow: var(--preview-shadow);
                }

                .theme-preset-card:focus-visible {
                    outline: 2px solid var(--preview-accent);
                    outline-offset: 2px;
                }

                .theme-preset-card.is-selected {
                    border-color: var(--preview-accent);
                    background: var(--snow-shot-surface-card);
                    box-shadow:
                        0 0 0 1px var(--preview-accent),
                        0 10px 28px color-mix(in srgb, var(--preview-accent) 16%, transparent);
                }

                .theme-preset-card:disabled {
                    cursor: wait;
                    opacity: 0.62;
                }

                .theme-preview-window {
                    position: relative;
                    display: grid;
                    grid-template-columns: 28% 72%;
                    width: 100%;
                    height: 106px;
                    overflow: hidden;
                    border: 1px solid var(--preview-border);
                    border-radius: calc(var(--snow-shot-radius) + 2px);
                    background:
                        var(--preview-pattern),
                        var(--preview-atmosphere),
                        var(--preview-canvas);
                    background-size:
                        var(--preview-pattern-size),
                        auto,
                        auto;
                    box-shadow: var(--preview-shadow);
                }

                .theme-preview-sider {
                    display: flex;
                    flex-direction: column;
                    gap: 7px;
                    padding: 10px 7px;
                    border-right: 1px solid var(--preview-border);
                    background: color-mix(in srgb, var(--preview-canvas) 84%, transparent);
                }

                .theme-preview-logo {
                    width: 17px;
                    height: 17px;
                    margin-bottom: 6px;
                    border: 1px solid var(--preview-border-strong);
                    border-radius: 5px;
                    background: var(--preview-logo);
                }

                .theme-preview-nav {
                    display: block;
                    width: 100%;
                    height: 6px;
                    border-radius: 999px;
                    background: color-mix(in srgb, var(--preview-muted) 48%, transparent);
                }

                .theme-preview-nav.is-active {
                    height: 9px;
                    background: color-mix(in srgb, var(--preview-accent) 34%, var(--preview-card));
                    box-shadow: inset 2px 0 0 var(--preview-accent);
                }

                .theme-preview-nav.is-short {
                    width: 68%;
                }

                .theme-preview-main {
                    display: grid;
                    grid-template-rows: 18px minmax(0, 1fr);
                    min-width: 0;
                }

                .theme-preview-header {
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    gap: 3px;
                    padding-right: 7px;
                    border-bottom: 1px solid var(--preview-border);
                    background: color-mix(in srgb, var(--preview-canvas) 78%, transparent);
                }

                .theme-preview-header span {
                    width: 4px;
                    height: 4px;
                    border-radius: 999px;
                    background: var(--preview-muted);
                }

                .theme-preview-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    margin: 6px;
                    padding: 7px;
                    border: 1px solid var(--preview-border);
                    border-radius: 7px;
                    background: var(--preview-panel);
                }

                .theme-preview-title {
                    width: 44%;
                    height: 5px;
                    margin-bottom: 1px;
                    border-radius: 999px;
                    background: var(--preview-ink);
                    opacity: 0.86;
                }

                .theme-preview-command {
                    display: grid;
                    grid-template-columns: 11px 1fr auto;
                    align-items: center;
                    gap: 5px;
                    height: 19px;
                    padding: 0 4px;
                    border: 1px solid var(--preview-border);
                    border-radius: 5px;
                    background: var(--preview-surface);
                }

                .theme-preview-command.is-primary {
                    border-color: var(--preview-border-strong);
                    background: var(--preview-elevated);
                }

                .theme-preview-command-icon {
                    width: 7px;
                    height: 7px;
                    border-radius: 2px;
                    background: var(--preview-accent);
                }

                .theme-preview-command:nth-child(3) .theme-preview-command-icon {
                    background: var(--preview-alt-three);
                }

                .theme-preview-command-label {
                    width: 66%;
                    height: 4px;
                    border-radius: 999px;
                    background: var(--preview-body);
                    opacity: 0.78;
                }

                .theme-preview-command-label.is-short {
                    width: 48%;
                }

                .theme-preview-keycap {
                    min-width: 17px;
                    padding: 1px 3px;
                    border: 1px solid var(--preview-border-strong);
                    border-radius: 3px;
                    color: var(--preview-body);
                    font-size: 7px;
                    line-height: 9px;
                    text-align: center;
                }

                .theme-preset-meta {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                    padding: 9px 2px 2px;
                }

                .theme-preset-heading {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 6px;
                }

                .theme-preset-name {
                    overflow: hidden;
                    color: var(--snow-shot-ink);
                    font-size: 13px;
                    font-weight: 650;
                    line-height: 18px;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .theme-preset-active {
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                    flex: 0 0 auto;
                    color: var(--preview-accent);
                    font-size: 10px;
                    font-weight: 650;
                    line-height: 16px;
                }

                .theme-preset-description {
                    display: -webkit-box;
                    min-height: 34px;
                    overflow: hidden;
                    color: var(--snow-shot-muted);
                    font-size: 11px;
                    line-height: 17px;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2;
                }

                .theme-preset-swatches {
                    display: flex;
                    gap: 4px;
                    padding-top: 2px;
                }

                .theme-preset-swatches span {
                    width: 14px;
                    height: 4px;
                    border-radius: 999px;
                    background: var(--preview-accent);
                }

                .theme-preset-swatches span:nth-child(2) {
                    background: var(--preview-alt-one);
                }

                .theme-preset-swatches span:nth-child(3) {
                    background: var(--preview-alt-two);
                }

                .theme-preset-swatches span:nth-child(4) {
                    background: var(--preview-alt-three);
                }

                @media (max-width: 980px) {
                    .theme-preset-selector {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                }

                @media (max-width: 620px) {
                    .theme-preset-selector {
                        grid-template-columns: minmax(0, 1fr);
                    }
                }
            `}</style>
		</fieldset>
	);
};
