import { createLazyFileRoute } from "@tanstack/react-router";
import { WorkbenchDetailPage } from "@/pages/workbench";

export const Route = createLazyFileRoute("/_layout/w/$itemId")({
	component: RouteComponent,
});

function RouteComponent() {
	const { itemId } = Route.useParams();
	return <WorkbenchDetailPage key={itemId} itemId={itemId} />;
}
