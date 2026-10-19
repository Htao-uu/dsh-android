# Updater 设计：OTel 迁移（post-update migration）

> 目标：dsh runtime 更新后，仍然保证 `otel` 行处于禁用状态，且不会因为 profile 被重置/更新而
> 悄悄把 195 个模块重新带回冷启动。

## 1. 状态存在哪里

- profile patch：`/root/.dsh/profiles/web/cordis.patch.yml` 里的 `- id: otel / disabled: true`；
- 新装 seed：`opt/dsh/dsh-home-seed/profiles/web/cordis.patch.yml`；
- 启动迁移：`opt/dsh/android/repair-profile.mjs` 每次 boot 幂等追加；
- `DSH_TELEMETRY_DISABLED=1`：只负责 `session-telemetry-otel`，不能代替 `otel` 行。

## 2. updater 必须做的三件事

### preUpdate

1. 备份当前 profile patch 到 generation 目录；
2. 记录当前 dsh 版本、rootfs 版本、Node ABI、`DSH_TELEMETRY_DISABLED`；
3. 若 patch 里没有 otel 行，记录为”需要补”，不阻塞更新。

### postUpdate

1. 重新读取 profile patch（YAML，不允许字符串拼接式改整个文件）；
2. 迁移规则：
   - 没有 `id: otel`：追加 `- id: otel / disabled: true`；
   - 有 `id: otel` 且 `disabled` 不是 true：改为 true，保留用户其他字段；
   - 有 `id: otel` 且已 true：不动；
   - 用户显式开了 telemetry（例如配置里 opt-in）：不覆盖，只记录并提示；
3. 写前备份 `.bak-otel-<generation>`；写失败则回滚整个 runtime 更新；
4. 确认新 dsh 仍有 `otel` 行：
   - 有：完成；
   - 没有/改名：标记 `otel-row-missing`，至少保持 `DSH_TELEMETRY_DISABLED=1`，
     并在 updater 状态里报 warning（下一版迁移需适配新行名）；
5. 保留 seed 更新：新装用户走 `dsh-home-seed`，已有用户走 profile 迁移，两条路都要覆盖。

### verify

1. 冷启动到 URL；
2. 检查启动日志/profile：没有 OTel provider 激活、没有 `session-telemetry-otel` pending 警告；
3. 可选：CPU profile/trace 里 `@opentelemetry/*` 模块数应为 0 或接近 0；
4. 失败则切回上一代 runtime + 上一份 profile patch。

## 3. 失败/回滚矩阵

| 情况 | 行为 |
|---|---|
| profile patch 写入失败 | 回滚 generation，保留旧 patch，报告错误 |
| 新 dsh 没有 otel 行 | 保留 `DSH_TELEMETRY_DISABLED=1`，warning，不阻塞启动 |
| 用户显式 opt-in telemetry | 不覆盖，记录 `telemetry-opt-in` |
| 新 dsh 启动失败 | 切回上一代，恢复 patch 备份 |
| 冷启动比基线慢 > 阈值 | 回滚并标记该 generation 为 bad |

## 4. 与现有 repair-profile 的关系

- `repair-profile.mjs` 是”启动时兜底”；updater 的 postUpdate 是”切换时主动迁移”；
- 两者都幂等，允许同时存在；
- updater 不应删除 repair-profile，否则全新 profile 没有兜底。

## 5. 测试

- patch 四种形态：空 `[]`、无 otel、有 otel 但 enabled、有 otel 已 disabled；
- 两种更新：保留 profile、重置/新建 profile；
- 失败注入：patch 只读、YAML 损坏、新 dsh 无 row；
- 每次都要跑一次冷启动到 URL，并检查没有 OTel 激活。
