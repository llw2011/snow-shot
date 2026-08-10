# Snow Shot

<p align="center">
  <img src="docs/imgs/app-icon.png" width="84" alt="Snow Shot icon">
</p>

<p align="center">
  <strong>面向 Windows 与 macOS 的轻量截图工作台</strong><br>
  <sub>A focused, extensible screenshot workspace for Windows and macOS.</sub>
</p>

<p align="center">
  <a href="https://github.com/llw2011/snow-shot/releases"><img src="https://img.shields.io/github/v/release/llw2011/snow-shot?include_prereleases&label=release" alt="Latest release"></a>
  <a href="https://github.com/llw2011/snow-shot/issues"><img src="https://img.shields.io/github/issues/llw2011/snow-shot?label=issues" alt="Issues"></a>
  <a href="https://github.com/llw2011/snow-shot/blob/main/LICENSE-Commercial"><img src="https://img.shields.io/badge/license-see%20repository%20files-4c6ef5" alt="License files"></a>
</p>

Snow Shot is a local-first desktop tool for capturing, annotating, pinning, and organizing screenshots. Optional OCR, translation, AI, and recording features are installed and configured only when you need them.

## Features

- Full-screen, window, focused-window, multi-monitor, and scrolling capture.
- Annotation tools including shapes, arrows, text, mosaic, and image pinning.
- Clipboard, local history, configurable save formats, and custom shortcuts.
- System tray and native Windows session recovery for long-running use.
- Switchable light/dark modes, visual skins, backgrounds, and compact layouts.
- Optional Rapid OCR, API-based OCR, translation, chat, and recording plugins.

## Download

Download the installer for your platform from [GitHub Releases](https://github.com/llw2011/snow-shot/releases). The release page is the authoritative list of available packages and signatures.

Published OTA updates use the public GitHub release manifest and Tauri's minisign verification. OTA signatures do not replace Windows code signing or macOS notarization; first-time installations may show the platform's normal security prompt.

## Privacy and network boundaries

- The public build contains no maintainer API endpoint, model, token, or password.
- Screenshot, clipboard, history, and configuration data stay on the local device unless you explicitly choose an external service.
- OCR, translation, and AI requests use the service configured by the user and are subject to the application's network capabilities.
- The updater reads a fixed public manifest and never needs a GitHub token in the client.
- Before opening an Issue, remove screenshots, logs, configuration files, and API keys from any attachment.

## Build from source

### Requirements

- Node.js 20+, pnpm 10+, and Yarn 1.x.
- Rust 1.90+ (see [`src-tauri/Cargo.toml`](src-tauri/Cargo.toml)).
- Windows: MSVC Build Tools, Windows SDK, NSIS, and WebView2.
- macOS: Xcode Command Line Tools.
- The drawing editor uses the public [`mg-chao/excalidraw`](https://github.com/mg-chao/excalidraw) sibling repository on its `custom/master` branch.

Prepare the sibling repositories in one parent directory:

```bash
git clone https://github.com/llw2011/snow-shot.git snow-shot
git clone --branch custom/master https://github.com/mg-chao/excalidraw.git excalidraw

cd excalidraw
yarn install --frozen-lockfile

cd ../snow-shot
pnpm install --frozen-lockfile
pnpm update:excalidraw
pnpm dev                 # frontend development server
pnpm build               # frontend production assets
pnpm exec tsc --noEmit   # TypeScript check
cargo check --locked --manifest-path src-tauri/Cargo.toml
pnpm tauri dev
```

On PowerShell, use `pnpm.cmd` and `yarn.cmd` if script execution is restricted.

### Build flavors

The default Tauri build is the public flavor. It permits HTTPS and loopback HTTP, and it starts with empty AI/OCR/translation service lists. Rapid OCR uses its pinned public ModelScope files and SHA-256 checks.

To build an application for user-managed HTTP services, opt in explicitly:

```bash
pnpm tauri build --config src-tauri/tauri.custom-network.conf.json
```

Only a build with `PUBLIC_BUILD_FLAVOR=custom` reads `PUBLIC_DEFAULT_CHAT_API_CONFIG`, `PUBLIC_DEFAULT_TRANSLATION_API_CONFIG`, `PUBLIC_DEFAULT_OCR_API_CONFIG`, `PUBLIC_SERVICE_BASE_URL`, `PUBLIC_PROXY_BYPASS_HOSTS`, and `PUBLIC_PLUGIN_FILE_SOURCES`. These values are bundled into the application, so never put secrets in them.

## Documentation

- [Design direction and theme system](docs/design.md)
- [Architecture overview](docs/architecture.md)
- [OTA release and trust rules](docs/ota.md)

## Contributing

Use [GitHub Issues](https://github.com/llw2011/snow-shot/issues) for bug reports and proposals, and submit changes through a Pull Request. Please include a clean reproduction, sanitized logs, and focused verification steps.

## License and attribution

The original project author is **mg-chao**.

The repository contains two license texts; consult the file contents and the licenses of third-party components before distribution:

- [`LICENSE-Commercial`](LICENSE-Commercial)
- [`LICENSE-NonCommercial`](LICENSE-NonCommercial)

## English summary

Snow Shot is a local-first screenshot workspace for Windows and macOS. It combines capture, annotation, screen pinning, history, shortcuts, themes, and optional OCR/translation/AI/recording plugins.

Download packages from [GitHub Releases](https://github.com/llw2011/snow-shot/releases). Public builds do not bundle maintainer endpoints or credentials. User-managed HTTP services require the explicit custom-network configuration described above. Use GitHub Issues and Pull Requests for public support and collaboration.
