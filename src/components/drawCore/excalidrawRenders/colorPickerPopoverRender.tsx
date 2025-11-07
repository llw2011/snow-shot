import type { ExcalidrawPropsCustomOptions } from "@mg-chao/excalidraw/types";
import { Button, ColorPicker, Flex, theme } from "antd";
import { debounce } from "es-toolkit";
import React, {
	type ComponentProps,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useIntl } from "react-intl";
import { PickColorIcon } from "@/components/icons";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import {
	DrawEvent,
	type DrawEventParams,
	DrawEventPublisher,
} from "@/pages/draw/extra";
import { DrawContext } from "@/pages/fullScreenDraw/extra";

const ColorPickerCore: React.FC<{
	color: string | null;
	onChange: (color: string) => void;
}> = ({ color: colorProp, onChange }) => {
	const intl = useIntl();
	const { token } = theme.useToken();
	const color = colorProp === "transparent" ? "#00000000" : colorProp;

	const { enableColorPicker, setColorPickerForceEnable } =
		useContext(DrawContext);

	const [activePick, setActivePick] = useState(false);

	const updateColor = useMemo(() => {
		return debounce((event: DrawEventParams) => {
			if (event?.event === DrawEvent.ColorPickerColorChange) {
				onChange(event.params.color.hex());
			}
		}, 100);
	}, [onChange]);
	useStateSubscriber(DrawEventPublisher, activePick ? updateColor : undefined);

	useEffect(() => {
		setColorPickerForceEnable?.(activePick);

		return () => {
			setColorPickerForceEnable?.(false);
		};
	}, [activePick, setColorPickerForceEnable]);

	const onEnablePickClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			event.preventDefault();
			event.stopPropagation();

			setActivePick((prev) => !prev);
		},
		[],
	);
	const enablePickTitle = useMemo(() => {
		return intl.formatMessage({ id: "draw.pickColor" });
	}, [intl]);

	const onMouseDown = useCallback(() => {
		setActivePick(false);
	}, []);

	useEffect(() => {
		if (!enableColorPicker) {
			return;
		}

		document.addEventListener("mousedown", onMouseDown);
		return () => {
			document.removeEventListener("mousedown", onMouseDown);
		};
	}, [enableColorPicker, onMouseDown]);

	const { getPopupContainer } = useContext(DrawContext);

	const onChangeComplete = useCallback<
		NonNullable<ComponentProps<typeof ColorPicker>["onChangeComplete"]>
	>(
		(newColor) => {
			onChange(newColor.toHexString());
		},
		[onChange],
	);

	const panelRender = useCallback<
		NonNullable<ComponentProps<typeof ColorPicker>["panelRender"]>
	>(
		(panel) => {
			return (
				<>
					{panel}
					{enableColorPicker && (
						<Flex
							justify="end"
							className="color-picker-popover-render-pick-color"
						>
							<Button
								type={activePick === true ? "primary" : "default"}
								icon={<PickColorIcon style={{ fontSize: "1.2em" }} />}
								onClick={onEnablePickClick}
								title={enablePickTitle}
							/>
						</Flex>
					)}
				</>
			);
		},
		[activePick, enableColorPicker, enablePickTitle, onEnablePickClick],
	);
	return (
		<div title={color ?? undefined} className="color-picker-popover-render">
			<ColorPicker
				value={color}
				onChangeComplete={onChangeComplete}
				size="small"
				placement="rightTop"
				disabledFormat
				getPopupContainer={getPopupContainer}
				panelRender={panelRender}
			/>

			<style jsx>{`
                .color-picker-popover-render :global(.ant-color-picker-trigger) {
                    width: 27px !important;
                    height: 27px !important;
                }

                .color-picker-popover-render :global(.ant-color-picker-color-block) {
                    width: 19px !important;
                    height: 19px !important;
                }

                :global(.color-picker-popover-render-pick-color) {
                    margin-top: ${token.marginXS}px;
                }
            `}</style>
		</div>
	);
};

const ColorPickerMemo = React.memo(ColorPickerCore);

export const colorPickerPopoverRender: NonNullable<
	ExcalidrawPropsCustomOptions["pickerRenders"]
>["colorPickerPopoverRender"] = ({ color, onChange }) => {
	return <ColorPickerMemo color={color} onChange={onChange} />;
};
