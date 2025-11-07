import { theme } from "antd";

export const ContentWrap: React.FC<{
	children: React.ReactNode;
	className?: string;
}> = ({ children, className }) => {
	const { token } = theme.useToken();
	return (
		<div className={`content-wrap ${className}`}>
			{children}
			<style jsx>
				{`
                    .content-wrap {
                        padding-bottom: ${token.paddingLG}px;
                        box-sizing: border-box;
                        min-height: 100%;
                        height: 100%;
                    }
                `}
			</style>
		</div>
	);
};
