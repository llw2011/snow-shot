import {
	BulbOutlined,
	CameraOutlined,
	CheckCircleFilled,
	DownOutlined,
	FolderOpenOutlined,
	HistoryOutlined,
	InfoCircleOutlined,
	PlayCircleOutlined,
	SettingOutlined,
	ThunderboltOutlined,
	UpOutlined,
} from "@ant-design/icons";
import { useRouter } from "@tanstack/react-router";
import { Button, Space, Spin, Tag, Tooltip, theme } from "antd";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FormattedMessage } from "react-intl";
import { CheckPermissions } from "@/components/checkPermissions";
import { ContentWrap } from "@/components/contentWrap";
import { GlobalShortcutContext } from "@/components/globalShortcut";
import { GroupTitle } from "@/components/groupTitle";
import { KeyButton } from "@/components/keyButton";
import { ResetSettingsButton } from "@/components/resetSettingsButton";
import {
	PLUGIN_ID_AI_CHAT,
	PLUGIN_ID_FFMPEG,
	PLUGIN_ID_GLM_OCR,
	PLUGIN_ID_RAPID_OCR,
	PLUGIN_ID_TRANSLATE,
} from "@/constants/pluginService";
import {
	AppSettingsActionContext,
	AppSettingsPublisher,
} from "@/contexts/appSettingsActionContext";
import { usePluginServiceContext } from "@/contexts/pluginServiceContext";
import { usePlatform } from "@/hooks/usePlatform";
import { useStateSubscriber } from "@/hooks/useStateSubscriber";
import {
	type AppSettingsData,
	AppSettingsGroup,
	ShortcutKeyStatus,
} from "@/types/appSettings";
import {
	AppFunction,
	type AppFunctionComponentConfig,
	type AppFunctionConfig,
	AppFunctionGroup,
} from "@/types/components/appFunction";
import { canUseOcr } from "@/utils/ocr";
import {
	convertShortcutKeyStatusToButtonColor,
	convertShortcutKeyStatusToTip,
} from "./extra";

// 功能语义化解读与专属视觉配色（让新手一眼看懂是干嘛的）
interface FunctionMeta {
	desc: string;
	badge: string;
	color: string;
	gradient: string;
}

const FUNCTION_METAS: Partial<Record<AppFunction, FunctionMeta>> = {
	[AppFunction.Screenshot]: {
		desc: "自由拖拽框选任意区域，自动吸附窗口与像素标尺，即时标注",
		badge: "核心推荐",
		color: "#2563eb",
		gradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
	},
	[AppFunction.ScreenshotFocusedWindow]: {
		desc: "自动识别并精确捕捉当前具有焦点的窗口画面",
		badge: "窗口吸附",
		color: "#0284c7",
		gradient: "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
	},
	[AppFunction.ScreenshotFullScreen]: {
		desc: "一键快速捕获所有显示器或主屏幕的完整画面",
		badge: "全屏即刻",
		color: "#7c3aed",
		gradient: "linear-gradient(135deg, #a855f7 0%, #6d28d9 100%)",
	},
	[AppFunction.ScreenshotDelay]: {
		desc: "倒计时 3 秒后截图，轻松捕捉悬浮菜单与右键下拉列表",
		badge: "延时捕获",
		color: "#d97706",
		gradient: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)",
	},
	[AppFunction.ScreenshotFixed]: {
		desc: "截取画面后自动悬浮置顶在屏幕最顶层，方便对照参考",
		badge: "置顶对比",
		color: "#e11d48",
		gradient: "linear-gradient(135deg, #fb7185 0%, #e11d48 100%)",
	},
	[AppFunction.ScreenshotOcr]: {
		desc: "截取屏幕任意区域，单机离线高精度提取图片所有文本",
		badge: "本地离线",
		color: "#059669",
		gradient: "linear-gradient(135deg, #34d399 0%, #059669 100%)",
	},
	[AppFunction.ScreenshotOcrTranslate]: {
		desc: "截取包含外语的画面，自动识图并直通大模型翻译",
		badge: "智能翻译",
		color: "#0891b2",
		gradient: "linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)",
	},
	[AppFunction.ScreenshotCopy]: {
		desc: "截取画面后无需确认，静默直接存入系统剪贴板",
		badge: "极速存剪贴板",
		color: "#4f46e5",
		gradient: "linear-gradient(135deg, #818cf8 0%, #4338ca 100%)",
	},
	[AppFunction.Translation]: {
		desc: "呼出独立桌面翻译面板，支持中英日韩多语即时互译",
		badge: "多语互译",
		color: "#0284c7",
		gradient: "linear-gradient(135deg, #38bdf8 0%, #0369a1 100%)",
	},
	[AppFunction.TranslationSelectText]: {
		desc: "选中屏幕任意文字，即刻呼出浮窗进行智能翻译",
		badge: "划词浮窗",
		color: "#06b6d4",
		gradient: "linear-gradient(135deg, #67e8f9 0%, #0891b2 100%)",
	},
	[AppFunction.Chat]: {
		desc: "唤起 AI 智能助手，支持多轮对话、截图答疑与代码解析",
		badge: "多模态 AI",
		color: "#8b5cf6",
		gradient: "linear-gradient(135deg, #c084fc 0%, #7c3aed 100%)",
	},
	[AppFunction.ChatSelectText]: {
		desc: "划选屏幕文字一键发送至 AI 对话框，快速提问分析",
		badge: "划词提问",
		color: "#6366f1",
		gradient: "linear-gradient(135deg, #a5b4fc 0%, #4f46e5 100%)",
	},
	[AppFunction.VideoRecord]: {
		desc: "框选任意屏幕区域录制高清视频，支持系统声音录制",
		badge: "高清录像",
		color: "#dc2626",
		gradient: "linear-gradient(135deg, #f87171 0%, #b91c1c 100%)",
	},
	[AppFunction.VideoRecordCopy]: {
		desc: "录制完成后自动编码为 GIF / MP4 并快速存入剪贴板",
		badge: "录完即粘",
		color: "#ea580c",
		gradient: "linear-gradient(135deg, #fb923c 0%, #c2410c 100%)",
	},
	[AppFunction.FixedContent]: {
		desc: "将剪贴板中的图片或文本一键固定悬浮在桌面最顶层",
		badge: "屏幕钉图",
		color: "#db2777",
		gradient: "linear-gradient(135deg, #f472b6 0%, #be185d 100%)",
	},
	[AppFunction.FullScreenDraw]: {
		desc: "开启全屏透明教学画板，适合会议演讲、直播与在线批注",
		badge: "演示笔",
		color: "#65a30d",
		gradient: "linear-gradient(135deg, #a3e635 0%, #4d7c0f 100%)",
	},
	[AppFunction.OpenCaptureHistory]: {
		desc: "快速检索、查看、复用与批量管理历史截图文件",
		badge: "历史检索",
		color: "#ca8a04",
		gradient: "linear-gradient(135deg, #facc15 0%, #a16207 100%)",
	},
	[AppFunction.OpenImageSaveFolder]: {
		desc: "直接在系统文件管理器中定位截图与录屏本地保存目录",
		badge: "本地目录",
		color: "#475569",
		gradient: "linear-gradient(135deg, #94a3b8 0%, #334155 100%)",
	},
	[AppFunction.TopWindow]: {
		desc: "快速将当前活动窗口置顶或取消置顶，便于多任务参考",
		badge: "窗口置顶",
		color: "#0d9488",
		gradient: "linear-gradient(135deg, #2dd4bf 0%, #0f766e 100%)",
	},
	[AppFunction.ShowOrHideMainWindow]: {
		desc: "快速呼出或隐藏 Snow Shot 工作台主界面",
		badge: "工作台呼出",
		color: "#64748b",
		gradient: "linear-gradient(135deg, #94a3b8 0%, #475569 100%)",
	},
};

const getSpecialKeys = (group: AppFunctionGroup) => {
	switch (group) {
		case AppFunctionGroup.Screenshot:
		case AppFunctionGroup.Translation:
		case AppFunctionGroup.Chat:
		case AppFunctionGroup.Other:
			return ["PrintScreen"];
		default:
			return undefined;
	}
};

export const HomePage = () => {
	const { token } = theme.useToken();
	const router = useRouter();

	const { updateAppSettings } = useContext(AppSettingsActionContext);

	const resetFliter = useCallback((group: AppFunctionGroup) => {
		return (settings: Record<string, unknown>) => {
			const newSettings: Partial<
				AppSettingsData[AppSettingsGroup.AppFunction]
			> = {};

			Object.keys(settings).forEach((key) => {
				if ((settings[key] as AppFunctionConfig).group !== group) {
					return;
				}

				newSettings[key as AppFunction] = settings[key] as AppFunctionConfig;
			});

			return newSettings;
		};
	}, []);

	const [currentPlatform] = usePlatform();

	const {
		defaultAppFunctionComponentGroupConfigs,
		updateShortcutKeyStatusLoading,
		appSettingsLoading,
		appFunctionSettings,
		shortcutKeyStatus,
		setShortcutInputActive,
	} = useContext(GlobalShortcutContext);

	useEffect(() => {
		return () => {
			setShortcutInputActive(false);
		};
	}, [setShortcutInputActive]);

	const { isReadyStatus } = usePluginServiceContext();
	const [currentAppSettings, setCurrentAppSettings] =
		useState<AppSettingsData>();
	useStateSubscriber(AppSettingsPublisher, setCurrentAppSettings);

	const ocrReady = currentAppSettings
		? canUseOcr(
				currentAppSettings,
				isReadyStatus?.(PLUGIN_ID_GLM_OCR),
				isReadyStatus?.(PLUGIN_ID_RAPID_OCR),
			)
		: false;

	// 新手指南展开/折叠状态（默认展开）
	const [showGuide, setShowGuide] = useState(() => {
		try {
			const saved = localStorage.getItem("snow_shot_guide_expanded");
			return saved !== null ? saved === "true" : true;
		} catch {
			return true;
		}
	});

	const toggleGuide = useCallback(() => {
		setShowGuide((prev) => {
			const next = !prev;
			try {
				localStorage.setItem("snow_shot_guide_expanded", String(next));
			} catch {}
			return next;
		});
	}, []);

	const isGroupEnabled = useCallback(
		(group: AppFunctionGroup) => {
			switch (group) {
				case AppFunctionGroup.VideoRecord:
					return isReadyStatus?.(PLUGIN_ID_FFMPEG);
				case AppFunctionGroup.Chat:
					return isReadyStatus?.(PLUGIN_ID_AI_CHAT);
				case AppFunctionGroup.Translation:
					return isReadyStatus?.(PLUGIN_ID_TRANSLATE);
				default:
					return true;
			}
		},
		[isReadyStatus],
	);

	const getVisibleConfigs = useCallback(
		(group: AppFunctionGroup) => {
			return (defaultAppFunctionComponentGroupConfigs[group] ?? []).filter(
				(config) => {
					if (
						currentPlatform === "macos" &&
						config.configKey === AppFunction.TopWindow
					) {
						return false;
					}

					if (
						config.configKey === AppFunction.ScreenshotOcr ||
						config.configKey === AppFunction.ScreenshotOcrTranslate
					) {
						return ocrReady;
					}

					return true;
				},
			);
		},
		[currentPlatform, defaultAppFunctionComponentGroupConfigs, ocrReady],
	);

	// 主截屏配置 (Hero Action)
	const primaryScreenshotConfig = useMemo(() => {
		const configs = getVisibleConfigs(AppFunctionGroup.Screenshot);
		return configs.find((c) => c.configKey === AppFunction.Screenshot);
	}, [getVisibleConfigs]);

	// 截图捕获类功能
	const captureConfigs = useMemo(() => {
		return getVisibleConfigs(AppFunctionGroup.Screenshot);
	}, [getVisibleConfigs]);

	// AI 与翻译类功能
	const aiAndTranslationConfigs = useMemo(() => {
		const chat = isGroupEnabled(AppFunctionGroup.Chat)
			? getVisibleConfigs(AppFunctionGroup.Chat)
			: [];
		const trans = isGroupEnabled(AppFunctionGroup.Translation)
			? getVisibleConfigs(AppFunctionGroup.Translation)
			: [];
		return [...chat, ...trans];
	}, [getVisibleConfigs, isGroupEnabled]);

	// 实用工具类功能
	const utilityConfigs = useMemo(() => {
		const video = isGroupEnabled(AppFunctionGroup.VideoRecord)
			? getVisibleConfigs(AppFunctionGroup.VideoRecord)
			: [];
		const other = getVisibleConfigs(AppFunctionGroup.Other);
		return [...video, ...other];
	}, [getVisibleConfigs, isGroupEnabled]);

	// 渲染现代交互卡片
	const renderModernCard = (
		config: AppFunctionComponentConfig,
		group: AppFunctionGroup,
	) => {
		const key = config.configKey;
		const currentShortcutKey =
			appFunctionSettings?.[key as AppFunction]?.shortcutKey;
		const meta = FUNCTION_METAS[key] ?? {
			desc: "高效实用的桌面快捷能力",
			badge: "实用",
			color: token.colorPrimary,
			gradient: `linear-gradient(135deg, ${token.colorPrimary} 0%, #1677ff 100%)`,
		};

		const statusColor = appSettingsLoading
			? undefined
			: convertShortcutKeyStatusToButtonColor(
					shortcutKeyStatus?.[key as AppFunction],
				);

		const statusTip = appSettingsLoading
			? undefined
			: convertShortcutKeyStatusToTip(shortcutKeyStatus?.[key as AppFunction]);

		let shortcutTag = <></>;
		if (shortcutKeyStatus?.[key as AppFunction] === ShortcutKeyStatus.None) {
			shortcutTag = (
				<span className="snow-keycap-none">
					<FormattedMessage id="home.shortcut.none" defaultMessage="未设置" />
				</span>
			);
		} else if (statusTip) {
			shortcutTag = (
				<Tooltip title={statusTip}>
					<InfoCircleOutlined className="snow-keycap-warn-icon" />
				</Tooltip>
			);
		}

		return (
			// biome-ignore lint/a11y/useSemanticElements: interactive card container with nested controls
			<div
				className="snow-feature-card"
				key={`${group}-${key}`}
				role="button"
				tabIndex={0}
				onClick={async () => {
					try {
						await config.onClick();
					} catch (e) {
						console.error("Execute action error", e);
					}
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						config.onClick();
					}
				}}
			>
				<div className="snow-card-left">
					<div
						className="snow-card-icon-box"
						style={{ background: meta.gradient }}
						aria-hidden="true"
					>
						{config.icon}
					</div>
				</div>

				<div className="snow-card-body">
					<div className="snow-card-top-row">
						<span className="snow-card-title">{config.title}</span>
						{meta.badge && (
							<span
								className="snow-card-badge"
								style={{
									color: meta.color,
									backgroundColor: `color-mix(in srgb, ${meta.color} 10%, transparent)`,
									borderColor: `color-mix(in srgb, ${meta.color} 25%, transparent)`,
								}}
							>
								{meta.badge}
							</span>
						)}
					</div>
					<div className="snow-card-desc">{meta.desc}</div>
				</div>

				<div
					className="snow-card-action-side"
					onClick={(e) => e.stopPropagation()}
				>
					<KeyButton
						speicalKeys={getSpecialKeys(group)}
						title={config.title}
						maxWidth={140}
						keyValue={currentShortcutKey ?? ""}
						buttonProps={{
							variant: "dashed",
							color: statusColor,
							children: shortcutTag,
							className: "snow-keycap-pill",
							onClick: () => {
								setShortcutInputActive(true);
							},
						}}
						onCancel={() => {
							setShortcutInputActive(false);
						}}
						onKeyChange={async (value) => {
							setShortcutInputActive(false);
							updateAppSettings(
								AppSettingsGroup.AppFunction,
								{
									[key as AppFunction]: {
										...(appFunctionSettings?.[key as AppFunction] ?? {}),
										shortcutKey: value,
									},
								},
								false,
								true,
								false,
								false,
							);
						}}
						maxLength={1}
					/>
					<Tooltip title="立即运行">
						<button
							type="button"
							className="snow-card-run-btn"
							aria-label="立即运行"
							onClick={async (e) => {
								e.stopPropagation();
								await config.onClick();
							}}
						>
							<PlayCircleOutlined />
						</button>
					</Tooltip>
				</div>
			</div>
		);
	};

	return (
		<ContentWrap className="home-wrap">
			<CheckPermissions />

			{/* 顶部现代化欢迎横幅与状态面板 */}
			<header className="snow-home-hero">
				<div className="snow-hero-header">
					<div className="snow-hero-brand-wrap">
						<div className="snow-hero-badge-pill">
							<ThunderboltOutlined className="snow-hero-pill-icon" />
							<span>现代化智能截图与 AI 生产力工作台</span>
						</div>
						<h1 className="snow-hero-title">
							欢迎使用 <span className="snow-hero-highlight">Snow Shot</span>
						</h1>
						<p className="snow-hero-subtitle">
							轻量、本地优先、开箱即用。按{" "}
							<kbd className="snow-kbd-hero">
								{primaryScreenshotConfig?.shortcutKey || "F1"}
							</kbd>{" "}
							随时开启精准框选截屏，或在下方直接点击体验各项专业工具。
						</p>
					</div>

					{/* 实时状态指示面板 */}
					<div className="snow-hero-status-strip">
						<div className="snow-status-indicator">
							<span className="snow-status-dot is-online" />
							<span className="snow-status-label">守护状态:</span>
							<span className="snow-status-val">已就绪</span>
						</div>
						<div className="snow-status-indicator">
							<ThunderboltOutlined style={{ color: "#3b82f6" }} />
							<span className="snow-status-label">主快捷键:</span>
							<span className="snow-status-val is-hotkey">
								{primaryScreenshotConfig?.shortcutKey || "F1"}
							</span>
						</div>
						<div className="snow-status-indicator">
							<CheckCircleFilled
								style={{ color: ocrReady ? "#10b981" : "#94a3b8" }}
							/>
							<span className="snow-status-label">离线 OCR:</span>
							<span className="snow-status-val">
								{ocrReady ? "本地就绪" : "待安装"}
							</span>
						</div>
					</div>
				</div>

				{/* 超级大卡片：核心一键截屏 CTA */}
				{primaryScreenshotConfig && (
					// biome-ignore lint/a11y/useSemanticElements: hero action container with interactive child buttons
					<div
						className="snow-hero-action-card"
						role="button"
						tabIndex={0}
						onClick={() => primaryScreenshotConfig.onClick()}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								primaryScreenshotConfig.onClick();
							}
						}}
					>
						<div className="snow-hero-action-glow" />
						<div className="snow-hero-action-left">
							<div className="snow-hero-action-icon">
								<CameraOutlined />
							</div>
							<div className="snow-hero-action-text">
								<div className="snow-hero-action-headline">
									<h2>立即开始截图</h2>
									<Tag color="blue" className="snow-hero-tag">
										最常用
									</Tag>
								</div>
								<p>
									自由拖拽框选任意区域，自动吸附窗口与像素标尺，即刻唤起专业标注画板
								</p>
							</div>
						</div>

						<div
							className="snow-hero-action-right"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="snow-hero-key-badge">
								快捷键: <kbd>{primaryScreenshotConfig.shortcutKey || "F1"}</kbd>
							</div>
							<Button
								type="primary"
								size="large"
								icon={<CameraOutlined />}
								className="snow-hero-snip-btn"
								onClick={async (e) => {
									e.stopPropagation();
									await primaryScreenshotConfig.onClick();
								}}
							>
								点击截屏
							</Button>
						</div>
					</div>
				)}
			</header>

			{/* 新手极速上手向导 */}
			<section className="snow-guide-section" aria-label="新手入门指南">
				<div className="snow-guide-header" onClick={toggleGuide}>
					<div className="snow-guide-header-left">
						<BulbOutlined className="snow-guide-bulb-icon" />
						<span className="snow-guide-header-title">
							新手 3 步极速上手指南
						</span>
						<span className="snow-guide-header-hint">
							一分钟了解截图标注与贴图
						</span>
					</div>
					<Button
						type="text"
						size="small"
						className="snow-guide-toggle-btn"
						icon={showGuide ? <UpOutlined /> : <DownOutlined />}
					>
						{showGuide ? "收起向导" : "展开向导"}
					</Button>
				</div>

				{showGuide && (
					<div className="snow-guide-grid">
						<div className="snow-guide-card">
							<div className="snow-guide-step-num">01</div>
							<div className="snow-guide-step-body">
								<h4>一键框选选区</h4>
								<p>
									按快捷键 <kbd>F1</kbd>{" "}
									或点击截屏卡片，鼠标拖动选择任意截取区域，自动智能识别窗口边缘。
								</p>
							</div>
						</div>

						<div className="snow-guide-card">
							<div className="snow-guide-step-num">02</div>
							<div className="snow-guide-step-body">
								<h4>丰富专业标注</h4>
								<p>
									选区下方即刻呼出 Excalidraw
									画板，支持矩形、箭头、序号笔、文字与局部马赛克模糊。
								</p>
							</div>
						</div>

						<div className="snow-guide-card">
							<div className="snow-guide-step-num">03</div>
							<div className="snow-guide-step-body">
								<h4>多维便捷产出</h4>
								<p>
									按 <kbd>Ctrl+C</kbd> 存入剪贴板，点 <kbd>钉子</kbd>{" "}
									置顶桌面参考，或一键离线提取文字/直通翻译。
								</p>
							</div>
						</div>
					</div>
				)}
			</section>

			{/* 分组一：核心截屏捕获模式 */}
			<section className="snow-category-section">
				<GroupTitle
					id="captureModesGroup"
					extra={
						<ResetSettingsButton
							title={<FormattedMessage id="home.screenshotFunction" />}
							appSettingsGroup={AppSettingsGroup.AppFunction}
							filter={resetFliter(AppFunctionGroup.Screenshot)}
						/>
					}
				>
					<span className="snow-category-title-text">
						📸 核心截屏与捕获模式 (Capture Modes)
					</span>
				</GroupTitle>

				<Spin spinning={updateShortcutKeyStatusLoading || appSettingsLoading}>
					<div className="snow-cards-grid">
						{captureConfigs.map((config) =>
							renderModernCard(config, AppFunctionGroup.Screenshot),
						)}
					</div>
				</Spin>
			</section>

			{/* 分组二：AI 智能与语言翻译 */}
			{aiAndTranslationConfigs.length > 0 && (
				<section className="snow-category-section">
					<GroupTitle id="aiTranslationGroup">
						<span className="snow-category-title-text">
							🤖 AI 智能与语言翻译 (AI & Language Suite)
						</span>
					</GroupTitle>

					<Spin spinning={updateShortcutKeyStatusLoading || appSettingsLoading}>
						<div className="snow-cards-grid">
							{aiAndTranslationConfigs.map((config) =>
								renderModernCard(config, config.group),
							)}
						</div>
					</Spin>
				</section>
			)}

			{/* 分组三：录屏、贴图与桌面实用工具 */}
			{utilityConfigs.length > 0 && (
				<section className="snow-category-section">
					<GroupTitle id="utilitiesGroup">
						<span className="snow-category-title-text">
							🛠️ 录屏、贴图与桌面辅助 (Recording & Workspace Utilities)
						</span>
					</GroupTitle>

					<Spin spinning={updateShortcutKeyStatusLoading || appSettingsLoading}>
						<div className="snow-cards-grid">
							{utilityConfigs.map((config) =>
								renderModernCard(config, config.group),
							)}
						</div>
					</Spin>
				</section>
			)}

			{/* 底部快速辅助坞 (Quick Utility Dock) */}
			<footer className="snow-home-footer-dock">
				<div className="snow-dock-left">
					<span className="snow-dock-hint">常用快捷跳转:</span>
					<Space wrap size="small">
						<Button
							size="small"
							icon={<HistoryOutlined />}
							onClick={() => router.navigate({ to: "/tools/captureHistory" })}
						>
							截图历史
						</Button>
						<Button
							size="small"
							icon={<SettingOutlined />}
							onClick={() =>
								router.navigate({ to: "/settings/systemSettings" })
							}
						>
							系统设置
						</Button>
						<Button
							size="small"
							icon={<FolderOpenOutlined />}
							onClick={async () => {
								const folderConfig = utilityConfigs.find(
									(c) => c.configKey === AppFunction.OpenImageSaveFolder,
								);
								await folderConfig?.onClick?.();
							}}
						>
							打开图片目录
						</Button>
					</Space>
				</div>
				<div className="snow-dock-right">
					<span>按 ESC 或点击右侧按键可随时自定义修改快捷键</span>
				</div>
			</footer>

			<style jsx global>{`
				/* 现代化工作台样式系统 */
				.home-wrap {
					max-width: 1280px;
					margin: 0 auto;
					padding-bottom: 40px;
				}

				/* 顶部 Hero Banner */
				.snow-home-hero {
					margin-bottom: 24px;
					background: var(--snow-shot-surface-card);
					border: 1px solid var(--snow-shot-hairline-soft);
					border-radius: var(--snow-shot-radius-lg);
					padding: 24px;
					box-shadow: 0 4px 20px -8px rgba(0, 0, 0, 0.06);
					transition: border-color 0.2s ease;
				}

				.snow-home-hero:hover {
					border-color: var(--snow-shot-hairline);
				}

				.snow-hero-header {
					display: flex;
					align-items: flex-start;
					justify-content: space-between;
					gap: 20px;
					flex-wrap: wrap;
					margin-bottom: 20px;
				}

				.snow-hero-brand-wrap {
					max-width: 680px;
				}

				.snow-hero-badge-pill {
					display: inline-flex;
					align-items: center;
					gap: 6px;
					font-size: 12px;
					font-weight: 500;
					padding: 3px 10px;
					border-radius: 999px;
					background: color-mix(in srgb, var(--snow-shot-primary) 10%, transparent);
					color: var(--snow-shot-primary);
					border: 1px solid color-mix(in srgb, var(--snow-shot-primary) 20%, transparent);
					margin-bottom: 10px;
				}

				.snow-hero-pill-icon {
					font-size: 13px;
				}

				.snow-hero-title {
					font-size: 24px;
					font-weight: 700;
					color: var(--snow-shot-ink);
					margin: 0 0 8px 0;
					letter-spacing: -0.02em;
				}

				.snow-hero-highlight {
					background: linear-gradient(135deg, #2563eb, #7c3aed);
					-webkit-background-clip: text;
					-webkit-text-fill-color: transparent;
				}

				.snow-hero-subtitle {
					font-size: 14px;
					color: var(--snow-shot-muted);
					line-height: 1.6;
					margin: 0;
				}

				.snow-kbd-hero {
					display: inline-block;
					padding: 1px 7px;
					font-family: monospace;
					font-size: 13px;
					font-weight: 600;
					color: var(--snow-shot-ink);
					background: var(--snow-shot-surface-elevated);
					border: 1px solid var(--snow-shot-hairline-strong);
					border-bottom-width: 2px;
					border-radius: 5px;
					margin: 0 3px;
				}

				/* 状态面板 */
				.snow-hero-status-strip {
					display: flex;
					align-items: center;
					gap: 12px;
					flex-wrap: wrap;
					background: var(--snow-shot-surface-elevated);
					border: 1px solid var(--snow-shot-hairline-soft);
					border-radius: var(--snow-shot-radius);
					padding: 10px 14px;
				}

				.snow-status-indicator {
					display: inline-flex;
					align-items: center;
					gap: 6px;
					font-size: 12px;
				}

				.snow-status-dot {
					width: 8px;
					height: 8px;
					border-radius: 50%;
					background: #94a3b8;
				}

				.snow-status-dot.is-online {
					background: #10b981;
					box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
				}

				.snow-status-label {
					color: var(--snow-shot-muted);
				}

				.snow-status-val {
					font-weight: 600;
					color: var(--snow-shot-ink);
				}

				.snow-status-val.is-hotkey {
					color: #2563eb;
					font-family: monospace;
				}

				/* 超级大卡片 CTA */
				.snow-hero-action-card {
					position: relative;
					overflow: hidden;
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 20px;
					padding: 20px 24px;
					background: linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(124, 58, 237, 0.06) 100%);
					border: 1.5px solid color-mix(in srgb, var(--snow-shot-primary) 35%, transparent);
					border-radius: var(--snow-shot-radius);
					cursor: pointer;
					transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
				}

				.snow-hero-action-card:hover {
					border-color: var(--snow-shot-primary);
					background: linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(124, 58, 237, 0.09) 100%);
					transform: translateY(-2px);
					box-shadow: 0 10px 24px -6px rgba(37, 99, 235, 0.18);
				}

				.snow-hero-action-card:active {
					transform: translateY(0);
				}

				.snow-hero-action-left {
					display: flex;
					align-items: center;
					gap: 16px;
				}

				.snow-hero-action-icon {
					width: 52px;
					height: 52px;
					flex: 0 0 auto;
					border-radius: 12px;
					background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
					color: #fff;
					display: flex;
					align-items: center;
					justify-content: center;
					font-size: 26px;
					box-shadow: 0 6px 16px -4px rgba(37, 99, 235, 0.4);
				}

				.snow-hero-action-text h2 {
					font-size: 18px;
					font-weight: 700;
					color: var(--snow-shot-ink);
					margin: 0;
					line-height: 1.2;
				}

				.snow-hero-action-headline {
					display: flex;
					align-items: center;
					gap: 10px;
					margin-bottom: 4px;
				}

				.snow-hero-tag {
					margin: 0 !important;
					font-weight: 500;
					border-radius: 4px;
				}

				.snow-hero-action-text p {
					margin: 0;
					font-size: 13px;
					color: var(--snow-shot-muted);
					line-height: 1.4;
				}

				.snow-hero-action-right {
					display: flex;
					align-items: center;
					gap: 16px;
				}

				.snow-hero-key-badge {
					font-size: 13px;
					color: var(--snow-shot-muted);
					display: flex;
					align-items: center;
					gap: 6px;
				}

				.snow-hero-key-badge kbd {
					padding: 2px 8px;
					background: var(--snow-shot-surface-elevated);
					border: 1px solid var(--snow-shot-hairline-strong);
					border-bottom-width: 2px;
					border-radius: 5px;
					font-family: monospace;
					font-weight: 700;
					color: #2563eb;
					font-size: 14px;
				}

				.snow-hero-snip-btn {
					height: 44px !important;
					padding-inline: 20px !important;
					font-weight: 600 !important;
					font-size: 15px !important;
					border-radius: 8px !important;
					background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%) !important;
					box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35) !important;
				}

				/* 新手向导 */
				.snow-guide-section {
					margin-bottom: 24px;
					background: var(--snow-shot-surface-card);
					border: 1px solid var(--snow-shot-hairline-soft);
					border-radius: var(--snow-shot-radius-lg);
					overflow: hidden;
				}

				.snow-guide-header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 12px 18px;
					cursor: pointer;
					background: color-mix(in srgb, var(--snow-shot-surface-elevated) 60%, transparent);
					transition: background-color 0.16s ease;
				}

				.snow-guide-header:hover {
					background: var(--snow-shot-surface-elevated);
				}

				.snow-guide-header-left {
					display: flex;
					align-items: center;
					gap: 10px;
				}

				.snow-guide-bulb-icon {
					color: #eab308;
					font-size: 16px;
				}

				.snow-guide-header-title {
					font-size: 14px;
					font-weight: 600;
					color: var(--snow-shot-ink);
				}

				.snow-guide-header-hint {
					font-size: 12px;
					color: var(--snow-shot-muted);
				}

				.snow-guide-grid {
					display: grid;
					grid-template-columns: repeat(3, 1fr);
					gap: 16px;
					padding: 16px 18px;
					border-top: 1px solid var(--snow-shot-hairline-soft);
					background: var(--snow-shot-surface);
				}

				.snow-guide-card {
					display: flex;
					align-items: flex-start;
					gap: 12px;
					padding: 12px 14px;
					background: var(--snow-shot-surface-elevated);
					border: 1px solid var(--snow-shot-hairline-soft);
					border-radius: var(--snow-shot-radius);
				}

				.snow-guide-step-num {
					font-size: 20px;
					font-weight: 800;
					font-family: monospace;
					color: #2563eb;
					opacity: 0.85;
					line-height: 1;
				}

				.snow-guide-step-body h4 {
					margin: 0 0 4px 0;
					font-size: 13px;
					font-weight: 600;
					color: var(--snow-shot-ink);
				}

				.snow-guide-step-body p {
					margin: 0;
					font-size: 12px;
					color: var(--snow-shot-muted);
					line-height: 1.5;
				}

				.snow-guide-step-body kbd {
					padding: 1px 5px;
					font-size: 11px;
					font-family: monospace;
					background: var(--snow-shot-surface-card);
					border: 1px solid var(--snow-shot-hairline);
					border-radius: 4px;
				}

				/* 分类区段 */
				.snow-category-section {
					margin-bottom: 24px;
					background: var(--snow-shot-surface-card);
					border: 1px solid var(--snow-shot-hairline-soft);
					border-radius: var(--snow-shot-radius-lg);
					padding: 16px 20px 20px;
					transition: border-color 0.2s ease;
				}

				.snow-category-section:hover {
					border-color: var(--snow-shot-hairline);
				}

				.snow-category-title-text {
					font-size: 15px;
					font-weight: 600;
					color: var(--snow-shot-ink);
				}

				/* 现代功能卡片网格 */
				.snow-cards-grid {
					display: grid;
					grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
					gap: 12px;
					margin-top: 12px;
				}

				/* 现代功能卡片 */
				.snow-feature-card {
					display: flex;
					align-items: center;
					gap: 12px;
					padding: 12px 14px;
					background: var(--snow-shot-surface);
					border: 1px solid var(--snow-shot-hairline);
					border-radius: var(--snow-shot-radius);
					cursor: pointer;
					transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
					position: relative;
					overflow: hidden;
				}

				.snow-feature-card:hover {
					background: var(--snow-shot-surface-elevated);
					border-color: var(--snow-shot-primary-strong);
					transform: translateY(-2px);
					box-shadow: 0 6px 16px -4px rgba(0, 0, 0, 0.08);
				}

				.snow-feature-card:focus-visible {
					outline: 2px solid var(--snow-shot-primary);
					outline-offset: 1px;
				}

				.snow-card-left {
					flex: 0 0 auto;
				}

				.snow-card-icon-box {
					width: 40px;
					height: 40px;
					border-radius: 10px;
					color: #ffffff;
					display: flex;
					align-items: center;
					justify-content: center;
					font-size: 19px;
					box-shadow: 0 3px 8px -2px rgba(0, 0, 0, 0.2);
					transition: transform 0.18s ease;
				}

				.snow-feature-card:hover .snow-card-icon-box {
					transform: scale(1.06);
				}

				.snow-card-body {
					flex: 1 1 auto;
					min-width: 0;
				}

				.snow-card-top-row {
					display: flex;
					align-items: center;
					gap: 6px;
					margin-bottom: 3px;
				}

				.snow-card-title {
					font-size: 14px;
					font-weight: 600;
					color: var(--snow-shot-ink);
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				.snow-card-badge {
					font-size: 10px;
					font-weight: 500;
					padding: 1px 5px;
					border-radius: 3px;
					border: 1px solid transparent;
					white-space: nowrap;
				}

				.snow-card-desc {
					font-size: 12px;
					color: var(--snow-shot-muted);
					line-height: 1.4;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				.snow-card-action-side {
					flex: 0 0 auto;
					display: flex;
					align-items: center;
					gap: 6px;
				}

				.snow-keycap-pill {
					min-width: 60px;
					height: 28px !important;
					padding: 0 8px !important;
					font-size: 12px !important;
					font-weight: 600 !important;
					font-family: monospace !important;
					border-radius: 5px !important;
					box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
				}

				.snow-keycap-none {
					color: var(--snow-shot-muted);
					font-size: 11px;
					font-weight: normal;
				}

				.snow-keycap-warn-icon {
					color: #f59e0b;
					margin-inline-start: 4px;
				}

				.snow-card-run-btn {
					width: 28px;
					height: 28px;
					border: none;
					background: transparent;
					border-radius: 5px;
					color: var(--snow-shot-muted);
					display: flex;
					align-items: center;
					justify-content: center;
					font-size: 15px;
					cursor: pointer;
					transition: all 0.15s ease;
				}

				.snow-card-run-btn:hover {
					color: var(--snow-shot-primary);
					background: color-mix(in srgb, var(--snow-shot-primary) 10%, transparent);
				}

				/* 底部快速辅助坞 */
				.snow-home-footer-dock {
					display: flex;
					align-items: center;
					justify-content: space-between;
					flex-wrap: wrap;
					gap: 12px;
					padding: 14px 18px;
					background: var(--snow-shot-surface-card);
					border: 1px solid var(--snow-shot-hairline-soft);
					border-radius: var(--snow-shot-radius-lg);
					font-size: 12px;
					color: var(--snow-shot-muted);
				}

				.snow-dock-left {
					display: flex;
					align-items: center;
					gap: 10px;
					flex-wrap: wrap;
				}

				.snow-dock-hint {
					font-weight: 500;
					color: var(--snow-shot-ink);
				}

				.snow-dock-right {
					color: var(--snow-shot-muted);
				}

				/* 响应式断点适配 */
				@media (max-width: 900px) {
					.snow-guide-grid {
						grid-template-columns: 1fr;
					}

					.snow-hero-action-card {
						flex-direction: column;
						align-items: flex-start;
					}

					.snow-hero-action-right {
						width: 100%;
						justify-content: space-between;
					}

					.snow-cards-grid {
						grid-template-columns: 1fr;
					}
				}
			`}</style>
		</ContentWrap>
	);
};
