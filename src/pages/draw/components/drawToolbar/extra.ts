import type { GlobalToken } from "antd";
import type { BaseButtonProps } from "antd/es/button/button";
import React from "react";
import { DrawState } from "@/types/draw";

export const getButtonTypeByState = (
	active: boolean,
): BaseButtonProps["type"] => {
	return active ? "primary" : "text";
};

export const getButtonIconColorByState = (
	active: boolean,
	token: GlobalToken,
) => {
	return active ? token.colorSuccess : token.colorTextDisabled;
};

export type DrawToolbarContextType = {
	drawToolarContainerRef: React.RefObject<HTMLDivElement | null>;
	drawToolbarRef: React.RefObject<HTMLDivElement | null>;
	draggingRef: React.RefObject<boolean>;
	setDragging: (dragging: boolean) => void;
};

export const DrawToolbarContext = React.createContext<DrawToolbarContextType>({
	drawToolarContainerRef: { current: null },
	drawToolbarRef: { current: null },
	draggingRef: { current: false },
	setDragging: () => {},
});

export const isEnableSubToolbar = (drawState: DrawState) => {
	switch (drawState) {
		case DrawState.Idle:
			return false;
		default:
			return true;
	}
};
