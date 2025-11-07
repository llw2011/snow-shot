import { Button } from "antd";
import React, { useCallback, useState } from "react";
import { DrawStatePublisher } from "@/components/drawCore/extra";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { KeyEventWrap } from "@/pages/draw/components/drawToolbar/components/keyEventWrap";
import type { DrawToolbarKeyEventKey } from "@/types/components/drawToolbar";
import type { HotkeysScope } from "@/types/core/appHotKeys";
import type { DrawState } from "@/types/draw";
import { getButtonTypeByState } from "../../extra";

const ToolButtonCore: React.FC<{
	hidden?: boolean;
	componentKey?: DrawToolbarKeyEventKey;
	icon: React.ReactNode;
	onClick: () => void;
	drawState: DrawState;
	extraDrawState?: DrawState[];
	enableState?: boolean;
	disable?: boolean;
	confirmTip?: React.ReactNode;
	hotkeyScope?: HotkeysScope;
	buttonProps?: React.ComponentProps<typeof Button>;
}> = ({
	hidden,
	componentKey,
	icon,
	onClick,
	drawState: propDrawState,
	extraDrawState,
	enableState,
	disable,
	confirmTip,
	hotkeyScope,
	buttonProps,
}) => {
	const [buttonType, setButtonType] = useState(getButtonTypeByState(false));
	const updateButtonType = useCallback(
		(drawState: DrawState) => {
			setButtonType(
				getButtonTypeByState(
					drawState === propDrawState ||
						enableState ||
						(extraDrawState?.includes(drawState) ?? false),
				),
			);
		},
		[propDrawState, enableState, extraDrawState],
	);

	useStateSubscriber(DrawStatePublisher, updateButtonType);

	const buttonDom = (
		<Button
			style={{
				display: hidden ? "none" : undefined,
			}}
			{...buttonProps}
			icon={icon}
			type={buttonType}
			onClick={onClick}
			disabled={disable}
			key={componentKey}
		/>
	);

	if (!componentKey) {
		return buttonDom;
	}

	return (
		<KeyEventWrap
			onKeyUpEventPropName="onClick"
			componentKey={componentKey}
			confirmTip={confirmTip}
			enable={disable ? false : undefined}
			hotkeyScope={hotkeyScope}
		>
			{buttonDom}
		</KeyEventWrap>
	);
};

export const ToolButton = React.memo(ToolButtonCore);
