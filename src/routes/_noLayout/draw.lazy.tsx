import { createLazyFileRoute } from "@tanstack/react-router";
import { DrawPage } from "@/pages/draw/page";

export const Route = createLazyFileRoute("/_noLayout/draw")({
	component: RouteComponent,
});

function RouteComponent() {
	return <DrawPage />;
}
