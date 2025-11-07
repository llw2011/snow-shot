import type { ExcalidrawPropsCustomOptions } from "@mg-chao/excalidraw/types";
import { Button, theme } from "antd";

export const ColorIcon: React.FC<{ color: string }> = ({ color }) => {
	const { token } = theme.useToken();
	return (
		<div className="color-icon">
			<div className="color-icon-transparent" />
			<div className="color-icon-color" />
			<style jsx>
				{`
                    .color-icon {
                        width: 0.72em;
                        height: 0.72em;
                        position: relative;
                    }
                    .color-icon-color {
                        width: 100%;
                        height: 100%;
                        position: absolute;
                        background-color: ${color};
                        border-radius: ${token.borderRadiusXS}px;
                        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
                    }
                    .color-icon-transparent {
                        position: absolute;
                        width: 100%;
                        height: 100%;
                        background-image: conic-gradient(
                            rgba(0, 0, 0, 0.06) 25%,
                            transparent 25% 50%,
                            rgba(0, 0, 0, 0.06) 50% 75%,
                            transparent 75% 100%
                        );
                        border-radius: ${token.borderRadiusXS}px;
                    }
                `}
			</style>
		</div>
	);
};

export const colorPickerTopPickesButtonRender: NonNullable<
	ExcalidrawPropsCustomOptions["pickerRenders"]
>["colorPickerTopPickesButtonRender"] = (props) => {
	const { key, color, onClick, dataTestid, active } = props;

	return (
		<Button
			key={key}
			type={active ? "default" : "text"}
			variant={active ? "outlined" : "text"}
			title={color}
			size="small"
			onClick={onClick}
			data-testid={dataTestid}
			icon={<ColorIcon color={color} />}
			style={{ fontSize: 24 }}
		/>
	);
};
