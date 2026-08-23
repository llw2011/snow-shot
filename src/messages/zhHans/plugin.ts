export const plugin = {
	"plugin.ffmpeg.name": "视频录制",
	"plugin.ffmpeg.description":
		"基于 FFmpeg 实现音频和视频多种格式的录制、转换等功能",
	"plugin.rapid_ocr.name": "Rapid OCR 本地模型",
	"plugin.rapid_ocr.description":
		"安装 Rapid OCR V4/V5 ONNX 模型。选择 Rapid OCR V4/V5 后，识别在 Snow Shot 本机进程内执行，不启动独立服务，也不占用端口。",
	"plugin.glm_ocr.name": "GLM OCR",
	"plugin.glm_ocr.description":
		"启用基于 OpenAI 兼容接口的 GLM OCR 文本识别。请在功能设置中填写服务地址、端口和模型。",
	"plugin.ai_chat.name": "AI 对话",
	"plugin.ai_chat.description":
		"使用最前沿的 AI 大模型简化工作流程，支持自定义配置兼容 Open AI SDK 的 API。",
	"plugin.translate.name": "翻译",
	"plugin.translate.description": "支持图片翻译、文本翻译等功能",
	"plugin.status.NotInstalled": "未安装",
	"plugin.status.Installed": "已安装",
	"plugin.status.Downloading": "下载中",
	"plugin.status.Unzipping": "解压中",
	"plugin.status.Uninstalling": "卸载中",
	"plugin.install": "安装",
	"plugin.uninstall": "卸载",
	"plugin.forceInstall": "重新安装",
	"plugin.uninstall.confirm.title": "卸载“{name}”？",
	"plugin.uninstall.confirm.description":
		"这会删除已安装的插件文件和本地模型。再次使用前需要重新安装。",
	"plugin.uninstall.confirm.action": "确认卸载",
	"plugin.reinstall.confirm.title": "重新安装“{name}”？",
	"plugin.reinstall.confirm.description":
		"这会先删除当前插件文件和本地模型，再重新安装。如果安装中断，对应功能可能暂时不可用。",
	"plugin.reinstall.confirm.action": "确认重新安装",
};
