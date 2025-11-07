import { createLazyFileRoute } from "@tanstack/react-router";
import { HotKeySettingsPage } from "@/pages/settings/hotKeySettings/page";

export const Route = createLazyFileRoute("/_layout/settings/hotKeySettings")({
	component: HotKeySettingsComponent,
});

function HotKeySettingsComponent() {
	return <HotKeySettingsPage />;
}
