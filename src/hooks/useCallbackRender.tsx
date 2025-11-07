import rafSchd from "raf-schd";
import { useMemo } from "react";

export function useCallbackRender<
	T extends (...args: Parameters<T>) => ReturnType<T> | Promise<ReturnType<T>>,
>(action: T) {
	return useMemo(() => {
		return rafSchd(action);
	}, [action]);
}

export function useCallbackRenderSlow<
	T extends (...args: Parameters<T>) => ReturnType<T> | Promise<ReturnType<T>>,
>(action: T) {
	return useMemo(() => {
		const rafAction = rafSchd(action);
		return rafSchd((...args: Parameters<T>) => {
			rafAction(...args);
		});
	}, [action]);
}
