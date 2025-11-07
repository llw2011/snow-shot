import { useCallback, useEffect, useState } from "react";

export const useWebWorker = (enalbe: boolean, workerUrl: string | URL) => {
	const [webWorker, setWebWorker] = useState<Worker | undefined>(undefined);
	const generateWebWorker = useCallback(() => {
		if (enalbe) {
			return new Worker(new URL(workerUrl));
		}
		return undefined;
	}, [workerUrl, enalbe]);
	useEffect(() => {
		const worker = generateWebWorker();
		setWebWorker(worker);
		return () => {
			worker?.terminate();
		};
	}, [generateWebWorker]);

	return webWorker;
};
