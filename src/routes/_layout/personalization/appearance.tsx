import { createFileRoute } from "@tanstack/react-router";
import { AppearancePage } from "@/pages/personalization/appearance/page";

export const Route = createFileRoute("/_layout/personalization/appearance")({
	component: RouteComponent,
});

function RouteComponent() {
	return <AppearancePage />;
}
