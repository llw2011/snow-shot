import { Button, Slider } from "antd";
import type React from "react";
import { useContext, useMemo } from "react";
import { FormattedMessage } from "react-intl";
import { GlobalShortcutContext } from "@/components/globalShortcut";
import { SettingsGroup } from "@/components/settingsGroup";
import { ShortcutEditor, useShortcutInfo } from "@/components/shortcutEditor";
import {
	DetailPage,
	RelatedLinks,
	WorkbenchIcon,
} from "@/components/workbench";
import type { WorkbenchItem } from "@/components/workbench/registry";
import { AppSettingsActionContext } from "@/contexts/appSettingsActionContext";
import { useAppSettingsSnapshot } from "@/pages/settings/shared/hooks";
import { SettingsLine } from "@/pages/settings/shared/settingsLine";
import { AppSettingsGroup } from "@/types/appSettings";
import {
	type AppFunction,
	AppFunctionGroup,
} from "@/types/components/appFunction";

const ShortcutGroup: React.FC<{
	appFunction: AppFunction;
	titleId: string;
	group: AppFunctionGroup;
}> = ({ appFunction, titleId, group }) => {
	const { state, statusMessageId } = useShortcutInfo(appFunction);

	return (
		<SettingsGroup
			title={<FormattedMessage id="workbench.group.shortcut" />}
			rows={false}
		>
			<SettingsLine
				label={<FormattedMessage id="workbench.shortcut.global" />}
				description={
					state === "ok" ? (
						<FormattedMessage id="workbench.shortcut.registeredHint" />
					) : statusMessageId ? (
						<span
							style={{
								color:
									state === "error"
										? "var(--snow-shot-red)"
										: state === "warning"
											? "var(--snow-shot-yellow)"
											: undefined,
							}}
						>
							<FormattedMessage id={statusMessageId} />
						</span>
					) : (
						<FormattedMessage id="workbench.shortcut.emptyHint" />
					)
				}
				control={
					<ShortcutEditor
						appFunction={appFunction}
						group={group}
						title={<FormattedMessage id={titleId} />}
					/>
				}
			/>
		</SettingsGroup>
	);
};

/** Seconds to wait before a delayed screenshot starts. */
export const DelaySecondsGroup: React.FC = () => {
	const settings = useAppSettingsSnapshot();
	const { updateAppSettings } = useContext(AppSettingsActionContext);
	const seconds =
		settings?.[AppSettingsGroup.Cache].delayScreenshotSeconds ?? 3;

	return (
		<SettingsGroup
			title={<FormattedMessage id="workbench.group.delay" />}
			rows={false}
		>
			<SettingsLine
				stacked
				label={
					<FormattedMessage id="workbench.delay.seconds" values={{ seconds }} />
				}
				description={
					<FormattedMessage id="home.screenshotFunction.screenshotDelay.tip" />
				}
				control={
					<Slider
						style={{ flex: 1, margin: "4px 16px 24px" }}
						min={0}
						max={10}
						step={1}
						marks={{ 0: "0s", 3: "3s", 5: "5s", 10: "10s" }}
						value={seconds}
						onChange={(value) =>
							updateAppSettings(
								AppSettingsGroup.Cache,
								{ delayScreenshotSeconds: value },
								true,
								true,
								true,
								true,
								false,
							)
						}
					/>
				}
			/>
		</SettingsGroup>
	);
};

/**
 * Detail of a capture or desktop action: run it, edit its global shortcut,
 * and adjust the settings that only this action uses.
 */
export const ActionDetail: React.FC<{
	item: WorkbenchItem;
	related?: string[];
	children?: React.ReactNode;
}> = ({ item, related, children }) => {
	const { defaultAppFunctionComponentGroupConfigs } = useContext(
		GlobalShortcutContext,
	);
	const config = useMemo(
		() =>
			Object.values(defaultAppFunctionComponentGroupConfigs ?? {})
				.flat()
				.find((entry) => entry.configKey === item.appFunction),
		[defaultAppFunctionComponentGroupConfigs, item.appFunction],
	);

	return (
		<DetailPage
			icon={item.icon}
			title={<FormattedMessage id={item.titleId} />}
			description={<FormattedMessage id={item.descriptionId} />}
			actions={
				config && (
					<Button
						type="primary"
						icon={<WorkbenchIcon name="play" size={14} />}
						onClick={() => {
							config.onClick();
						}}
					>
						<FormattedMessage id="workbench.run" />
					</Button>
				)
			}
		>
			{item.appFunction && (
				<ShortcutGroup
					appFunction={item.appFunction}
					titleId={item.titleId}
					group={config?.group ?? AppFunctionGroup.Other}
				/>
			)}
			{children}
			{related && related.length > 0 && (
				<SettingsGroup
					title={<FormattedMessage id="workbench.group.related" />}
					rows={false}
				>
					<RelatedLinks ids={related} />
				</SettingsGroup>
			)}
		</DetailPage>
	);
};
