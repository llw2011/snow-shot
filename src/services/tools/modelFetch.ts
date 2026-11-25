import { fetch } from "@tauri-apps/plugin-http";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** Keep the native streaming/abort transport, without a WebView Origin locally. */
export const modelFetch: typeof fetch = (input, init) => {
	const request = input instanceof Request ? input : undefined;
	const url = new URL(request ? request.url : String(input));
	const options = { ...init, signal: init?.signal ?? request?.signal };
	if (
		(url.protocol === "http:" || url.protocol === "https:") &&
		LOOPBACK_HOSTS.has(url.hostname)
	) {
		const headers = new Headers(init?.headers ?? request?.headers);
		// With unsafe-headers, the plugin removes an explicitly empty Origin.
		// Deleting it here would instead make the plugin add the WebView origin.
		headers.set("Origin", "");
		options.headers = headers;
		// Never forward a request without Origin to a redirected remote URL.
		options.maxRedirections = 0;
	}
	return fetch(input, options);
};
