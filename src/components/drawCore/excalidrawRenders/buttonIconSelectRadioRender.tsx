import type { ExcalidrawPropsCustomOptions } from "@mg-chao/excalidraw/types";
import { Radio } from "antd";
import React from "react";

const ButtonIconSelectRadioRenderCore: React.FC<
	Parameters<
		NonNullable<
			NonNullable<
				ExcalidrawPropsCustomOptions["pickerRenders"]
			>["buttonIconSelectRadioRender"]
		>
	>[0]
> = (props) => {
	return (
		<Radio.Button
			key={props.key}
			title={props.title}
			data-testid={props.dataTestid}
			onClick={props.onChange}
			name={props.name}
			value={props.value}
			checked={props.checked}
		>
			<div className="radio-button-icon">{props.children}</div>
		</Radio.Button>
	);
};

const ButtonIconSelectRadioRenderMemo = React.memo(
	ButtonIconSelectRadioRenderCore,
);

export const buttonIconSelectRadioRender: NonNullable<
	NonNullable<
		ExcalidrawPropsCustomOptions["pickerRenders"]
	>["buttonIconSelectRadioRender"]
> = (props) => {
	return <ButtonIconSelectRadioRenderMemo {...props} />;
};
