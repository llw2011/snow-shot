import { createLazyFileRoute } from "@tanstack/react-router";
import { IdlePage } from "@/pages/idle/page";

export const Route = createLazyFileRoute("/_noLayout/idle")({
	component: RouteComponent,
});

function RouteComponent() {
	return <IdlePage />;
}
