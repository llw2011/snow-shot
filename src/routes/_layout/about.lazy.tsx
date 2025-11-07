import { createLazyFileRoute } from "@tanstack/react-router";
import { AboutPage } from "@/pages/about/page";

export const Route = createLazyFileRoute("/_layout/about")({
	component: RouteComponent,
});

function RouteComponent() {
	return <AboutPage />;
}
