import { InfoCircleOutlined } from "@ant-design/icons";
import { Tooltip, theme } from "antd";

export const IconLabel: React.FC<{
	icon?: React.ReactNode;
	label: React.ReactNode;
	title?: string;
	tooltipTitle?: React.ReactNode;
}> = ({ icon, label, tooltipTitle, title }) => {
	const { token } = theme.useToken();
	return (
		<div className="icon-label" title={title}>
			<div className="icon-label-label">{label}</div>
			{icon && <div className="icon-label-icon">{icon}</div>}
			{tooltipTitle && (
				<Tooltip title={tooltipTitle}>
					<InfoCircleOutlined style={{ marginLeft: token.marginXXS }} />
				</Tooltip>
			)}

			<style jsx>{`
                .icon-label {
                    display: flex;
                    align-items: center;
                }

                .icon-label .icon-label-icon {
                    margin-left: ${token.marginXXS}px;
                    height: 100%;
                }
            `}</style>
		</div>
	);
};
