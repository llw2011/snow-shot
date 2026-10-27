import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export type ServiceProvider =
	| "ollama"
	| "lmstudio"
	| "llamacpp"
	| "vllm"
	| "openai"
	| "deepseek"
	| "dashscope"
	| "zhipu"
	| "siliconflow"
	| "openrouter"
	| "deepl"
	| "openaiCompatible";

export type DetectedModel = {
	id: string;
	vision: boolean;
	thinking: boolean;
};

export type ServiceDetection = {
	status: "ok" | "unreachable" | "auth" | "notFound" | "invalid" | "empty";
	provider: ServiceProvider;
	apiUri: string;
	models: DetectedModel[];
	latencyMs?: number;
	httpStatus?: number;
	message?: string;
};

export const PROVIDER_LABELS: Record<ServiceProvider, string> = {
	ollama: "Ollama",
	lmstudio: "LM Studio",
	llamacpp: "llama.cpp",
	vllm: "vLLM",
	openai: "OpenAI",
	deepseek: "DeepSeek",
	dashscope: "DashScope",
	zhipu: "Zhipu GLM",
	siliconflow: "SiliconFlow",
	openrouter: "OpenRouter",
	deepl: "DeepL",
	openaiCompatible: "OpenAI API",
};

/** Ports probed by "scan this computer"; only loopback is ever scanned. */
export const LOCAL_SERVICE_PORTS: {
	port: number;
	provider: ServiceProvider;
}[] = [
	{ port: 11434, provider: "ollama" },
	{ port: 1234, provider: "lmstudio" },
	{ port: 8000, provider: "vllm" },
	{ port: 8080, provider: "llamacpp" },
];

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

const HOST_PROVIDERS: [RegExp, ServiceProvider, string][] = [
	[/(^|\.)deepl\.com$/i, "deepl", "/v2/translate"],
	[/(^|\.)openai\.com$/i, "openai", "/v1"],
	[/(^|\.)deepseek\.com$/i, "deepseek", "/v1"],
	[
		/(^|\.)dashscope(-intl)?\.aliyuncs\.com$/i,
		"dashscope",
		"/compatible-mode/v1",
	],
	[/(^|\.)bigmodel\.cn$/i, "zhipu", "/api/paas/v4"],
	[/(^|\.)siliconflow\.(cn|com)$/i, "siliconflow", "/v1"],
	[/(^|\.)openrouter\.ai$/i, "openrouter", "/api/v1"],
];

const VISION_PATTERN =
	/(vl\b|-vl|vision|llava|minicpm-v|qwen3\.5|omni|gemma-?3|glm-4(\.1)?v|glm-ocr|pixtral|internvl|moondream|gpt-4o|gpt-4\.1|gpt-5|claude|gemini)/i;
const THINKING_PATTERN =
	/(qwen3|qwq|deepseek-r1|reasoner|r1-distill|think|reason|\bo[134]\b|o[34]-mini|gpt-5|glm-4\.5|glm-z1|magistral|gpt-oss)/i;
const NON_CHAT_PATTERN = /(embed|bge|rerank|whisper|tts|clip\b)/i;

export const guessModelCapabilities = (id: string) => ({
	vision: VISION_PATTERN.test(id),
	thinking: THINKING_PATTERN.test(id),
});

/**
 * Turn whatever the user pasted into an OpenAI-compatible base URL:
 * add a scheme, the provider's API path, and strip a pasted endpoint suffix.
 */
export const normalizeServiceInput = (
	input: string,
): { apiUri: string; provider: ServiceProvider } | undefined => {
	let value = input.trim();
	if (!value) {
		return undefined;
	}

	if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
		const host = value.split(/[/:]/)[0].toLowerCase();
		const isLoopback =
			LOOPBACK_HOSTS.has(host) || /^127\./.test(host) || host === "";
		value = `${isLoopback ? "http" : "https"}://${value}`;
	}

	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return undefined;
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return undefined;
	}

	let pathname = url.pathname
		.replace(/\/+$/, "")
		.replace(/\/(chat\/completions|completions|models)$/i, "");
	const hostProvider = HOST_PROVIDERS.find(([pattern]) =>
		pattern.test(url.hostname),
	);
	let provider: ServiceProvider = hostProvider?.[1] ?? "openaiCompatible";

	if (!hostProvider) {
		const localProvider = LOCAL_SERVICE_PORTS.find(
			({ port }) => `${port}` === url.port,
		);
		if (localProvider && LOOPBACK_HOSTS.has(url.hostname)) {
			provider = localProvider.provider;
		}
		if (url.hostname === "localhost" || url.hostname === "0.0.0.0") {
			url.hostname = "127.0.0.1";
		}
	}

	if (!pathname) {
		pathname = hostProvider?.[2] ?? "/v1";
	}

	return {
		apiUri: `${url.protocol}//${url.host}${pathname}`,
		provider,
	};
};

const withTimeout = (timeoutMs: number, signal?: AbortSignal) => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	signal?.addEventListener("abort", () => controller.abort(), { once: true });
	return {
		signal: controller.signal,
		done: () => clearTimeout(timer),
	};
};

const requestJson = async (
	url: string,
	init: RequestInit & { timeoutMs: number; signal?: AbortSignal },
): Promise<{ status: number; body?: unknown }> => {
	const timeout = withTimeout(init.timeoutMs, init.signal);
	try {
		const response = await tauriFetch(url, { ...init, signal: timeout.signal });
		let body: unknown;
		try {
			body = await response.json();
		} catch {
			body = undefined;
		}
		return { status: response.status, body };
	} finally {
		timeout.done();
	}
};

const rootOf = (apiUri: string) => {
	const url = new URL(apiUri);
	return `${url.protocol}//${url.host}`;
};

type ModelEntry = { id: string; ownedBy?: string; capabilities?: string[] };

const readModelEntries = (payload: unknown): ModelEntry[] => {
	if (!payload || typeof payload !== "object") {
		return [];
	}

	const record = payload as Record<string, unknown>;
	const entries: ModelEntry[] = [];
	const seen = new Set<string>();
	const push = (entry: unknown) => {
		if (!entry || typeof entry !== "object") {
			return;
		}
		const item = entry as Record<string, unknown>;
		const id = [item.id, item.model, item.name].find(
			(value): value is string => typeof value === "string" && !!value.trim(),
		);
		if (!id || seen.has(id)) {
			return;
		}
		seen.add(id);
		entries.push({
			id,
			ownedBy: typeof item.owned_by === "string" ? item.owned_by : undefined,
			capabilities: Array.isArray(item.capabilities)
				? item.capabilities.filter(
						(value): value is string => typeof value === "string",
					)
				: undefined,
		});
	};

	if (Array.isArray(record.data)) {
		record.data.forEach(push);
	}
	if (Array.isArray(record.models)) {
		record.models.forEach(push);
	}
	return entries;
};

const readOllamaCapabilities = async (
	root: string,
	model: string,
	signal?: AbortSignal,
) => {
	try {
		const { status, body } = await requestJson(`${root}/api/show`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model }),
			timeoutMs: 4000,
			signal,
		});
		if (status !== 200 || !body || typeof body !== "object") {
			return undefined;
		}
		const capabilities = (body as Record<string, unknown>).capabilities;
		return Array.isArray(capabilities)
			? capabilities.filter(
					(value): value is string => typeof value === "string",
				)
			: undefined;
	} catch {
		return undefined;
	}
};

/** Rank chat-capable models first so a sensible default is preselected. */
export const sortDetectedModels = (models: DetectedModel[]) =>
	[...models].sort((a, b) => {
		const rank = (model: DetectedModel) =>
			(NON_CHAT_PATTERN.test(model.id) ? 2 : 0) +
			(/ocr/i.test(model.id) ? 1 : 0);
		return rank(a) - rank(b);
	});

export const isChatModel = (id: string) => !NON_CHAT_PATTERN.test(id);

const detectDeepL = async (
	apiUri: string,
	apiKey: string,
	signal?: AbortSignal,
): Promise<ServiceDetection> => {
	const started = performance.now();
	const usageUrl = apiUri.replace(/\/translate$/, "/usage");
	try {
		const { status } = await requestJson(usageUrl, {
			method: "GET",
			headers: { Authorization: `DeepL-Auth-Key ${apiKey}` },
			timeoutMs: 8000,
			signal,
		});
		const latencyMs = Math.round(performance.now() - started);
		if (status === 200) {
			return { status: "ok", provider: "deepl", apiUri, models: [], latencyMs };
		}
		return {
			status: status === 401 || status === 403 ? "auth" : "invalid",
			provider: "deepl",
			apiUri,
			models: [],
			latencyMs,
			httpStatus: status,
		};
	} catch (error) {
		return {
			status: "unreachable",
			provider: "deepl",
			apiUri,
			models: [],
			message: error instanceof Error ? error.message : `${error}`,
		};
	}
};

/**
 * Connect to a pasted endpoint and describe it: provider, latency, models and
 * per-model capabilities. Never throws; failures are encoded in `status`.
 */
export const detectService = async (
	input: string,
	apiKey: string,
	options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<ServiceDetection | undefined> => {
	const normalized = normalizeServiceInput(input);
	if (!normalized) {
		return undefined;
	}

	const { apiUri } = normalized;
	let { provider } = normalized;
	if (provider === "deepl") {
		return detectDeepL(apiUri, apiKey, options?.signal);
	}

	const headers: Record<string, string> = {};
	if (apiKey.trim()) {
		headers.Authorization = `Bearer ${apiKey.trim()}`;
	}

	const root = rootOf(apiUri);
	const candidates = Array.from(
		new Set([`${apiUri}/models`, `${root}/v1/models`]),
	);
	const started = performance.now();
	let lastStatus: number | undefined;
	let lastMessage: string | undefined;

	for (const url of candidates) {
		let result: { status: number; body?: unknown };
		try {
			result = await requestJson(url, {
				method: "GET",
				headers,
				timeoutMs: options?.timeoutMs ?? 8000,
				signal: options?.signal,
			});
		} catch (error) {
			lastMessage = error instanceof Error ? error.message : `${error}`;
			continue;
		}

		lastStatus = result.status;
		if (result.status === 401 || result.status === 403) {
			return {
				status: "auth",
				provider,
				apiUri,
				models: [],
				httpStatus: result.status,
				latencyMs: Math.round(performance.now() - started),
			};
		}
		if (result.status !== 200) {
			continue;
		}

		const latencyMs = Math.round(performance.now() - started);
		const entries = readModelEntries(result.body);
		if (provider === "openaiCompatible") {
			if (entries.some((entry) => entry.ownedBy === "llamacpp")) {
				provider = "llamacpp";
			} else if (entries.some((entry) => entry.ownedBy === "vllm")) {
				provider = "vllm";
			}
		}
		if (provider === "openaiCompatible" || provider === "ollama") {
			// Ollama answers /api/version; it also tells us real capabilities.
			const version = await requestJson(`${root}/api/version`, {
				method: "GET",
				timeoutMs: 1500,
				signal: options?.signal,
			}).catch(() => undefined);
			if (version?.status === 200) {
				provider = "ollama";
			}
		}

		const ollamaCapabilities =
			provider === "ollama"
				? await Promise.all(
						entries
							.slice(0, 24)
							.map((entry) =>
								readOllamaCapabilities(root, entry.id, options?.signal),
							),
					)
				: [];

		const models = sortDetectedModels(
			entries.map((entry, index) => {
				const capabilities = ollamaCapabilities[index] ?? entry.capabilities;
				const guessed = guessModelCapabilities(entry.id);
				if (capabilities && provider === "ollama") {
					return {
						id: entry.id,
						vision: capabilities.includes("vision"),
						thinking: capabilities.includes("thinking"),
					};
				}
				return {
					id: entry.id,
					vision:
						guessed.vision ||
						!!capabilities?.some((value) => /vision|multimodal/i.test(value)),
					thinking: guessed.thinking,
				};
			}),
		);

		return {
			status: models.length > 0 ? "ok" : "empty",
			provider,
			apiUri,
			models,
			latencyMs,
		};
	}

	return {
		status: lastStatus === undefined ? "unreachable" : "notFound",
		provider,
		apiUri,
		models: [],
		httpStatus: lastStatus,
		message: lastMessage,
	};
};

export type DiscoveredService = ServiceDetection & { port: number };

/** Probe the well-known local runtime ports once; unreachable ports are skipped. */
export const scanLocalServices = async (
	signal?: AbortSignal,
): Promise<DiscoveredService[]> => {
	const results = await Promise.all(
		LOCAL_SERVICE_PORTS.map(async ({ port }) => {
			const detection = await detectService(`http://127.0.0.1:${port}`, "", {
				signal,
				timeoutMs: 1500,
			});
			return detection?.status === "ok" ? { ...detection, port } : undefined;
		}),
	);
	return results.filter((result): result is DiscoveredService => !!result);
};

/** The provider is shown as a badge, so the name only carries the model. */
export const suggestServiceName = (provider: ServiceProvider, model: string) =>
	provider === "deepl" || !model ? PROVIDER_LABELS[provider] : model;
