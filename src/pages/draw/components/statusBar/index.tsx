"use client";

import { Descriptions, Space, theme } from "antd";
import type { DescriptionsItemType } from "antd/es/descriptions";
import Color from "color";
import { debounce } from "es-toolkit";
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { FormattedMessage } from "react-intl";
import { DrawStatePublisher } from "@/components/drawCore/extra";
import { KeyboardIcon, MouseIcon } from "@/components/icons";
import { AppSettingsPublisher } from "@/contexts/appSettingsActionContext";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { useCallbackRender } from "@/hooks/useCallbackRender";
import { useStateRef } from "@/hooks/useStateRef";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import { useContentScale } from "@/hooks/useTextScaleFactor";
import { AppSettingsGroup } from "@/types/appSettings";
import type { ElementRect } from "@/types/commands/screenshot";
import { DrawState } from "@/types/draw";
import { formatKey } from "@/utils/format";
import { MousePosition } from "@/utils/mousePosition";
import { getPlatformValue } from "@/utils/platform";
import { ScreenshotType } from "@/utils/types";
import { zIndexs } from "@/utils/zIndex";
import {
	CaptureLoadingPublisher,
	CaptureStepPublisher,
	DrawEvent,
	type DrawEventParams,
	DrawEventPublisher,
	type MonitorRect,
	ScreenshotTypePublisher,
} from "../../extra";
import { CaptureStep, DrawContext } from "../../types";
import { getMaskBackgroundColor } from "../selectLayer/extra";

const KeyLabel: React.FC<{
	messageId?: string;
	hotKey?: string;
	icon?: React.ReactNode;
}> = ({ messageId, hotKey, icon }) => {
	const formatHotKey = useMemo(() => {
		return formatKey(hotKey);
	}, [hotKey]);

	return (
		<div className="descriptions-item-btn-label">
			<div className="descriptions-item-btn-label-icon">
				{icon ?? <KeyboardIcon />}
			</div>
			{messageId && <FormattedMessage id={messageId} />}
			{formatHotKey}
		</div>
	);
};

// 新实例化的组件可能收不到 DrawEvent.ChangeMonitor 消息
// 用个全局变量存一下然后初始化
let useMonitorRectData: MonitorRect = {
	rect: {
		min_x: 0,
		min_y: 0,
		max_x: 0,
		max_y: 0,
	},
	scale_factor: 0,
};
export const useMonitorRect = (
	isToolbar?: boolean,
): {
	monitorRect: MonitorRect;
	contentScale: ReturnType<typeof useContentScale>;
	calculatedBoundaryRect: (rect: ElementRect) => ElementRect;
} => {
	const [monitorRectInfo, setMonitorRectInfo, monitorRectInfoRef] =
		useStateRef<MonitorRect>(useMonitorRectData);

	useStateSubscriber(
		DrawEventPublisher,
		useCallback(
			(event: DrawEventParams) => {
				if (event?.event === DrawEvent.ChangeMonitor) {
					const { rect, scale_factor } = event.params.rect;

					const info = {
						rect: {
							min_x: rect.min_x / window.devicePixelRatio,
							min_y: rect.min_y / window.devicePixelRatio,
							max_x: rect.max_x / window.devicePixelRatio,
							max_y: rect.max_y / window.devicePixelRatio,
						},
						scale_factor,
					};
					setMonitorRectInfo(info);
					useMonitorRectData = info;
				}
			},
			[setMonitorRectInfo],
		),
	);

	const calculatedBoundaryRect = useCallback(
		(rect: ElementRect) => {
			if (monitorRectInfoRef.current.rect.max_x === 0) {
				return rect;
			}

			const monitorWidth =
				monitorRectInfoRef.current.rect.max_x -
				monitorRectInfoRef.current.rect.min_x;
			const monitorHeight =
				monitorRectInfoRef.current.rect.max_y -
				monitorRectInfoRef.current.rect.min_y;

			const minX = rect.min_x + monitorRectInfoRef.current.rect.min_x;
			const minY = rect.min_y + monitorRectInfoRef.current.rect.min_y;
			return {
				min_x: minX,
				min_y: minY,
				max_x: minX + monitorWidth,
				max_y: minY + monitorHeight,
			};
		},
		[monitorRectInfoRef],
	);

	const contentScaleValues = useContentScale(
		monitorRectInfo.scale_factor,
		isToolbar,
	);

	return useMemo(() => {
		return {
			monitorRect: monitorRectInfo,
			contentScale: contentScaleValues,
			calculatedBoundaryRect,
		};
	}, [monitorRectInfo, contentScaleValues, calculatedBoundaryRect]);
};

const StatusBar: React.FC = () => {
	const { token } = theme.useToken();

	const [hotKeyTipOpacity, setHotKeyTipOpacity] = useState(100);
	useAppSettingsLoad(
		useCallback((settings) => {
			setHotKeyTipOpacity(
				settings[AppSettingsGroup.Screenshot].hotKeyTipOpacity,
			);
		}, []),
		true,
	);

	const [getAppSettings] = useStateSubscriber(AppSettingsPublisher, undefined);

	const statusBarRef = useRef<HTMLDivElement>(null);
	const { selectLayerActionRef } = useContext(DrawContext);

	const [isFixed, setIsFixed] = useState(false);

	const [getCaptureStep] = useStateSubscriber(
		CaptureStepPublisher,
		useCallback((captureStep: CaptureStep) => {
			setIsFixed(captureStep === CaptureStep.Fixed);
		}, []),
	);
	const [getDrawState] = useStateSubscriber(DrawStatePublisher, undefined);
	const [isHover, setIsHover] = useState(false);
	const onCaptureLoadingChange = useCallback((captureLoading: boolean) => {
		setIsHover(captureLoading);
	}, []);
	const [getCaptureLoading] = useStateSubscriber(
		CaptureLoadingPublisher,
		onCaptureLoadingChange,
	);

	const [descriptionsItems, setDescriptionsItems] = useState<
		DescriptionsItemType[]
	>([]);

	const [getScreenshotType] = useStateSubscriber(
		ScreenshotTypePublisher,
		undefined,
	);
	const updateDescriptionsItems = useCallback(() => {
		if (getScreenshotType()?.type === ScreenshotType.TopWindow) {
			setDescriptionsItems([]);
			return;
		}

		const {
			colorPickerCopy: { hotKey: colorPickerCopyHotKey },
			colorPickerMoveUp: { hotKey: colorPickerMoveUpHotKey },
			colorPickerMoveDown: { hotKey: colorPickerMoveDownHotKey },
			colorPickerMoveLeft: { hotKey: colorPickerMoveLeftHotKey },
			colorPickerMoveRight: { hotKey: colorPickerMoveRightHotKey },
			maintainAspectRatioPicker: { hotKey: maintainAspectRatioPickerHotKey },
			rotateWithDiscreteAnglePicker: {
				hotKey: rotateWithDiscreteAnglePickerHotKey,
			},
			resizeFromCenterPicker: { hotKey: resizeFromCenterPickerHotKey },
			autoAlignPicker: { hotKey: autoAlignPickerHotKey },
			switchColorFormat: { hotKey: switchColorFormatHotKey },
			serialNumberDisableArrow: { hotKey: serialNumberDisableArrowHotKey },
			selectPrevRectTool: { hotKey: selectPrevRectToolHotKey },
			lockWidthHeightPicker: { hotKey: lockWidthHeightPickerHotKey },
			dragSelectRect: { hotKey: dragSelectRectHotKey },
			previousCapture: { hotKey: previousCaptureHotKey },
			nextCapture: { hotKey: nextCaptureHotKey },
		} = getAppSettings()[AppSettingsGroup.DrawToolbarKeyEvent];

		const findChildrenElements =
			getAppSettings()[AppSettingsGroup.FunctionScreenshot]
				.findChildrenElements;

		const items: DescriptionsItemType[] = [
			{
				key: "colorPickerMoveUp",
				label: <FormattedMessage id="draw.colorPickerMoveUp" />,
				children: <KeyLabel hotKey={colorPickerMoveUpHotKey} />,
			},
			{
				key: "colorPickerMoveDown",
				label: <FormattedMessage id="draw.colorPickerMoveDown" />,
				children: <KeyLabel hotKey={colorPickerMoveDownHotKey} />,
			},
			{
				key: "colorPickerMoveLeft",
				label: <FormattedMessage id="draw.colorPickerMoveLeft" />,
				children: <KeyLabel hotKey={colorPickerMoveLeftHotKey} />,
			},
			{
				key: "colorPickerMoveRight",
				label: <FormattedMessage id="draw.colorPickerMoveRight" />,
				children: <KeyLabel hotKey={colorPickerMoveRightHotKey} />,
			},
		];

		const captureStep = getCaptureStep();
		const drawState = getDrawState();

		if (captureStep === CaptureStep.Select) {
			[
				...(findChildrenElements
					? getPlatformValue(
							[
								{
									key: "selectWindowOrElement",
									label: <FormattedMessage id="draw.selectWindowOrElement" />,
									children: <KeyLabel messageId="draw.tabKey" />,
								},
							],
							[],
						)
					: []),
				{
					key: "changeSelectLevel",
					label: <FormattedMessage id="draw.changeSelectLevel" />,
					children: (
						<KeyLabel icon={<MouseIcon />} messageId="draw.mouseWheel" />
					),
				},
				{
					key: "selectPrevRectTool",
					label: <FormattedMessage id="draw.selectPrevRectTool" />,
					children: <KeyLabel hotKey={selectPrevRectToolHotKey} />,
				},
				{
					key: "dragSelectRect",
					label: <FormattedMessage id="draw.dragSelectRect" />,
					children: <KeyLabel hotKey={dragSelectRectHotKey} />,
				},
				{
					key: "lockWidthHeightPicker",
					label: <FormattedMessage id="draw.lockWidthHeightPicker" />,
					children: <KeyLabel hotKey={lockWidthHeightPickerHotKey} />,
				},
				{
					key: "switchCapture",
					label: <FormattedMessage id="draw.switchCapture" />,
					children: (
						<Space>
							<KeyLabel hotKey={previousCaptureHotKey} />
							<KeyLabel hotKey={nextCaptureHotKey} />
						</Space>
					),
				},
				{
					key: "colorPickerCopy",
					label: <FormattedMessage id="draw.colorPickerCopy" />,
					children: <KeyLabel hotKey={colorPickerCopyHotKey} />,
				},
				{
					key: "switchColorFormat",
					label: <FormattedMessage id="draw.switchColorFormat" />,
					children: <KeyLabel hotKey={switchColorFormatHotKey} />,
				},
			].forEach((item) => {
				items.push(item);
			});
		}

		if (
			drawState === DrawState.Rect ||
			drawState === DrawState.Ellipse ||
			drawState === DrawState.Blur ||
			drawState === DrawState.Diamond
		) {
			items.push({
				key: "maintainAspectRatioPicker",
				label: <FormattedMessage id="draw.maintainAspectRatioPicker" />,
				children: <KeyLabel hotKey={maintainAspectRatioPickerHotKey} />,
			});
			items.push({
				key: "resizeFromCenterPicker",
				label: <FormattedMessage id="draw.resizeFromCenterPicker" />,
				children: <KeyLabel hotKey={resizeFromCenterPickerHotKey} />,
			});
			items.push({
				key: "autoAlignPicker",
				label: <FormattedMessage id="draw.autoAlignPicker" />,
				children: <KeyLabel hotKey={autoAlignPickerHotKey} />,
			});
		}

		if (drawState === DrawState.Arrow || drawState === DrawState.Line) {
			items.push({
				key: "rotateWithDiscreteAnglePicker",
				label: <FormattedMessage id="draw.rotateWithDiscreteAnglePicker" />,
				children: <KeyLabel hotKey={rotateWithDiscreteAnglePickerHotKey} />,
			});
		}

		if (drawState === DrawState.SerialNumber) {
			items.push({
				key: "serialNumberDisableArrow",
				label: <FormattedMessage id="draw.serialNumberDisableArrow2" />,
				children: <KeyLabel hotKey={serialNumberDisableArrowHotKey} />,
			});
		}

		if (
			drawState === DrawState.Rect ||
			drawState === DrawState.Ellipse ||
			drawState === DrawState.Diamond ||
			drawState === DrawState.Arrow ||
			drawState === DrawState.Line ||
			drawState === DrawState.Pen ||
			drawState === DrawState.Text ||
			drawState === DrawState.SerialNumber ||
			drawState === DrawState.Blur ||
			drawState === DrawState.BlurFreeDraw ||
			drawState === DrawState.Highlight
		) {
			items.push({
				key: "selectSameTypeElement",
				label: <FormattedMessage id="draw.selectSameTypeElement" />,
				children: <KeyLabel icon={<MouseIcon />} messageId="draw.mouseLeft" />,
			});
			items.push({
				key: "editElementStyle",
				label: <FormattedMessage id="draw.editElementStyle" />,
				children: <KeyLabel icon={<MouseIcon />} messageId="draw.mouseRight" />,
			});
		}

		setDescriptionsItems(items);
	}, [getAppSettings, getCaptureStep, getDrawState, getScreenshotType]);
	const updateDescriptionsItemsDebounce = useMemo(
		() => debounce(updateDescriptionsItems, 0),
		[updateDescriptionsItems],
	);
	useStateSubscriber(CaptureStepPublisher, updateDescriptionsItemsDebounce);
	useStateSubscriber(DrawStatePublisher, updateDescriptionsItemsDebounce);
	useStateSubscriber(ScreenshotTypePublisher, updateDescriptionsItemsDebounce);

	const {
		monitorRect: { rect: monitorRect },
		contentScale: [contentScale, , contentScaleRef],
	} = useMonitorRect();

	const onMouseMove = useCallback(
		(mousePosition: MousePosition) => {
			const statusBar = statusBarRef.current;
			if (!statusBar) {
				return;
			}

			const statusBarMaxX =
				statusBar.clientWidth * contentScaleRef.current + statusBar.offsetLeft;
			const statusBarMinY =
				statusBar.offsetTop - statusBar.clientHeight * contentScaleRef.current;

			if (
				mousePosition.mouseX < statusBarMaxX &&
				mousePosition.mouseY > statusBarMinY
			) {
				setIsHover(true);
				return;
			}

			const selectRect = selectLayerActionRef.current?.getSelectRect();
			if (!selectRect) {
				setIsHover(false);
				return;
			}
			const minX = selectRect.min_x / window.devicePixelRatio;
			const maxY = selectRect.max_y / window.devicePixelRatio;
			// 矩形现在是正的了，只判断左下角即可
			if (minX < statusBarMaxX && maxY > statusBarMinY) {
				setIsHover(true);
				return;
			}

			setIsHover(false);
		},
		[contentScaleRef, selectLayerActionRef],
	);
	const onMouseMoveRender = useCallbackRender(onMouseMove);

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (getCaptureLoading()) {
				return;
			}

			onMouseMoveRender(new MousePosition(e.clientX, e.clientY));
		};

		document.addEventListener("mousemove", handleMouseMove);

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
		};
	}, [getCaptureLoading, onMouseMoveRender]);

	if (isFixed) {
		return null;
	}

	return (
		<div
			className="status-bar"
			ref={statusBarRef}
			style={{
				opacity:
					descriptionsItems.length === 0 || isHover
						? 0
						: hotKeyTipOpacity / 100,
			}}
		>
			<div className="status-bar-content">
				<Descriptions column={1} items={descriptionsItems} />
			</div>

			<style jsx>{`
                {/* 在这里处理下 antd message 的样式*/}
                :global(.app-global-message) {
                    {/* 刘海屏可能会被遮挡，加个 margin */}
                    top: calc(${monitorRect.min_y}px + ${token.marginLG * contentScale}px) !important;
                    left: ${monitorRect.min_x}px !important;
                    width: ${monitorRect.max_x - monitorRect.min_x}px !important;
                    transform: scale(${contentScale}) !important;
                    transform-origin: top;
                }
                
                :global(.ant-modal-wrap),
                :global(.ant-modal-mask) {
                    top: ${monitorRect.min_y}px !important;
                    left: ${monitorRect.min_x}px !important;
                    right: unset !important;
                    bottom: unset !important;
                    width: ${monitorRect.max_x - monitorRect.min_x}px !important;
                    height: ${monitorRect.max_y - monitorRect.min_y}px !important;
                    max-height: ${monitorRect.max_y - monitorRect.min_y}px !important;
                }

                :global(.ant-modal-wrap .ant-modal>div) {
                    transform-origin: calc(100% * ${contentScale - 1}) 0 !important;
                    transform: translate(0, calc(-100% * ${contentScale - 1} / 2)) scale(${contentScale}) !important;
                }

               :global(.draw-modal-body) {
                    overflow-y: auto;
                    overflow-x: hidden;
                    max-height: calc(50vh / ${contentScale});
                    padding-bottom: ${64}px;
                }

                .status-bar {
                    position: fixed;
                    top: ${monitorRect.max_y}px;
                    left: ${monitorRect.min_x}px;
                    transform: translate(0, calc(-100% * ${contentScale})) scale(${contentScale});
                    transform-origin: top left;
                    padding: ${token.paddingLG}px ${token.paddingLG}px ${token.padding}px
                        ${token.padding}px;
                    transition: opacity ${token.motionDurationMid} ${token.motionEaseInOut};
                    opacity: ${descriptionsItems.length > 0 ? 1 : 0};
                    pointer-events: none;
                    display: inline-block;
                    z-index: ${zIndexs.Draw_StatusBar};
                    box-sizing: border-box;
                    user-select: none;
                }

                {/* 有些用户反馈 OCR 复制时会复制到提示文本，这里再次禁用下 */}
                :global(.status-bar .ant-descriptions-item-label),
                :global(.status-bar .descriptions-item-btn-label) {
                    pointer-events: none !important;
                    user-select: none !important;
                }


                .status-bar-content {
                    background-color: ${Color(getMaskBackgroundColor(false))
											.alpha(0.64)
											.toString()};
                    display: inline-block;
                    box-sizing: border-box;
                    padding: ${token.padding}px ${token.padding}px;
                    border-radius: ${token.borderRadius}px;
                }

                .status-bar-content :global(.ant-descriptions .ant-descriptions-item-label) {
                    color: rgba(255, 255, 255, 0.72) !important;
                }

                .status-bar-content
                    :global(
                        .ant-descriptions .ant-descriptions-item-content .ant-badge-status-text
                    ),
                :global(.ant-descriptions-item-content) {
                    color: white !important;
                }

                .status-bar-content :global(.descriptions-item-btn-label) {
                    margin-left: ${token.padding}px;
                    margin-right: ${token.marginXS + token.padding}px;
                    display: flex;
                    align-items: center;
                    position: relative;
                }

                .status-bar-content :global(.descriptions-item-btn-label)::after {
                    content: '';
                    display: block;
                    position: absolute;
                    top: -${token.paddingXXS / 2}px;
                    left: -${token.padding}px;
                    width: 100%;
                    height: 100%;
                    padding: ${token.paddingXXS / 2}px ${token.padding}px;
                    border-radius: ${token.borderRadius}px;
                    border: 1px solid currentColor;
                }

                .status-bar-content
                    :global(.descriptions-item-btn-label .descriptions-item-btn-label-icon) {
                    margin-right: ${token.marginXS}px;
                }

                .status-bar-content :global(.ant-descriptions) {
                    display: inline-block;
                }

                .status-bar-content :global(.ant-descriptions-view) {
                    display: inline-block;
                }

                .status-bar-content :global(.ant-descriptions-view table) {
                    display: inline-block;
                }
            `}</style>
		</div>
	);
};

export default StatusBar;
