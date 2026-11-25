/* eslint-disable @typescript-eslint/no-explicit-any */

import { fetch } from "@tauri-apps/plugin-http";
import { BUILD_SERVICE_BASE_URL } from "@/constants/buildFlavor";
import { appError } from "@/utils/log";
import { modelFetch } from "./modelFetch";

// biome-ignore lint/suspicious/noExplicitAny: 方便实现
const getUrl = (url: string, params?: Record<string, any>) => {
	const urlObj = BUILD_SERVICE_BASE_URL
		? new URL(url, BUILD_SERVICE_BASE_URL)
		: new URL(url);

	if (params) {
		Object.entries(params).forEach(([key, value]) => {
			urlObj.searchParams.set(key, value);
		});
	}

	return urlObj.toString();
};

export class ServiceResponse<T> {
	public readonly response: Response | undefined;
	public readonly code: number | undefined;
	public readonly message: string | undefined;
	public readonly data: T | undefined;

	private constructor(
		response: Response | undefined,
		code?: number,
		message?: string,
		data?: T,
	) {
		this.response = response;
		this.code = code;
		this.message = message;
		this.data = data;
	}

	static requestError(error: Error): ServiceResponse<undefined> {
		return new ServiceResponse(undefined, -1, error.message, undefined);
	}

	static httpError(response: Response): ServiceResponse<undefined> {
		return new ServiceResponse(response, -1, response.statusText, undefined);
	}

	static serviceError(
		response: Response,
		code: number,
		message: string,
	): ServiceResponse<undefined> {
		return new ServiceResponse(response, code, message, undefined);
	}

	static success<T>(
		response: Response,
		message: string,
		data: T,
	): ServiceResponse<T> {
		return new ServiceResponse(response, 0, message, data);
	}

	public success(ignoreEvent?: boolean): T | undefined {
		if (!this.response) {
			if (!ignoreEvent) {
				try {
					window.__APP_HANDLE_REQUEST_ERROR__?.(this);
				} catch (error) {
					appError("[ServiceResponse] success error", error);
				}
			}
			return undefined;
		}

		if (this.response.status !== 200) {
			if (!ignoreEvent) {
				try {
					window.__APP_HANDLE_HTTP_ERROR__?.(this);
				} catch (error) {
					appError("[ServiceResponse] httpError error", error);
				}
			}
			return undefined;
		}

		if (this.code !== 0) {
			if (!ignoreEvent) {
				try {
					window.__APP_HANDLE_SERVICE_ERROR__?.(this);
				} catch (error) {
					appError("[ServiceResponse] serviceError error", error);
				}
			}
			return undefined;
		}

		return this.data;
	}
}

export const serviceBaseFetch = async (
	url: string,
	options: {
		method: "POST" | "GET";
		// biome-ignore lint/suspicious/noExplicitAny: 方便实现
		params?: any | Record<string, any>;
		// biome-ignore lint/suspicious/noExplicitAny: 方便实现
		data?: any | Record<string, any>;
		headers?: Record<string, string>;
	},
): Promise<Response | ServiceResponse<undefined>> => {
	let response: Response;
	try {
		response = await fetch(getUrl(url, options.params), {
			method: options.method,
			headers: {
				"Content-Type": "application/json",
				"Accept-Language": window.__APP_ACCEPT_LANGUAGE__,
				...options.headers,
			},
			body: JSON.stringify(options.data),
		});
	} catch (e) {
		if (e instanceof Error) {
			return ServiceResponse.requestError(e);
		} else if (typeof e === "string") {
			return ServiceResponse.requestError(new Error(e));
		}

		return ServiceResponse.requestError(new Error(`Unknown error: ${e}`));
	}

	if (response.status !== 200) {
		return ServiceResponse.httpError(response);
	}

	return response;
};

export const appFetch = (async (...params: Parameters<typeof fetch>) => {
	try {
		const headers = new Headers(
			params[1]?.headers ??
				(params[0] instanceof Request ? params[0].headers : undefined),
		);
		if (!headers.has("Accept-Language")) {
			headers.set("Accept-Language", window.__APP_ACCEPT_LANGUAGE__);
		}
		const response = await modelFetch(params[0], {
			...params[1],
			headers,
		});

		if (response.status !== 200) {
			// Preserve the body for SDK error handling, including empty 403s.
			const data = await response
				.clone()
				.json()
				.catch(() => undefined);

			if (data?.error && typeof data.error.message === "string") {
				ServiceResponse.serviceError(
					{ status: 200, statusText: response.statusText } as Response,
					response.status,
					data.error.message ? data.error.message : response.statusText,
				).success();
			}
		}
		return response;
	} catch (error) {
		if (!(error instanceof Error && error.name === "AbortError")) {
			appError("[appFetch] fetch error", error);
		}
		throw error;
	}
}) as typeof fetch;
