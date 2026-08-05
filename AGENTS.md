# Repository Agent Instructions

## Redlines

- 未经用户对当前操作的明确许可，禁止创建或推送任何新的远端分支。该禁令包括但不限于 `git push -u`、带新 refspec 的 `git push`，以及通过 GitHub API、网页界面或其他工具创建远端分支。
- 未经用户对当前操作的明确许可，禁止执行 `git pull`，包括带 `--rebase`、`--ff-only` 等参数的任何变体。
- 如任务需要上述操作，必须先说明具体 remote、branch 和命令，询问用户并等待明确同意；不得从此前授权或其他 Git 操作中推断许可。
