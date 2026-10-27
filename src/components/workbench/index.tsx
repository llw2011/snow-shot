import { useLocation } from "@tanstack/react-router";
import type React from "react";
import { useEffect } from "react";
import { useIntl } from "react-intl";
import { useWorkbench, WorkbenchProvider } from "./context";
import { Navigator } from "./navigator";
import { TopBar } from "./topBar";
import "./workbench.css";

const WorkbenchFrame: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const intl = useIntl();
	const location = useLocation();
	const { navOpen, setNavOpen } = useWorkbench();

	// Opening a page always reveals it in compact windows.
	useEffect(() => {
		if (location.pathname) {
			setNavOpen(false);
		}
	}, [location.pathname, setNavOpen]);

	return (
		<div className={`wb${navOpen ? " is-nav-open" : ""}`}>
			<TopBar />
			<div className="wb-body">
				<Navigator />
				<button
					type="button"
					className="wb-scrim"
					aria-label={intl.formatMessage({ id: "workbench.navigator.close" })}
					onClick={() => setNavOpen(false)}
					tabIndex={-1}
				/>
				<main className="wb-detail">{children}</main>
			</div>
		</div>
	);
};

/**
 * Main window shell. Left: every capture action, tool and settings page.
 * Right: the selected route, rendered by the router outlet.
 */
export const Workbench: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => (
	<WorkbenchProvider>
		<WorkbenchFrame>{children}</WorkbenchFrame>
	</WorkbenchProvider>
);

export { DetailPage, RelatedLinks, ToolPage } from "./detailPage";
export { WorkbenchIcon } from "./icons";
