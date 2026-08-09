# Snow Shot OTA 发布说明

Snow Shot 的公开 OTA 只使用 GitHub 仓库 `llw2011/snow-shot`。客户端不携带 GitHub token，只读取 Tauri updater 的公开 manifest：

```text
https://github.com/llw2011/snow-shot/releases/latest/download/latest.json
```

## 客户端信任边界

更新包由 Tauri updater 使用 minisign 验签。当前内置公钥是：

```text
dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDFBNzgzMTAxRkZBN0Y3OEIKUldTTDk2Zi9BVEY0R2pseml5R0RmbkNuQ1ZBc1ZqdGZjMVh0bEl5YmtWdjBjRUYzK1ZDenR3YkoK
```

公钥是客户端的一部分，可以公开；签名私钥、私钥密码和 GitHub 凭据绝不能进入仓库、安装包或日志。

客户端行为有三个边界：

- 自动检查只在用户打开“自动检查更新”后启动一次，不使用定时轮询；About 页面提供手动检查。
- 便携版不执行在线更新。
- 便携渠道识别有 3 秒上限；如果主 WebView/IPC 没有响应，客户端会跳过更新而不会 fail-open 安装标准包。
- 更新前会重新获取 manifest，下载完成后由 Tauri 验签并重启应用。
- updater capability 只授予 `main` WebView；其他绘图/辅助 WebView 不能直接调用检查、下载或安装命令。

## 发布渠道

| 渠道 | endpoint | 生成签名 OTA | 说明 |
|---|---|---|---|
| Windows 标准版 | GitHub `latest.json` | 是 | 由 `tauri.release.conf.json` 开启 `createUpdaterArtifacts` |
| macOS DMG/app | GitHub `latest.json` | 是 | 还需要按 macOS 发布要求完成代码签名/公证 |
| Windows fixed-runtime | 空 | 否 | 与标准 Windows 共用 `windows-x86_64` 标识，不能共用 manifest |
| Windows offline | 空 | 否 | 离线资源和标准包不同，只能手动安装 |
| portable | 不适用 | 否 | 应用运行时跳过 updater |

fixed-runtime/offline 不能把自己的包追加到公共 `latest.json`：它们与标准 Windows 使用相同平台键，混用会让客户端下载安装错误渠道。若未来需要这两个渠道 OTA，必须分别建立独立 manifest、平台标识和签名公钥。

## GitHub Actions 发布

`.github/workflows/release.yml` 使用 `tauri-apps/tauri-action@v0`。矩阵串行执行，避免多个 job 同时读写 `latest.json`；只有标准 Windows 和 macOS job 设置 `includeUpdaterJson: true`。Release 必须由该 workflow 生成，并且必须包含 `latest.json`，否则 `/releases/latest/download/latest.json` 对客户端不可用。

工作流会拒绝不在默认分支历史中的 tag；手动发布必须从默认分支当前提交运行。发布前还会读取 draft Release 的 `latest.json`，校验版本、Windows/macOS 三个平台键、签名字段和 GitHub tag 下载 URL，校验失败时不会将 Release 公开。仓库管理员仍应在 GitHub 为 `main` 和 `v*` tag 配置保护规则，并为签名发布配置需要审批的 environment；workflow 文件和依赖只应从受保护的默认分支进入发布流程。

发布依赖的 Excalidraw 使用固定 commit；下载的 ONNX Runtime、offline 资源和 Fixed WebView2 资源都在解压前校验固定 SHA-256。Rust 发布构建使用 `--locked`，若 `Cargo.lock` 被重写则发布 job 失败。

在仓库 Settings → Secrets and variables → Actions 中配置：

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

Secret 内容应来自受控的签名密钥文件和密码（密码 Secret 去掉文件末尾换行），不要把密钥路径写进 workflow。密钥应在离线位置备份；丢失私钥后无法给已经安装的客户端发布可验证更新。

仓库 fork 的 Actions 可能默认关闭，首次发布前需要在 GitHub 仓库设置中启用 Actions。workflow 会校验 release tag（例如 `v0.7.10-beta`）去掉 `v` 后与 `src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 和 `src-tauri/Cargo.lock` 的版本一致；先修改版本并提交，再创建并推送对应 tag，或用 `workflow_dispatch` 重跑一个已经存在且指向当前默认分支提交的 tag。workflow 不会在手动触发时再次 push tag。`package.json` 是前端工作区元数据，不作为 Tauri 发布版本来源。

`latest` endpoint 只指向已发布的非 draft、非 prerelease Release。本 workflow 将当前 beta tag 作为公开 latest（`prerelease: false`），因此 beta 也会进入公共 OTA；如果以后要隐藏测试版，必须另建 channel/manifest，不能只改 tag 名。不要手工发布不含 `latest.json` 的 Release。

## 首次迁移与 Bootstrap

本项目曾切换 OTA 仓库和 minisign 公钥。旧安装无法验证第一份由新信任根签名的包；这是签名信任根变更，不是 updater bug。首次迁移必须手动安装一份带当前公钥的 Bootstrap 安装包，其版本必须严格高于已安装版本；之后的版本也必须持续递增，才能由 OTA 更新。

不要尝试从旧仓库或其他项目恢复私钥，也不要复用其他应用的 updater key。发布时只认当前平台配置中的 Snow Shot 公钥。

## 本地构建

Windows/macOS 平台配置默认保留 GitHub endpoint 和公钥，但 `bundle.createUpdaterArtifacts` 默认关闭，因此普通本地 `tauri build` 不要求签名 Secret。发布 CI 通过额外的 `--config src-tauri/tauri.release.conf.json` 开启签名产物；fixed/offline CI 通过 `tauri.no-ota.conf.json` 明确关闭 endpoint 和签名产物。

如需在本地验证签名构建，必须临时提供同名环境变量，并在构建后清理环境；私钥不应写入 shell 历史或任何 tracked 文件。
