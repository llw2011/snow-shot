import rafSchd from "raf-schd";
import { useMemo } from "react";

type RafAsyncFn<T extends (...args: Parameters<T>) => ReturnType<T>> = ((
	...args: Parameters<T>
) => void) & {
	cancel: () => void;
	flush: () => void;
	isPending: () => boolean;
};

export function useCallbackAsyncRender<
	T extends (...args: Parameters<T>) => ReturnType<T>,
>(action: T) {
	return useMemo(() => {
		let lastArgs: Parameters<T> | null = null;
		let inFlight = false;

		const invoke = () => {
			const args = lastArgs as Parameters<T>;
			lastArgs = null;

			let result: unknown;
			try {
				result = action(...args);
			} finally {
				// 同步函数执行结束会直接走到这里；异步的 pending 标志在下面设置/清除
			}

			if (result && typeof (result as { then?: unknown }).then === "function") {
				inFlight = true;
				(result as Promise<unknown>).finally(() => {
					inFlight = false;
					if (lastArgs) scheduledInvoke();
				});
			}
		};

		const scheduledInvoke = rafSchd(invoke) as (() => void) & {
			cancel(): void;
			flush(): void;
		};

		const wrapped = ((...args: Parameters<T>) => {
			lastArgs = args;
			if (!inFlight) scheduledInvoke();
		}) as RafAsyncFn<T>;

		wrapped.cancel = () => {
			lastArgs = null;
			scheduledInvoke.cancel();
		};
		wrapped.flush = () => {
			if (!inFlight) scheduledInvoke.flush();
		};
		wrapped.isPending = () => inFlight;

		return wrapped;
	}, [action]);
}
