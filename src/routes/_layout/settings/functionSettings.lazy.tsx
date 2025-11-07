import { createLazyFileRoute } from "@tanstack/react-router";
import { FunctionSettingsPage } from "@/pages/settings/functionSettings/page";

export const Route = createLazyFileRoute("/_layout/settings/functionSettings")({
	component: FunctionSettingsComponent,
});

function FunctionSettingsComponent() {
	return <FunctionSettingsPage />;
}
