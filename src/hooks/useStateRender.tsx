import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 避免在 react 的每个渲染周期内多次设置 state 后超出 setState 的最大设置次数
 * 并且运用 requestAnimationFrame 来进一步平滑设置 state 的值
 * @param val
 * @returns
 */
export function useStateRender<ValueType>(
	val: ValueType,
): [ValueType, (value: ValueType) => void] {
	const valueRef = useRef(val);
	const [value, _setValue] = useState(val);

	const setValue = useCallback((value: ValueType) => {
		valueRef.current = value;
		_setValue(value);
	}, []);

	const reactRenderedRef = useRef(true);
	const renderedRef = useRef(true);

	useEffect(() => {
		reactRenderedRef.current = false;
	}, []);

	useEffect(() => {
		valueRef.current = value;

		if (!reactRenderedRef.current) {
			return;
		}

		reactRenderedRef.current = false;

		if (!renderedRef.current) {
			return;
		}

		renderedRef.current = false;
		requestAnimationFrame(() => {
			setValue(valueRef.current);
			renderedRef.current = true;
		});
	}, [setValue, value]);

	return [value, setValue];
}
