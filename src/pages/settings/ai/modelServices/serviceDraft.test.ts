import { buildServiceDraft, type InputDetection } from "./serviceDraft.js";

const assert = (condition: boolean, message: string) => {
	if (!condition) throw new Error(message);
};

const uri = "https://old.example.test/custom";
const key = "old-key";
const uses = { chat: true, translation: true, ocr: false };
const detected = {
	uriInput: uri,
	keyInput: key,
	result: {
		status: "ok",
		provider: "vllm",
		// A fallback probe may find a working base different from the input.
		apiUri: "https://old.example.test/v1",
		models: [
			{ id: "default-model", vision: false, thinking: false },
			{ id: "chosen-model", vision: true, thinking: true },
		],
	},
} satisfies InputDetection;

// Simulate the render immediately after an input edit, before effect cleanup.
for (const [nextUri, nextKey] of [
	["https://new.example.test/v1", "new-key"],
	["https://new.example.test/v1", key],
	[uri, "new-key"],
	["", key],
	[" ", key],
]) {
	const draft = buildServiceDraft(
		nextUri,
		nextKey,
		detected,
		"chosen-model",
		uses,
	);
	assert(!draft.detection, "input edits must hide the previous detection");
	assert(
		!draft.service,
		"never save a new input with a previous endpoint/model",
	);
}

assert(
	!buildServiceDraft(uri, key, undefined, "chosen-model", uses).service,
	"pending detection cannot reuse a previously selected model",
);
assert(
	!buildServiceDraft(uri, key, detected, "previous-service-model", uses)
		.service,
	"a selected model must belong to this input's detection",
);

const chosen = buildServiceDraft(
	uri,
	key,
	detected,
	"chosen-model",
	uses,
).service;
assert(
	chosen?.apiUri === "https://old.example.test/v1",
	"save the working base",
);
assert(chosen?.apiKey === key, "save only this input's credentials");
assert(chosen?.apiModel === "chosen-model", "retain a manually selected chip");
assert(
	!!chosen?.supportThinking && !!chosen.supportVision,
	"capabilities belong to the selected model",
);
assert(
	!!chosen?.uses.chat && !!chosen.uses.translation && !chosen.uses.ocr,
	"preserve the selected uses",
);

const rejected: InputDetection = {
	...detected,
	result: { ...detected.result, status: "forbidden" },
};
assert(
	!buildServiceDraft(uri, key, rejected, "chosen-model", uses).service,
	"a failed new detection must not enable the previous model",
);

const deepl: InputDetection = {
	uriInput: "https://api.deepl.com",
	keyInput: "deepl-key",
	result: {
		status: "ok",
		provider: "deepl",
		apiUri: "https://api.deepl.com/v2/translate",
		models: [],
	},
};
const deeplService = buildServiceDraft(
	deepl.uriInput,
	deepl.keyInput,
	deepl,
	undefined,
	{ chat: false, translation: true, ocr: false },
).service;
assert(
	deeplService?.kind === "deepl" && deeplService.apiModel === "",
	"DeepL does not require a model selection",
);
const offlineDeepL = buildServiceDraft(
	deepl.uriInput,
	deepl.keyInput,
	{
		...deepl,
		result: {
			status: "unreachable",
			provider: "deepl",
			apiUri: "https://api.deepl.com/v2/translate",
			models: [],
		},
	},
	undefined,
	{ chat: false, translation: true, ocr: false },
).service;
assert(
	offlineDeepL?.kind === "deepl" && offlineDeepL.apiKey === deepl.keyInput,
	"a completed DeepL check need not succeed before saving its current input",
);

console.log(
	"model service draft regressions passed: input identity, pending/cleared input, chosen model, fallback base, DeepL",
);
