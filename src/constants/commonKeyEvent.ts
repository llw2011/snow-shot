import {
	type CommonKeyEventComponentValue,
	CommonKeyEventGroup,
	CommonKeyEventKey,
	type CommonKeyEventValue,
} from "@/types/core/commonKeyEvent";
import { getPlatformValue } from "@/utils/platform";

export const defaultCommonKeyEventSettings: Record<
	CommonKeyEventKey,
	CommonKeyEventValue
> = {
	[CommonKeyEventKey.CopyAndHide]: {
		hotKey: getPlatformValue("Ctrl+Q", "Meta+Q"),
		group: CommonKeyEventGroup.Translation,
	},
	[CommonKeyEventKey.Copy]: {
		hotKey: getPlatformValue("Ctrl+C", "Meta+C"),
		group: CommonKeyEventGroup.Translation,
	},
	[CommonKeyEventKey.ChatCopyAndHide]: {
		hotKey: getPlatformValue("Ctrl+Q", "Meta+Q"),
		group: CommonKeyEventGroup.Chat,
	},
	[CommonKeyEventKey.ChatCopy]: {
		hotKey: getPlatformValue("Ctrl+C", "Meta+C"),
		group: CommonKeyEventGroup.Chat,
	},
	[CommonKeyEventKey.ChatNewSession]: {
		hotKey: getPlatformValue("Ctrl+N", "Meta+N"),
		group: CommonKeyEventGroup.Chat,
	},
	[CommonKeyEventKey.FixedContentEnableDraw]: {
		hotKey: getPlatformValue("Ctrl+E", "Meta+E"),
		group: CommonKeyEventGroup.FixedContent,
	},
	[CommonKeyEventKey.FixedContentSwitchThumbnail]: {
		hotKey: "R",
		group: CommonKeyEventGroup.FixedContent,
	},
	[CommonKeyEventKey.FixedContentAlwaysOnTop]: {
		hotKey: getPlatformValue("Ctrl+T", "Meta+T"),
		group: CommonKeyEventGroup.FixedContent,
	},
	[CommonKeyEventKey.FixedContentCloseWindow]: {
		hotKey: "Escape",
		group: CommonKeyEventGroup.FixedContent,
	},
	[CommonKeyEventKey.FixedContentCopyToClipboard]: {
		hotKey: getPlatformValue("Ctrl+C", "Meta+C"),
		group: CommonKeyEventGroup.FixedContent,
	},
	// [CommonKeyEventKey.FixedContentCopyRawToClipboard]: {
	//     hotKey: getPlatformValue('Ctrl+Shift+C', 'Meta+Shift+C'),
	//     group: CommonKeyEventGroup.FixedContent,
	// },
	[CommonKeyEventKey.FixedContentSaveToFile]: {
		hotKey: getPlatformValue("Ctrl+S", "Meta+S"),
		group: CommonKeyEventGroup.FixedContent,
	},
	[CommonKeyEventKey.FixedContentSelectText]: {
		hotKey: getPlatformValue("Ctrl+D", "Meta+D"),
		group: CommonKeyEventGroup.FixedContent,
	},
	[CommonKeyEventKey.FixedContentSetOpacity]: {
		hotKey: getPlatformValue("Ctrl", "Meta"),
		group: CommonKeyEventGroup.FixedContent,
		unique: false,
	},
};

const commonKeyEventSettingsKeys = Object.keys(defaultCommonKeyEventSettings);
export const defaultCommonKeyEventComponentConfig: Record<
	CommonKeyEventKey,
	CommonKeyEventComponentValue
> = commonKeyEventSettingsKeys.reduce(
	(acc, key) => {
		let baseMessageId = "";
		if (
			defaultCommonKeyEventSettings[key as CommonKeyEventKey].group ===
			CommonKeyEventGroup.Translation
		) {
			baseMessageId = "tools.translation";
		} else if (
			defaultCommonKeyEventSettings[key as CommonKeyEventKey].group ===
			CommonKeyEventGroup.Chat
		) {
			baseMessageId = "tools.chat";
		} else if (
			defaultCommonKeyEventSettings[key as CommonKeyEventKey].group ===
			CommonKeyEventGroup.FixedContent
		) {
			baseMessageId = "settings.hotKeySettings.fixedContent";
		}

		acc[key as CommonKeyEventKey] = {
			...defaultCommonKeyEventSettings[key as CommonKeyEventKey],
			messageId: `${baseMessageId}.${key}`,
		};
		return acc;
	},
	{} as Record<CommonKeyEventKey, CommonKeyEventComponentValue>,
);
