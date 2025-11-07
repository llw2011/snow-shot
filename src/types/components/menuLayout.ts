import type { TabsProps } from "antd";
import type React from "react";

export type RouteMapItem = {
	items: TabsProps["items"];
	hideTabs?: boolean;
};

export type RouteItem = {
	key: string;
	path: string | undefined;
	label: string;
	icon?: React.ReactNode;
	hideTabs?: boolean;
	children?: RouteItem[];
	tabs?: TabsProps["items"];
};
