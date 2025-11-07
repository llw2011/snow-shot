import { createLazyFileRoute } from "@tanstack/react-router";
import { GeneralSettingsPage } from "@/pages/settings/generalSettings/page";

export const Route = createLazyFileRoute("/_layout/settings/generalSettings")({
	component: GeneralSettingsComponent,
});

function GeneralSettingsComponent() {
	return <GeneralSettingsPage />;
}
