import { Button, Flex, theme } from "antd";
import React, { useCallback, useContext, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { DrawStatePublisher } from "@/components/drawCore/extra";
import { ArrowIcon, LineIcon } from "@/components/icons";
import {
	AppSettingsActionContext,
	AppSettingsPublisher,
} from "@/contexts/appSettingsActionContext";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { ToolbarPopover } from "@/pages/draw/components/drawToolbar/components/toolbarPopover";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";
import { DrawToolbarKeyEventKey } from "@/types/components/drawToolbar";
import { DrawState } from "@/types/draw";
import { getButtonTypeByState } from "../../../extra";
import { ToolButton } from "../../toolButton";

const ArrowToolCore: React.FC<{
	customToolbarToolHiddenMap: Partial<Record<DrawState, boolean>> | undefined;
	onToolClickAction: (tool: DrawState) => void;
	disable: boolean;
}> = ({ customToolbarToolHiddenMap, onToolClickAction, disable }) => {
	const intl = useIntl();
	const { token } = theme.useToken();

	const { updateAppSettings } = useContext(AppSettingsActionContext);

	const [lastArrowTool, setLastArrowTool] = useState<DrawState>(
		DrawState.Arrow,
	);
	useStateSubscriber(
		AppSettingsPublisher,
		useCallback((settings: AppSettingsData) => {
			setLastArrowTool(settings[AppSettingsGroup.Cache].lastArrowTool);
		}, []),
	);
	const [drawState, setDrawState] = useState(DrawState.Idle);
	useStateSubscriber(
		DrawStatePublisher,
		useCallback((state: DrawState) => {
			setDrawState(state);
		}, []),
	);

	const updateLastArrowTool = useCallback(
		(value: DrawState) => {
			updateAppSettings(
				AppSettingsGroup.Cache,
				{ lastArrowTool: value },
				true,
				true,
				false,
				true,
				false,
			);
		},
		[updateAppSettings],
	);

	const arrowButton = useMemo(() => {
		return (
			<ToolButton
				hidden={customToolbarToolHiddenMap?.[DrawState.Arrow]}
				componentKey={DrawToolbarKeyEventKey.ArrowTool}
				icon={<ArrowIcon style={{ fontSize: "0.83em" }} />}
				drawState={DrawState.Arrow}
				disable={disable}
				key="arrow"
				onClick={() => {
					onToolClickAction(DrawState.Arrow);
					updateLastArrowTool(DrawState.Arrow);
				}}
			/>
		);
	}, [
		disable,
		customToolbarToolHiddenMap,
		onToolClickAction,
		updateLastArrowTool,
	]);

	const lineButton = useMemo(() => {
		return (
			<Button
				icon={<LineIcon style={{ fontSize: "1.15em", height: "1em" }} />}
				title={intl.formatMessage({ id: "draw.lineTool" })}
				type={getButtonTypeByState(drawState === DrawState.Line)}
				key="line"
				onClick={() => {
					onToolClickAction(DrawState.Line);
					updateLastArrowTool(DrawState.Line);
				}}
				disabled={disable}
			/>
		);
	}, [disable, drawState, intl, onToolClickAction, updateLastArrowTool]);

	let mainToolbarButton: React.ReactNode = customToolbarToolHiddenMap?.[
		DrawState.Arrow
	]
		? lineButton
		: arrowButton;
	if (
		lastArrowTool === DrawState.Arrow &&
		!customToolbarToolHiddenMap?.[DrawState.Arrow]
	) {
		mainToolbarButton = arrowButton;
	} else if (
		lastArrowTool === DrawState.Line &&
		!customToolbarToolHiddenMap?.[DrawState.Line]
	) {
		mainToolbarButton = lineButton;
	}

	if (
		customToolbarToolHiddenMap?.[DrawState.Arrow] &&
		customToolbarToolHiddenMap?.[DrawState.Line]
	) {
		mainToolbarButton = undefined;
	}

	return (
		<ToolbarPopover
			trigger={
				!customToolbarToolHiddenMap?.[DrawState.Arrow] &&
				!customToolbarToolHiddenMap?.[DrawState.Line]
					? "hover"
					: []
			}
			content={
				<Flex align="center" gap={token.paddingXS} className="popover-toolbar">
					{arrowButton}
					{!customToolbarToolHiddenMap?.[DrawState.Line] && lineButton}
				</Flex>
			}
		>
			<div>{mainToolbarButton}</div>
		</ToolbarPopover>
	);
};

export const ArrowTool = React.memo(ArrowToolCore);
