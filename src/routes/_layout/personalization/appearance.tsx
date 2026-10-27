import { createFileRoute, Navigate } from "@tanstack/react-router";

// Legacy route kept for links from older windows and saved state.
export const Route = createFileRoute("/_layout/personalization/appearance")({
	component: RouteComponent,
});

function RouteComponent() {
	return <Navigate to="/w/$itemId" params={{ itemId: "general" }} replace />;
}
