import { createLazyFileRoute } from "@tanstack/react-router";
import { SwitchMouseThroughPage } from "@/pages/fullScreenDraw/switchMouseThrough/page";

export const Route = createLazyFileRoute(
	"/_noLayout/fullScreenDrawSwitchMouseThrough",
)({
	component: RouteComponent,
});

function RouteComponent() {
	return <SwitchMouseThroughPage />;
}
