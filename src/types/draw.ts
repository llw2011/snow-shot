export enum DrawState {
	Idle = 0,
	// 选择元素
	Select = 1,
	// 矩形
	Rect = 2,
	// 菱形
	Diamond = 3,
	// 椭圆
	Ellipse = 4,
	// 箭头
	Arrow = 5,
	// 线条
	Line = 6,
	// 画笔
	Pen = 7,
	// 文本
	Text = 8,
	// 序列号
	SerialNumber = 9,
	// 模糊
	Blur = 10,
	// 橡皮擦
	Eraser = 11,
	// 锁定
	Lock = 12,
	// 绘制额外工具
	DrawExtraTools = 13,
	// 水印
	Watermark = 14,
	// 高亮
	Highlight = 15,
	// 自由绘制模糊
	BlurFreeDraw = 16,
	// 撤销
	Undo = 101,
	// 重做
	Redo = 102,
	// 取消
	Cancel = 103,
	// 保存
	Save = 104,
	// 快速保存
	FastSave = 105,
	// 固定
	Fixed = 106,
	// 复制
	Copy = 107,
	// Confirm
	Confirm = 107001,
	// OCR
	OcrDetect = 108,
	// OCR 翻译
	OcrTranslate = 108001,
	// 滚动截图
	ScrollScreenshot = 109,
	// 额外工具
	ExtraTools = 110,
	// 扫描二维码
	ScanQrcode = 111,
	// 激光笔
	LaserPointer = 112,
	// 鼠标穿透
	MouseThrough = 113,
	// 视频录制
	VideoRecord = 114,
	// 拖拽窗口
	DragWindow = 115,
	// 保存到云端
	SaveToCloud = 116,
	// 重置画布
	ResetCanvas = 117,
}
