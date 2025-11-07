import { useEffect, useState } from "react";
import {
	type HotkeyCallback,
	type Keys,
	useHotkeys,
	useHotkeysContext,
} from "react-hotkeys-hook";
import type { OptionsOrDependencyArray } from "react-hotkeys-hook/packages/react-hotkeys-hook/dist/types";
import { HotkeysScope } from "@/types/core/appHotKeys";

export const useHotkeysApp = (
	keys: Keys,
	callback: HotkeyCallback,
	options?: OptionsOrDependencyArray,
	dependencies?: OptionsOrDependencyArray,
) => {
	const { activeScopes } = useHotkeysContext();

	const [enable, setEnable] = useState(true);

	useEffect(() => {
		if (options && "scopes" in options && typeof options.scopes === "string") {
			setEnable(
				activeScopes.includes(options.scopes) ||
					activeScopes.includes(HotkeysScope.All),
			);
		}
	}, [activeScopes, options]);

	return useHotkeys(
		keys,
		callback,
		{
			...options,
			enabled:
				enable && (options && "enabled" in options ? options.enabled : true),
		},
		dependencies,
	);
};
