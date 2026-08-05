import { Typography, theme } from "antd";

export const GroupTitle: React.FC<{
	children: React.ReactNode;
	id?: string;
	extra?: React.ReactNode;
}> = ({ children, id, extra }) => {
	const { token } = theme.useToken();
	return (
		<div
			className="components_group-title-row"
			style={{ marginBottom: token.margin }}
		>
			<Typography.Title
				className="components_group-title"
				style={{ margin: 0 }}
				level={4}
				id={id}
			>
				{children}
			</Typography.Title>
			{extra && <div className="components_group-title-extra">{extra}</div>}

			<style jsx>{`
				.components_group-title-row {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 12px;
				}

				.components_group-title-extra {
					display: flex;
					flex: 0 0 auto;
					align-items: center;
				}
			`}</style>
		</div>
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
