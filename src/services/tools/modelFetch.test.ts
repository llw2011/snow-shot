import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import OpenAI from "openai";
import { detectService } from "../../pages/settings/ai/modelServices/detection.js";
import { modelFetch } from "./modelFetch.js";

const assert = (condition: boolean, message: string) => {
	if (!condition) throw new Error(message);
};

type ClientConfig = {
	url: string;
	method: string;
	headers: [string, string][];
	data: number[] | null;
	maxRedirections?: number;
};

// Exercise the installed JS plugin (Request, IPC and streaming), mocking only
// the native boundary. Live Rust/WebView acceptance remains a separate check.
Object.defineProperty(globalThis, "window", {
	value: { crypto: globalThis.crypto },
	configurable: true,
});
const requests: ClientConfig[] = [];
const responses = new Map<number, Response>();
const cancelled: number[] = [];
let respond = (_config: ClientConfig): Response | Promise<Response> =>
	Response.json({ ok: true });
mockIPC(async (command, args) => {
	const payload = args as {
		clientConfig: ClientConfig;
		rid: number;
		streamChannel: { onmessage: (data: Uint8Array) => void };
	};
	if (command === "plugin:http|fetch") {
		requests.push(payload.clientConfig);
		return requests.length - 1;
	}
	if (command === "plugin:http|fetch_cancel") {
		cancelled.push(payload.rid);
		return;
	}
	if (command === "plugin:http|fetch_send") {
		const response = await respond(requests[payload.rid]);
		responses.set(payload.rid, response);
		return {
			rid: payload.rid,
			status: response.status,
			statusText: response.statusText,
			headers: [...response.headers],
			url: requests[payload.rid].url,
		};
	}
	if (command === "plugin:http|fetch_read_body") {
		const response = responses.get(payload.rid);
		const reader = response?.body?.getReader();
		if (reader) {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				payload.streamChannel.onmessage(new Uint8Array([...value, 0]));
			}
		}
		payload.streamChannel.onmessage(new Uint8Array([1]));
		responses.delete(payload.rid);
		return;
	}
	throw new Error(`Unexpected IPC: ${command}`);
});

try {
	for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
		for (const protocol of ["http", "https"]) {
			const headers = new Headers({ Authorization: "Bearer local-test" });
			const init = { headers, maxRedirections: 5 };
			await modelFetch(`${protocol}://${host}:11434/v1/models`, init);
			const config = requests[requests.length - 1];
			const sent = new Headers(config.headers);
			assert(
				sent.get("Origin") === "",
				"loopback must explicitly clear Origin",
			);
			assert(sent.get("Authorization") === "Bearer local-test", "keep API key");
			assert(config.maxRedirections === 0, "never redirect local requests");
			assert(
				!headers.has("Origin") && init.maxRedirections === 5,
				"do not mutate caller options",
			);
		}
	}
	for (const url of [
		"https://example.com/v1/models",
		"http://192.168.1.2:11434/v1/models",
		"http://localhost.example.com/v1/models",
		"http://127.0.0.1.example.com/v1/models",
		"http://127.0.0.1@example.com/v1/models",
		"http://[::2]:11434/v1/models",
	]) {
		// Credential-bearing URLs are rejected by Request before IPC.
		if (url.includes("@")) {
			let rejected = false;
			try {
				await modelFetch(url);
			} catch {
				rejected = true;
			}
			assert(rejected, "credential URL should be rejected");
			continue;
		}
		await modelFetch(new URL(url), { maxRedirections: 3 });
		const config = requests[requests.length - 1];
		assert(
			!new Headers(config.headers).has("Origin"),
			"remote must use plugin default Origin",
		);
		assert(config.maxRedirections === 3, "remote redirect options unchanged");
	}

	const controller = new AbortController();
	const request = new Request("http://127.0.0.1:11434/v1/chat/completions", {
		method: "POST",
		headers: {
			Authorization: "Bearer from-request",
			"Content-Type": "application/json",
		},
		body: '{"stream":true}',
		signal: controller.signal,
	});
	await modelFetch(request);
	const lastRequest = requests[requests.length - 1];
	assert(
		new Headers(lastRequest.headers).get("Authorization") ===
			"Bearer from-request",
		"keep Request headers",
	);
	assert(lastRequest.method === "POST", "keep method");
	assert(
		new TextDecoder().decode(new Uint8Array(lastRequest.data ?? [])) ===
			'{"stream":true}',
		"keep request body",
	);
	controller.abort();
	assert(
		cancelled.includes(requests.length - 1),
		"forward Request abort to native cancellation",
	);
	const count = requests.length;
	try {
		await modelFetch(request);
	} catch {
		/* pre-aborted request */
	}
	assert(requests.length === count, "pre-aborted Request must not enter IPC");

	respond = (config) => {
		assert(
			new Headers(config.headers).get("Origin") === "",
			"all detection paths clear Origin",
		);
		const path = new URL(config.url).pathname;
		if (path === "/v1/models")
			return Response.json({ data: [{ id: "qwen3.5:2b" }] });
		if (path === "/api/version") return Response.json({ version: "test" });
		if (path === "/api/show")
			return Response.json({
				capabilities: ["completion", "thinking", "vision"],
			});
		throw new Error(`Unexpected detection path: ${path}`);
	};
	const detection = await detectService("http://127.0.0.1:11434", "");
	assert(
		detection?.status === "ok" && detection.provider === "ollama",
		"detect Ollama",
	);
	assert(
		detection?.models[0]?.thinking === true && detection.models[0].vision,
		"read Ollama capabilities",
	);
	for (const status of [401, 403]) {
		respond = () => new Response(null, { status });
		const result = await detectService("http://127.0.0.1:11434", "");
		assert(
			result?.status === (status === 401 ? "auth" : "forbidden"),
			"distinguish denied access from API key failure",
		);
	}

	const fallbackStart = requests.length;
	respond = (config) =>
		new URL(config.url).pathname === "/v1/models"
			? Response.json({ data: [{ id: "working-model", owned_by: "vllm" }] })
			: new Response(null, { status: 404 });
	const fallback = await detectService("http://127.0.0.1:11440/wrong", "");
	assert(
		fallback?.status === "ok" &&
			fallback.apiUri === "http://127.0.0.1:11440/v1" &&
			requests.length === fallbackStart + 2,
		"a successful fallback must return the base used by real model calls",
	);

	const preAborted = new AbortController();
	preAborted.abort();
	const beforePreAborted = requests.length;
	assert(
		(await detectService("http://127.0.0.1:11434", "", {
			signal: preAborted.signal,
		})) === undefined && requests.length === beforePreAborted,
		"a cancelled detection must never enter native IPC",
	);
	const deeplCancellation = new AbortController();
	respond = () => {
		deeplCancellation.abort();
		return Response.json({});
	};
	assert(
		(await detectService("https://api.deepl.com", "test-key", {
			signal: deeplCancellation.signal,
		})) === undefined,
		"DeepL cancellation must also return no detection result",
	);

	for (const cancelAt of ["/wrong/models", "/api/version", "/api/show"]) {
		const cancellation = new AbortController();
		const activeListeners =
			new Set<EventListenerOrEventListenerObject | null>();
		const addListener = cancellation.signal.addEventListener.bind(
			cancellation.signal,
		);
		const removeListener = cancellation.signal.removeEventListener.bind(
			cancellation.signal,
		);
		cancellation.signal.addEventListener = (
			...args: Parameters<AbortSignal["addEventListener"]>
		) => {
			const [type, listener] = args;
			if (type === "abort") activeListeners.add(listener);
			addListener(...args);
		};
		cancellation.signal.removeEventListener = (
			...args: Parameters<AbortSignal["removeEventListener"]>
		) => {
			const [type, listener] = args;
			if (type === "abort") activeListeners.delete(listener);
			removeListener(...args);
		};
		const requestedPaths: string[] = [];
		respond = (config) => {
			const path = new URL(config.url).pathname;
			requestedPaths.push(path);
			if (path === cancelAt) cancellation.abort();
			if (path.endsWith("/models")) {
				return Response.json({ data: [{ id: "test-model" }] });
			}
			if (path === "/api/version") return Response.json({ version: "test" });
			if (path === "/api/show") {
				return Response.json({ capabilities: ["completion"] });
			}
			throw new Error(`Unexpected cancellation path: ${path}`);
		};
		const result = await detectService("http://127.0.0.1:11434/wrong", "", {
			signal: cancellation.signal,
		});
		assert(result === undefined, "cancellation must not become a result");
		assert(
			requestedPaths[requestedPaths.length - 1] === cancelAt &&
				!requestedPaths.includes("/v1/models"),
			"cancellation must stop fallback and capability requests",
		);
		assert(activeListeners.size === 0, "release detection abort listeners");
	}

	const completed = new AbortController();
	let addedListeners = 0;
	let removedListeners = 0;
	const addListener = completed.signal.addEventListener.bind(completed.signal);
	const removeListener = completed.signal.removeEventListener.bind(
		completed.signal,
	);
	completed.signal.addEventListener = (
		...args: Parameters<AbortSignal["addEventListener"]>
	) => {
		addedListeners += 1;
		addListener(...args);
	};
	completed.signal.removeEventListener = (
		...args: Parameters<AbortSignal["removeEventListener"]>
	) => {
		removedListeners += 1;
		removeListener(...args);
	};
	respond = () =>
		Response.json({ data: [{ id: "test-model", owned_by: "vllm" }] });
	await detectService("http://127.0.0.1:11440", "", {
		signal: completed.signal,
	});
	assert(
		addedListeners > 0 && addedListeners === removedListeners,
		"successful detection must also release abort listeners",
	);

	const encoder = new TextEncoder();
	let finishStream = () => {};
	respond = () =>
		new Response(
			new ReadableStream({
				start(stream) {
					stream.enqueue(
						encoder.encode(
							'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n',
						),
					);
					finishStream = () => {
						stream.enqueue(
							encoder.encode(
								'data: {"choices":[{"delta":{"content":"世界"}}]}\n\ndata: [DONE]\n\n',
							),
						);
						stream.close();
					};
				},
			}),
			{ headers: { "Content-Type": "text/event-stream" } },
		);
	const client = new OpenAI({
		apiKey: "test",
		baseURL: "http://127.0.0.1:11434/v1",
		fetch: modelFetch,
		dangerouslyAllowBrowser: true,
	});
	const stream = await client.chat.completions.create({
		model: "qwen3.5:2b",
		messages: [{ role: "user", content: "Hello" }],
		stream: true,
	});
	const iterator = stream[Symbol.asyncIterator]();
	const first = await iterator.next();
	assert(
		first.value?.choices[0]?.delta.content === "你好",
		"deliver first delta before response completes",
	);
	finishStream();
	const second = await iterator.next();
	assert(
		second.value?.choices[0]?.delta.content === "世界",
		"preserve subsequent stream chunks",
	);
	assert((await iterator.next()).done === true, "complete SSE stream");
	console.log(
		"model HTTP regressions passed: loopback/remote boundaries, headers, Request body/abort, detection fallback/cancellation/cleanup, HTTP errors, streaming SDK",
	);
} finally {
	clearMocks();
}
