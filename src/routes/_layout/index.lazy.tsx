import { createLazyFileRoute } from "@tanstack/react-router";
import { WorkbenchDetailPage } from "@/pages/workbench";

export const Route = createLazyFileRoute("/_layout/")({
	component: HomeComponent,
});

function HomeComponent() {
	return <WorkbenchDetailPage />;
}
