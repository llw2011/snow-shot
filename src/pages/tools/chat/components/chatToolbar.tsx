import { PlusOutlined } from "@ant-design/icons";
import { Link } from "@tanstack/react-router";
import { Button, Select, type SelectProps, Tooltip } from "antd";
import type React from "react";
import { useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { HotkeysMenu } from "@/components/hotkeysMenu";
import { SidebarIcon, ThinkingIcon } from "@/components/icons";
import { WorkbenchIcon } from "@/components/workbench";
import {
	CommonKeyEventKey,
	type CommonKeyEventValue,
} from "@/types/core/commonKeyEvent";
import { formatKey } from "@/utils/format";
import type { ChatModelConfig } from "../messages";
import { ModelSelectLabel } from "./modelSelectLabel";

/** Header actions of the chat tool: history, model, thinking, new session. */
export const ChatToolbar: React.FC<{
	hasSessions: boolean;
	onOpenSessions: () => void;
	models: ChatModelConfig[];
	selectedModel: string | undefined;
	onSelectModel: (model: string) => void;
	thinkingSupported: boolean;
	thinkingEnabled: boolean;
	onToggleThinking: () => void;
	busy: boolean;
	canStartNewSession: boolean;
	onNewSession: () => void;
	hotKeys: Record<CommonKeyEventKey, CommonKeyEventValue> | undefined;
	onCopy: () => void;
	onCopyAndHide: () => void;
}> = ({
	hasSessions,
	onOpenSessions,
	models,
	selectedModel,
	onSelectModel,
	thinkingSupported,
	thinkingEnabled,
	onToggleThinking,
	busy,
	canStartNewSession,
	onNewSession,
	hotKeys,
	onCopy,
	onCopyAndHide,
}) => {
	const intl = useIntl();

	const modelOptions = useMemo<SelectProps["options"]>(
		() =>
			models.map((item) => ({
				label: item.name,
				value: item.model,
				reasoner: item.thinking,
			})),
		[models],
	);

	const keyTooltip = (messageId: string, key: CommonKeyEventKey) =>
		intl.formatMessage(
			{ id: "draw.keyEventTooltip" },
			{
				message: intl.formatMessage({ id: messageId }),
				key: formatKey(hotKeys?.[key]?.hotKey),
			},
		);

	return (
		<div className="chat-toolbar">
			<Tooltip title={<FormattedMessage id="tools.chat.sessions" />}>
				<Button
					type="text"
					icon={<SidebarIcon />}
					disabled={!hasSessions}
					onClick={onOpenSessions}
					aria-label={intl.formatMessage({ id: "tools.chat.sessions" })}
				/>
			</Tooltip>

			<Select
				className="chat-model-select"
				value={selectedModel}
				options={modelOptions}
				disabled={busy}
				onChange={onSelectModel}
				optionRender={(option) => (
					<ModelSelectLabel
						modelName={String(option.label ?? "")}
						reasoner={!!option.data.reasoner}
					/>
				)}
				popupMatchSelectWidth={false}
				placeholder={intl.formatMessage({ id: "tools.chat.noSelectedModel" })}
				notFoundContent={
					<Link to="/w/$itemId" params={{ itemId: "modelServices" }}>
						<FormattedMessage id="workbench.models.addFirst" />
					</Link>
				}
				styles={{ popup: { root: { minWidth: 220 } } }}
				variant="filled"
			/>

			<Tooltip
				title={intl.formatMessage({
					id: thinkingSupported
						? "tools.chat.thinking"
						: "tools.chat.thinking.unsupported",
				})}
			>
				<Button
					type="text"
					className={`chat-thinking${thinkingSupported && thinkingEnabled ? " is-on" : ""}`}
					icon={<ThinkingIcon />}
					disabled={!thinkingSupported || busy}
					aria-pressed={thinkingSupported && thinkingEnabled}
					onClick={onToggleThinking}
				/>
			</Tooltip>

			<Tooltip
				title={keyTooltip(
					"tools.chat.newSession",
					CommonKeyEventKey.ChatNewSession,
				)}
			>
				<Button
					type="text"
					icon={<PlusOutlined />}
					onClick={onNewSession}
					disabled={!canStartNewSession}
				>
					<FormattedMessage id="tools.chat.newSession" />
				</Button>
			</Tooltip>

			<HotkeysMenu
				variant="toolbar"
				menu={{
					items: [
						{
							label: keyTooltip(
								"tools.chat.chatCopy",
								CommonKeyEventKey.ChatCopy,
							),
							key: "copy",
							onClick: onCopy,
						},
						{
							label: keyTooltip(
								"tools.chat.chatCopyAndHide",
								CommonKeyEventKey.ChatCopyAndHide,
							),
							key: "copyAndHide",
							onClick: onCopyAndHide,
						},
					],
				}}
			/>

			<Link
				to="/w/$itemId"
				params={{ itemId: "chatPreferences" }}
				className="wb-icon-button"
				title={intl.formatMessage({ id: "workbench.item.chatPreferences" })}
				aria-label={intl.formatMessage({
					id: "workbench.item.chatPreferences",
				})}
			>
				<WorkbenchIcon name="sliders" />
			</Link>
		</div>
	);
};
