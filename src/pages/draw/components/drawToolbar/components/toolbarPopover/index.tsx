import { Popover } from "antd";
import { useCallback, useContext } from "react";
import { DrawToolbarContext } from "@/pages/draw/components/drawToolbar/extra";

/// 渲染在节点内部的 Popover
export const ToolbarPopover = ({
	children,
	...props
}: React.ComponentProps<typeof Popover>) => {
	const { drawToolbarRef } = useContext(DrawToolbarContext);

	const getPopupContainer = useCallback(() => {
		return drawToolbarRef.current ?? document.body;
	}, [drawToolbarRef]);
	return (
		<Popover {...props} getPopupContainer={getPopupContainer}>
			{children}
		</Popover>
	);
};
