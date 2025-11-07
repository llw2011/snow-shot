import type { GlobalToken } from "antd";
import type { FixedContentProcessImageConfig } from ".";

export const getHtmlContent = (token: GlobalToken, bodyContent: string) => {
	return `
      <html>
                  <head>
                  <meta name="color-scheme" content="light dark"></meta>
                  <style>
                        body {
                            width: fit-content;
                            height: fit-content;
                            margin: 0;
                            padding: ${token.padding}px;
                            overflow: hidden;
                            box-sizing: border-box;
                            background-color: transparent;
                            color: ${token.colorText};
                        }
                    </style>
                    <script>
                        window.addEventListener('load', () => {
                            window.parent.postMessage({
                                type: 'bodySize',
                                width: document.body.offsetWidth,
                                height: document.body.offsetHeight,
                                clientWidth: document.body.clientWidth,
                                clientHeight: document.body.clientHeight,
                            }, '*');

                            // 检测并应用主背景色
                            const colorMap = {};
                            let resultColor = "";
                            let maxAmount = 0;
                            
                            // 创建 TreeWalker，从 <body> 开始，忽略注释节点和文本节点
                            const walker = document.createTreeWalker(
                                document.body, 
                                NodeFilter.SHOW_ELEMENT, 
                                (node) => {
                                    const { width, height } = node.getBoundingClientRect();
                                    const { backgroundColor, opacity } = getComputedStyle(node);
                                    const pixelAmount = width * height;
                                    
                                    // 跳过透明(背景)元素或无尺寸元素(display:contents)继续遍历后代元素
                                    if (backgroundColor === "rgba(0, 0, 0, 0)" || opacity === "0" || pixelAmount === 0) {
                                        return NodeFilter.FILTER_ACCEPT;
                                    }
                                    
                                    colorMap[backgroundColor] = (colorMap[backgroundColor] || 0) + pixelAmount;
                                    const amount = colorMap[backgroundColor];
                                    
                                    if (amount > maxAmount) {
                                        resultColor = backgroundColor;
                                        maxAmount = amount;
                                    }
                                    
                                    return NodeFilter.FILTER_REJECT; // 跳过当前节点及其后代
                                }, 
                                false
                            );
                            
                            while (walker.nextNode()); // 开启遍历
                            
                            // 如果检测到有效背景色，应用到 body 并重置文字颜色
                            if (resultColor && resultColor !== "rgba(0, 0, 0, 0)") {
                                document.body.style.backgroundColor = resultColor;
                                document.body.style.color = ""; // 重置为默认颜色
                            }
                        });

                        window.addEventListener('resize', () => {
                            window.parent.postMessage({
                                type: 'resize',
                                width: document.body.offsetWidth,
                                height: document.body.offsetHeight,
                                clientWidth: document.body.clientWidth,
                                clientHeight: document.body.clientHeight,
                            }, '*');
                        });

                        document.addEventListener('contextmenu', (e) => {
                            e.preventDefault();
                            window.parent.postMessage({
                                type: 'contextMenu',
                                x: e.clientX,
                                y: e.clientY
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

                        // 转发键盘事件到父窗口
                        document.addEventListener('keydown', (e) => {
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
                        });

                        document.addEventListener('keyup', (e) => {
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
                        });

                        document.addEventListener('mousedown', (e) => {
                            window.parent.postMessage({
                                type: 'mousedown',
                                button: e.button,
                                buttons: e.buttons,
                                ctrlKey: e.ctrlKey,
                                shiftKey: e.shiftKey,
                                altKey: e.altKey,
                            }, '*');
                        });

                        // 拦截 a 标签的跳转操作
                        document.addEventListener('click', (e) => {
                            const target = e.target;
                            
                            // 检查点击的是否是 a 标签或其子元素
                            const linkElement = target.closest ? target.closest('a') : null;
                            
                            if (linkElement && linkElement.href) {
                                e.preventDefault(); // 阻止默认跳转行为
                                
                                window.parent.postMessage({
                                    type: 'linkClick',
                                    href: linkElement.href,
                                    text: linkElement.textContent || linkElement.innerText || '',
                                    target: linkElement.target || '_self'
                                }, '*');
                            }
                        });
                    </script>
                    </head>
                    <body>
                        ${bodyContent}
                    </body>
                </html>
    `;
};

/**
 * 是否需要交换宽高
 * @param angle 角度
 * @returns 是否需要交换宽高
 */
export const needSwapWidthAndHeight = (angle: number) => {
	return angle === 1 || angle === 3;
};

export const getStyleProps = (
	width: number,
	height: number,
	processImageConfig: FixedContentProcessImageConfig,
	options?: {
		scale?: {
			x: number;
			y: number;
		};
	},
): React.CSSProperties => {
	if (needSwapWidthAndHeight(processImageConfig.angle)) {
		const temp = width;
		width = height;
		height = temp;
	}

	return {
		width: `${width}px`,
		height: `${height}px`,
		...getTransformProps(width, height, processImageConfig, options),
	};
};

export const getTransformProps = (
	width: number,
	height: number,
	processImageConfig: FixedContentProcessImageConfig,
	options?: {
		scale?: {
			x: number;
			y: number;
		};
	},
): React.CSSProperties => {
	// 角度相关的位移+旋转（保持与现有逻辑一致：先写 translate 再写 rotate，依赖 CSS 右到左的应用顺序）
	let angleTransformValue = "";
	switch (processImageConfig.angle) {
		case 1:
			angleTransformValue = `translateX(${height}px) translateY(${0}px) rotateZ(${90}deg)`;
			break;
		case 2:
			angleTransformValue = `translateX(${width}px) translateY(${height}px) rotateZ(${180}deg)`;
			break;
		case 3:
			angleTransformValue = `translateX(${0}px) translateY(${width}px) rotateZ(${270}deg)`;
			break;
	}

	// 计算翻转的 scale 值
	const flipScaleX = processImageConfig.horizontalFlip ? -1 : 1;
	const flipScaleY = processImageConfig.verticalFlip ? -1 : 1;

	// 合并翻转和缩放（外部缩放 options 与翻转叠加）
	const finalScaleX = (options?.scale?.x || 1) * flipScaleX;
	const finalScaleY = (options?.scale?.y || 1) * flipScaleY;

	// 翻转补偿所用尺寸：此处直接使用传入的 width/height（已在 getStyleProps 中根据角度交换过）
	const currentWidth = width;
	const currentHeight = height;

	// 翻转补偿：在 scale 之前对坐标系做正向平移，避免内容被镜像到负半轴
	// 组合顺序（右到左生效）：angleTransform -> flipTranslate -> scale
	let flipTranslateValue = "";
	if (processImageConfig.horizontalFlip) {
		flipTranslateValue += ` translateX(${currentWidth}px)`;
	}
	if (processImageConfig.verticalFlip) {
		flipTranslateValue += ` translateY(${currentHeight}px)`;
	}

	return {
		transform: `${angleTransformValue}${flipTranslateValue} scale(${finalScaleX}, ${finalScaleY})`,
		transformOrigin: "top left",
	};
};
