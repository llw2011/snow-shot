import { createLazyFileRoute } from "@tanstack/react-router";
import { VideoRecordToolbarPage } from "@/pages/videoRecord/toolbar/page";

export const Route = createLazyFileRoute("/_noLayout/videoRecordToolbar")({
	component: RouteComponent,
});

function RouteComponent() {
	return <VideoRecordToolbarPage />;
}
