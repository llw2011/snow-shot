import type React from "react";

/**
 * A settings row that is not bound to a form field: a label, optional
 * secondary text, and a trailing control. Matches the Form.Item row grammar.
 */
export const SettingsLine: React.FC<{
	label: React.ReactNode;
	description?: React.ReactNode;
	hint?: React.ReactNode;
	control?: React.ReactNode;
	/** Put the control under the copy instead of beside it. */
	stacked?: boolean;
}> = ({ label, description, hint, control, stacked = false }) => {
	return (
		<div className={`settings-line${stacked ? " is-stacked" : ""}`}>
			<div className="settings-line-copy">
				<div className="settings-line-label">{label}</div>
				{description && (
					<div className="settings-line-description">{description}</div>
				)}
				{hint && <div className="settings-line-hint">{hint}</div>}
			</div>
			{control && <div className="settings-line-control">{control}</div>}
		</div>
	);
};
