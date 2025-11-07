# Snow Shot

<p align="center">
  <img src="docs/imgs/app-icon.png" width="84" alt="Snow Shot icon">
</p>

<p align="center">
  <strong>面向 Windows 与 macOS 的轻量截图工作台</strong><br>
  <sub>A focused, extensible screenshot workspace for Windows and macOS.</sub>
</p>

<p align="center">
  <a href="https://github.com/llw2011/snow-shot/releases/latest"><img src="https://img.shields.io/github/v/release/llw2011/snow-shot?include_prereleases&label=release" alt="Latest release"></a>
  <a href="https://github.com/llw2011/snow-shot/releases"><img src="https://img.shields.io/github/downloads/llw2011/snow-shot/total?label=downloads" alt="Downloads"></a>
  <a href="https://github.com/llw2011/snow-shot/issues"><img src="https://img.shields.io/github/issues/llw2011/snow-shot?label=issues" alt="Issues"></a>
  <a href="https://github.com/llw2011/snow-shot/blob/main/LICENSE-Commercial"><img src="https://img.shields.io/badge/license-see%20repository%20files-4c6ef5" alt="License files"></a>
</p>

> 本仓库是公开的 Snow Shot 社区 fork，发布、问题反馈和 OTA 更新均以本仓库为准。上游 Snow Apps monorepo 位于 [mg-chao/snow-apps](https://github.com/mg-chao/snow-apps)。

## 能做什么

- **快速截图**：支持全屏、窗口、焦点窗口、滚动截图和多显示器场景。
- **编辑与贴图**：矩形、箭头、文字、马赛克等标注工具，并可将结果固定到屏幕或保存到历史记录。
- **本地优先的扩展能力**：按需启用 OCR、翻译、AI 对话和录屏插件；只有触发或启用相关流程时，才会请求对应服务。
- **可靠的桌面入口**：全局快捷键、系统托盘和 Windows 会话恢复链路由原生层维护。
- **可调整的界面**：主题、浅色/深色模式、背景和紧凑布局可以独立调整。

## 下载与安装

请前往 [GitHub Releases](https://github.com/llw2011/snow-shot/releases/latest) 选择对应平台的安装包。

| 渠道 | 平台 | 获取/更新 |
| --- | --- | --- |
| 标准版 | Windows x64 | 支持签名 OTA |
| 标准版 | macOS Apple Silicon / Intel | 支持签名 OTA |
| fixed-runtime / offline | Windows x64 | `v0.7.10-beta` 未附公开包；仅手动构建，不参与 OTA |

> 当前 `v0.7.10-beta` 是 OTA 信任根迁移后的 Bootstrap 版本。已安装旧版的用户需要先手动安装一次，之后才能接收在线更新。详细规则见 [`docs/ota.md`](docs/ota.md)。

Release 页面上的实际资产列表是唯一的下载清单；不同渠道的安装包不能互相替换。

OTA minisign 签名只保证更新包完整性，不等同于 Windows Authenticode 或 macOS 公证；首次安装时可能看到 SmartScreen 或 Gatekeeper 提示。

## 隐私与网络边界

- 标准版客户端不携带 GitHub token；在线更新只读取固定的公开 `latest.json` 并由 Tauri 使用 minisign 验签。
- 公共构建不预置 OCR、翻译或 AI 的服务地址、模型和密钥；这些值只能来自用户设置或显式启用的自定义 flavor，并受客户端网络权限限制。只有触发或启用相关流程时才会发起请求，请在使用第三方服务时自行确认其隐私政策。
- 截图、剪贴板和历史记录属于本机数据。提交 Issue 时请先移除截图、日志、配置和 API key 等敏感内容。
- 本项目不要求登录个人账号才能完成截图、标注或本地保存。

## 快速开始

1. 从 Releases 下载并安装对应平台的标准版。
2. 启动后在设置中确认保存目录、快捷键和托盘行为。
3. 按快捷键开始截图；需要 OCR、翻译、AI 或录屏时，再从插件/功能设置中启用对应能力。

## 从源码构建

### 环境要求

- Node.js 20+、pnpm 10+、Yarn 1.x（用于构建同级 Excalidraw）
- Rust 1.90+（项目声明的最低版本见 [`src-tauri/Cargo.toml`](src-tauri/Cargo.toml)）
- Windows 构建需要 MSVC Build Tools、Windows SDK、NSIS 和 WebView2；macOS 构建需要 Xcode Command Line Tools。
- 绘图编辑器依赖 [mg-chao/excalidraw](https://github.com/mg-chao/excalidraw) 的 `custom/master` 分支，需放在项目旁的 `excalidraw` 目录。

### 安装依赖与常用命令

```bash
# 在同一个父目录中准备两个 sibling 仓库
git clone https://github.com/llw2011/snow-shot.git snow-shot
git clone --branch custom/master https://github.com/mg-chao/excalidraw.git excalidraw
cd snow-shot

cd ../excalidraw
yarn install --frozen-lockfile
cd ../snow-shot
pnpm install --frozen-lockfile
pnpm update:excalidraw
pnpm dev                 # 启动前端开发服务器
pnpm build               # 构建前端资源
pnpm exec tsc --noEmit   # TypeScript 检查
```

Rust 检查和桌面开发：

```bash
cargo check --locked --manifest-path src-tauri/Cargo.toml
pnpm tauri dev
```

PowerShell 如果阻止脚本文件，可使用等价的 `pnpm.cmd` 和 `yarn.cmd`。完整的发布矩阵由 [`.github/workflows/release.yml`](.github/workflows/release.yml) 负责；本地构建不需要 OTA 签名私钥。

### 网络 flavor

默认 Tauri 构建是公共 flavor：只允许任意端口的 HTTPS 和 loopback HTTP，不携带任何维护者服务配置。需要连接用户自管的非 HTTPS 服务时，必须显式使用 [`src-tauri/tauri.custom-network.conf.json`](src-tauri/tauri.custom-network.conf.json)：

```bash
pnpm tauri build --config src-tauri/tauri.custom-network.conf.json
```

自定义 flavor 的 `PUBLIC_DEFAULT_*`、`PUBLIC_SERVICE_BASE_URL`、`PUBLIC_PROXY_BYPASS_HOSTS` 和 `PUBLIC_PLUGIN_FILE_SOURCES` 仅用于构建时注入公开配置；它们会被打包进客户端，绝不能包含需要保密的 token、密码或私钥。未设置 `PUBLIC_BUILD_FLAVOR=custom` 时，公共构建会忽略这些默认值。

## 文档

- [设计方向与主题系统](docs/design.md)
- [架构概览](docs/architecture.md)
- [OTA 发布与信任根说明](docs/ota.md)

机器相关的构建记录、服务地址和临时分支状态不属于公开仓库；请不要把这类信息复制到 Issue、日志或公开文档中。

## 贡献与反馈

- [提交 Issue](https://github.com/llw2011/snow-shot/issues)
- [提交 Pull Request](https://github.com/llw2011/snow-shot/pulls)

提交前请确认：问题可以在干净环境复现，日志已经脱敏，且没有附带配置文件、截图或凭据。功能改动建议同时补充相关文档和最小验证步骤。

## 许可证与第三方组件

原项目作者为 **mg-chao**；本 fork 保留原始署名和完整 Git 提交历史。

本次公开整理只清理当前分支的文件树，不重写 Git 历史。早期提交中可能仍留有已删除的开发记录或本机构建痕迹；若要从所有历史对象彻底移除这些内容，需要另行授权历史重写与强制更新，当前版本不会执行该操作。

仓库包含两份许可证文本；文件名不替代法律条款，请以文件正文和适用的第三方许可证为准：

- [`LICENSE-Commercial`](LICENSE-Commercial)（当前文件正文为 GNU GPLv3）
- [`LICENSE-NonCommercial`](LICENSE-NonCommercial)（当前文件正文为 Apache License 2.0）

第三方依赖和嵌入组件仍受各自许可证约束；发布前请一并检查对应的 notices 和许可证文件。

## English summary

Snow Shot is a desktop screenshot workspace for Windows and macOS. It combines fast capture, annotation, screen pinning, history, configurable shortcuts, and optional OCR/translation/AI/recording extensions.

Download standard builds with OTA signatures from [GitHub Releases](https://github.com/llw2011/snow-shot/releases/latest). The standard-build updater reads only the repository's fixed manifest; it never receives a GitHub token. Fixed-runtime and offline builds are manual-install channels. OTA signatures do not imply Windows code signing or macOS notarization. Public builds do not bundle AI/OCR endpoints or credentials. See [`docs/ota.md`](docs/ota.md) for the Bootstrap migration and release-channel rules.

For development, install Node.js, pnpm, Rust, and Yarn 1.x, clone the sibling [`mg-chao/excalidraw`](https://github.com/mg-chao/excalidraw) dependency, run `yarn install --frozen-lockfile` there, then run `pnpm install --frozen-lockfile`, `pnpm update:excalidraw`, and `pnpm build` in Snow Shot. Use GitHub Issues and Pull Requests for public support and collaboration.

This cleanup changes only the current tree and intentionally preserves the complete Git history. Earlier commits may still contain removed development notes or local-build traces; removing them from every historical object would require separately authorized history rewriting and a force update.
