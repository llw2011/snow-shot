import {
	type Dispatch,
	type RefObject,
	type SetStateAction,
	useCallback,
	useRef,
	useState,
} from "react";

export function useStateRef<S>(
	initialState: S | (() => S),
): [S, Dispatch<SetStateAction<S>>, RefObject<S>] {
	const [state, _setState] = useState<S>(initialState);
	const stateRef = useRef<S>(state);

	const setState = useCallback<Dispatch<SetStateAction<S>>>((value) => {
		if (typeof value === "function") {
			const action = value as (prevState: S) => S;
			_setState((prev) => {
				const newValue = action(prev);
				stateRef.current = newValue;
				return newValue;
			});
		} else {
			stateRef.current = value;
			_setState(value);
		}
	}, []);

	return [state, setState, stateRef];
}
