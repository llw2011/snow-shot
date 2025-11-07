import type { GlobalToken } from "antd";
import { OcrResultType } from ".";

const domParser = new DOMParser();
export const getOcrResultIframeSrcDoc = (
	textContent: string,
	ocrResultType: OcrResultType,
	enableDrag: boolean | undefined,
	enableCopy: boolean | undefined,
	token: GlobalToken | undefined,
) => {
	let extraStyle = "";
	if (ocrResultType === OcrResultType.VisionModelHtml) {
		// 如果 textContent 包含 markdown 代码块标记，提取首个 < 和最后一个 > 之间的内容
		const firstLtIndex = textContent.indexOf("<");
		const lastGtIndex = textContent.lastIndexOf(">");

		textContent = textContent.substring(
			firstLtIndex === -1 ? 0 : firstLtIndex,
			lastGtIndex === -1 ? textContent.length : lastGtIndex + 1,
		);

		const contentHtmlDom = domParser.parseFromString(textContent, "text/html");
		textContent = contentHtmlDom.body.innerHTML;
		extraStyle = `
            table {
                border-collapse: collapse;
                border-spacing: 0;
                width: 100%;
                border: 1px solid ${token?.colorBorder ?? "#d9d9d9"};
            }

            th, td {
                text-align: left;
                padding: 8px 12px;
                border: 1px solid ${token?.colorBorder ?? "#d9d9d9"};
            }

            th {
                background-color: ${token?.colorBgContainer ? `color-mix(in srgb, ${token.colorBgContainer} 50%, ${token.colorBorderSecondary ?? "#f0f0f0"})` : "#fafafa"};
                font-weight: 600;
            }

            tr:hover {
                background-color: ${token?.colorBgTextHover ?? "rgba(0, 0, 0, 0.02)"};
            }
        `;
	}

	return `<head><meta name="color-scheme" content="light dark"></meta></head>
                                <body>${textContent}</body>
                        <style>
                            html {
                                height: 100%;
                                width: 100%;
                                background-color: ${ocrResultType === OcrResultType.VisionModelHtml ? (token?.colorBgContainer ?? "transparent") : "transparent"};
                                ${ocrResultType === OcrResultType.VisionModelHtml ? `color: ${token?.colorText ?? "inherit"}` : ""}
                            }

                            ${extraStyle}

                            .ocr-result-text-background-element {
                                opacity: 0;
                            }

                            .ocr-result-text-element {
                                opacity: 1;
                            }

                            body {
                                height: 100%;
                                width: 100%;
                                padding: 0;
                                margin: 0;
                                border: none;
                                overflow: ${ocrResultType === OcrResultType.VisionModelHtml ? "auto" : "hidden"};
                                ${enableDrag ? "cursor: grab;" : ""}
                                background-color: transparent;
                            }
                            body:active {
                                ${enableDrag ? "cursor: grabbing;" : ""}
                            }

                            * {
                                -webkit-user-select: text !important;
                                -moz-user-select: text !important;
                                -ms-user-select: text !important;
                                user-select: text !important;
                            }
                        </style>
                        <script>
                            document.oncopy = (e) => {
                                if (${enableCopy ? "true" : "false"}) {
                                    return;
                                }

                                e.preventDefault();
                            };

                            document.oncontextmenu = (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.parent.postMessage({
                                    type: 'contextMenu',
                                    eventData: {
                                        type: 'contextmenu',
                                        clientX: e.clientX,
                                        clientY: e.clientY,
                                    }
                                }, '*');
                            };

                            document.addEventListener('mousedown', (e) => {
                                window.parent.postMessage({
                                    type: 'mousedown',
                                    clientX: e.clientX,
                                    clientY: e.clientY,
                                    button: e.button,
                                    buttons: e.buttons,
                                    ctrlKey: e.ctrlKey,
                                    shiftKey: e.shiftKey,
                                    altKey: e.altKey,
                                    metaKey: e.metaKey,
                                }, '*');
                            });

                            document.addEventListener('wheel', (e) => {
                                e.preventDefault();
                                window.parent.postMessage({
                                    type: 'wheel',
                                    eventData: {
                                        deltaY: e.deltaY,
                                        clientX: e.clientX,
                                        clientY: e.clientY,
                                        ctrlKey: e.ctrlKey,
                                        shiftKey: e.shiftKey,
                                        altKey: e.altKey,
                                    },
                                }, '*');
                            });

                            document.addEventListener('mousemove', (e) => {
                                window.parent.postMessage({
                                    type: 'mousemove',
                                    clientX: e.clientX,
                                    clientY: e.clientY,
                                    button: e.button,
                                    buttons: e.buttons,
                                    ctrlKey: e.ctrlKey,
                                    shiftKey: e.shiftKey,
                                    altKey: e.altKey,
                                    metaKey: e.metaKey,
                                }, '*');
                            });

                            document.onmouseup = (e) => {
                                window.parent.postMessage({
                                    type: 'mouseup',
                                    clientX: e.clientX,
                                    clientY: e.clientY,
                                    button: e.button,
                                    buttons: e.buttons,
                                    ctrlKey: e.ctrlKey,
                                    shiftKey: e.shiftKey,
                                    altKey: e.altKey,
                                    metaKey: e.metaKey,
                                }, '*');
                            };

                            // 转发键盘事件到父窗口
                            document.onkeydown = (e) => {
                                window.parent.postMessage({
                                    type: 'keydown',
                                    key: e.key,
                                    code: e.code,
                                    keyCode: e.keyCode,
                                    ctrlKey: e.ctrlKey,
                                    shiftKey: e.shiftKey,
                                    altKey: e.altKey,
                                    metaKey: e.metaKey,
                                    repeat: e.repeat,
                                }, '*');
                            };

                            document.onkeyup = (e) => {
                                window.parent.postMessage({
                                    type: 'keyup',
                                    key: e.key,
                                    code: e.code,
                                    keyCode: e.keyCode,
                                    ctrlKey: e.ctrlKey,
                                    shiftKey: e.shiftKey,
                                    altKey: e.altKey,
                                    metaKey: e.metaKey,
                                }, '*');
                            };
                        </script>
                    `;
};

/**
 * 将译文按来源文本的长度占比切分，使两者段数一致且占比尽量接近
 */
export function alignTranslatedBySourceProportion(
	sourceTextList: string[],
	translatedTextList: string[],
): string[] {
	const splitGraphemes = (text: string): string[] => {
		type SegmentData = { segment: string };
		type SegmenterInstance = {
			segment: (input: string) => Iterable<SegmentData>;
		};
		type SegmenterCtor = new (
			locales?: string | string[],
			options?: { granularity?: "grapheme" | "word" | "sentence" },
		) => SegmenterInstance;
		const SegCtor =
			typeof Intl !== "undefined"
				? (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter
				: undefined;
		const segmenter: SegmenterInstance | null =
			typeof SegCtor === "function"
				? new SegCtor(undefined, { granularity: "grapheme" })
				: null;
		if (segmenter) {
			const seg = segmenter.segment(text);
			const result: string[] = [];
			for (const part of seg) result.push(part.segment);
			return result;
		}
		// Fallback: code points
		return Array.from(text);
	};

	const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

	// 1) 源文本各段长度与占比
	const sourceGraphemeLens = sourceTextList.map(
		(s) => splitGraphemes(s).length,
	);
	const sourceTotal = sum(sourceGraphemeLens);
	const n = sourceTextList.length;

	// 边界：若源总长度为 0，则平均分配
	const sourceRatios =
		sourceTotal > 0
			? sourceGraphemeLens.map((l) => l / sourceTotal)
			: Array.from({ length: n }, () => 1 / Math.max(1, n));

	// 2) 译文总长度
	const translatedGraphemesList = translatedTextList.map(splitGraphemes);
	const translatedTotal = sum(translatedGraphemesList.map((g) => g.length));

	// 边界：译文总长度为 0，直接返回空段
	if (translatedTotal === 0) return Array.from({ length: n }, () => "");

	// 3) 最大余数法：按占比把总长度分成 n 份的整数目标
	const quotas = sourceRatios.map((r) => r * translatedTotal);
	const floorParts = quotas.map((q) => Math.floor(q));
	const remainder = translatedTotal - sum(floorParts);

	const remainders = quotas.map((q, i) => ({ i, frac: q - Math.floor(q) }));
	remainders.sort((a, b) => (b.frac === a.frac ? a.i - b.i : b.frac - a.frac));
	for (let k = 0; k < remainder; k++) {
		floorParts[remainders[k].i] += 1;
	}
	const targetLens = floorParts; // 每段应取的“字素”数，和为 translatedTotal

	// 4) 顺序切分译文，得到与源文本同段数的结果
	const result: string[] = Array.from({ length: n }, () => "");
	let translatedIndex = 0; // 指向第几个译文段
	let graphemeIndex = 0; // 指向该译文段内的字素位置

	for (let i = 0; i < n; i++) {
		let need = targetLens[i];
		const parts: string[] = [];

		while (need > 0 && translatedIndex < translatedGraphemesList.length) {
			const current = translatedGraphemesList[translatedIndex];
			const remain = current.length - graphemeIndex;
			if (remain <= 0) {
				translatedIndex += 1;
				graphemeIndex = 0;
				continue;
			}

			const take = Math.min(need, remain);
			if (take > 0) {
				parts.push(current.slice(graphemeIndex, graphemeIndex + take).join(""));
				graphemeIndex += take;
				need -= take;
			}

			if (graphemeIndex >= current.length) {
				translatedIndex += 1;
				graphemeIndex = 0;
			}
		}

		result[i] = parts.join("");
	}

	return result;
}
