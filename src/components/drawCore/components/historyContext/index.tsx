import { createContext, useContext, useMemo } from "react";
import { CanvasHistory } from "@/core/canvas/canvasHistory";

type HistoryContextType = {
	history: CanvasHistory;
};

export const HistoryContext = createContext<HistoryContextType>({
	history: new CanvasHistory(),
});

export const useHistory = () => {
	const context = useContext(HistoryContext);

	return context;
};

export function withCanvasHistory<T extends object>(
	Component: React.ComponentType<T>,
) {
	return function CanvasHistoryProvider(props: T) {
		const history = useMemo(() => new CanvasHistory(), []);

		return (
			<HistoryContext.Provider value={{ history }}>
				<Component {...props} />
			</HistoryContext.Provider>
		);
	};
}
