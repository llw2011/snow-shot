import type React from "react";

/**
 * Stroke icons for the main window. One 24px grid, 1.6px stroke, round joins;
 * they inherit color from text so selected and disabled states stay legible.
 */
const PATHS = {
	capture: (
		<>
			<path d="M6 2v14a2 2 0 0 0 2 2h14" />
			<path d="M18 22V8a2 2 0 0 0-2-2H2" />
		</>
	),
	window: (
		<>
			<rect x="3" y="4" width="18" height="16" rx="2" />
			<path d="M3 9h18" />
		</>
	),
	monitor: (
		<>
			<rect x="2" y="4" width="20" height="13" rx="2" />
			<path d="M8 21h8M12 17v4" />
		</>
	),
	timer: (
		<>
			<circle cx="12" cy="13" r="8" />
			<path d="M12 9v4l2.5 2M9 2h6" />
		</>
	),
	pin: <path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3z" />,
	scanText: (
		<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 9h8M8 12h8M8 15h5" />
	),
	translate: (
		<path d="M4 5h8M8 3v2M5.5 5c.8 3.6 3.4 6.5 6.5 8M10.5 5c-.8 3.6-3.4 6.5-6.5 8M13 21l4-9 4 9M14.4 18h5.2" />
	),
	copy: (
		<>
			<rect x="8" y="8" width="13" height="13" rx="2" />
			<path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
		</>
	),
	chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
	textCursor: (
		<>
			<path d="M4 7V5h16v2M12 5v14M9 19h6" />
		</>
	),
	record: (
		<>
			<circle cx="12" cy="12" r="9" />
			<circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
		</>
	),
	recordCopy: (
		<>
			<rect x="3" y="6" width="13" height="12" rx="2" />
			<path d="M16 10l5-3v10l-5-3" />
		</>
	),
	pen: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />,
	clipboard: (
		<>
			<rect x="5" y="4" width="14" height="17" rx="2" />
			<path d="M9 4V3h6v1M9 11h6M9 15h4" />
		</>
	),
	layers: <path d="M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
	history: <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" />,
	folder: (
		<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
	),
	app: (
		<>
			<rect x="3" y="3" width="7" height="7" rx="1.5" />
			<rect x="14" y="3" width="7" height="7" rx="1.5" />
			<rect x="3" y="14" width="7" height="7" rx="1.5" />
			<rect x="14" y="14" width="7" height="7" rx="1.5" />
		</>
	),
	spark: (
		<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
	),
	sliders: (
		<>
			<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
			<circle cx="15" cy="6" r="2" />
			<circle cx="9" cy="12" r="2" />
			<circle cx="17" cy="18" r="2" />
		</>
	),
	keyboard: (
		<>
			<rect x="2" y="6" width="20" height="12" rx="2" />
			<path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
		</>
	),
	palette: (
		<>
			<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.1-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z" />
			<circle cx="7.5" cy="11" r="1" />
			<circle cx="10.5" cy="7" r="1" />
			<circle cx="15" cy="7.5" r="1" />
		</>
	),
	download: <path d="M12 3v12M7 10l5 5 5-5M4 19h16" />,
	chip: (
		<>
			<rect x="4" y="4" width="16" height="16" rx="2" />
			<rect x="9" y="9" width="6" height="6" />
		</>
	),
	plug: <path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4" />,
	info: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 16v-5M12 8h.01" />
		</>
	),
	search: (
		<>
			<circle cx="11" cy="11" r="7" />
			<path d="M20 20l-3.5-3.5" />
		</>
	),
	play: <path d="M7 4l13 8-13 8z" />,
	plus: <path d="M12 5v14M5 12h14" />,
	check: <path d="M5 12l5 5 9-10" />,
	close: <path d="M6 6l12 12M18 6 6 18" />,
	minus: <path d="M5 12h14" />,
	chevronRight: <path d="M9 6l6 6-6 6" />,
	chevronLeft: <path d="M15 6l-6 6 6 6" />,
	chevronDown: <path d="M6 9l6 6 6-6" />,
	menu: <path d="M4 7h16M4 12h16M4 17h16" />,
	radar: (
		<>
			<circle cx="12" cy="12" r="9" />
			<circle cx="12" cy="12" r="5" />
			<path d="M12 12l6-6" />
		</>
	),
	refresh: (
		<path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" />
	),
	trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
	eye: (
		<>
			<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
			<circle cx="12" cy="12" r="3" />
		</>
	),
	bulb: (
		<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.8 10.6c.6.5.8 1.2.8 1.9V16h6v-.5c0-.7.2-1.4.8-1.9A6 6 0 0 0 12 3z" />
	),
	link: (
		<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
	),
} as const;

export type WorkbenchIconName = keyof typeof PATHS;

export const WorkbenchIcon: React.FC<{
	name: WorkbenchIconName;
	size?: number;
	className?: string;
}> = ({ name, size = 16, className }) => (
	<svg
		className={["wb-icon", className].filter(Boolean).join(" ")}
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth={1.6}
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
		focusable="false"
	>
		{PATHS[name]}
	</svg>
);
