# Snow Shot 审计修复记录 · 2026-11-13

本次按审计建议顺序修复 F1–F6，并完成截图历史复制按钮的成功提示。修复位于当前工作区，尚未提交、发布或安装到本机应用。基线 HEAD 保持 `91d4e67ab4c4060318a384f171e1d627f3090134`。

原始问题与证据见 [项目进度审计](D:/work/snow-shot/docs/reports/project-progress-audit-2026-11-13.md)。本记录补充修复结果，不改写审计时的事实。

## 修复结果

| 审计项 | 当前行为 | 主要文件 |
|---|---|---|
| F1：旧探测结果混入新密钥 | 探测结果绑定产生它的地址与密钥；输入改变后立即禁止使用旧结果保存，等待期间也不可添加。DeepL 保留检测完成但服务暂不可达时保存当前配置的原行为。 | `addService.tsx`、`serviceDraft.ts` |
| F2：回退成功仍保存错误地址 | 实际成功的 `/models` 候选决定最终 API 基址。 | `detection.ts` |
| F3：取消后继续探测 | 已取消的请求不发出；中途取消后不进入其他地址、版本和能力探测；清理定时器与监听。 | `detection.ts`、`modelFetch.test.ts` |
| F6：页面恢复丢失未发送草稿 | 按会话存储草稿和当前会话，重新加载时恢复；提交被接受或加入队列后只清除对应文字，队列继续发送不会清除新输入。 | `chat/drafts.ts`、`useChatSessions.ts`、`chat/page.tsx` |
| F4：公开版本重跑提前退出 | jq 将合法布尔值转换为文本，使 `draft=false` 能进入已有版本的校验分支；缺失或异常类型仍失败。 | `.github/workflows/release.yml` |
| F5：离线包缺少 WebView2 | Windows offline 变体复用已有固定 WebView2 配置、固定版本和 SHA-256 校验下载步骤，同时保留离线前端资源与关闭 OTA 的配置。 | `.github/workflows/release.yml`、`docs/ota.md` |

聊天草稿复核中另外修正了两处时序问题：首次发送等待创建会话时继续输入的文字会迁入新会话；存储初次读取失败时不写空快照，后续编辑重试读取并合并变更，保留其他会话草稿。快速切换或清空会话会让迟到的切换失效。原先“询问选中文字”的链接已处理标识也会保存，避免页面恢复后把编辑过的草稿替换成原始选中文字。

草稿使用现有 Tauri store，在应用配置目录新增 `stores/chat-drafts.json`，不修改聊天历史文件格式。提交被接受不代表模型已经完成回答。

## 复制按钮

- 原生复制调用成功后，图标显示 **✅**，保留“复制”文字；辅助阅读文本提示“已复制”。
- 点击另一张历史图片时立即清除上一张的标记；成功标记在 **3 秒**后消失；再次复制会重新计时。
- 复制进行中暂时禁用其他复制按钮，避免完成顺序与实际剪贴板内容错位。
- 复制前通过现有本地图片地址发出不使用缓存的 HEAD 请求；文件已删除、读取失败或剪贴板调用失败时显示错误，不显示成功标记。
- 页面卸载后清理计时器，迟到结果不会更新新页面。

[复制按钮效果图](D:/work/snow-shot/docs/reports/history-copy-feedback-2026-11-13.png) 来自真实当前组件的浏览器验证页；图片列表与原生调用为模拟数据，不是已安装应用的截图。

## 实际验证

全部使用已安装的工具和依赖。测试输出、临时服务器和前端构建位于本轮独立 `.tmp` 目录；未清理其他任务的产物。

| 检查 | 结果与覆盖范围 |
|---|---|
| TypeScript 全量检查 | `tsc --noEmit --incremental false` 通过。 |
| Biome | 对 `src`、相关 package/tsconfig/capability 文件检查，354 个文件通过；检查时未批量写回。 |
| 模型 HTTP 回归 | 通过，包括回环/远端边界、请求体与鉴权、流式调用、回退地址、预先取消、中途取消及监听清理。 |
| 模型服务回归 | 原有 `serviceModel.test.ts` 与新增 `serviceDraft.test.ts` 均通过，覆盖输入身份、旧模型选择、探测等待、回退地址和 DeepL。 |
| 聊天草稿逻辑 | 8 组通过，包括恢复、慢读、发送消费、清空、写入顺序、选中文字标识、首次发送期间继续输入和存储故障恢复。 |
| 聊天 hook 浏览器验证 | 真实 React StrictMode + `useChatSessions`，7 组生命周期通过：初始化/重渲染、卸载重挂载、会话切换、迟到消费、首次发送期间输入、清空与存储读取故障。原生存储为内存模拟。 |
| 复制组件浏览器验证 | 10 项通过：无路径、已删除文件、等待状态、防并发、成功、跨行清除、重复复制重新计时、3 秒消失、失败重试、卸载后的迟到完成；无 JavaScript 页面异常。 |
| 发布/OTA/构建辅助脚本 | `release-scripts.test.mjs`、`ota-release.test.mjs`、`build-scripts.test.mjs` 全部通过。 |
| 实际 jq 表达式 | Windows PATH 无 jq，Windows 测试明确 SKIP；另在已运行的 Ubuntu 环境执行同一仓库测试，`CI=true`，8 种输入全部通过，未跳过。 |
| 前端生产构建 | 加载真实 `rsbuild.config.ts`，只将产物路径改到本轮独立目录；构建成功，路由生成文件哈希未变化。 |
| Git/工作区检查 | `git diff --check` 通过；13 个未纳入本次修复的原有修改/未跟踪文件哈希完全一致。三个有意叠加修复的既有文件为 `package.json`、`detection.ts`、`modelFetch.test.ts`。 |

可重复运行的草稿测试入口已加入 `package.json` 的 `test:chat-drafts`；服务测试入口增加 `serviceDraft.test.ts`。实际本轮编译使用独立输出目录，避免脚本原有清理步骤影响共享目录。

发布表达式复核命令：

```powershell
wsl.exe -d Ubuntu --cd /mnt/d/work/snow-shot --exec env CI=true TMPDIR=/mnt/d/work/snow-shot/.tmp/repair-20261113-5c50ef6f TMP=/mnt/d/work/snow-shot/.tmp/repair-20261113-5c50ef6f TEMP=/mnt/d/work/snow-shot/.tmp/repair-20261113-5c50ef6f node scripts/release-scripts.test.mjs
```

## 验收边界

本次完成源码修复、定向回归、浏览器组件/hook 检查和前端构建。尚未执行原生应用构建、真实 Windows 剪贴板粘贴、锁屏解锁/显示器变化恢复、无 WebView2 断网安装、GitHub 发布流程重跑或真实模型请求。这些现场验收不能由模拟调用或前端构建代替。

此前 HTTP 修复、README、Rust 依赖与权限、历史报告等工作区内容保留。本次没有提交、推送、拉取、新建远端分支、安装依赖、变更模型配置或重启服务。两个本轮浏览器测试服务已结束，测试标签页已关闭。
