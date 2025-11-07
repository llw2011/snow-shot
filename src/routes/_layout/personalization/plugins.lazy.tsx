import { createLazyFileRoute } from "@tanstack/react-router";
import { PluginsPage } from "@/pages/personalization/plugins/page";

export const Route = createLazyFileRoute("/_layout/personalization/plugins")({
	component: RouteComponent,
});

function RouteComponent() {
	return <PluginsPage />;
}
