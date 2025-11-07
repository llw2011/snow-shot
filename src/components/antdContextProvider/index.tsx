import { Modal, message } from "antd";
import type { HookAPI } from "antd/es/modal/useModal";
import type React from "react";
import { useCallback, useMemo, useRef } from "react";
import { AntdContext } from "@/contexts/antdContext";

export const AntdContextProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [messageApi, messageContextHolder] = message.useMessage(
		useMemo(
			() => ({
				prefixCls: "app-global-message",
			}),
			[],
		),
	);
	const [modalApi, modalContextHolder] = Modal.useModal();

	const isConfirmingRef = useRef(false);
	const confirmWithStatus = useCallback(
		async (...params: Parameters<HookAPI["confirm"]>) => {
			isConfirmingRef.current = true;
			const res = await modalApi.confirm(...params);
			isConfirmingRef.current = false;
			return res;
		},
		[modalApi],
	);

	const contextValues = useMemo(
		() => ({
			message: messageApi,
			modal: { ...modalApi, confirmWithStatus },
			isConfirmingRef,
		}),
		[messageApi, modalApi, confirmWithStatus],
	);
	return (
		<AntdContext.Provider value={contextValues}>
			{messageContextHolder}
			{modalContextHolder}
			{children}
		</AntdContext.Provider>
	);
};
