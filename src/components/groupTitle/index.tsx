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

			<style jsx global>{`
				.components_group-title-row {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 12px;
					min-width: 0;
					min-height: 30px;
					padding: 0 0 0 10px;
					border-inline-start: 2px solid var(--snow-shot-primary);
					border-bottom: 1px solid var(--snow-shot-hairline-soft);
				}

				.components_group-title-row :global(.components_group-title) {
					flex: 1 1 auto;
					min-width: 0;
					max-width: 100%;
					overflow: hidden;
					font-size: 16px !important;
					line-height: 24px;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				.components_group-title-extra {
					display: flex;
					flex: 0 0 auto;
					min-width: 0;
					max-width: 50%;
					overflow: hidden;
					align-items: center;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				.components_group-title-extra :global(.ant-btn) {
					max-width: 100%;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
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
