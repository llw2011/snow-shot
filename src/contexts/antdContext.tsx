import type { MessageInstance } from "antd/es/message/interface";
import type { HookAPI } from "antd/es/modal/useModal";
import React from "react";

export type AntdContextType = {
	message: MessageInstance;
	modal: HookAPI & {
		confirmWithStatus: (
			...params: Parameters<HookAPI["confirm"]>
		) => Promise<boolean>;
	};
	isConfirmingRef: React.RefObject<boolean>;
};

export const AntdContext = React.createContext<AntdContextType>({
	message: {} as MessageInstance,
	modal: {} as HookAPI & {
		confirmWithStatus: (
			...params: Parameters<HookAPI["confirm"]>
		) => Promise<boolean>;
	},
	isConfirmingRef: {} as React.RefObject<boolean>,
});
