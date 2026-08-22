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
					scroll-margin-top: 72px;
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
					min-height: 80px;
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
					align-items: flex-start;
					justify-content: space-between;
					gap: 20px;
					width: 100%;
					min-width: 0;
					min-height: 80px;
					padding: 18px 24px;
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
					gap: 6px;
				}

				.settings-section-title {
					font-size: 18px;
					font-weight: 600;
					line-height: 26px;
				}

				.settings-section-description {
					color: var(--snow-shot-muted);
					font-size: 14px;
					line-height: 22px;
					max-width: 68ch;
					white-space: normal;
				}

				.settings-section-chevron {
					flex: 0 0 auto;
					margin-top: 4px;
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
					padding: 0 20px 0 8px;
				}

				.settings-section-body {
					padding: 28px 28px 10px;
					background: color-mix(
						in srgb,
						var(--snow-shot-surface) 94%,
						var(--snow-shot-ink)
					);
				}

				.settings-section-body[hidden] {
					display: none;
				}

				:global(.settings-section-body .ant-form) {
					width: 100%;
				}

				:global(.settings-section-body .ant-row) {
					row-gap: 6px;
				}

				:global(.settings-section-body .ant-col) {
					min-width: 0;
				}

				:global(.settings-section-body .ant-form-item) {
					margin-bottom: 22px;
				}

				:global(.settings-section-body .ant-form-item-label) {
					padding: 0 0 8px;
				}

				:global(.settings-section-body .ant-form-item-label > label),
				:global(.settings-section-body .ant-pro-form-item-label > label) {
					font-size: 15px;
					line-height: 22px;
				}

				:global(.settings-section-body .ant-form-item-extra),
				:global(.settings-section-body .ant-form-item-explain) {
					padding-top: 6px;
					font-size: 13px;
					line-height: 20px;
				}

				:global(.settings-section-body .ant-input),
				:global(.settings-section-body .ant-input-affix-wrapper),
				:global(.settings-section-body .ant-input-number),
				:global(.settings-section-body .ant-select-selector),
				:global(.settings-section-body .ant-picker),
				:global(.settings-section-body .ant-color-picker-trigger),
				:global(.settings-section-body .ant-btn) {
					min-height: 40px;
					border-radius: var(--snow-shot-radius);
				}

				:global(.settings-section-body .ant-select-single .ant-select-selector) {
					height: 40px;
				}

				:global(.settings-section-body .ant-radio-group) {
					display: flex;
					flex-wrap: wrap;
					gap: 8px 16px;
				}

				:global(.settings-section-body .ant-radio-wrapper) {
					min-height: 32px;
					margin-inline-end: 0;
					align-items: center;
				}

				@container snow-content (max-width: 680px) {
					.settings-section-body {
						padding: 20px 20px 6px;
					}

					:global(.settings-section-body .ant-form-horizontal .ant-form-item-row) {
						flex-direction: column;
						align-items: stretch;
						gap: 6px;
					}

					:global(.settings-section-body .ant-form-horizontal .ant-form-item-label),
					:global(.settings-section-body .ant-form-horizontal .ant-form-item-control) {
						flex: 0 0 100% !important;
						max-width: 100% !important;
						min-width: 0;
					}

					:global(.settings-section-body .ant-form-horizontal .ant-form-item-label) {
						padding: 0 0 2px;
						text-align: left;
					}
				}

				@container snow-content (max-width: 520px) {
					.settings-section-toggle {
						gap: 12px;
						padding: 14px 16px;
					}

					.settings-section-header {
						min-height: 64px;
					}

					.settings-section-toggle {
						min-height: 64px;
					}

					.settings-section-title {
						font-size: 16px;
						line-height: 22px;
					}

					.settings-section-extra {
						padding-right: 12px;
					}

					.settings-section-body {
						padding: 18px 16px 4px;
					}
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
