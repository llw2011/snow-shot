import { createLazyFileRoute } from "@tanstack/react-router";
import { CaptureHistoryPage } from "@/pages/tools/captureHistory/page";

export const Route = createLazyFileRoute("/_layout/tools/captureHistory")({
	component: CaptureHistoryComponent,
});

function CaptureHistoryComponent() {
	return <CaptureHistoryPage />;
}
