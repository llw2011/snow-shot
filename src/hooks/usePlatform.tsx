import * as tauriOs from "@tauri-apps/plugin-os";
import { useEffect } from "react";
import { useStateRef } from "./useStateRef";

export const usePlatform: () => [
	tauriOs.Platform | undefined,
	React.RefObject<tauriOs.Platform | undefined>,
] = () => {
	const [platform, setPlatform, platformRef] = useStateRef<
		tauriOs.Platform | undefined
	>(undefined);
	useEffect(() => {
		setPlatform(tauriOs.platform());
	}, [setPlatform]);

	return [platform, platformRef];
};
