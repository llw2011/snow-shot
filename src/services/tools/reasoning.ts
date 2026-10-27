import type OpenAI from "openai";

type ReasoningEffort = NonNullable<
	OpenAI.Chat.ChatCompletionCreateParams["reasoning_effort"]
>;

/**
 * Reasoning models served by Ollama and similar runtimes (Qwen 3.5, DeepSeek
 * R1, …) think by default, which turns a one-line translation into a minute of
 * hidden tokens. `reasoning_effort: "none"` is the OpenAI-compatible switch to
 * answer directly; it is only sent to services marked as thinking-capable.
 */
export const getDisableReasoningParams = (
	supportThinking: boolean | undefined,
): { reasoning_effort?: ReasoningEffort } =>
	supportThinking
		? { reasoning_effort: "none" as unknown as ReasoningEffort }
		: {};
