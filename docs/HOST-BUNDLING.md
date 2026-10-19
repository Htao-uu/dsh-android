# Host 打包（模块解析优化）计划与风险闸门

> 目标：减少 dsh 启动时 **模块解析 / stat / package.json 查找** 的数量。
> 真机 profile 已确认这是启动大头（约 38% 采样在 fs 元数据操作，编译只占约 5%）。
> 本文不是"必须打"的决定，而是**先量后打、随时可停**的执行计划。

## 已确认的现状（2026-10-18 真机 profile）

- dsh 冷启动采样到 **724 个 JS 模块**；其中 `@deepseek-ai/dsh` / `dsh-app-boot` / cordis 相关只有 **8 个**。
- 大头是依赖包：`undici` 96、`yaml` 56、`@opentelemetry/*` 约 195、`semver` 28、`@mixmark-io/domino` 22……
- 设置 `DSH_TELEMETRY_DISABLED=1` 后模块数降到 **660**：官方开关只禁用 `session-telemetry-otel`；
  `otel` 这一行（`@deepseek-ai/dsh-otel`）仍然加载，OTel 模块还有 195 个。
- 因此**只打 host launcher、插件保持动态**，能消掉的模块非常有限（host 自身约 8 个）；
  真正的大头挂在 profile bundle / 插件链上。

## 四条底线（不可妥协）

1. **只打 host**；profile bundle 和插件必须保持动态加载、动态 `import()` 路径不变。
2. **external 列表必须生成**（不允许手写漏项）：对 `.node`、`worker_threads`、`child_process`、
   `import.meta.resolve`、动态 `import()`/`require()`、`__dirname`/`__filename` 使用点做扫描 + 运行时追踪。
3. **保留 sourcemap**（`--sourcemap=external --sources-content=true`），排障时能映射回原文件。
4. **可随时回滚**：bundle 是独立文件，通过启动脚本里的一个开关切换；原 `node_modules` 路径保留不动。

## 风险 → 闸门

| # | 风险 | 具体防线 | 不通过就停 |
|---|---|---|---|
| 1 | 动态加载漏打 | 用真实的模块追踪器记录 (parent, specifier, resolved) 全量图；bundle 后重放，diff 缺失模块 | 任何动态 specifier 未 external |
| 2 | `__dirname`/`__filename` 语义 | 扫描所有使用点；命中模块强制 external（或显式 banner 注入兼容值） | 有未处理的命中 |
| 3 | native/worker/子进程 | 扫描 `.node`、`Worker`、`child_process`、`fork`、`execPath`；全部 external | 有漏 |
| 4 | tree-shaking 误删 | 关闭 tree-shaking（`--tree-shaking=false`）作为第一版；确认模块副作用保留 | 需要开 tree-shaking 才有效时不做 |
| 5 | 循环依赖放大 | 同一 bundle 内禁止重排 top-level 副作用：保留模块顺序，启动冒烟 + 会话内工具调用 | 启动/首轮失败 |
| 6 | 堆栈/行号失真 | sourcemap 外置 + 保留原文件 | 无法定位错误 |
| 7 | 更新粒度变粗 | 只把 host 核心打成 bundle；插件与 profile 仍是独立包，热更新逻辑不变 | 影响插件热更新 |
| 8 | 插件系统冲突 | bundle 入口只替换 host launcher；loader / rev / client bundle 全不动 | 任何插件加载路径变化 |
| 9 | 两套 bundle 机制重叠 | host bundle 只走构建脚本，不进入 client bundle 管线 | 出现交叉 |
| 10 | 构建链复杂 | 一个 `scripts/build-host-bundle.mjs` + 一个 external 清单 + CI 校验；不引入第二套运行时 | 构建无法复现 |
| 11 | external 漏配 | external 清单由追踪器 + 扫描共同生成，并加测试：清单外不得出现 `node_modules` 引用 | 有漏 |

## 分阶段执行

### Stage 0：模块图（先做，不打包）

- 写 `scripts/trace-modules.mjs`（`module.register` resolve hook），输出 JSONL：parent、specifier、resolved、
  加载阶段。PC 上用本机 dsh 先跑通；真机可通过临时 hot 脚本跑一遍。
- 产出 `module-graph.json`：按包统计、按入口归因（host / profile bundle / 插件）。

### Stage 1：安全减模块（不打 bundle）

- 根据归因图，先做**不改模块语义**的删减：例如把未使用的 `otel` 行在 profile patch 里禁用、
  把明显可选的依赖懒加载。每项单独 A/B，保留回滚。
- 通过条件：启动 URL 时间或模块数有可重复的改善，功能 smoke 全过。

### Stage 2：Host bundle 试制（只在 guest 里跑，不替换启动）

- 用 esbuild 打 host launcher 静态图；插件/profile bundle/原生/动态项 external。
- 产出 `host-bundle.mjs` + `externals.json` + `.map`。
- 在真机 guest 里用**另一个端口**跑 `node host-bundle.mjs web --port 3081`，不碰当前 3080 启动链。
- 与 Stage 0 的图做 diff，缺一个模块就不通过。

### Stage 3：是否上线

必须同时满足：

- 冷启动到 URL 的改善 **≥ 1 s**，或模块数减少 **≥ 25%**；
- web UI、会话列表、终端、一次工具调用、外部热包 replay、恢复模式入口全部 smoke 通过；
- `node_modules` 原路径仍在，回滚只需改一行启动脚本。

否则记录数据、停止，不做生产切换。

## 当前设备状态

- 最终 APK 已安装，数据完整；真机 profile 产物在 `_timing/`。
- `DSH_TELEMETRY_DISABLED=1` 已写进设备启动脚本（只减少 64 个模块，先保留观察）。
## Stage 0 / Stage 2 实测记录（2026-10-18）

- 模块追踪（PC，dsh 0.2.1 + 手机 profile）：6428 次 resolve，**2584 个唯一文件**；
  CPU profile 采样到的 724 只是有 CPU 活跃的模块，不是全量。
- `@deepseek-ai/cordis` 被 **60 个父模块** import；OTel 只由 `dsh-otel` 与
  `session-telemetry-otel` 两个入口加载。
- 朴素 host bundle：**420 个模块 / 2.5 MB**；直接启动失败在
  `new URL("../package.json", import.meta.url)`。
- 路径重写原型：把输入图的源文件集中到 staging 树，对每个模块把
  `import.meta.url` / `__dirname` / `__filename` 换成**原文件的绝对路径**，再用 esbuild 打包：
  **bundle 成功启动并打印 Web URL**（sourcemap 4.25 MB）。
- 同一台 PC 上的 A/B：plain 27.4/27.1 s，bundle 25.3/28.9 s —— 该测试 profile 本身要 27 s
  （与手机 13–15 s 不同构），**该 A/B 不作为结论**；下一步要在真机 guest 的 3081 端口做。
- profile patch `- id: otel` + `disabled: true` 语法有效：能启动；只关 `otel` 会留下
  `session-telemetry-otel` pending 警告，正式启用要同时有 `DSH_TELEMETRY_DISABLED=1`（app 启动脚本已设置）。

### 下一步

1. 用 guest 路径（`/opt/dsh/...`）重建 bundle，在真机 guest 的 3081 端口与 plain 做 A/B，
   带上模块图 diff 和 smoke（Web UI、会话、终端、一次工具调用）。
2. 若达到 `启动 −1 s 或模块数 −25%`，再接启动脚本；否则停止，保留研究结论。
3. 打包插件 MVP 之前，先按 `docs/UPDATER-PLUGIN.md` 的 adapter 分层把桌面 npm/git 路径跑通。
## Stage 3 结论（真机 3081 A/B，2026-10-18 晚）

| 组 | 次数 | 到 URL 时间 |
|---|---|---|
| plain（磁盘模块图） | 2 | 13.89 s / 15.93 s |
| host bundle（2.5 MB） | 2 | 16.74 s / 15.89 s |
| plain（复测） | 2 | 14.13 s / 16.24 s |
| host bundle（minify 1.3 MB） | 2 | 15.24 s / 16.49 s |

**结论：host-only bundle 没有收益（反而慢 0.7–1.4 s）。** 420 个 host 模块虽然被内联，
但单文件 2.5 MB 的解析/编译成本抵消了模块解析的节省；profile 插件仍动态加载，
真正的大头（OTel 等）没有动。按 Stage 3 闸门 **停止 host bundle**，保留研究结论，不再接启动链。

## Stage 1 结论（真机同条件 A/B，2026-10-18 晚）

同一台手机、同一 0.2.0 rootfs、复制 profile、都设置 `DSH_TELEMETRY_DISABLED=1`：

| 组 | 次数 | 到 URL 时间 |
|---|---|---|
| base（不关 otel） | 2 | 16.20 s / 16.71 s |
| `otel` 行 disabled | 2 | 13.30 s / 13.38 s |

**平均 16.46 s → 13.34 s，约 −3.1 s（−19%）**，且两次一致。
OTel provider 在真机 profile 里约 195 个模块，是当前找到的**最大且低风险**启动收益。

实现：

- `profile/cordis.patch.yml` 给新装用户加 `- id: otel / disabled: true`；
- `payload/opt/dsh/android/repair-profile.mjs` 给老 profile **幂等追加**同一行
  （`[]` 占位替换为列表、已存在则跳过、写前备份 `.bak-otel`）；
- `scripts/test_repair_profile.mjs` 覆盖 4 种 profile 形态；
- 与 `DSH_TELEMETRY_DISABLED=1` 配合，两个 telemetry 行都关闭，不会留下 pending 警告。

下一步：把 `repair-profile.mjs` 通过 APK 或热包送到现有设备，再做整机冷启动复核。
