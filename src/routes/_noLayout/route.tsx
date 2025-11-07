import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RouterContainer } from "@/components/routerContainer";

export const Route = createFileRoute("/_noLayout")({
	component: PathlessLayoutComponent,
});

function PathlessLayoutComponent() {
	return (
		<RouterContainer autoInitPlugin={false}>
			<Outlet />
		</RouterContainer>
	);
}
