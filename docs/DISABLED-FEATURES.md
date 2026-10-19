# 已禁用 / 惰性处理的功能清单

> 记录"当前为什么关、怎么恢复"，避免以后需要这些功能时忘记它们现在的状态。
> 更新于 2026-10-19。

## 已禁用

| 功能 | 行 / 开关 | 当前状态 | 原因 | 如何恢复 |
|---|---|---|---|---|
| OTel provider | `otel` (`@deepseek-ai/dsh-otel`) | **disabled**（profile patch） | 真机约 195 个模块；同条件 A/B 16.46 s → 13.34 s（−3.1 s）；更新后整机冷启动实测 **12.17 s**。该行只被 `dsh-otel` 和 `session-telemetry-otel` 使用 | 从 `profile/cordis.patch.yml` 及现有 profile 的 `cordis.patch.yml` 删除 `- id: otel` 行（或改成 `disabled: false`），并去掉 `DSH_TELEMETRY_DISABLED=1`；重启 |
| session telemetry | `session-telemetry-otel` | **disabled**（env） | app 不收集 telemetry；与 `otel` 行一起关，避免 pending 警告 | 去掉 `start-dsh.sh` 里的 `export DSH_TELEMETRY_DISABLED=1` |
| plugin-manager 工具 | `tool-plugin-manager` | **disabled**（base patch） | DSH 默认不向模型暴露管理工具；插件市场仍用 service | 在 profile patch 里 `disabled: false`（不推荐） |
| skill badge | `skill-badge` | **disabled**（base patch） | 默认不启用 | 同上 |
| ralph 工具 | `tool-ralph` | **disabled**（base patch） | 默认不启用 | 同上 |
| pwsh 相关 | `pwsh-sandbox` / `tool-pwsh` | **无入口**（Linux guest） | Windows PowerShell 行在 Linux 上不加载 | 不适用 |

## 惰性 / 未启用

| 功能 | 状态 | 说明 |
|---|---|---|
| host bundle | **未接入** | 420 模块 / 2.5 MB 的 sealed bundle 真机反而慢 0.7–1.4 s，按闸门停止 |
| `llm-pi-ai` provider SDK | **待惰性化** | 161 个独占模块；上游 pi-ai 已有 lazy 提交但未发布；当前未在 profile 里禁用 |

## 恢复 OTel 的注意点

1. `otel` 行恢复后，如果 `DSH_TELEMETRY_DISABLED` 仍设置，只有 `session-telemetry-otel` 会保持 disabled，不会报错但也不会上报。
2. `repair-profile.mjs` 只在 profile 里没有 `id: otel` 时才追加；恢复时若保留行并设 `disabled: false`，迁移不会重复添加。
3. 每次恢复后跑一次冷启动确认没有 pending 警告。