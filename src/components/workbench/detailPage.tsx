import { Link } from "@tanstack/react-router";
import type React from "react";
import { FormattedMessage } from "react-intl";
import { WorkbenchIcon, type WorkbenchIconName } from "./icons";
import { getWorkbenchItem } from "./registry";

/** A scrollable detail page: icon, title, description, actions, then content. */
export const DetailPage: React.FC<{
	icon: WorkbenchIconName;
	title: React.ReactNode;
	description?: React.ReactNode;
	actions?: React.ReactNode;
	children?: React.ReactNode;
}> = ({ icon, title, description, actions, children }) => (
	<div className="wb-page">
		<div className="wb-page-scroll snow-scroll">
			<div className="wb-page-inner">
				<header className="wb-page-header">
					<div className="wb-page-icon" aria-hidden="true">
						<WorkbenchIcon name={icon} size={22} />
					</div>
					<div className="wb-page-copy">
						<h1 className="wb-page-title">{title}</h1>
						{description && (
							<p className="wb-page-description">{description}</p>
						)}
					</div>
					{actions && <div className="wb-page-actions">{actions}</div>}
				</header>
				{children}
			</div>
		</div>
	</div>
);

/** A full-height tool (translation, chat, history) with a slim header. */
export const ToolPage: React.FC<{
	icon: WorkbenchIconName;
	title: React.ReactNode;
	actions?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}> = ({ icon, title, actions, children, className }) => (
	<div className={["wb-tool", className].filter(Boolean).join(" ")}>
		<header className="wb-tool-header">
			<WorkbenchIcon name={icon} />
			<span className="wb-tool-title">{title}</span>
			<span className="wb-tool-header-spacer" />
			{actions}
		</header>
		<div className="wb-tool-body">{children}</div>
	</div>
);

/** Links to other navigator items, used for "related settings". */
export const RelatedLinks: React.FC<{ ids: string[] }> = ({ ids }) => {
	const items = ids
		.map(getWorkbenchItem)
		.filter((item): item is NonNullable<typeof item> => !!item);
	if (items.length === 0) {
		return null;
	}

	return (
		<div className="wb-related">
			{items.map((item) => (
				<Link
					key={item.id}
					{...(item.to
						? { to: item.to }
						: { to: "/w/$itemId", params: { itemId: item.id } })}
				>
					<WorkbenchIcon name={item.icon} size={14} />
					<FormattedMessage id={item.titleId} />
				</Link>
			))}
		</div>
	);
};
