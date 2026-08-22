import type { TabsProps } from "antd";
import type React from "react";

export type RouteMapItem = {
	items: TabsProps["items"];
	hideTabs?: boolean;
	contentNavigation?: "settings-workspace";
};

export type RouteItem = {
	key: string;
	path: string | undefined;
	label: string;
	icon?: React.ReactNode;
	hideTabs?: boolean;
	contentNavigation?: "settings-workspace";
	children?: RouteItem[];
	tabs?: TabsProps["items"];
};
