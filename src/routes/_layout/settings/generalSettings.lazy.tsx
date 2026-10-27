import { createLazyFileRoute, Navigate } from "@tanstack/react-router";

// Legacy route kept for links from older windows and saved state.
export const Route = createLazyFileRoute("/_layout/settings/generalSettings")({
	component: RouteComponent,
});

function RouteComponent() {
	return <Navigate to="/w/$itemId" params={{ itemId: "general" }} replace />;
}
