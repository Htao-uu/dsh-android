# App 内更新 dsh：多端插件调研与方案

> 目标：把「更新 dsh 运行时」做成一个**跨平台 DSH 插件**（Cordis host + client），
> 桌面 / 服务器 / Android app 共用一套 UI 与更新引擎，平台差异放在 adapter 层。

## 1. 现有插件调研（2026-10-18，npm + GitHub）

| 插件 | 位置 | 能力 | 不适用点 |
|---|---|---|---|
| `dsh-self-update` | npm 0.4.0 · github.com/Shane-Jay/dsh-self-update | **git checkout** 自更新；检查/一键更新/回滚；退出码 75 重启契约；无 supervisor 时 macOS/Linux 自拉起；可选 macOS 壳 | 只支持 git 源码安装；Android app 的 rootfs 不是 git 工作树，也没有 pnpm build |
| `dsh-update-checker` | npm 1.7.2 · github.com/Airmetro/dsh-update-checker | 核心 npm 包 + 第三方插件更新；备份/回滚/重启看门狗；布局自适应（in-place / `-g`）；Desktop/Electron 支持；写入路由 loopback+confirm 防护 | 默认假设有可用的 npm 部署根 / 桌面重启方式；不认识 Android app 的 runtime generation 与原生 bridge |
| `dsh-updater-npm` | npm 1.13.4 · github.com/SiriusWJ/dsh-updater-npm | 一键 `npm install -g @deepseek-ai/dsh`；实时进度；staged swap 保留回滚点；重启；官方文档同步 | 面向全局 npm 安装与 OS 进程重启，没有 app 内原子切换/签名运行时 |
| `dsh-plugin-updater` | github.com/dp419936514/dsh-plugin-updater | 插件级安全更新：备份、更新后真实启动 smoke、自动回滚、重启按钮 | 只更新插件（不是 dsh 运行时）；GitHub-only |
| `dsh-mobile-apk` PR #192 | github.com/kelai141/dsh-mobile-apk | Android APK 自更新（镜像链、二次确认、安装授权） | 是 app 外壳更新，不是 dsh 运行时插件 |

**结论**：没有现成的「Android app 内更新 dsh 运行时」的多端插件。最接近的是
`dsh-update-checker`（更新引擎/回滚/跨平台）和 `dsh-self-update`（重启契约/UI/失败回退）。
建议**不另起炉灶**：以 `dsh-update-checker` 的 host/client 骨架为起点，抽出 adapter 接口，
补一个 Android adapter；`dsh-self-update` 的 exit-code-75 契约可直接沿用。

## 2. 推荐架构：`dsh-runtime-updater`（多端 Cordis 插件）

```
dsh-runtime-updater
├─ host (lib/index.js)
│  ├─ UpdateSource   版本清单：npm registry / GitHub release / app bridge
│  ├─ RuntimeAdapter 识别安装形态并执行更新
│  │   ├─ GitAdapter    git checkout（复用 dsh-self-update 流程）
│  │   ├─ NpmAdapter    npm 部署树（复用 dsh-update-checker / updater-npm）
│  │   └─ AppAdapter    Android app（调用原生 bridge 的 runtime generation API）
│  ├─ Backup/Rollback + smoke test + 状态机
│  └─ Restart         exit 75 / 平台 launcher / app bridge restart
└─ client (lib/client.js)
   └─ 设置页一张卡片：当前/最新版本、渠道、进度、回滚、重启
```

### Android adapter 契约（app 侧实现，插件只调用）

- `GET  /dsh-android/runtime/status` → `{channel, installed, latest, compatible, pid, restartMode}`
- `POST /dsh-android/runtime/prepare` → 下载/校验签名与逐文件 hash，解到 `files/runtimes/<id>/`
- `POST /dsh-android/runtime/apply` → 原子切换 current generation，保留上一代
- `POST /dsh-android/runtime/rollback` → 切回上一代
- `POST /dsh-android/runtime/restart` → app 重启 PRoot 服务并返回新 pid/instance id
- 所有写路由要求 loopback + token + `{confirm:true}`；清单与包必须签名。

App 侧 runtime generation：`node_modules` + sealed `host.bundle.mjs` + manifest；
Proot 用 `-b files/runtimes/<id>/node_modules:/opt/dsh/node_modules` 覆盖内置树；
bundle 与 manifest 匹配才走 bundle，否则退回磁盘扫描（慢但正确）。

### 重启契约（多端统一）

- 桌面/服务器：插件退出码 **75**，由 systemd/PM2/macOS 壳/自拉起承接。
- Android：插件调用 app bridge restart；app 的 DshService 按实例 id/pid 确认新实例启动。
- 失败：插件/app 两侧都保留上一代 + backup，自动回滚并报告。

### 更新安全与兼容

- 签名 manifest（Ed25519）+ 逐文件 sha256；reject 未签名/串线版本。
- 先检查 Node ABI、rootfs 版本、app 版本、profile 插件 peer 依赖；不兼容则阻止并说明。
- 目录级覆盖禁止；更新单元 = 完整 runtime generation。
- 更新包建议 delta / 按包压缩；GUI 显示体积、网络与剩余存储；Wi-Fi 默认。
- 自己的升级失败要能从 CLI/设置页回滚，避免“UI 挂了没法回滚”。

## 3. 与现有方案的边界

- **APK 更新**：外壳/图标/Java/内置 payload，仍走 Android installer；插件不做 APK。
- **dsh-only 更新**：Node/rootfs 不变时，可 app 内下载新 runtime generation 并切换。
- **插件/client**：继续现有 rev 动态机制，不进入 runtime bundle。

## 4. 分阶段

1. **Stage 0/1（进行中）**：模块图与安全减模块（OTel 等），确定 bundle 边界。
2. **Stage 2**：sealed host bundle 原型（3081 端口试跑），验证 bundle 收益与路径/单例风险。
3. **Plugin MVP**：抽 adapter 接口，先在桌面用 NpmAdapter 跑通 UI/回滚/重启；
   Android AppAdapter 先实现 status/prepare/apply/rollback/restart 五个端点。
4. **Android runtime generation**：app 内目录、bind、原子切换、回滚、健康检查。
5. **发布**：签名清单 + 渠道 + 体积/delta；文档与失败回滚演练。

## 5. 参考

- https://github.com/Shane-Jay/dsh-self-update
- https://github.com/Airmetro/dsh-update-checker
- https://github.com/SiriusWJ/dsh-updater-npm
- https://github.com/dp419936514/dsh-plugin-updater
- https://github.com/kelai141/dsh-mobile-apk
