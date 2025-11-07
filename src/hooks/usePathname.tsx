import { useLocation } from "@tanstack/react-router";
import { useMemo } from "react";

export const usePathname = () => {
	const { pathname } = useLocation();
	const hasLayout = useMemo(
		() =>
			!(
				pathname === "/draw" ||
				pathname === "/fixedContent" ||
				pathname === "/fullScreenDraw" ||
				pathname === "/fullScreenDrawSwitchMouseThrough" ||
				pathname === "/videoRecord" ||
				pathname === "/videoRecordToolbar" ||
				pathname === "/idle"
			),
		[pathname],
	);

	return { pathname, hasLayout };
};
