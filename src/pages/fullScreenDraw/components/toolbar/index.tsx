import { CloseOutlined, LockOutlined } from "@ant-design/icons";
import * as tauriOs from "@tauri-apps/plugin-os";
import { type ButtonProps, Flex, theme } from "antd";
import {
	useCallback,
	useContext,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { useIntl } from "react-intl";
import { closeFullScreenDrawWindow } from "@/commands/core";
import {
	DrawStatePublisher,
	type ExcalidrawEventParams,
	ExcalidrawEventPublisher,
} from "@/components/drawCore/extra";
import {
	ArrowSelectIcon,
	CircleIcon,
	EraserIcon,
	LaserPointerIcon,
	MouseThroughIcon,
	PenIcon,
	ResetCanvasIcon,
	SerialNumberIcon,
	TextIcon,
} from "@/components/icons";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { fullScreenDrawChangeMouseThrough } from "@/functions/fullScreenDraw";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { useStateRef } from "@/hooks/useStateRef";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { HistoryControls } from "@/pages/draw/components/drawToolbar/components/historyControls";
import { ToolButton } from "@/pages/draw/components/drawToolbar/components/toolButton";
import { ArrowTool } from "@/pages/draw/components/drawToolbar/components/tools/arrowTool";
import { RectTool } from "@/pages/draw/components/drawToolbar/components/tools/rectTool";
import { type AppSettingsData, AppSettingsGroup } from "@/types/appSettings";
import { DrawToolbarKeyEventKey } from "@/types/components/drawToolbar";
import { DrawState } from "@/types/draw";
import { zIndexs } from "@/utils/zIndex";
import { useDrawContext } from "../../extra";

export type DrawToolbarActionType = {
	setTool: (drawState: DrawState) => void;
};

export const FullScreenDrawToolbar: React.FC<{
	actionRef: React.RefObject<DrawToolbarActionType | undefined>;
}> = ({ actionRef }) => {
	const intl = useIntl();
	const { token } = theme.useToken();

	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const { getDrawCoreAction } = useDrawContext();
	const [getDrawState, _setDrawState] = useStateSubscriber(
		DrawStatePublisher,
		undefined,
	);
	const setDrawState = useCallback(
		(drawState: DrawState) => {
			_setDrawState(drawState);
		},
		[_setDrawState],
	);

	const [showLockDrawTool, setShowLockDrawTool, showLockDrawToolRef] =
		useStateRef(false);
	const [enableLockDrawTool, setEnableLockDrawTool, enableLockDrawToolRef] =
		useStateRef(false);
	const [mouseThroughHotkey, setMouseThroughHotkey] = useState("");

	const onToolClick = useCallback(
		(drawState: DrawState) => {
			const drawCoreAction = getDrawCoreAction();

			const prev = getDrawState();

			if (drawState === DrawState.Lock) {
				updateAppSettings(
					AppSettingsGroup.Cache,
					{ enableLockDrawTool: !enableLockDrawToolRef.current },
					true,
					true,
					false,
					true,
					false,
				);

				return;
			}

			let next = drawState;

			if (prev === drawState && prev !== DrawState.Idle) {
				if (drawState === DrawState.ScrollScreenshot) {
					next = DrawState.Idle;
				} else {
					next = DrawState.Select;
				}
			}

			let toolLocked = true;
			if (showLockDrawToolRef.current) {
				toolLocked = enableLockDrawToolRef.current;
			}

			switch (next) {
				case DrawState.Select:
					drawCoreAction?.setActiveTool(
						{
							type: "selection",
						},
						undefined,
						next,
					);
					break;
				case DrawState.Rect:
					drawCoreAction?.setActiveTool(
						{
							type: "rectangle",
							locked: toolLocked,
						},
						undefined,
						next,
					);
					break;
				case DrawState.Diamond:
					drawCoreAction?.setActiveTool(
						{
							type: "diamond",
							locked: toolLocked,
						},
						undefined,
						next,
					);
					break;
				case DrawState.Ellipse:
					drawCoreAction?.setActiveTool(
						{
							type: "ellipse",
							locked: toolLocked,
						},
						undefined,
						next,
					);
					break;
				case DrawState.Arrow:
					drawCoreAction?.setActiveTool(
						{
							type: "arrow",
							locked: toolLocked,
						},
						undefined,
						next,
					);
					break;
				case DrawState.Line:
					drawCoreAction?.setActiveTool(
						{
							type: "line",
							locked: toolLocked,
						},
						undefined,
						next,
					);
					break;
				case DrawState.Pen:
					drawCoreAction?.setActiveTool(
						{
							type: "freedraw",
							locked: toolLocked,
						},
						undefined,
						next,
					);
					break;
				case DrawState.Text:
					drawCoreAction?.setActiveTool(
						{
							type: "text",
							locked: toolLocked,
						},
						undefined,
						next,
					);
					break;
				case DrawState.SerialNumber:
					break;
				case DrawState.Eraser:
					drawCoreAction?.setActiveTool(
						{
							type: "eraser",
							locked: toolLocked,
						},
						undefined,
						next,
					);
					break;
				case DrawState.LaserPointer:
					drawCoreAction?.setActiveTool(
						{
							type: "laser",
							locked: true,
						},
						undefined,
						next,
					);
					break;
				case DrawState.MouseThrough:
					drawCoreAction?.setActiveTool(
						{
							type: "laser",
							locked: true,
						},
						undefined,
						next,
					);
					break;
				default:
					break;
			}

			setDrawState(next);
		},
		[
			enableLockDrawToolRef,
			getDrawCoreAction,
			getDrawState,
			setDrawState,
			showLockDrawToolRef,
			updateAppSettings,
		],
	);

	const appSettingsDefaultToolRef = useRef<DrawState | undefined>(undefined);
	const excalidrawReadyRef = useRef(false);
	const appSettingsReadyRef = useRef(false);
	const initDefaultToolReadyRef = useRef(false);
	const initDefaultTool = useCallback((): void => {
		if (!appSettingsDefaultToolRef.current || !excalidrawReadyRef.current) {
			return;
		}

		onToolClick(appSettingsDefaultToolRef.current);
		setTimeout(() => {
			initDefaultToolReadyRef.current = true;
		}, 100);
	}, [onToolClick]);

	useAppSettingsLoad(
		useCallback(
			(settings: AppSettingsData) => {
				// 不显示锁定绘制工具
				setShowLockDrawTool(
					!settings[AppSettingsGroup.FunctionDraw].lockDrawTool,
				);
				// 是否启用锁定绘制工具
				setEnableLockDrawTool(
					settings[AppSettingsGroup.Cache].enableLockDrawTool,
				);

				setMouseThroughHotkey(
					settings[AppSettingsGroup.AppFunction].fullScreenDraw.shortcutKey,
				);

				appSettingsDefaultToolRef.current =
					settings[AppSettingsGroup.FunctionFullScreenDraw].defaultTool;

				appSettingsReadyRef.current = true;
				initDefaultTool();
			},
			[setEnableLockDrawTool, setShowLockDrawTool, initDefaultTool],
		),
	);

	useStateSubscriber(
		ExcalidrawEventPublisher,
		useCallback(
			(params: ExcalidrawEventParams | undefined) => {
				if (initDefaultToolReadyRef.current) {
					if (params?.event === "onChange") {
						if (
							params.params.appState.activeTool.type === "selection" &&
							getDrawState() !== DrawState.Select &&
							getDrawState() !== DrawState.Idle
						) {
							onToolClick(DrawState.Select);
						}
					}
				}

				if (params?.event === "onDraw") {
					excalidrawReadyRef.current = true;
					initDefaultTool();
				}
			},
			[getDrawState, initDefaultTool, onToolClick],
		),
	);

	useImperativeHandle(
		actionRef,
		useCallback(() => {
			return {
				setTool: onToolClick,
			};
		}, [onToolClick]),
	);

	const toolButtonProps = useMemo<ButtonProps>(() => {
		return {
			size: "large",
		};
	}, []);

	const mouseThroughButtonTitle = useMemo(() => {
		if (!mouseThroughHotkey) {
			return intl.formatMessage({ id: "draw.mouseThroughTool" });
		}

		return intl.formatMessage(
			{
				id: "draw.keyEventTooltip",
			},
			{
				message: intl.formatMessage({ id: "draw.mouseThroughTool" }),
				key: mouseThroughHotkey,
			},
		);
	}, [intl, mouseThroughHotkey]);

	const [currentPlatform, setCurrentPlatform] = useState<tauriOs.Platform>();
	useEffect(() => {
		setCurrentPlatform(tauriOs.platform());
	}, []);

	return (
		<div className="full-screen-draw-toolbar-container">
			<div className="full-screen-draw-toolbar">
				<Flex align="center" gap={token.paddingXS}>
					{/* 选择状态 */}
					<ToolButton
						componentKey={DrawToolbarKeyEventKey.SelectTool}
						icon={<ArrowSelectIcon style={{ fontSize: "1.2em" }} />}
						drawState={DrawState.Select}
						buttonProps={toolButtonProps}
						onClick={() => {
							onToolClick(DrawState.Select);
						}}
					/>

					{showLockDrawTool && (
						<>
							{/* 锁定绘制工具 */}
							<ToolButton
								componentKey={DrawToolbarKeyEventKey.LockDrawTool}
								icon={<LockOutlined />}
								drawState={DrawState.Lock}
								enableState={enableLockDrawTool}
								onClick={() => {
									onToolClick(DrawState.Lock);
								}}
							/>
						</>
					)}

					<div className="draw-toolbar-splitter" />

					<RectTool
						customToolbarToolHiddenMap={undefined}
						onToolClickAction={onToolClick}
						disable={false}
					/>

					{/* 椭圆 */}
					<ToolButton
						componentKey={DrawToolbarKeyEventKey.EllipseTool}
						icon={
							<CircleIcon
								style={{
									fontSize: "1em",
								}}
							/>
						}
						buttonProps={toolButtonProps}
						drawState={DrawState.Ellipse}
						onClick={() => {
							onToolClick(DrawState.Ellipse);
						}}
					/>

					{/* 箭头 */}
					<ArrowTool
						customToolbarToolHiddenMap={undefined}
						onToolClickAction={onToolClick}
						disable={false}
					/>

					{/* 画笔 */}
					<ToolButton
						componentKey={DrawToolbarKeyEventKey.PenTool}
						icon={<PenIcon style={{ fontSize: "1.15em" }} />}
						buttonProps={toolButtonProps}
						drawState={DrawState.Pen}
						onClick={() => {
							onToolClick(DrawState.Pen);
						}}
					/>

					{/* 文本 */}
					<ToolButton
						componentKey={DrawToolbarKeyEventKey.TextTool}
						icon={<TextIcon style={{ fontSize: "1.15em" }} />}
						drawState={DrawState.Text}
						buttonProps={toolButtonProps}
						onClick={() => {
							onToolClick(DrawState.Text);
						}}
					/>

					{/* 序列号 */}
					<ToolButton
						componentKey={DrawToolbarKeyEventKey.SerialNumberTool}
						icon={
							<SerialNumberIcon
								style={{
									fontSize: "1.16em",
								}}
							/>
						}
						drawState={DrawState.SerialNumber}
						buttonProps={toolButtonProps}
						onClick={() => {
							onToolClick(DrawState.SerialNumber);
						}}
					/>

					{/* 橡皮擦 */}
					<ToolButton
						componentKey={DrawToolbarKeyEventKey.EraserTool}
						icon={
							<EraserIcon
								style={{
									fontSize: "0.95em",
								}}
							/>
						}
						drawState={DrawState.Eraser}
						buttonProps={toolButtonProps}
						onClick={() => {
							onToolClick(DrawState.Eraser);
						}}
					/>

					{/* 激光笔 */}
					<ToolButton
						componentKey={DrawToolbarKeyEventKey.LaserPointerTool}
						icon={
							<LaserPointerIcon
								style={{
									fontSize: "1.1em",
								}}
							/>
						}
						buttonProps={toolButtonProps}
						drawState={DrawState.LaserPointer}
						onClick={() => {
							onToolClick(DrawState.LaserPointer);
						}}
					/>

					<div className="draw-toolbar-splitter" />

					<ToolButton
						icon={
							<ResetCanvasIcon
								style={{
									fontSize: "1.08em",
								}}
							/>
						}
						drawState={DrawState.ResetCanvas}
						buttonProps={{
							...toolButtonProps,
							title: intl.formatMessage({ id: "draw.resetCanvasTool" }),
						}}
						onClick={() => {
							getDrawCoreAction()?.updateScene({
								elements: [],
								captureUpdate: "IMMEDIATELY",
							});
						}}
					/>

					<ToolButton
						icon={
							<MouseThroughIcon
								style={{
									fontSize: "0.95em",
								}}
							/>
						}
						drawState={DrawState.MouseThrough}
						buttonProps={{
							...toolButtonProps,
							title: mouseThroughButtonTitle,
						}}
						onClick={() => {
							fullScreenDrawChangeMouseThrough();
						}}
					/>

					{/* 取消截图 */}
					<ToolButton
						componentKey={DrawToolbarKeyEventKey.CancelTool}
						icon={
							<CloseOutlined
								style={{
									fontSize: "0.9em",
									color: token.colorError,
								}}
							/>
						}
						buttonProps={toolButtonProps}
						drawState={DrawState.Cancel}
						onClick={() => {
							closeFullScreenDrawWindow();
						}}
					/>

					<HistoryControls hidden={true} disable={false} />
				</Flex>
			</div>

			<style jsx>{`
                .full-screen-draw-toolbar-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    pointer-events: none;
                    width: 100%;
                    display: flex;
                    justify-content: center;
                    z-index: ${zIndexs.FullScreenDraw_Toolbar};
                }

                .full-screen-draw-toolbar-container:hover {
                    z-index: ${zIndexs.FullScreenDraw_ToolbarHover};
                }

                .full-screen-draw-toolbar :global(.ant-btn) :global(.ant-btn-icon) {
                    font-size: 24px;
                    display: flex;
                    align-items: center;
                }

                :global(.full-screen-draw-toolbar > div) {
                    line-height: 0;
                }

                .full-screen-draw-toolbar {
                    pointer-events: auto;
                    /* macOS 下加上 menu bar 的高度 */
                    margin-top: ${token.marginLG + (currentPlatform === "macos" ? 24 : 0)}px;
                    z-index: ${zIndexs.FullScreenDraw_Toolbar};
                }

                .full-screen-draw-toolbar {
                    padding: ${token.paddingXXS}px ${token.paddingSM}px;
                    box-sizing: border-box;
                    background-color: ${token.colorBgContainer};
                    border-radius: ${token.borderRadiusLG}px;
                    cursor: default; /* 防止非拖动区域也变成可拖动状态 */
                    color: ${token.colorText};
                    box-shadow: 0 0 3px 0px ${token.colorPrimaryHover};
                    transition: opacity ${token.motionDurationMid} ${token.motionEaseInOut};
                }

                .full-screen-draw-toolbar :global(.draw-toolbar-splitter),
                .draw-toolbar-splitter {
                    width: 1px;
                    height: 1.6em;
                    background-color: ${token.colorBorder};
                    margin: 0 ${token.marginXS}px;
                }
            `}</style>
		</div>
	);
};
