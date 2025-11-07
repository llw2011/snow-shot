import type React from "react";
import { useContext, useEffect } from "react";
import { AntdContext } from "@/contexts/antdContext";

export const FetchErrorHandler: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const { message } = useContext(AntdContext);
	useEffect(() => {
		window.__APP_HANDLE_HTTP_ERROR__ = (error) => {
			message.error(`${error.response?.status}: ${error.response?.statusText}`);
		};
		window.__APP_HANDLE_SERVICE_ERROR__ = (error) => {
			message.error(`${error.code}: ${error.message}`);
		};
		window.__APP_HANDLE_REQUEST_ERROR__ = (error) => {
			message.error(`${error.code}: ${error.message}`);
		};
	}, [message]);
	return <>{children}</>;
};
