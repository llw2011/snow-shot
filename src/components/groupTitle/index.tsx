import { Typography, theme } from "antd";

export const GroupTitle: React.FC<{
	children: React.ReactNode;
	id?: string;
	extra?: React.ReactNode;
}> = ({ children, id, extra }) => {
	const { token } = theme.useToken();
	return (
		<Typography.Title
			className="components_group-title"
			style={{
				marginTop: 0,
				marginBottom: token.margin,
				display: "flex",
				justifyContent: "space-between",
			}}
			level={4}
			id={id}
		>
			<div>{children}</div>
			<div>{extra}</div>
		</Typography.Title>
	);
};

export const SubGroupTitle: React.FC<{
	children: React.ReactNode;
	id?: string;
}> = ({ children, id }) => {
	const { token } = theme.useToken();
	return (
		<Typography.Title
			className="components_sub-group-title"
			style={{ marginTop: 0, marginBottom: token.margin }}
			level={5}
			id={id}
		>
			{children}
		</Typography.Title>
	);
};
