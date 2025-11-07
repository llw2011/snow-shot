import { createLazyFileRoute } from "@tanstack/react-router";
import { FixedContentPage } from "@/pages/fixedContent/page";

export const Route = createLazyFileRoute("/_noLayout/fixedContent")({
	component: RouteComponent,
});

function RouteComponent() {
	return <FixedContentPage />;
}
