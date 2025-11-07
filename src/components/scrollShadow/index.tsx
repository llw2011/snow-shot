import { debounce } from "es-toolkit";
import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";

interface ScrollShadowProps {
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
}

const ScrollShadow: React.FC<ScrollShadowProps> = ({
	children,
	className,
	style,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const [showLeftShadow, setShowLeftShadow] = useState(false);
	const [showRightShadow, setShowRightShadow] = useState(false);

	const checkScroll = useCallback(() => {
		const container = containerRef.current;
		if (!container) return;

		const { scrollLeft, scrollWidth, clientWidth } = container;
		setShowLeftShadow(scrollLeft > 0);
		setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 1);
	}, []);
	const checkScrollRender = useMemo(() => {
		return debounce(checkScroll, 17);
	}, [checkScroll]);

	checkScrollRender();

	return (
		<div className={`scroll-container ${className || ""}`}>
			{showLeftShadow && <div className="left-shadow" />}
			<div
				ref={containerRef}
				className="scroll-content"
				style={style}
				onScroll={checkScroll}
				onWheel={checkScroll}
			>
				{children}
			</div>
			{showRightShadow && <div className="right-shadow" />}

			<style jsx>{`
                .scroll-container {
                    position: relative;
                    width: 100%;
                    overflow: hidden;
                }

                .scroll-content {
                    width: 100%;
                    overflow-x: auto;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                    &::-webkit-scrollbar {
                        display: none;
                    }
                }

                .left-shadow,
                .right-shadow {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 12px;
                    pointer-events: none;
                    z-index: 1;
                }

                .left-shadow {
                    left: 0;
                    background: linear-gradient(to right, rgba(0, 0, 0, 0.08), transparent);
                }

                .right-shadow {
                    right: 0;
                    background: linear-gradient(to left, rgba(0, 0, 0, 0.08), transparent);
                }
            `}</style>
		</div>
	);
};

export default ScrollShadow;
