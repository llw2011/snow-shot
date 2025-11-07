import { createLazyFileRoute } from "@tanstack/react-router";
import { FullScreenDrawPage } from "@/pages/fullScreenDraw/page";

export const Route = createLazyFileRoute("/_noLayout/fullScreenDraw")({
	component: RouteComponent,
});

function RouteComponent() {
	return <FullScreenDrawPage />;
}
