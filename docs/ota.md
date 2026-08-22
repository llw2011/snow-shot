# OTA 与编译/发布规范

Snow Shot 的公开 OTA 只使用 GitHub Releases。客户端 endpoint 固定为：

```text
https://github.com/llw2011/snow-shot/releases/latest/download/latest.json
```

`latest.json` 由发布 job 在所有平台构建完成后一次性生成。构建 job 不直接创建或修改 GitHub Release，因此不会再出现多个矩阵 job 争抢 `latest.json`、先公开半成品或发布 job 等待数小时的情况。

同一个 Release 还会提供公开的完整资产校验索引：

```text
https://github.com/llw2011/snow-shot/releases/latest/download/checksums.json
```

`checksums.json` 按资产文件名记录 SHA-256，覆盖 DMG、标准/ fixed-runtime/ offline
安装包及其 OTA 签名文件；`latest.json` 和 `checksums.json` 这两个元数据文件不纳入自身索引。

## OTA manifest

公开 manifest 必须包含这三个平台键，并且每个键都有非空 minisign 签名和 tag 下载 URL：

```json
{
  "version": "0.8.0",
  "pub_date": "2026-01-01T00:00:00.000Z",
  "notes": "",
  "platforms": {
    "darwin-aarch64": { "signature": "...", "url": "..." },
    "darwin-x86_64": { "signature": "...", "url": "..." },
    "windows-x86_64": { "signature": "...", "url": "..." }
  }
}
```

规范资产名为：

```text
Snow.Shot_<version>_darwin-aarch64.app.tar.gz[.sig]
Snow.Shot_<version>_darwin-x64.app.tar.gz[.sig]
Snow.Shot_<version>_windows-x64_setup.exe[.sig]
```

DMG、fixed-runtime 和 offline 安装包也会随 Release 提供，但不会写入公共 OTA manifest。fixed-runtime/offline 与标准 Windows 使用相同 updater 平台键，混入 manifest 会让客户端下载错误渠道；这两个渠道必须手动安装。

每次新发布还会附带 `checksums.json`，记录所有非 metadata 发布资产的 SHA-256。publish job 会在本地 staging、draft Release 和公开 `latest` endpoint 三处校验它；历史 Release 没有该文件时，兼容性验证仍只检查 manifest 和资产名。

## GitHub Actions 发布流程

`.github/workflows/release.yml` 分为三个阶段：

1. `prepare`（只读）：校验 tag 格式、annotated tag 的 peeled commit、tag 与当前 `main` 提交一致、三个源码版本、updater 公钥/endpoint 和 signing secrets。
2. `build-app`（五个矩阵 job）：macOS ARM、macOS Intel、Windows 标准、Windows fixed-runtime、Windows offline 并行构建。每个 job 只有 `contents: read`，使用固定 runner/工具链，调用 `stage-release-assets.mjs` 后上传 Actions artifact；不携带 GitHub Release 参数，也不写 Release。
3. `publish-release`（唯一写 job）：下载全部 artifact，生成并本地验证 `latest.json` 与 `checksums.json`，幂等地复用或创建 draft Release，集中上传资产，重新从 GitHub 读取资产、manifest 和完整校验索引验证，最后才把 draft 公开。验证失败时 Release 保持 draft。

job 有固定超时；超时只结束当前 workflow job，不取消远端 run。同一 tag 的 publish job 使用独立 concurrency。重复触发时，workflow 会复用已经存在的 active run，不会重复 dispatch；失败、超时或疑似 zombie run 不会自动取消、重跑或删除，保留 URL 供人工处理。

dispatch 后只做一个很短的有界 run-discovery 窗口；长期观察交给 GitHub Actions 或 GitHub CLI 的 `run watch`，不会在本机无限轮询。

beta tag 当前按 `prerelease: false` 公开，因此也会成为 `latest` OTA。若以后需要隐藏测试版，应建立独立 channel/manifest，而不是仅修改 tag 名称。

## 本地资产验证

需要单独验证本地 staging 目录时，可使用仓库内的 Node.js 校验工具，并显式提供校验索引：

```powershell
node scripts/release-manifest.mjs verify `
  --tag v0.8.0 `
  --manifest .\latest.json `
  --assets-dir .\staged `
  --checksums .\staged\checksums.json
```

## 依赖与固定校验

- CI 固定 Node.js 22、pnpm 10.8.1、Rust 1.90.0；本地 Rust 必须满足 `rust-version >= 1.90`。
- `../excalidraw` 必须是 `d57ac317fc926bba6f7332e9ac24de7a84359d5f`。
- Windows CI 下载 `onnxruntime-win-x64-static_lib-1.22.2.zip` 后校验固定 SHA-256。
- offline 资源和 WebView2 fixed runtime 在解压前校验 SHA-256。
- Rust 构建使用 `--locked`，任何 lockfile 被重写都会使 job 失败。

## 安全边界

签名私钥、私钥密码和 GitHub token 不能进入仓库、安装包或日志。发布 job 使用最小权限：构建只读，集中 publish 才有 `contents: write`。不要把 token 放入 `package.json`、workflow 参数或 Release 说明；失效或泄露的 token 应立即在 GitHub 撤销并重新生成。
