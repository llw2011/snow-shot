import type React from "react";
import { useId } from "react";
import "./settingsGroup.css";

/**
 * One titled block of settings. Its children are usually a single antd form;
 * every Form.Item inside renders as a separated row (see settingsGroup.css).
 */
export const SettingsGroup: React.FC<{
	title?: React.ReactNode;
	description?: React.ReactNode;
	extra?: React.ReactNode;
	children: React.ReactNode;
	/** Render children as rows. Disable for custom content such as lists. */
	rows?: boolean;
	className?: string;
}> = ({ title, description, extra, children, rows = true, className }) => {
	const titleId = useId();
	const hasHeader = Boolean(title || extra);

	return (
		<section
			className={["settings-group", className].filter(Boolean).join(" ")}
			aria-labelledby={title ? titleId : undefined}
		>
			{hasHeader && (
				<header className="settings-group-header">
					<div className="settings-group-copy">
						{title && (
							<h3 className="settings-group-title" id={titleId}>
								{title}
							</h3>
						)}
						{description && (
							<p className="settings-group-description">{description}</p>
						)}
					</div>
					{extra && <div className="settings-group-extra">{extra}</div>}
				</header>
			)}
			<div
				className={["settings-group-body", rows ? "settings-rows" : undefined]
					.filter(Boolean)
					.join(" ")}
			>
				{children}
			</div>
		</section>
	);
};
