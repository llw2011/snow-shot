export enum CommonKeyEventGroup {
	Translation = "translation",
	Chat = "chat",
	FixedContent = "fixedContent",
}

export type CommonKeyEventValue = {
	hotKey: string;
	unique?: boolean;
	group: CommonKeyEventGroup;
};

export type CommonKeyEventComponentValue = CommonKeyEventValue & {
	messageId: string;
};

export enum CommonKeyEventKey {
	CopyAndHide = "copyAndHide",
	Copy = "copy",
	ChatCopyAndHide = "chatCopyAndHide",
	ChatCopy = "chatCopy",
	ChatNewSession = "chatNewSession",
	FixedContentEnableDraw = "fixedContentEnableDraw",
	FixedContentSwitchThumbnail = "fixedContentSwitchThumbnail",
	FixedContentAlwaysOnTop = "fixedContentAlwaysOnTop",
	FixedContentCloseWindow = "fixedContentCloseWindow",
	FixedContentCopyToClipboard = "fixedContentCopyToClipboard",
	// FixedContentCopyRawToClipboard = 'fixedContentCopyRawToClipboard',
	FixedContentSaveToFile = "fixedContentSaveToFile",
	FixedContentSelectText = "fixedContentSelectText",
	FixedContentSetOpacity = "fixedContentSetOpacity",
}
