import { error, info, warn } from "@tauri-apps/plugin-log";

export enum LogMessageLevel {
	Info = "info",
	Error = "error",
	Warning = "warning",
}

export type LogMessageEvent = {
	level: LogMessageLevel;
	message: string;
};

export function appLog(
	event: LogMessageEvent,
	message: undefined,
	from: "APP_WEB" | "APP_TAURI",
): void;
export function appLog(
	level: LogMessageLevel,
	message: string,
	from: "APP_WEB" | "APP_TAURI",
): void;
export function appLog(
	event: LogMessageEvent | LogMessageLevel,
	message?: string,
	from: "APP_WEB" | "APP_TAURI" = "APP_WEB",
) {
	let level: LogMessageLevel;
	let msg: string;
	if (typeof event === "object") {
		level = event.level;
		msg = event.message;
	} else {
		level = event;
		msg = message ?? "";
	}

	const formattedMessage = `[${from} ${level}] ${msg}`;

	if (level === LogMessageLevel.Info) {
		info(formattedMessage);
	} else if (level === LogMessageLevel.Error) {
		error(formattedMessage);
	} else if (level === LogMessageLevel.Warning) {
		warn(formattedMessage);
	}
}
