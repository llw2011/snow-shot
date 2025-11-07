import { useCallback, useContext, useEffect } from "react";
import type {
	StatePublisher,
	StatePublisherListener,
} from "./useStatePublisher";

export function useStateSubscriber<Value>(
	statePublisher: StatePublisher<Value>,
	onChange: StatePublisherListener<Value> | undefined,
): [
	getValue: () => Value,
	setValue: (value: Value) => void,
	reset: () => void,
] {
	const { stateRef, publish, subscribe, reset } = useContext(
		statePublisher.context,
	);

	const getValue = useCallback(() => stateRef.current, [stateRef]);

	const setValue = useCallback(
		(value: Value) => {
			if (stateRef.current === value) {
				return;
			}

			publish(value);
		},
		[stateRef, publish],
	);

	useEffect(() => {
		if (!onChange) {
			return;
		}

		const unsubscribe = subscribe(onChange);

		return () => {
			unsubscribe();
		};
	}, [onChange, subscribe]);

	// 初始调用
	useEffect(() => {
		onChange?.(stateRef.current, stateRef.current);
	}, [onChange, stateRef]);

	return [getValue, setValue, reset];
}
