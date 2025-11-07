import { createLazyFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/pages/home";

export const Route = createLazyFileRoute("/_layout/")({
	component: HomeComponent,
});

function HomeComponent() {
	return <HomePage />;
}
