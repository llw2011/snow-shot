import { Button } from "antd";
import type React from "react";
import { useState } from "react";

export const FunctionButton: React.FC<{
	label: React.ReactNode;
	icon?: React.ReactNode;
	onClick?: () => Promise<void>;
	children?: React.ReactNode;
	variant?: "standard" | "primary" | "compact";
}> = ({ label, icon, onClick, children, variant = "standard" }) => {
	const [loading, setLoading] = useState(false);

	return (
		<div
			className={`snow-command-row snow-command-row--${variant}${children ? " has-shortcut" : ""}`}
		>
			<Button
				className="snow-command-button snow-command-action"
				loading={loading}
				icon={icon}
				block
				onClick={async () => {
					setLoading(true);
					try {
						await onClick?.();
					} finally {
						setLoading(false);
					}
				}}
			>
				<span className="snow-command-label">{label}</span>
			</Button>

			{children && (
				<div
					className="snow-command-shortcut"
					onClick={(event) => event.stopPropagation()}
				>
					{children}
				</div>
			)}

			<style jsx global>{`
				.snow-command-row {
					position: relative;
					display: grid;
					grid-template-columns: minmax(0, 1fr);
					align-items: center;
					min-width: 0;
					min-height: 52px;
					overflow: hidden;
					border: 1px solid var(--snow-shot-hairline);
					border-inline-start: 3px solid transparent;
					border-radius: var(--snow-shot-radius);
					background: var(--snow-shot-surface);
					box-shadow: inset 0 1px 0
						color-mix(in srgb, var(--snow-shot-ink) 3%, transparent);
					transition:
						background-color 0.16s ease,
						border-color 0.16s ease,
						box-shadow 0.16s ease;
				}

				.snow-command-row--primary {
					min-height: 64px;
					border-color: var(--snow-shot-primary);
					border-inline-start-color: var(--snow-shot-primary);
					border-inline-start-width: 4px;
					background: var(--snow-shot-primary);
					color: var(--snow-shot-canvas);
				}

				.snow-command-row--compact {
					min-height: 48px;
				}

				.snow-command-row.has-shortcut {
					grid-template-columns: minmax(0, 1fr) auto;
				}

				.snow-command-row:hover,
				.snow-command-row:focus-within {
					border-color: var(--snow-shot-primary-strong);
					border-inline-start-color: var(--snow-shot-primary);
					background: var(--snow-shot-surface-elevated);
				}

				.snow-command-row--primary:hover,
				.snow-command-row--primary:focus-within {
					border-color: var(--snow-shot-ink);
					border-inline-start-color: var(--snow-shot-ink);
					background: var(--snow-shot-ink);
				}

				.snow-command-row:focus-within::after {
					content: "";
					position: absolute;
					inset: 1px;
					z-index: 2;
					border: 2px solid var(--snow-shot-primary);
					border-radius: var(--snow-shot-radius-sm);
					pointer-events: none;
				}

				.snow-command-row--primary:focus-within::after {
					border-color: var(--snow-shot-canvas);
				}

				.snow-command-row :global(.snow-command-action.ant-btn) {
					justify-content: flex-start;
					height: 50px;
					min-width: 0;
					overflow: hidden;
					padding: 0 14px 0 12px;
					border: 0 !important;
					border-radius: 0 !important;
					background: transparent !important;
					box-shadow: none !important;
					text-align: left;
				}

				.snow-command-row--primary :global(.snow-command-action.ant-btn) {
					color: var(--snow-shot-canvas) !important;
				}

				.snow-command-row--primary
					:global(.snow-command-action.ant-btn:focus-visible) {
					outline-color: var(--snow-shot-canvas) !important;
				}

				.snow-command-row--primary :global(.snow-command-action.ant-btn) {
					height: 62px;
					padding-inline: 16px;
				}

				.snow-command-row--compact :global(.snow-command-action.ant-btn) {
					height: 46px;
					padding-inline: 10px;
				}

				.snow-command-row :global(.snow-command-action.ant-btn:hover),
				.snow-command-row :global(.snow-command-action.ant-btn:focus-visible) {
					background: transparent !important;
				}

				.snow-command-row :global(.snow-command-action .ant-btn-icon) {
					display: inline-flex;
					flex: 0 0 auto;
					align-items: center;
					justify-content: center;
					width: 22px;
					color: var(--snow-shot-muted);
					font-size: 16px;
				}

				.snow-command-row--primary
					:global(.snow-command-action .ant-btn-icon) {
					color: var(--snow-shot-canvas);
				}

				.snow-command-label {
					display: block;
					min-width: 0;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
					font-size: 14px;
					font-weight: 600;
				}

				.snow-command-row--primary .snow-command-label {
					font-size: 16px;
				}

				.snow-command-row--compact .snow-command-label {
					font-weight: 500;
				}

				.snow-command-shortcut {
					display: flex;
					align-items: center;
					justify-content: flex-end;
					min-width: 0;
					min-height: 34px;
					padding: 0 10px;
					border-inline-start: 1px solid var(--snow-shot-hairline-soft);
					background: color-mix(
						in srgb,
						var(--snow-shot-canvas) 20%,
						transparent
					);
				}

				.snow-command-row--primary .snow-command-shortcut {
					border-inline-start-color: color-mix(
						in srgb,
						var(--snow-shot-canvas) 34%,
						transparent
					);
					background: color-mix(
						in srgb,
						var(--snow-shot-canvas) 8%,
						transparent
					);
				}

				.snow-command-row--compact .snow-command-shortcut {
					min-height: 32px;
					padding-inline: 8px;
				}

				@media (prefers-reduced-motion: reduce) {
					.snow-command-row {
						transition: none;
					}
				}
			`}</style>
		</div>
	);
};
