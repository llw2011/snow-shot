import { Flex, theme } from "antd";

const ButtonList: React.FC<{
	children: React.ReactNode;
	className?: string;
}> = ({ children, className }) => {
	const { token } = theme.useToken();
	return (
		<Flex gap={token.marginSM} wrap className={className}>
			{children}
		</Flex>
	);
};

export { ButtonList };
