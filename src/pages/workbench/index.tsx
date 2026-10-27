import { Navigate } from "@tanstack/react-router";
import type React from "react";
import { FormattedMessage } from "react-intl";
import { CheckPermissions } from "@/components/checkPermissions";
import { DetailPage } from "@/components/workbench";
import {
	DEFAULT_WORKBENCH_ITEM_ID,
	getWorkbenchItem,
	type WorkbenchItem,
} from "@/components/workbench/registry";
import { usePlatform } from "@/hooks/usePlatform";
import { AboutPage } from "@/pages/about/page";
import { PluginsPage } from "@/pages/personalization/plugins/page";
import {
	ChatGenerationSection,
	ChatSessionSection,
} from "@/pages/settings/ai/chatPreferencesSection";
import { ModelServicesSection } from "@/pages/settings/ai/modelServices";
import { OcrSection } from "@/pages/settings/ai/ocrSection";
import {
	TranslationDefaultsSection,
	TranslationModelSection,
} from "@/pages/settings/ai/translationPreferencesSection";
import { DrawSection } from "@/pages/settings/capture/drawSection";
import { FixedContentSection } from "@/pages/settings/capture/fixedContentSection";
import { FullScreenDrawSection } from "@/pages/settings/capture/fullScreenDrawSection";
import { OutputSection } from "@/pages/settings/capture/outputSection";
import {
	ScreenshotBehaviorSection,
	ScreenshotSaveSection,
} from "@/pages/settings/capture/screenshotBehaviorSection";
import { ScreenshotUiSection } from "@/pages/settings/capture/screenshotUiSection";
import { ScrollScreenshotSection } from "@/pages/settings/capture/scrollScreenshotSection";
import { AppearanceSection } from "@/pages/settings/general/appearanceSection";
import { NetworkSection } from "@/pages/settings/general/networkSection";
import { StartupSection } from "@/pages/settings/general/startupSection";
import { TraySection } from "@/pages/settings/general/traySection";
import { VideoRecordSection } from "@/pages/settings/recording/videoRecordSection";
import { GlobalShortcutsSection } from "@/pages/settings/shortcuts/globalShortcutsSection";
import { InWindowHotkeysSection } from "@/pages/settings/shortcuts/inWindowHotkeysSection";
import { ShortcutPolicySection } from "@/pages/settings/shortcuts/shortcutPolicySection";
import { CaptureEngineSection } from "@/pages/settings/system/captureEngineSection";
import { CoreSection } from "@/pages/settings/system/coreSection";
import { DataFilesSection } from "@/pages/settings/system/dataFilesSection";
import { PermissionsSection } from "@/pages/settings/system/permissionsSection";
import { ActionDetail, DelaySecondsGroup } from "./actionDetail";

type ActionContent = { related?: string[]; content?: React.ReactNode };

/** Settings owned by a single action live on that action's page. */
const ACTION_CONTENT: Record<string, ActionContent> = {
	screenshot: {
		content: (
			<>
				<ScreenshotBehaviorSection />
				<ScreenshotSaveSection />
			</>
		),
		related: ["captureInterface", "output", "shortcuts"],
	},
	screenshotFocusedWindow: {
		content: <ScreenshotSaveSection />,
		related: ["output"],
	},
	screenshotFullScreen: {
		content: <ScreenshotSaveSection />,
		related: ["output", "system"],
	},
	screenshotDelay: { content: <DelaySecondsGroup />, related: ["screenshot"] },
	screenshotFixed: {
		content: <FixedContentSection />,
		related: ["fixedContent"],
	},
	screenshotOcr: { content: <OcrSection />, related: ["modelServices"] },
	screenshotOcrTranslate: {
		related: ["translationPreferences", "ocr", "modelServices"],
	},
	screenshotCopy: { related: ["screenshot", "output"] },
	translationSelectText: {
		content: <TranslationDefaultsSection />,
		related: ["translation", "translationPreferences", "modelServices"],
	},
	chatSelectText: { related: ["chat", "chatPreferences", "modelServices"] },
	videoRecord: { content: <VideoRecordSection /> },
	videoRecordCopy: { related: ["videoRecord"] },
	fullScreenDraw: { content: <FullScreenDrawSection /> },
	fixedContent: {
		content: <FixedContentSection />,
		related: ["screenshotFixed"],
	},
	topWindow: {},
	openImageSaveFolder: { related: ["screenshot", "output"] },
	showOrHideMainWindow: { related: ["general"] },
};

const SettingsContent: React.FC<{ id: string }> = ({ id }) => {
	const [platform] = usePlatform();

	switch (id) {
		case "modelServices":
			return <ModelServicesSection />;
		case "translationPreferences":
			return (
				<>
					<TranslationDefaultsSection />
					<TranslationModelSection />
				</>
			);
		case "chatPreferences":
			return (
				<>
					<ChatSessionSection />
					<ChatGenerationSection />
				</>
			);
		case "ocr":
			return <OcrSection />;
		case "captureInterface":
			return (
				<>
					<ScreenshotUiSection />
					<DrawSection />
					<ScrollScreenshotSection />
				</>
			);
		case "output":
			return <OutputSection />;
		case "shortcuts":
			return (
				<>
					<GlobalShortcutsSection />
					<ShortcutPolicySection />
					<InWindowHotkeysSection />
				</>
			);
		case "general":
			return (
				<>
					<AppearanceSection />
					<StartupSection />
					<TraySection />
					<NetworkSection />
				</>
			);
		case "system":
			return (
				<>
					{platform === "macos" && <PermissionsSection />}
					<CaptureEngineSection />
					<CoreSection />
					<DataFilesSection />
				</>
			);
		case "plugins":
			return <PluginsPage />;
		case "about":
			return <AboutPage />;
		default:
			return null;
	}
};

const SettingsDetail: React.FC<{ item: WorkbenchItem }> = ({ item }) => (
	<DetailPage
		icon={item.icon}
		title={<FormattedMessage id={item.titleId} />}
		description={<FormattedMessage id={item.descriptionId} />}
	>
		<SettingsContent id={item.id} />
	</DetailPage>
);

/** Resolves /w/$itemId (and "/") to the page of a navigator item. */
export const WorkbenchDetailPage: React.FC<{ itemId?: string }> = ({
	itemId = DEFAULT_WORKBENCH_ITEM_ID,
}) => {
	const item = getWorkbenchItem(itemId);

	if (!item) {
		return (
			<Navigate
				to="/w/$itemId"
				params={{ itemId: DEFAULT_WORKBENCH_ITEM_ID }}
				replace
			/>
		);
	}

	if (item.to) {
		return <Navigate to={item.to} replace />;
	}

	return (
		<>
			{item.id === DEFAULT_WORKBENCH_ITEM_ID && <CheckPermissions />}
			{item.kind === "action" ? (
				<ActionDetail item={item} related={ACTION_CONTENT[item.id]?.related}>
					{ACTION_CONTENT[item.id]?.content}
				</ActionDetail>
			) : (
				<SettingsDetail item={item} />
			)}
		</>
	);
};
