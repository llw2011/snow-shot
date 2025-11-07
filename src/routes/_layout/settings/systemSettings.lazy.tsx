import { createLazyFileRoute } from "@tanstack/react-router";
import { SystemSettingsPage } from "@/pages/settings/systemSettings/page";

export const Route = createLazyFileRoute("/_layout/settings/systemSettings")({
	component: SystemSettingsComponent,
});

function SystemSettingsComponent() {
	return <SystemSettingsPage />;
}
