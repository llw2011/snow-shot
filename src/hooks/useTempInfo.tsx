import { useCallback, useEffect, useRef, useState } from "react";

export const useTempInfo = (): [boolean, () => void] => {
	const [showInfo, setShowInfo] = useState(false);
	const infoTimerRef = useRef<NodeJS.Timeout | null>(null);
	const showInfoTemporary = useCallback(() => {
		setShowInfo(true);

		if (infoTimerRef.current) {
			clearTimeout(infoTimerRef.current);
		}

		infoTimerRef.current = setTimeout(() => {
			setShowInfo(false);
			infoTimerRef.current = null;
		}, 1000);
	}, []);

	useEffect(() => {
		return () => {
			if (infoTimerRef.current) {
				clearTimeout(infoTimerRef.current);
			}
		};
	}, []);

	return [showInfo, showInfoTemporary];
};
