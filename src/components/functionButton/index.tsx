import { Button } from "antd";
import type React from "react";
import { useState } from "react";

export const FunctionButton: React.FC<{
	label: React.ReactNode;
	icon?: React.ReactNode;
	onClick?: () => Promise<void>;
	children?: React.ReactNode;
}> = ({ label, icon, onClick, children }) => {
	const [loading, setLoading] = useState(false);

	return (
		<div className={`snow-command-row${children ? " has-shortcut" : ""}`}>
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

			<style jsx>{`
				.snow-command-row {
					display: grid;
					grid-template-columns: minmax(0, 1fr);
					align-items: center;
					min-width: 0;
					min-height: 56px;
					overflow: hidden;
					border: 1px solid var(--snow-shot-hairline-soft);
					border-radius: var(--snow-shot-radius);
					background: var(--snow-shot-surface-elevated);
					transition:
						background-color 0.16s ease,
						border-color 0.16s ease;
				}

				.snow-command-row.has-shortcut {
					grid-template-columns: minmax(0, 1fr) auto;
				}

				.snow-command-row:hover,
				.snow-command-row:focus-within {
					border-color: var(--snow-shot-hairline-strong);
					background: var(--snow-shot-surface-card);
				}

				.snow-command-row :global(.snow-command-action.ant-btn) {
					justify-content: flex-start;
					height: 54px;
					min-width: 0;
					overflow: hidden;
					padding: 0 16px;
					border: 0 !important;
					border-radius: 0 !important;
					background: transparent !important;
					box-shadow: none !important;
					text-align: left;
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
					width: 24px;
					font-size: 18px;
				}

				.snow-command-label {
					display: block;
					min-width: 0;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
					font-size: 15px;
					font-weight: 500;
				}

				.snow-command-shortcut {
					display: flex;
					align-items: center;
					justify-content: flex-end;
					min-width: 0;
					padding: 0 14px 0 8px;
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
