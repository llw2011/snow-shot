"use client";

import {
	ArrowLeftOutlined,
	CloseOutlined,
	MinusOutlined,
	TranslationOutlined,
} from "@ant-design/icons";
import { useRouter, useSearch } from "@tanstack/react-router";
import {
	type Window as AppWindow,
	getCurrentWindow,
} from "@tauri-apps/api/window";
import { Button, Space, theme } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { FormattedMessage } from "react-intl";
import { ContentWrap } from "@/components/contentWrap";
import { HotkeysMenu } from "@/components/hotkeysMenu";
import { Translator, type TranslatorActionType } from "@/components/translator";
import { finishScreenshot } from "@/functions/screenshot";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { usePlatform } from "@/hooks/usePlatform";
import { AppSettingsGroup } from "@/types/appSettings";
import {
	CommonKeyEventKey,
	type CommonKeyEventValue,
} from "@/types/core/commonKeyEvent";
import { decodeParamsValue } from "@/utils/base64";
import { copyText, copyTextAndHide } from "@/utils/clipboard";
import { formatKey } from "@/utils/format";

const TranslationCore = () => {
	const { token } = theme.useToken();
	const router = useRouter();
	const [currentPlatform] = usePlatform();
	const appWindowRef = useRef<AppWindow | undefined>(undefined);
	useEffect(() => {
		appWindowRef.current = getCurrentWindow();
	}, []);

	const handleNavigateBack = useCallback(() => {
		if (window.history.length > 1) {
			router.history.back();
		} else {
			router.navigate({ to: "/" });
		}
	}, [router]);

	useHotkeys("esc", handleNavigateBack, {
		enableOnFormTags: false,
		preventDefault: true,
	});

	const translatorActionRef = useRef<TranslatorActionType>(undefined);

	const searchParams = useSearch({ from: "/_layout/tools/translation" }) as {
		t?: string;
		selectText?: string;
	};
	const searchParamsSign = searchParams.t;
	const searchParamsSelectText = searchParams.selectText;
	const prevSearchParamsSign = useRef<string | undefined>(undefined);
	const ignoreDebounce = useRef<boolean>(false);
	const updateSourceContentBySelectedText = useCallback(async () => {
		if (prevSearchParamsSign.current === searchParamsSign) {
			return;
		}

		prevSearchParamsSign.current = searchParamsSign;

		if (searchParamsSelectText) {
			await finishScreenshot();

			translatorActionRef.current?.setSourceContent(
				decodeParamsValue(searchParamsSelectText).substring(0, 5000),
				true,
			);
			ignoreDebounce.current = true;
		}

		setTimeout(() => {
			translatorActionRef.current?.getSourceContentRef()?.focus();
			prevSearchParamsSign.current = searchParamsSign;
		}, 64);
	}, [searchParamsSign, searchParamsSelectText]);

	useEffect(() => {
		updateSourceContentBySelectedText();
	}, [updateSourceContentBySelectedText]);

	const [hotKeys, setHotKeys] =
		useState<Record<CommonKeyEventKey, CommonKeyEventValue>>();
	useAppSettingsLoad(
		useCallback((appSettings) => {
			setHotKeys(appSettings[AppSettingsGroup.CommonKeyEvent]);
		}, []),
		true,
	);

	const onCopy = useCallback(() => {
		if (!translatorActionRef.current) {
			return;
		}

		copyText(
			translatorActionRef.current
				.getTranslatedContent()
				.map((item) => item.content)
				.join("\n"),
		);
	}, []);
	const onCopyAndHide = useCallback(() => {
		if (!translatorActionRef.current) {
			return;
		}

		copyTextAndHide(
			translatorActionRef.current
				.getTranslatedContent()
				.map((item) => item.content)
				.join("\n"),
		);
	}, []);

	useHotkeys(
		hotKeys?.[CommonKeyEventKey.CopyAndHide]?.hotKey ?? "",
		onCopyAndHide,
		{
			keyup: false,
			keydown: true,
			preventDefault: true,
			enableOnFormTags: ["INPUT", "TEXTAREA", "SELECT"],
		},
	);
	useHotkeys(hotKeys?.[CommonKeyEventKey.Copy]?.hotKey ?? "", onCopy, {
		keyup: false,
		keydown: true,
		preventDefault: true,
		enableOnFormTags: ["INPUT", "TEXTAREA", "SELECT"],
	});

	return (
		<div className="translation-page-container">
			{/* 顶部现代化导航与标题栏 */}
			<div
				className={`translation-header ${currentPlatform === "macos" ? "is-macos" : ""}`}
				data-tauri-drag-region
			>
				<Space className="translation-header-left" align="center">
					<Button
						type="text"
						icon={<ArrowLeftOutlined />}
						className="translation-back-btn"
						onClick={handleNavigateBack}
						title="返回首页 (Esc)"
					>
						返回
					</Button>
					<span className="translation-header-divider" />
					<div className="translation-header-title">
						<TranslationOutlined style={{ color: "#2563eb", marginRight: 6 }} />
						<span>极速翻译工作台</span>
					</div>
				</Space>

				<div className="translation-header-center" data-tauri-drag-region />

				{currentPlatform !== "macos" && (
					<Space className="translation-header-right" align="center">
						<Button
							className="window-command-button translation-window-btn"
							type="text"
							size="small"
							icon={<MinusOutlined />}
							aria-label="Minimize"
							title="最小化"
							onClick={() => {
								appWindowRef.current?.minimize();
							}}
						/>
						<Button
							className="window-command-button translation-window-btn"
							type="text"
							size="small"
							icon={<CloseOutlined />}
							aria-label="Hide"
							title="隐藏"
							onClick={() => {
								appWindowRef.current?.hide();
								appWindowRef.current?.emit("on-hide-main-window");
							}}
						/>
					</Space>
				)}
			</div>

			<ContentWrap className="settings-wrap translation-content-wrap">
				<Translator actionRef={translatorActionRef} />

				<HotkeysMenu
					className="translation-hotkeys-menu"
					menu={{
						items: [
							{
								label: (
									<FormattedMessage
										id="settings.hotKeySettings.keyEventTooltip"
										values={{
											message: <FormattedMessage id="tools.translation.copy" />,
											key: formatKey(hotKeys?.[CommonKeyEventKey.Copy]?.hotKey),
										}}
									/>
								),
								key: "copy",
								onClick: onCopy,
							},
							{
								label: (
									<FormattedMessage
										id="settings.hotKeySettings.keyEventTooltip"
										values={{
											message: (
												<FormattedMessage id="tools.translation.copyAndHide" />
											),
											key: formatKey(
												hotKeys?.[CommonKeyEventKey.CopyAndHide]?.hotKey,
											),
										}}
									/>
								),
								key: "copyAndHide",
								onClick: onCopyAndHide,
							},
						],
					}}
				/>
			</ContentWrap>

			<style jsx>{`
				.translation-page-container {
					display: flex;
					flex-direction: column;
					height: 100%;
					width: 100%;
				}

				.translation-header {
					height: 48px;
					box-sizing: border-box;
					border-bottom: 1px solid var(--snow-shot-hairline);
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 0 14px;
					background: var(--snow-shot-header-bg);
					user-select: none;
					flex: 0 0 auto;
				}

				.translation-header.is-macos {
					padding-inline-start: 76px !important;
				}

				.translation-header-left,
				.translation-header-right {
					display: flex;
					align-items: center;
					gap: 6px;
				}

				.translation-header-center {
					flex: 1 1 auto;
					height: 100%;
					min-width: 16px;
				}

				.translation-back-btn {
					display: inline-flex;
					align-items: center;
					gap: 4px;
					font-weight: 500;
					color: var(--snow-shot-ink) !important;
				}

				.translation-back-btn:hover {
					background-color: var(--snow-shot-surface-elevated) !important;
				}

				.translation-header-divider {
					display: inline-block;
					width: 1px;
					height: 16px;
					background: var(--snow-shot-hairline);
					margin: 0 4px;
				}

				.translation-header-title {
					font-size: 14px;
					font-weight: 600;
					color: var(--snow-shot-ink);
					display: flex;
					align-items: center;
				}

				.translation-window-btn {
					color: var(--snow-shot-muted) !important;
				}

				.translation-window-btn:hover {
					color: var(--snow-shot-ink) !important;
					background-color: var(--snow-shot-surface-elevated) !important;
				}

				.translation-content-wrap {
					flex: 1 1 auto;
					overflow: auto;
				}

                :global(.translation-hotkeys-menu) {
                    position: fixed;
                    bottom: 0;
                    right: 0;
                    padding: ${token.padding}px;
                }
            `}</style>
		</div>
	);
};

export const TranslationPage = () => {
	return <TranslationCore />;
};
