# dsh-android (fork: proot-write-policy)

This is a fork of [itiswdwa/dsh-android](https://github.com/itiswdwa/dsh-android). The app code, UX and
runtime packaging are upstream work; this fork only changes the pieces listed below.

## Differences from upstream

- **PRoot build**: `libproot.so` now comes from [Htao-uu/proot-write-policy](https://github.com/Htao-uu/proot-write-policy)
  (a termux/proot fork that adds a write-path policy for `workspace-write` on hosts without
  bubblewrap/Landlock). `scripts/fetch-proot.sh` pins the release asset by sha256.
- **Hot overlay** (`payload/opt/dsh/android/repair-dsh.mjs`): injects an `AbortSignal.any`
  polyfill into the web frontend (needed by Huawei WebView 114) and configures
  `@deepseek-ai/dsh-sandbox-local` to run commands through the policy runner.
- **Runner** (`payload/usr/local/bin/sandbox-run`): translates the sandbox provider's
  bwrap-style profile into the `DSH_SANDBOX_*` markers that the PRoot extension enforces.
- `THIRD_PARTY.md` records the PRoot provenance, version and licence.

## 相对上游的差异

- **PRoot**：`libproot.so` 来自 [Htao-uu/proot-write-policy](https://github.com/Htao-uu/proot-write-policy)
  （termux/proot 的 fork，新增写路径策略，用于没有 bubblewrap/Landlock 的 `workspace-write`）；
  `scripts/fetch-proot.sh` 用 sha256 固定 release 资产。
- **热覆盖**（`payload/opt/dsh/android/repair-dsh.mjs`）：向前端注入 `AbortSignal.any` polyfill
  （华为 WebView 114 需要），并把 `@deepseek-ai/dsh-sandbox-local` 配置成走策略 runner。
- **Runner**（`payload/usr/local/bin/sandbox-run`）：把沙箱的 bwrap 风格参数翻译成
  `DSH_SANDBOX_*` 标记，交由 PRoot 扩展执行。
- `THIRD_PARTY.md` 记录 PRoot 的来源、版本与许可。

## Licence

App code stays under the upstream MIT licence (`LICENSE`). The PRoot fork is
GPL-2.0-or-later; its source is published in the repository above. Anyone distributing a build
of this app must make that corresponding source available.

应用代码仍为上游 MIT（`LICENSE`）；PRoot fork 为 GPL-2.0-or-later，源码发布在上述仓库，
分发本 app 的构建产物时须提供对应的 PRoot 源码。
