import { createContext, type RefObject } from "react";

export const TextScaleFactorContext = createContext<{
	textScaleFactor: number;
	textScaleFactorRef: RefObject<number>;
	devicePixelRatio: number;
}>({
	textScaleFactor: 1,
	textScaleFactorRef: { current: 1 },
	devicePixelRatio: 1,
});
