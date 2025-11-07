import { Button, Flex, theme } from "antd";
import type React from "react";
import { useState } from "react";
import { zIndexs } from "@/utils/zIndex";
import { IconLabel } from "../iconLable";

export const FunctionButton: React.FC<{
	label: React.ReactNode;
	icon?: React.ReactNode;
	onClick?: () => Promise<void>;
	children?: React.ReactNode;
}> = ({ label, icon, onClick, children }) => {
	const { token } = theme.useToken();
	const [loading, setLoading] = useState(false);
	return (
		<div style={{ position: "relative" }}>
			<Button
				size="large"
				loading={loading}
				block
				style={{ paddingRight: 0 }}
				onClick={async () => {
					setLoading(true);
					await onClick?.();
					setLoading(false);
				}}
			>
				<Flex
					justify="flex-start"
					align="center"
					style={{ width: "100%", height: "100%" }}
				>
					<IconLabel icon={icon} label={label} />
				</Flex>
			</Button>
			<div
				style={{
					position: "absolute",
					height: "100%",
					zIndex: zIndexs.Main_FunctionButtonInput,
					right: 0,
					top: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "flex-end",
					paddingLeft: token.padding,
					paddingRight: token.padding,
				}}
				onClick={(e) => {
					e.stopPropagation();
				}}
			>
				{children}
			</div>
		</div>
	);
};
