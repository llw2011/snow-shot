# Snow Shot 架构说明

本文档面向维护者和贡献者，概述当前源码结构与主要运行链路。

## 总览

Snow Shot 是 Tauri 桌面应用。前端负责界面、路由、设置、工具交互和状态编排；Rust 侧负责系统能力，包括截图、窗口管理、OCR、录屏、文件、剪贴板、全局键鼠监听、插件安装和共享缓冲区。

```text
React/Rsbuild 前端
  |
  | Tauri invoke / event
  v
src-tauri 主 crate
  |
  +-- src-crates/app-services
  +-- src-crates/app-os
  +-- src-crates/app-utils
  +-- src-crates/tauri-commands/*
  +-- src-crates/plugin-service
  +-- src-crates/webview
```

## 前端入口

- `src/index.tsx`：React 根入口。
- `src/App.tsx`：创建 TanStack Router，并挂载 `GlobalContext`。
- `src/routeTree.gen.ts`：TanStack Router 生成文件，不手动编辑。
- `src/routes`：文件路由定义。

两类路由：

- `_layout`：主窗口页面，包含菜单布局、主题皮肤、设置上下文、插件初始化。
- `_noLayout`：截图、贴图、全屏画板、录屏等工作窗口，不显示主菜单。

核心容器：

- `src/components/routerContainer/index.tsx`
- `src/components/appSettingsContextProvider/index.tsx`
- `src/components/pluginServiceContextProvider/index.tsx`
- `src/components/eventListener/index.tsx`
- `src/components/globalShortcut/index.tsx`

## 主要页面

| 路由 | 页面 | 说明 |
|---|---|---|
| `/` | `src/pages/home` | 主功能入口和快捷键状态 |
| `/settings/generalSettings` | `src/pages/settings/generalSettings` | 常规设置 |
| `/settings/functionSettings` | `src/pages/settings/functionSettings` | 截图、OCR、翻译、聊天、录屏设置 |
| `/settings/hotKeySettings` | `src/pages/settings/hotKeySettings` | 快捷键设置 |
| `/settings/systemSettings` | `src/pages/settings/systemSettings` | 系统设置、配置目录、清理数据 |
| `/tools/translation` | `src/pages/tools/translation` | 翻译工具 |
| `/tools/chat` | `src/pages/tools/chat` | AI 对话工具 |
| `/tools/captureHistory` | `src/pages/tools/captureHistory` | 截图历史 |
| `/personalization/plugins` | `src/pages/personalization/plugins` | 插件状态和安装入口 |
| `/draw` | `src/pages/draw` | 截图选区与标注窗口 |
| `/fixedContent` | `src/pages/fixedContent` | 贴图窗口 |
| `/fullScreenDraw` | `src/pages/fullScreenDraw` | 全屏画板 |
| `/videoRecord` | `src/pages/videoRecord` | 录屏区域窗口 |
| `/videoRecordToolbar` | `src/pages/videoRecord/toolbar` | 录屏控制条 |

## 前后端通信

前端命令封装在 `src/commands`：

- `core.ts`：窗口、剪贴板、选中文字、自启动、代理、置顶、通用能力
- `screenshot.ts` / `index.ts`：截图、屏幕捕获、窗口元素
- `ocr.ts`：OCR 初始化、识别、释放
- `scrollScreenshot.ts`：滚动截图
- `videoRecord.ts`：录屏
- `plugin.ts`：插件初始化、安装、卸载、状态
- `file.ts`：配置文件和图片文件读写
- `listenKey.ts`：全局键鼠监听
- `webview.ts`：Windows WebView2 共享缓冲区
- `nativeAction.ts`：原生快捷键/托盘动作映射、主 WebView 运行时状态和动作 ACK

Rust 命令注册在 `src-tauri/src/lib.rs` 的 `tauri::generate_handler!` 中，对应模块位于 `src-tauri/src/*.rs`。

事件通信主要通过 `@tauri-apps/api/event`：

- 主功能触发：`execute-screenshot`、`execute-translate`、`execute-chat`
- 生命周期：`release-draw-page`、`release-ocr-session`
- 录屏：`change-video-record-state`、`start-or-copy-video`
- 插件：`plugin-status-change`
- 键鼠监听：`listen-key-service:*`、`listen-mouse-service:*`

### 原生动作可靠性链路

Windows 长时间后台运行、锁屏、睡眠或 RDP 断开重连后，隐藏 WebView2 可能暂停或失去事件响应。快捷键、托盘和会话恢复入口因此由 Rust 原生层持有，业务实现仍复用前端现有函数：

```text
WTS reconnect/unlock / power resume / display change
  -> runtime session generation 失效
  -> Rust 销毁旧 draw，并 reload/rebuild main

global shortcut（Rust 直接注册）/ tray menu / tray click / single-instance
  -> main 一次性 probe；draw-backed 动作再做 draw 一次性 probe
  -> probe 失败时先恢复并复验
  -> execute-native-action（业务事件只定向发送一次）
  -> src/components/globalEventHandler.tsx
  -> 既有截图、翻译、聊天、贴图或录屏函数
```

- 全局快捷键由 Rust 通过 `GlobalShortcutExt` 直接注册，不创建依附主 WebView 的 JavaScript Channel；前端只提交快捷键与动作的期望映射。
- 快捷键整批重建按稳定顺序执行；文本重复项不注册，底层解析成相同 shortcut id 的别名由 Rust 保留首个映射，不会在失败清理时误删已生效映射。
- 每次主 WebView 和 draw WebView 文档加载都会建立唯一 runtime document id；Windows 会话恢复事件还会推进 session generation，使旧文档的 ready、probe 和 ACK 全部失效。同一恢复过程中的 reconnect/unlock/display 事件会合并为 dirty 信号，恢复边界只做一次事件驱动复验，避免事件风暴反复 reload/rebuild。
- main 的 `start`、事件监听器 ready、设置加载完成是不同状态；只有监听器与设置均完成才报告 main action-ready。不使用周期心跳判断健康。
- 截图、OCR、录屏选区和置顶窗口等 draw-backed 动作还要求 main 绑定当前唯一 draw label、document id 与 generation。draw 只有在底层事件监听、设置和 canvas 均 ready 后才确认；创建等待超过 12 秒会销毁该窗口。
- Rust 在业务投递前直接向当前 main/draw 窗口发送一次性健康 probe；probe 使用 oneshot 和 1 秒上限，并校验 window label、document id、draw generation 与 session generation。业务 ACK 超时后还会做一次 host-loop probe，以免“ready 但不再调度”的进程继续假活。
- runtime ready 等待由 ready/bind 事件唤醒，不使用定时轮询。reload 或 rebuild 超时后返回有界错误。
- probe 失败时 Rust 先销毁全部旧 draw，再 reload 主 WebView；若所需 runtime 未 ready 或复验失败，则按 `tauri.conf.json` 重建 `main` 窗口。
- 恢复并复验成功后，业务事件全程最多发送一次；draw-backed 截图事件只定向到刚刚探活并绑定的 draw label，不广播给换页重叠窗口。Rust 随后等待绑定当前 main document id 的一次性 claim ACK；过期、重复或旧文档 ACK 会被拒绝，ACK 超时不会重发可能已有副作用的业务动作。
- 动作分发与恢复使用串行锁；reload/destroy 前由 Rust 停止 `main` 对应的键盘和鼠标监听服务，窗口 `Destroyed` 时再次按 label 清理。
- 销毁最后一个主窗口进行硬重建时，仅在该重建窗口期阻止无显式退出码的进程退出；正常退出和 `app.exit(0)` 不受影响。
- Rust 在 setup 阶段创建并持续持有固定 ID `main-trayIcon` 的 fallback 托盘。前端只通过 `getById` 更新图标和菜单，绝不 `remove/new/close` manager-owned 托盘；恢复失败时仍保留原生入口。运行期 build/remove 由 async mutex 串行后切到 UI 线程执行，等待上限 2 秒。
- Windows 的 raw tray click callback 在 Tauri builder 绑定 Tao proxy 之前由 Rust 接管，直接进入 native action dispatcher；这样左击/双击不会因 Tao user-event queue 饥饿而丢失。菜单事件仍保留 Tauri/Muda 管线，以保证前端 `MenuItem.action` channel（例如快捷键开关和 fixed-content 菜单）不回归。
- 如果连续两次主线程 tray roundtrip 超时，或不健康的 `main` 窗口无法销毁，Rust 将该状态视为 host event-loop 硬故障，停止继续 reload/rebuild 和动作排队。Windows 会启动带旧 PID 的 recovery child；child 先用 `OpenProcess + WaitForSingleObject` 等旧进程退出，再初始化 Tauri/single-instance。恢复 child 启动后的 5 分钟内不会再次拉起 child；稳定运行超过该窗口后，后续独立故障仍可再次自救，避免立即重启风暴。
- 用户显式禁用托盘通过 `native_tray_set_enabled` 单独记录；只有该路径可以移除 fallback 托盘。托盘启用状态与“正在录入快捷键”的临时快捷键抑制状态互不覆盖。
- 所有 WebView 可持有 pending WebLock 作为浏览器保活提示，但健康结论只来自事件、runtime identity 和一次性 probe。
- “翻译所选文字/询问所选文字”不会在读取选区前预先聚焦主窗口。

该链路只恢复可靠入口，不在 Rust 中复制截图、OCR、翻译等业务逻辑。一次性 ACK 表示 `main` 已接管请求，不表示后续截图窗口、OCR、模型调用或文件写入已经完成；这些下游步骤继续使用各自现有的状态和错误处理。

### OTA 更新链路

公开更新由 Tauri updater 插件负责，前端封装在 `src/services/updater.ts`：

```text
About/opt-in startup check
  -> fixed GitHub latest.json endpoint
  -> minisign signature verification in Tauri
  -> user confirmation
  -> native main-window wake/recovery
  -> re-check manifest
  -> downloadAndInstall
  -> relaunch
```

检查 Promise 会合并并发调用，安装 Promise 会串行化；客户端不会保存 GitHub token，也不使用周期轮询。标准 Windows/macOS 发布 job 通过 `src-tauri/tauri.release.conf.json` 生成签名产物，fixed-runtime/offline job 通过 `tauri.no-ota.conf.json` 禁用 endpoint，避免同一平台键误装其他渠道。

### 后台资源与有界等待

- 新安装默认 `hotLoadPageCount = 0`。已有用户即使保留预热数量，idle fixed-content 页面也只挂载轻量路由壳；路由 listener、底层 Tauri listener 和设置均 ready 后才把窗口登记为可复用，收到实际贴图路由后才动态加载 `FixedContentCore`、DrawLayer 和 Excalidraw。
- draw 换页期间只缓存并转交一次完整截图 payload；新 draw 在 canvas、设置、业务 listener、底层 Tauri listener 和 native ready 握手全部完成后发事件接管，不再每 128 ms 重发。
- WebView2 outbound shared-buffer 回调拥有输入 `Vec`；JavaScript→Rust channel 的 COM 对象只在 originating WebView/UI apartment 创建、读取、关闭和析构，异步 worker 只接收 owned `Vec<u8>`。Rust callback 上限为 2.5 秒（早于前端 3 秒 listener），未消费 channel 由一次性 30 秒清理兜底。
- Windows HDR capture 启动和首帧等待分别有 5 秒上限。首帧 handler 主动结束 capture；可能无界的底层 stop/join 只在后台清理线程运行，不阻塞调用线程或 Tokio worker。启动/首帧失败后本进程禁用 HDR 路径并回退普通 SDR 捕获，避免重复泄漏 helper。
- Release 默认只落盘 `snow-shot-recovery` 安全目标，内容限于事件类型、runtime 标识状态、动作枚举和错误，不含截图、OCR、剪贴板、选中文字或密钥。默认每进程最多接受 1024 条恢复记录；启动时对超过 128 KiB 的旧文件轮转，最多保留 3 个文件。用户开启日志后才记录详细目标。

## Rust workspace

`src-tauri/Cargo.toml` 定义 workspace：

| crate | 责任 |
|---|---|
| `app-shared` | 共享基础结构和 Enigo 管理 |
| `app-utils` | 图片编码、显示器信息、截图数据处理、剪贴板核心逻辑 |
| `app-services` | OCR、录屏、文件缓存、热加载窗口、键鼠监听、拖拽/缩放服务 |
| `app-os` | Windows/macOS/Linux 平台能力，Windows UI Automation |
| `app-scroll-screenshot-service` | 滚动截图图像拼接与特征匹配 |
| `global_state` | 捕获状态、剪贴板读取状态、共享缓冲区状态 |
| `tauri-commands/*` | Tauri command 的业务实现 |
| `plugin-service` | 插件安装、卸载、sha256 校验、安全解压 |
| `webview` | WebView2 共享缓冲区优化 |

## 设置与数据目录

设置按 `AppSettingsGroup` 拆分成多个 JSON 文件，路径由 Rust `FileCacheService` 决定：

1. 自定义配置目录。
2. Windows 便携版目录：exe 同级存在 `__portable` 时使用。
3. 系统 app config 目录。

配置文件目录名为 `configs`。

额外数据：

- `stores/*.json`：Tauri store 数据，如聊天工作流、Excalidraw 状态、截图历史索引。
- `captureHistoryImages/`：截图历史图片文件。
- `plugins/<version>/<plugin>`：已安装插件。
- `pluginsDownloads/<version>`：本地插件 zip 缓存。

## 插件模型

插件 ID 定义在 `src/constants/pluginService.ts`：

- `glm_ocr`
- `rapid_ocr`
- `ffmpeg`
- `translate`
- `ai_chat`

插件包从用户明确选择的本地来源安装；Rapid OCR 的公开模型文件使用固定 URL 和 SHA-256 校验。公共构建不应包含维护者电脑上的插件地址、目录或内网服务信息。安装 zip 插件时要求同目录存在 `.zip.sha256`，Rust 侧会校验 hash 并做 Zip Slip 防护。需要额外文件源时，必须通过显式自定义 flavor 注入，不能把地址写入默认配置。

## OCR 与 AI

OpenAI-compatible AI/OCR 服务由用户在设置中配置。公共默认配置不包含维护者个人 endpoint、凭据或内网地址；发送内容前，用户应确认所选服务的隐私策略与网络边界。

默认 Tauri capability 只允许任意端口的 HTTPS 和 loopback HTTP。`src-tauri/tauri.custom-network.conf.json` 是显式 opt-in 的自定义 flavor，允许用户自管的任意端口 HTTP 服务；它不会提供任何具体主机、端口或凭据。

RapidOCR 依赖本地 ONNX 模型插件和 `src-tauri/lib/onnxruntime.lib`。OpenAI-compatible 调用统一使用 `appFetch`，并受应用的网络访问策略限制。

## 构建产物

前端构建输出：

```text
dist/
```

Tauri release 输出通常在：

```text
src-tauri/target/release/
src-tauri/target/release/bundle/
```

具体安装包名称由应用版本、目标平台和 Tauri bundle 配置决定。
