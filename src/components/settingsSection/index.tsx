import { DownOutlined } from "@ant-design/icons";
import type React from "react";
import { useEffect, useState } from "react";
import {
	getSettingsSectionPanelId,
	REVEAL_SETTINGS_SECTION_EVENT,
	type RevealSettingsSectionDetail,
	useSettingsWorkspace,
} from "@/components/settingsWorkspace";

export { revealSettingsSection } from "@/components/settingsWorkspace";

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
	const workspace = useSettingsWorkspace();
	const isWorkspacePanel = workspace !== null;
	const isOpen = isWorkspacePanel
		? workspace.activeSectionId === sectionId
		: open;
	const panelId = getSettingsSectionPanelId(sectionId);
	const titleId = `${sectionId}-settings-title`;

	useEffect(() => {
		if (isWorkspacePanel) {
			return;
		}

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
	}, [isWorkspacePanel, sectionId]);

	const sectionCopy = (
		<span className="settings-section-copy">
			<span className="settings-section-title">{title}</span>
			{description && (
				<span className="settings-section-description">{description}</span>
			)}
		</span>
	);

	return (
		<section
			className={`settings-section${
				!isWorkspacePanel && open ? " is-open" : ""
			}${isWorkspacePanel ? " settings-section--workspace" : ""}`}
			id={sectionId}
			aria-labelledby={isWorkspacePanel ? titleId : undefined}
			hidden={isWorkspacePanel && !isOpen}
		>
			<header className="settings-section-header">
				<h2 className="settings-section-heading" id={titleId}>
					{isWorkspacePanel ? (
						<span className="settings-section-static-copy">{sectionCopy}</span>
					) : (
						<button
							type="button"
							className="settings-section-toggle"
							aria-expanded={open}
							aria-controls={panelId}
							onClick={() => setOpen((value) => !value)}
						>
							{sectionCopy}
							<DownOutlined
								aria-hidden="true"
								className="settings-section-chevron"
							/>
						</button>
					)}
				</h2>
				{extra && <div className="settings-section-extra">{extra}</div>}
			</header>

			<section
				className="settings-section-body"
				id={panelId}
				aria-labelledby={titleId}
				hidden={!isOpen}
			>
				{children}
			</section>

			<style jsx global>{`
				.settings-section {
					scroll-margin-top: 64px;
					overflow: hidden;
					border: 1px solid var(--snow-shot-hairline-soft);
					border-radius: var(--snow-shot-radius-sm);
					background: var(--snow-shot-surface);
					box-shadow: none;
				}

				.settings-section--workspace {
					overflow: visible;
					border: 0;
					border-radius: 0;
					background: transparent;
				}

				.settings-section-header {
					position: relative;
					display: grid;
					grid-template-columns: minmax(0, 1fr) auto;
					align-items: center;
					min-height: 56px;
					border-bottom: 1px solid transparent;
					transition-property: background-color, border-color;
					transition-duration: var(--snow-shot-motion-fast);
					transition-timing-function: ease;
				}

				.settings-section-header::before {
					position: absolute;
					inset-block: 0;
					inset-inline-start: 0;
					width: 2px;
					background: var(--snow-shot-primary);
					content: "";
					opacity: 0;
					pointer-events: none;
					transition: opacity var(--snow-shot-motion-fast) ease;
				}

				.settings-section-header:hover,
				.settings-section-header:focus-within {
					background: var(--snow-shot-surface-elevated);
				}

				.settings-section-header:hover::before,
				.settings-section-header:focus-within::before {
					opacity: 0.68;
				}

				.settings-section--workspace .settings-section-header,
				.settings-section--workspace .settings-section-header:hover,
				.settings-section--workspace .settings-section-header:focus-within {
					min-height: 52px;
					border-bottom-color: var(--snow-shot-hairline-soft);
					background: transparent;
				}

				.settings-section--workspace .settings-section-header::before {
					display: none;
				}

				.settings-section-heading {
					min-width: 0;
					margin: 0;
					font: inherit;
				}

				.settings-section-static-copy {
					display: flex;
					width: 100%;
					min-width: 0;
					flex-direction: column;
					gap: 2px;
					padding: 8px 0;
				}

				.settings-section.is-open .settings-section-header {
					border-bottom-color: var(--snow-shot-hairline-soft);
					background: var(--snow-shot-surface-elevated);
				}

				.settings-section.is-open .settings-section-header::before {
					opacity: 1;
				}

				.settings-section.is-open .settings-section-header:hover,
				.settings-section.is-open .settings-section-header:focus-within {
					background: var(--snow-shot-surface-card);
				}

				.settings-section-toggle {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 14px;
					width: 100%;
					min-width: 0;
					min-height: 56px;
					padding: 8px 16px;
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
					outline: 2px solid var(--snow-shot-primary-strong);
					outline-offset: -2px;
				}

				.settings-section-copy {
					display: flex;
					min-width: 0;
					flex-direction: column;
					gap: 2px;
				}

				.settings-section-title {
					display: block;
					overflow: hidden;
					font-size: 16px;
					font-weight: 600;
					line-height: 20px;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				.settings-section-description {
					display: block;
					max-width: 100%;
					overflow: hidden;
					color: var(--snow-shot-muted);
					font-size: 13px;
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
					flex: 0 0 auto;
					align-items: center;
					padding-block: 0;
					padding-inline: 8px 14px;
				}

				.settings-section--workspace .settings-section-extra {
					padding-inline-end: 0;
				}

				.settings-section-body {
					padding: 20px 20px 6px;
					background: var(--snow-shot-surface);
				}

				.settings-section--workspace .settings-section-body {
					padding: 20px 0 6px;
					background: transparent;
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
					margin-bottom: 18px;
				}

				:global(.settings-section-body .ant-form-item-label) {
					padding: 0 0 8px;
				}

				:global(.settings-section-body .ant-form-item-label > label),
				:global(.settings-section-body .ant-pro-form-item-label > label) {
					font-size: 14px;
					line-height: 21px;
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
				:global(.settings-section-body .ant-color-picker-trigger) {
					min-height: 36px;
					border-radius: var(--snow-shot-radius);
				}

				/* Keyboard capture uses deliberately small keycaps. Do not let the
				   generic field-action sizing stretch them and break row alignment. */
				:global(.settings-section-body .ant-btn:not(.snow-keycap-button)) {
					min-height: 36px;
					border-radius: var(--snow-shot-radius);
				}

				:global(.settings-section-body .ant-select-single .ant-select-selector) {
					height: 36px;
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

				@container snow-content (max-width: 880px) {
					.settings-section-body {
						padding: 18px 18px 6px;
					}
				}

				@container snow-content (max-width: 520px) {
					.settings-section-toggle {
						gap: 12px;
						padding-inline: 14px;
					}

					.settings-section-header {
						min-height: 56px;
					}

					.settings-section-toggle {
						min-height: 56px;
					}

					.settings-section-title {
						font-size: 16px;
						line-height: 20px;
					}

					.settings-section-extra {
						padding-inline-end: 12px;
					}

					.settings-section-body {
						padding: 16px 16px 6px;
					}
				}

				@media (prefers-reduced-motion: reduce) {
					.settings-section-header,
					.settings-section-header::before,
					.settings-section-chevron {
						transition: none;
					}
				}
			`}</style>
		</section>
	);
};
