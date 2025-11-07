import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MenuLayout } from "@/components/menuLayout";
import { RouterContainer } from "@/components/routerContainer";
import { ThemeSkin } from "@/components/themeSkin";

export const Route = createFileRoute("/_layout")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<RouterContainer autoInitPlugin={true}>
			<ThemeSkin />
			<MenuLayout>
				<Outlet />
			</MenuLayout>
		</RouterContainer>
	);
}
