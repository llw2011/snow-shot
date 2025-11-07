import { Tooltip } from "antd";
import type React from "react";

export const ToolbarTip: React.FC<React.ComponentProps<typeof Tooltip>> = (
	props,
) => {
	return <Tooltip {...props} />;
};
