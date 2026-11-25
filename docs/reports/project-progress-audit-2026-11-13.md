# Snow Shot 项目进度与只读审计

审计日期：2026-11-13。工作区：`D:/work/snow-shot`。

后续状态：用户已授权实施修复。F1–F6 的当前工作区修复、复制按钮提示及实际检查结果见 [审计修复记录](D:/work/snow-shot/docs/reports/project-repairs-2026-11-13.md)。以下内容保留本次只读审计时的基线。

本轮结论：主要功能已在源码中落地，本地模型修复仍未提交；发现 **1 项 P1、5 项 P2** 待修复问题。现有相关检查全部通过，但没有覆盖这些问题，不能据此认定当前工作区已达到发布验收条件。

本轮没有修复代码、提交或推送，没有拉取远端、安装依赖、制作安装包、调用真实模型、操作桌面或重启服务。新增内容仅为本报告和 Git 忽略目录内的审计实验、测试输出。

## 1. 当前进度

### 本次核对的基线

- 分支：`main`；HEAD：`91d4e67ab4c4060318a384f171e1d627f3090134`，提交日期为 2026-10-27。
- Tauri 配置和 Rust 应用版本均为 `0.7.17-beta`。这是源码版本，不是线上最新版本或当前安装版证明。
- 开始时有 10 个已跟踪文件被修改、6 个未跟踪文件；没有暂存改动。主要内容是 README、本地模型 HTTP 修复、检测提示、HTTP scope 和回归测试。
- 本地 `origin/main` 指向同一 HEAD；当前分支跟踪 `upstream/main`，本地缓存显示 ahead 101 / behind 1。本轮没有 fetch/pull，不能把这些数字解释为实时远端状态。
- 仓库没有统一的进度台账。本报告结合提交历史、架构/设计/OTA 文档、测试报告和实际源码归纳进度。
- Workspace Knowledge 当前没有可用快照，本轮直接读取仓库，没有触发知识库构建。

| 工作方向 | 已有成果 | 仍需区分的边界 |
|---|---|---|
| 工作台与设置页 | 10 月 26–27 日提交了工作台、搜索导航、模块化设置及焦点样式改进；设计契约已存在 | 本轮未做视觉与键盘操作现场验收 |
| 模型服务管理 | 已有统一服务列表、模型发现、对话/翻译测试与配置转换 | 本轮发现添加状态错配、备用地址和取消处理问题 |
| 本地模型 HTTP | 当前工作区已有 `modelFetch`、回环 Origin 处理、重定向限制、401/403 区分及测试 | 这些文件尚未全部纳入提交；不能视为已正式发布 |
| 桌面稳定性 | 原生快捷键/托盘恢复、文档身份校验、一次性 ACK、共享缓冲区与 HDR 等有界等待已有实现 | 本轮只抽查源码；新增发现聊天草稿在恢复刷新中丢失 |
| 构建与 OTA | 已有五种发布变体、集中发布、签名与 manifest/checksums 校验 | 公开 Release 重跑有失败路径；offline 包缺少完整 WebView2 离线保障 |
| Qwen 2B 历史验收 | 项目报告记录了真实桌面连接/流式验证及 54 轮正式资源测试 | 近满上下文 6 轮中 5 轮截断；多段格式与语义完整性未验收 |
| 2B 停用历史 | 已重读历史结果，完成时间为 `2026-10-28T23:11:56.693004+00:00`：移除应用使用入口、翻译未配置、模型文件保留，共享服务未改动 | 文件夹使用 `20261029` 命名；这是历史记录。本轮未读取当前应用配置或探测当前模型加载状态 |

参考：[架构说明](D:/work/snow-shot/docs/architecture.md)、[设计契约](D:/work/snow-shot/docs/design.md)、[OTA 规范](D:/work/snow-shot/docs/ota.md)、[Qwen 测试报告](D:/work/snow-shot/docs/reports/qwen-local-model-tests-2026-10-28.md)、[历史停用结果](D:/work/snow-shot/.tmp/disable-qwen2b-20261029/result.json)。

## 2. 审计发现

严重级别：P1 表示应优先修复的凭据或重要用户数据风险；P2 表示具体功能、可靠性或交付问题。以下发现均有当前源码依据；其中 F1–F3 还进行了隔离模拟实验，F4–F6 未做实际 CI、安装或桌面复现。

### F1 · P1 · 添加服务时可能把新密钥配到旧地址

**触发条件：** 先成功检测服务 A，再输入服务 B 的地址与密钥，在 600 ms 防抖或新检测尚未返回时点击“添加”。

**证据链：** [addService.tsx:105](D:/work/snow-shot/src/pages/settings/ai/modelServices/addService.tsx:105) 开始检测时保留旧检测结果和已选模型；[第 148 行](D:/work/snow-shot/src/pages/settings/ai/modelServices/addService.tsx:148) 优先取旧检测地址，却与当前输入密钥组合；[第 160 行](D:/work/snow-shot/src/pages/settings/ai/modelServices/addService.tsx:160) 的添加条件没有检查检测状态或结果与输入是否匹配。

新增服务随后可由 [useModelServices.ts:178](D:/work/snow-shot/src/pages/settings/ai/modelServices/useModelServices.ts:178) 自动检测，并由 [detection.ts:327](D:/work/snow-shot/src/pages/settings/ai/modelServices/detection.ts:327) 将密钥放进 Authorization。因此存在把 B 的密钥发送给 A 的风险，不只是显示名称错误。

**本轮复现：** 使用当前组件源码和模拟 React 边界，在上述可达状态渲染并调用添加按钮。实际得到 `detecting=true`、`addDisabled=false`，输入为 `new.example.invalid`，保存的却是 `old.example.invalid` 与 `NEW-DUMMY-KEY`。实验没有访问网络，也没有证据表明真实密钥已经泄露。

**最小建议：** 将检测结果与当前地址、密钥输入身份绑定；输入变化时立即使旧结果/模型失效，结果不匹配时禁止添加。单纯在异步检测开始后设一个 loading 状态不足以覆盖输入改变到 effect 执行之间的窗口。

**补充验证：** 连续切换地址/密钥、检测等待期间添加、已有同名模型、检测失败后的手动输入路径。

### F2 · P2 · 检测备用地址成功，实际仍保存错误地址

**触发条件：** 用户输入带错误路径的端点，首次 `/wrong-path/models` 失败，但根路径 `/v1/models` 成功。

**证据链：** [detection.ts:332](D:/work/snow-shot/src/pages/settings/ai/modelServices/detection.ts:332) 会尝试备用地址；成功后 [第 423 行](D:/work/snow-shot/src/pages/settings/ai/modelServices/detection.ts:423) 仍返回最初的 `apiUri`。聊天和翻译随后按保存地址拼接实际请求路径。

**本轮复现：** 模拟首次 404、备用路径返回模型列表，实际结果为 `status=ok`，`apiUri=https://example.invalid/wrong-path`。用户看到“已连接”，实际使用却会访问错误路径。

**最小建议：** 返回成功候选对应的 API base，或明确区分“服务器可达”与“当前配置可用”；不要将其他路径成功直接当作当前配置成功。补主路径失败、备用路径成功的行为测试。

### F3 · P2 · 取消检测后仍会继续请求

**触发条件：** 修改输入、离开界面或主动取消时，检测链已经开始或准备进入下一候选请求。

**证据链：** [detection.ts:153](D:/work/snow-shot/src/pages/settings/ai/modelServices/detection.ts:153) 的超时控制器只监听未来的 abort，没有继承已取消状态；[第 347 行](D:/work/snow-shot/src/pages/settings/ai/modelServices/detection.ts:347) 捕获取消异常后继续下一候选。版本/能力检测也复用相同包装。

**本轮复现：**

- 传入预先取消的 signal，模拟传输收到的 `signal.aborted=false`，检测仍返回 `ok`。
- 首个请求途中取消并抛出 `AbortError`，备用请求仍被调用，且其 signal 仍未取消。

影响是旧检测继续访问先前端点，浪费请求并削弱取消承诺。此外，[addService.tsx:99](D:/work/snow-shot/src/pages/settings/ai/modelServices/addService.tsx:99) 在输入变成空值/无效值时没有推进请求序号，旧检测结果还有回写机会；该回写分支本轮只做源码核对。

**最小建议：** 创建包装 signal 时同步取消状态，取消后结束整个检测链，并在所有输入变化及 cleanup 时使旧请求失效。补预取消、中途取消、清空输入的回归。

### F4 · P2 · 已公开 Release 的重跑无法进入验证分支

**触发条件：** 同一 tag 已经公开，重新执行 publish job，例如发布后验证失败再重跑。

**证据链：** [release.yml:524](D:/work/snow-shot/.github/workflows/release.yml:524) 在 `set -euo pipefail` 下执行 `jq -er '.[0].draft'`。公开 Release 的值为布尔 `false`，`jq -e` 会以退出码 1 结束，shell 提前退出，无法进入后面“公开版本只验证、不覆盖”的分支。

**最小建议：** 校验 draft 是布尔类型后输出字符串，例如 `jq -er '.[0].draft | select(type == "boolean") | tostring'`。补 `draft=true`、`draft=false`、缺失/无效字段三类测试。

**证据边界：** 本机未提供 jq；本项根据脚本控制流和 jq 的退出语义确认，未执行 GitHub Actions 或真实发布重跑。现有 Node 发布脚本测试未覆盖这段 workflow shell。

### F5 · P2 · offline 包在缺少 WebView2 的断网机器上不满足安装承诺

**触发条件：** Windows 没有预装 WebView2，且无法联网。

**证据链：** [release.yml:214](D:/work/snow-shot/.github/workflows/release.yml:214) 的 `windows-offline` 只启用离线资源及禁用 OTA，没有 WebView2 安装方式覆盖，仍继承 [tauri.windows.conf.json:27](D:/work/snow-shot/src-tauri/tauri.windows.conf.json:27) 的 `embedBootstrapper`。该模式在 [安装脚本第 553 行](D:/work/snow-shot/src-tauri/build-configs/installer.nsi:553) 执行引导安装程序；[本地 Tauri schema 第 2726 行](D:/work/snow-shot/node_modules/@tauri-apps/cli/config.schema.json:2726) 明确说明需要互联网连接。

[README:122](D:/work/snow-shot/README.md:122) 却把 offline 包推荐给隔离网络并声称包含全部依赖。已经安装 WebView2 的断网机器不属于本项失败条件。

**最小建议：** 为 offline 变体显式选择完整离线安装器或随包 fixed runtime，并在无 WebView2 的断网机器验收。如果暂时只支持前端资源离线，应明确写出预装 WebView2 的要求。本轮未实际安装该包。

### F6 · P2 · 解锁或显示器变化后的恢复刷新会丢失聊天草稿

**触发条件：** 聊天输入框中有尚未发送文字，随后锁屏再解锁、恢复供电或改变显示模式。

**证据链：** [windows_session.rs:114](D:/work/snow-shot/src-tauri/src/windows_session.rs:114) 将这些系统消息交给恢复逻辑；[native_action.rs:553](D:/work/snow-shot/src-tauri/src/native_action.rs:553) 清空主页面身份；[第 1431 行](D:/work/snow-shot/src-tauri/src/native_action.rs:1431) 进入恢复，原页面无法作为 ready runtime 复用时会到 [第 1701 行](D:/work/snow-shot/src-tauri/src/native_action.rs:1701) 刷新窗口。首次系统恢复事件会先使原身份失效，不以原页面已经无响应为前提。

聊天草稿只保存在 [page.tsx:87](D:/work/snow-shot/src/pages/tools/chat/page.tsx:87) 的 `useState("")`；[第 299 行](D:/work/snow-shot/src/pages/tools/chat/page.tsx:299) 输入变化直接写入该状态，没有跨刷新保存与恢复路径。刷新后尚未发送文字会丢失。

**最小建议：** 按当前聊天会话保存和恢复草稿，成功发送后清理，保留现有恢复身份校验。补“输入草稿→主页面重新加载→草稿恢复”检查，再做实际解锁/显示变化验收。本轮仅确认源码链路，没有操作真实桌面。

## 3. 本轮实际验证

所有命令均使用已安装依赖。六组 TypeScript 回归使用各自现有 tsconfig 编译到本轮独立目录，再执行对应测试入口，避免脚本原有清理命令覆盖共享 `.tmp` 结果。发布/构建脚本测试的 TEMP/TMP 也限定到本轮仓库内临时目录。

| 检查 | 本轮结果 | 说明 |
|---|---|---|
| TypeScript | 通过，退出码 0 | `node node_modules/typescript/bin/tsc --noEmit --incremental false` |
| Biome | 347 文件通过，退出码 0 | `biome check src package.json tsconfig.model-http-regression.json src-tauri/capabilities/default.json --max-diagnostics=30`；未写回，不等同于原样执行全库 `pnpm lint` |
| Rust 格式 | 通过，退出码 0 | 在 `src-tauri` 执行 `cargo fmt --all -- --check` |
| 模型 HTTP | 通过 | 现有传输、边界、鉴权头、流式与检测回归 |
| 模型服务配置 | 通过 | 现有配置派生和写回回归，不覆盖 AddService 交互时序 |
| API 配置 | 通过 | 现有配置有效性回归 |
| 翻译结构协议 | 通过 | 不代表真实长文本翻译质量验收 |
| 贴图窗口布局 | 通过 | 现有 fixed-content 回归 |
| 主窗口尺寸 | 通过 | 现有 main-window-size 回归 |
| 发布资产/manifest | 通过 | `node scripts/release-scripts.test.mjs` |
| OTA 辅助脚本 | 通过 | `node scripts/ota-release.test.mjs` |
| 构建脚本 | 通过 | `node scripts/build-scripts.test.mjs`，包含 dry-run，不制作应用 |
| F1–F3 隔离实验 | 复现当前缺陷 | 当前源码转译，模拟组件/网络边界；不是真实 UI 或服务验收 |
| `git diff --check` | 通过 | 仅有现存 Cargo.lock 换行提示 |
| 历史证据 ZIP | SHA-256 与报告一致 | `a4b7b0d0945041eca875faea4edfaebf3e2a73fee38942acc554c113073ec133` |
| 既有工作区文件 | 16 个文件哈希未变 | 对比本轮开始记录的修改/未跟踪文件基线 |

本轮未重新编译 Rust 应用、重跑 Rust HTTP scope 测试或原生恢复测试，也未重跑截图、OCR、录屏、真实模型、Windows 桌面、macOS、安装包和 OTA 现场验收。历史测试报告中的通过项不能自动升级为本轮验证。

## 4. 建议处理顺序

1. 先修 F1，阻止端点与密钥错配；同一功能范围内补 F2、F3 的行为回归。
2. 修 F6，保护日常解锁/恢复过程中的未发送草稿，并进行实际桌面验收。
3. 发布前修 F4、F5，验证公开版本重跑与断网缺少 WebView2 的安装条件。
4. 按功能边界整理目前未提交的 HTTP 修复、测试及文档；保存必要证据后再决定提交、安装包和发布安排。
5. 如继续推进翻译质量，单独验收长文本输出预算、分段完整性及取消后的模型资源行为，不以本轮协议测试替代。

这些是后续工作建议，本轮没有实施修复或获得发布授权。当前 `unsafe-headers` 是插件全局编译特性，回环限制由应用封装实现；本轮没有将它误写成 Rust 端新增隔离。OTA 远端验证也不应被表述为已下载每个远端安装包并重新计算哈希，本轮没有这种证据。

## 5. 复核材料

- [F1–F3 隔离实验脚本](D:/work/snow-shot/.tmp/audit-20261113-d07e4f1f/reproduce-model-findings.cjs)：读取当前源文件，使用假密钥和模拟边界，重复运行可检查上述行为。
- [实验输出](D:/work/snow-shot/.tmp/audit-20261113-d07e4f1f/model-findings.log)。
- [模型 HTTP 回归输出](D:/work/snow-shot/.tmp/audit-20261113-d07e4f1f/model-http.log)、[模型服务回归输出](D:/work/snow-shot/.tmp/audit-20261113-d07e4f1f/model-services.log)、[API 配置回归输出](D:/work/snow-shot/.tmp/audit-20261113-d07e4f1f/api-config.log)。
- [翻译回归输出](D:/work/snow-shot/.tmp/audit-20261113-d07e4f1f/translation.log)、[贴图窗口回归输出](D:/work/snow-shot/.tmp/audit-20261113-d07e4f1f/fixed-content.log)、[主窗口尺寸回归输出](D:/work/snow-shot/.tmp/audit-20261113-d07e4f1f/main-window-size.log)。
- [发布脚本输出](D:/work/snow-shot/.tmp/audit-20261113-d07e4f1f/release-scripts.log)、[OTA 辅助脚本输出](D:/work/snow-shot/.tmp/audit-20261113-d07e4f1f/ota-release.log)、[构建脚本输出](D:/work/snow-shot/.tmp/audit-20261113-d07e4f1f/build-scripts.log)。
- [既有修改文件哈希基线](D:/work/snow-shot/.tmp/audit-20261113-d07e4f1f/baseline.json)。

`.tmp` 材料为本机辅助证据，受 Git 忽略规则管理；本报告本身保存了关键复现结果、源码位置、检查结果和证据边界，不依赖临时日志才能理解结论。
