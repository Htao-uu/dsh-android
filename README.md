# dsh-android (fork: proot-write-policy)

[中文](#中文) | [English](#english)

## English

This is a fork of [itiswdwa/dsh-android](https://github.com/itiswdwa/dsh-android). The app code, UX and
runtime packaging are upstream work; this fork changes the pieces listed below.

**Current release: [1.2.2](https://github.com/Htao-uu/dsh-android/releases/tag/v1.2.2)**

### Download

- [`dsh-android-1.2.2.apk`](https://github.com/Htao-uu/dsh-android/releases/download/v1.2.2/dsh-android-1.2.2.apk) — versioned APK
- [`dsh-hot.zip`](https://github.com/Htao-uu/dsh-android/releases/download/v1.2.2/dsh-hot.zip) — optional hot package
- [All releases](https://github.com/Htao-uu/dsh-android/releases)

Requirements: Android 10+ (arm64), WebView 116+ recommended. Version 1.2.2, versionCode 10215.
Install with `adb install -r -d dsh-android-1.2.2.apk` (same signing key as 1.2.1; data is preserved).

### What's new in 1.2.2

- Disabled the unused OTel provider row. On-device A/B: 16.46s -> 13.34s; full-app cold start
  measured 12.17s (one 1.2.2 validation run: 15.53s, device variance).
- Boot repairs: one boot-prep process, deferred PTY start, and a `DSH_HOME` guard so dsh cannot
  create a second empty home.
- The OTel migration is delivered to already-installed devices through the bundled hot overlay;
  existing profiles are patched by `repair-profile.mjs` without re-extracting the payload.

### What is dsh-hot.zip

`dsh-hot.zip` is a **small guest-side hot overlay**, not an APK and not a full dsh/plugin update.
It contains only two guest scripts plus the version manifest:

- `opt/dsh/android/repair-profile.mjs` — idempotently appends `- id: otel / disabled: true` to the
  profile patch on boot (backs up `.bak-otel`);
- `opt/dsh/android/start-dsh.sh` — the fixed guest entry script (LF, `DSH_TELEMETRY_DISABLED=1`,
  single boot-prep process, deferred PTY);
- `hot.json` — hot package version `1.2.2-t3-sp4`.

On launch the app writes these files into `/opt/dsh/android/`, so an installed device gets the OTel
migration **without re-extracting the payload**. The 1.2.2 APK already bundles the same overlay; the
Release asset is for manual application or old-device migration. A 1.2.1 app will not apply a
`1.2.2-t3` hot package.

### Differences from upstream

- **PRoot build**: `libproot.so` comes from [Htao-uu/proot-write-policy](https://github.com/Htao-uu/proot-write-policy)
  (a termux/proot fork with a write-path policy for `workspace-write` on hosts without
  bubblewrap/Landlock). `scripts/fetch-proot.sh` pins the release asset by sha256.
- **Web frontend polyfill**: `repair-dsh.mjs` injects `AbortSignal.any` (needed by Huawei WebView 114)
  and configures `@deepseek-ai/dsh-sandbox-local` to run commands through the policy runner.
- **Runner**: `payload/usr/local/bin/sandbox-run` translates the sandbox provider's bwrap-style
  profile into the `DSH_SANDBOX_*` markers enforced by the PRoot extension.
- **Boot repairs**: `boot-prep.mjs`, deferred PTY, `DSH_HOME` guard (see `docs/FINDINGS.md` §13).
- **OTel disabled**: seed profile patch + idempotent `repair-profile.mjs` migration.
- `THIRD_PARTY.md` records the PRoot provenance, version and licence.

### Build

The full pipeline is described in `docs/BUILD.md`: assemble the Ubuntu arm64 rootfs with
`scripts/assemble_payload.sh`, then run `scripts/build_apk.sh` with an Android SDK + JDK.
Current releases use the fork's own signing key; changing the key means a clean install.

### Verify

```
adb devices
adb install -r -d dsh-android-1.2.2.apk
adb shell am start -n dev.dsh.android/.MainActivity
adb logcat -v threadtime | grep -E 'dsh web|127.0.0.1:3080'
```

### Licence

App code stays under the upstream MIT licence (`LICENSE`). The PRoot fork is GPL-2.0-or-later;
its source is published in the repository above. Anyone distributing a build of this app must
make that corresponding source available.

## 中文

这是 [itiswdwa/dsh-android](https://github.com/itiswdwa/dsh-android) 的 fork。应用代码、交互和运行时打包来自上游；本 fork 只修改下面列出的部分。

**当前版本：[1.2.2](https://github.com/Htao-uu/dsh-android/releases/tag/v1.2.2)**

### 下载

- [`dsh-android-1.2.2.apk`](https://github.com/Htao-uu/dsh-android/releases/download/v1.2.2/dsh-android-1.2.2.apk)：按版本名命名的安装包
- [`dsh-hot.zip`](https://github.com/Htao-uu/dsh-android/releases/download/v1.2.2/dsh-hot.zip)：可选热包
- [全部 Release](https://github.com/Htao-uu/dsh-android/releases)

要求：Android 10+（arm64），建议 WebView 116+。版本 1.2.2，versionCode 10215。
安装：`adb install -r -d dsh-android-1.2.2.apk`（与 1.2.1 同签名，覆盖安装保留数据）。

### 1.2.2 主要变化

- 禁用未使用的 OTel provider 行。真机同条件 A/B：16.46s → 13.34s；整机冷启动实测 12.17s（1.2.2 验证一次 15.53s，存在设备波动）。
- 启动链路修复：boot-prep 单进程、PTY 延迟启动、`DSH_HOME` 保护，避免 dsh 建第二份空 home。
- OTel 迁移通过内置 hot overlay 送到已装设备；老 profile 由 `repair-profile.mjs` 追加补丁，无需重新解包 payload。

### 热包（dsh-hot.zip）说明

`dsh-hot.zip` 是 **guest 侧的小脚本热覆盖**，不是 APK，也不是完整的 dsh/插件更新。它只包含两个 guest 脚本和版本清单：

- `opt/dsh/android/repair-profile.mjs`：启动时幂等追加 `- id: otel / disabled: true`（写前备份 `.bak-otel`）；
- `opt/dsh/android/start-dsh.sh`：修正后的启动脚本（LF、`DSH_TELEMETRY_DISABLED=1`、boot-prep 单进程、PTY 延迟启动）；
- `hot.json`：热包版本 `1.2.2-t3-sp4`。

App 启动时会把它们写入 `/opt/dsh/android/`，因此已装设备**不重新解包 payload** 也能拿到 OTel 迁移。1.2.2 APK 内已内置同一份 overlay；Release 里的 `dsh-hot.zip` 供手动应用或旧设备迁移，1.2.1 的 App 不会应用 `1.2.2-t3` 这条线的热包。

### 相对上游的差异

- **PRoot**：`libproot.so` 来自 [Htao-uu/proot-write-policy](https://github.com/Htao-uu/proot-write-policy)（termux/proot 的 fork，新增写路径策略，用于没有 bubblewrap/Landlock 的 `workspace-write`）；`scripts/fetch-proot.sh` 用 sha256 固定 release 资产。
- **前端 polyfill**：`repair-dsh.mjs` 注入 `AbortSignal.any`（华为 WebView 114 需要），并把 `@deepseek-ai/dsh-sandbox-local` 配置成走策略 runner。
- **Runner**：`payload/usr/local/bin/sandbox-run` 把沙箱的 bwrap 风格参数翻译成 `DSH_SANDBOX_*` 标记，交由 PRoot 扩展执行。
- **启动修复**：`boot-prep.mjs`、PTY 延迟启动、`DSH_HOME` 保护（见 `docs/FINDINGS.md` §13）。
- **OTel 已禁用**：seed profile patch + `repair-profile.mjs` 幂等迁移。
- `THIRD_PARTY.md` 记录 PRoot 的来源、版本与许可。

### 构建

完整流程见 `docs/BUILD.md`：先用 `scripts/assemble_payload.sh` 组装 Ubuntu arm64 rootfs，再用 Android SDK + JDK 跑 `scripts/build_apk.sh`。当前发布使用 fork 自己的签名密钥；换钥必须卸载重装。

### 验证

```
adb devices
adb install -r -d dsh-android-1.2.2.apk
adb shell am start -n dev.dsh.android/.MainActivity
adb logcat -v threadtime | grep -E 'dsh web|127.0.0.1:3080'
```

### 许可

应用代码仍为上游 MIT（`LICENSE`）；PRoot fork 为 GPL-2.0-or-later，源码发布在上述仓库，分发本 app 的构建产物时须提供对应的 PRoot 源码。
