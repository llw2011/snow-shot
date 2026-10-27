"use client";

import { Link, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { FormattedMessage, useIntl } from "react-intl";
import { HotkeysMenu } from "@/components/hotkeysMenu";
import { ShortcutKeycap, useShortcutInfo } from "@/components/shortcutEditor";
import { Translator, type TranslatorActionType } from "@/components/translator";
import { ToolPage, WorkbenchIcon } from "@/components/workbench";
import { finishScreenshot } from "@/functions/screenshot";
import { useAppSettingsLoad } from "@/hooks/useAppSettingsLoad";
import { AppSettingsGroup } from "@/types/appSettings";
import { AppFunction } from "@/types/components/appFunction";
import {
	CommonKeyEventKey,
	type CommonKeyEventValue,
} from "@/types/core/commonKeyEvent";
import { decodeParamsValue } from "@/utils/base64";
import { copyText, copyTextAndHide } from "@/utils/clipboard";
import { formatKey } from "@/utils/format";

const TranslationCore = () => {
	const intl = useIntl();
	const appFunctionShortcut = useShortcutInfo(
		AppFunction.Translation,
	).shortcutKey;

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
		<ToolPage
			icon="translate"
			title={<FormattedMessage id="workbench.item.translation" />}
			actions={
				<>
					{appFunctionShortcut && (
						<span className="translation-shortcut">
							<ShortcutKeycap appFunction={AppFunction.Translation} />
						</span>
					)}
					<HotkeysMenu
						variant="toolbar"
						menu={{
							items: [
								{
									label: (
										<FormattedMessage
											id="settings.hotKeySettings.keyEventTooltip"
											values={{
												message: (
													<FormattedMessage id="tools.translation.copy" />
												),
												key: formatKey(
													hotKeys?.[CommonKeyEventKey.Copy]?.hotKey,
												),
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
					<Link
						to="/w/$itemId"
						params={{ itemId: "translationPreferences" }}
						className="wb-icon-button"
						title={intl.formatMessage({
							id: "workbench.item.translationPreferences",
						})}
						aria-label={intl.formatMessage({
							id: "workbench.item.translationPreferences",
						})}
					>
						<WorkbenchIcon name="sliders" />
					</Link>
				</>
			}
		>
			<div className="translation-tool-body snow-scroll">
				<Translator actionRef={translatorActionRef} />
			</div>
			<style jsx>{`
				.translation-tool-body {
					height: 100%;
					padding: 16px 20px 20px;
					overflow: auto;
					box-sizing: border-box;
				}

				.translation-shortcut {
					display: inline-flex;
				}
			`}</style>
		</ToolPage>
	);
};
export const TranslationPage = () => {
	return <TranslationCore />;
};
