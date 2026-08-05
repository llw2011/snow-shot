import { DownOutlined } from "@ant-design/icons";
import type React from "react";
import { useEffect, useState } from "react";

const REVEAL_SETTINGS_SECTION_EVENT = "snow-shot:reveal-settings-section";

type RevealSettingsSectionDetail = {
	id: string;
};

export const revealSettingsSection = (id: string) => {
	window.dispatchEvent(
		new CustomEvent<RevealSettingsSectionDetail>(
			REVEAL_SETTINGS_SECTION_EVENT,
			{
				detail: { id },
			},
		),
	);
};

export const SettingsSection: React.FC<{
	sectionId: string;
	title: React.ReactNode;
	children: React.ReactNode;
	extra?: React.ReactNode;
	description?: React.ReactNode;
	defaultOpen?: boolean;
}> = ({
	sectionId,
	title,
	children,
	extra,
	description,
	defaultOpen = false,
}) => {
	const [open, setOpen] = useState(defaultOpen);
	const panelId = `${sectionId}-settings-panel`;
	const titleId = `${sectionId}-settings-title`;

	useEffect(() => {
		const reveal = (event: Event) => {
			const detail = (event as CustomEvent<RevealSettingsSectionDetail>).detail;
			if (detail?.id === sectionId) {
				setOpen(true);
			}
		};

		window.addEventListener(REVEAL_SETTINGS_SECTION_EVENT, reveal);
		return () => {
			window.removeEventListener(REVEAL_SETTINGS_SECTION_EVENT, reveal);
		};
	}, [sectionId]);

	return (
		<section
			className={`settings-section${open ? " is-open" : ""}`}
			id={sectionId}
		>
			<header className="settings-section-header">
				<h2 className="settings-section-heading" id={titleId}>
					<button
						type="button"
						className="settings-section-toggle"
						aria-expanded={open}
						aria-controls={panelId}
						onClick={() => setOpen((value) => !value)}
					>
						<span className="settings-section-copy">
							<span className="settings-section-title">{title}</span>
							{description && (
								<span className="settings-section-description">
									{description}
								</span>
							)}
						</span>
						<DownOutlined className="settings-section-chevron" />
					</button>
				</h2>
				{extra && <div className="settings-section-extra">{extra}</div>}
			</header>

			<section
				className="settings-section-body"
				id={panelId}
				aria-labelledby={titleId}
				hidden={!open}
			>
				{children}
			</section>

			<style jsx>{`
				.settings-section {
					scroll-margin-top: 58px;
					overflow: hidden;
					border: 1px solid var(--snow-shot-hairline-soft);
					border-radius: var(--snow-shot-radius-lg);
					background: var(--snow-shot-surface);
					box-shadow: var(--snow-shot-card-shadow);
				}

				.settings-section-header {
					display: grid;
					grid-template-columns: minmax(0, 1fr) auto;
					align-items: center;
					min-height: 56px;
					transition-property: background-color;
					transition-duration: var(--snow-shot-motion-fast);
					transition-timing-function: ease;
				}

				.settings-section-header:hover,
				.settings-section-header:focus-within {
					background: var(--snow-shot-surface-elevated);
				}

				.settings-section-heading {
					min-width: 0;
					margin: 0;
					font: inherit;
				}

				.settings-section.is-open .settings-section-header {
					border-bottom: 1px solid var(--snow-shot-hairline-soft);
				}

				.settings-section-toggle {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 16px;
					width: 100%;
					min-width: 0;
					min-height: 56px;
					padding: 11px 16px;
					border: 0;
					background: transparent;
					color: var(--snow-shot-ink);
					font: inherit;
					text-align: left;
					cursor: pointer;
				}

				.settings-section-toggle:focus-visible {
					position: relative;
					z-index: 1;
					outline: 2px solid var(--snow-shot-primary);
					outline-offset: -3px;
				}

				.settings-section-copy {
					display: flex;
					min-width: 0;
					flex-direction: column;
					gap: 2px;
				}

				.settings-section-title {
					font-size: 15px;
					font-weight: 600;
					line-height: 22px;
				}

				.settings-section-description {
					overflow: hidden;
					color: var(--snow-shot-muted);
					font-size: 12px;
					line-height: 18px;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				.settings-section-chevron {
					flex: 0 0 auto;
					color: var(--snow-shot-muted);
					font-size: 12px;
					transition: transform 0.16s ease;
				}

				.settings-section.is-open .settings-section-chevron {
					transform: rotate(180deg);
				}

				.settings-section-extra {
					display: flex;
					align-items: center;
					padding-right: 12px;
				}

				.settings-section-body {
					padding: 18px 18px 2px;
				}

				.settings-section-body[hidden] {
					display: none;
				}

				@media (prefers-reduced-motion: reduce) {
					.settings-section-header,
					.settings-section-chevron {
						transition: none;
					}
				}
			`}</style>
		</section>
	);
};
