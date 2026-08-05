import { Button } from "antd";
import type React from "react";
import { useState } from "react";
import { IconLabel } from "../iconLable";

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
				<span className="snow-command-label">
					<IconLabel icon={icon} label={label} />
				</span>
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
					min-height: 48px;
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
					height: 46px;
					min-width: 0;
					padding: 0 12px;
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

				.snow-command-label {
					display: block;
					min-width: 0;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				.snow-command-shortcut {
					display: flex;
					align-items: center;
					justify-content: flex-end;
					min-width: 0;
					padding: 0 10px 0 4px;
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
