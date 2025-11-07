import { createLazyFileRoute } from "@tanstack/react-router";
import { VideoRecordPage } from "@/pages/videoRecord/page";

export const Route = createLazyFileRoute("/_noLayout/videoRecord")({
	component: RouteComponent,
});

function RouteComponent() {
	return <VideoRecordPage />;
}
