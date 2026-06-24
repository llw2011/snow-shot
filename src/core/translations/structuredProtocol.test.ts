import {
	buildStructuredTranslationInput,
	parseStructuredTranslationResult,
	tryParseJson,
} from "./structuredProtocol.js";

type RegressionSample = {
	id: string;
	category:
		| "bilingual"
		| "technical"
		| "ui"
		| "ocr"
		| "numbers"
		| "same-language";
	sourceLanguage: string;
	targetLanguage: string;
	sourceContent: string[];
	expectedHint: string;
};

const regressionSamples: RegressionSample[] = [
	{
		id: "en-zh-basic",
		category: "bilingual",
		sourceLanguage: "en",
		targetLanguage: "zh-CHS",
		sourceContent: ["The file has been saved."],
		expectedHint: "文件已保存",
	},
	{
		id: "zh-en-basic",
		category: "bilingual",
		sourceLanguage: "zh-CHS",
		targetLanguage: "en",
		sourceContent: ["请在设置页选择本地模型。"],
		expectedHint: "local model",
	},
	{
		id: "technical-term",
		category: "technical",
		sourceLanguage: "en",
		targetLanguage: "zh-CHS",
		sourceContent: ["Abort stale OpenAI-compatible translation streams."],
		expectedHint: "中止过期的 OpenAI-compatible 翻译流",
	},
	{
		id: "ui-short-phrases",
		category: "ui",
		sourceLanguage: "en",
		targetLanguage: "zh-CHS",
		sourceContent: ["Open file", "Save as", "Clear cache"],
		expectedHint: "打开文件 / 另存为 / 清理缓存",
	},
	{
		id: "ocr-blocks",
		category: "ocr",
		sourceLanguage: "en",
		targetLanguage: "zh-CHS",
		sourceContent: ["Invoice No.", "Total: $1,280.50", "Due date: 2026-07-01"],
		expectedHint: "发票号 / 总计 / 到期日",
	},
	{
		id: "numbers-dates-units",
		category: "numbers",
		sourceLanguage: "en",
		targetLanguage: "zh-CHS",
		sourceContent: ["Latency dropped from 120 ms to 85 ms on June 24, 2026."],
		expectedHint: "保留 120 ms、85 ms、2026-06-24 语义",
	},
	{
		id: "same-language",
		category: "same-language",
		sourceLanguage: "zh-CHS",
		targetLanguage: "zh-CHS",
		sourceContent: ["本地模型响应超时，请稍后重试。"],
		expectedHint: "原样返回",
	},
];

const assert = (condition: boolean, message: string) => {
	if (!condition) {
		throw new Error(message);
	}
};

const assertDeepEqual = (
	actual: unknown,
	expected: unknown,
	message: string,
) => {
	const actualJson = JSON.stringify(actual);
	const expectedJson = JSON.stringify(expected);
	assert(
		actualJson === expectedJson,
		`${message}\nactual: ${actualJson}\nexpected: ${expectedJson}`,
	);
};

const runStructuredProtocolChecks = () => {
	assertDeepEqual(
		buildStructuredTranslationInput(["Open file", "Save as"]),
		[
			{ id: 0, text: "Open file" },
			{ id: 1, text: "Save as" },
		],
		"structured input must preserve source order and assign stable ids",
	);

	assertDeepEqual(
		parseStructuredTranslationResult(
			JSON.stringify([
				{ id: 2, translation: "  85 ms  " },
				{ id: 0, translation: "打开文件" },
				{ id: 1, translation: "另存为" },
			]),
			3,
		),
		[{ content: "打开文件" }, { content: "另存为" }, { content: "85 ms" }],
		"parser must reorder translations by id and trim values",
	);

	assertDeepEqual(
		parseStructuredTranslationResult(
			'```json\n[{"id":0,"translation":"清理缓存"}]\n```',
			1,
		),
		[{ content: "清理缓存" }],
		"parser must accept fenced JSON",
	);

	assertDeepEqual(
		parseStructuredTranslationResult(
			'Result:\n[{"id":0,"translation":"总计：$1,280.50"}]\nDone.',
			1,
		),
		[{ content: "总计：$1,280.50" }],
		"parser must recover a JSON array from surrounding prose",
	);

	assert(
		tryParseJson("there is no JSON array here") === undefined,
		"tryParseJson must reject text without JSON",
	);

	const invalidResponses = [
		{
			name: "missing item",
			content: '[{"id":0,"translation":"打开文件"}]',
			sourceLength: 2,
		},
		{
			name: "duplicate id",
			content:
				'[{"id":0,"translation":"打开文件"},{"id":0,"translation":"另存为"}]',
			sourceLength: 2,
		},
		{
			name: "out-of-range id",
			content: '[{"id":2,"translation":"打开文件"}]',
			sourceLength: 1,
		},
		{
			name: "non-integer id",
			content: '[{"id":"0","translation":"打开文件"}]',
			sourceLength: 1,
		},
		{
			name: "non-string translation",
			content: '[{"id":0,"translation":123}]',
			sourceLength: 1,
		},
		{
			name: "malformed JSON",
			content: '[{"id":0,"translation":"打开文件"}',
			sourceLength: 1,
		},
	];

	for (const invalidResponse of invalidResponses) {
		assert(
			parseStructuredTranslationResult(
				invalidResponse.content,
				invalidResponse.sourceLength,
			) === undefined,
			`parser must reject ${invalidResponse.name}`,
		);
	}
};

const runRegressionSampleChecks = () => {
	const requiredCategories: RegressionSample["category"][] = [
		"bilingual",
		"technical",
		"ui",
		"ocr",
		"numbers",
		"same-language",
	];
	const sampleIds = new Set<string>();
	const sampleCategories = new Set<RegressionSample["category"]>();

	for (const sample of regressionSamples) {
		assert(!sampleIds.has(sample.id), `duplicate sample id: ${sample.id}`);
		sampleIds.add(sample.id);
		sampleCategories.add(sample.category);
		assert(sample.sourceContent.length > 0, `${sample.id} has no source text`);
		assert(
			sample.sourceContent.every((content) => content.trim().length > 0),
			`${sample.id} contains empty source text`,
		);
		assert(
			sample.sourceLanguage.length > 0 && sample.targetLanguage.length > 0,
			`${sample.id} must define source and target languages`,
		);
		assert(sample.expectedHint.length > 0, `${sample.id} has no expected hint`);
	}

	for (const category of requiredCategories) {
		assert(
			sampleCategories.has(category),
			`missing regression sample category: ${category}`,
		);
	}
};

runStructuredProtocolChecks();
runRegressionSampleChecks();

console.log("qwen translation regression checks passed");
