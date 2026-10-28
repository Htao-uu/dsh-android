# dsh-android (fork: proot-write-policy)

[中文](#中文) | [English](#english)

## English

This is a fork of [itiswdwa/dsh-android](https://github.com/itiswdwa/dsh-android).
The app shell and runtime packaging are upstream work; this fork carries the changes below.

**Current release: [1.4.0](https://github.com/Htao-uu/dsh-android/releases/tag/v1.4.0)**

### Download

- [`dsh-android-1.4.0-release.apk`](https://github.com/Htao-uu/dsh-android/releases/download/v1.4.0/dsh-android-1.4.0-release.apk)
- [All releases](https://github.com/Htao-uu/dsh-android/releases)

Requirements: Android 10+ (arm64), WebView 116+ recommended. Version 1.4.0, versionCode 14000.
Install with `adb install -r --no-incremental dsh-android-1.4.0-release.apk`.

### What's new in 1.4.0

- **Embedded Node.js 24.22.1** and **DeepSeek Harness 0.2.2-alpha.2** (Node 24.9+ required).
- **Embedded `dsh-mobile-shell` 0.7.5**, including the mobile settings layout for the new DSH
  settings panel: the native right-hand header and its duplicate actions are hidden, the custom
  back button remains, and the list / section states are kept separate.
- **Reinstall-safe payload extraction**: the rootfs is replaced instead of patched in place;
  read-only directories are made writable before deletion; a manifest root entry can no longer
  chmod the rootfs root and break the install marker. App data is not cleared by the upgrade.
- **Version-gated boot repairs**: prep/migrations only run when the payload, DSH or repair-script
  version changes.
- **Scripting-engine compatibility for Office/PDF preview**: PDF client/worker fallbacks for
  `Iterator`, `Promise.try`, `Promise.withResolvers`, `Uint8Array.toHex`,
  `Map.getOrInsertComputed` and `Math.sumPrecise`, plus system-font fallback.
- **Sign-in robustness**: DSH's `window.open("about:blank")` sign-in flow is handled without
  leaving the WebView on a blank page, and the Android back button falls back to WebView history.

### What is bundled

- Ubuntu arm64 rootfs with Node.js 24.22.1 and DSH 0.2.2-alpha.2.
- Default plugins: `dsh-mobile-shell`, `dsh-archived-chat-cleanup`, `agnes-media` and the
  Android sandbox/PTY bridge.
- PRoot build from [Htao-uu/proot-write-policy](https://github.com/Htao-uu/proot-write-policy)
  with a write-path policy for `workspace-write` hosts without bubblewrap/Landlock.

### Build

See `docs/BUILD.md`. The short version:

```sh
scripts/prepare_rootfs.sh
scripts/build_apk.sh
```

The release is signed with this fork's key. Changing the signing key requires a clean install.

### Verify

```sh
adb devices
adb install -r --no-incremental dsh-android-1.4.0-release.apk
adb shell am start -n dev.dsh.android/.MainActivity
```

### Licence

App code stays under the upstream MIT licence (`LICENSE`). The PRoot fork is
GPL-2.0-or-later; its source is published in the repository above. Distributing a build of this
app requires making the corresponding PRoot source available.

## 中文

这是 [itiswdwa/dsh-android](https://github.com/itiswdwa/dsh-android) 的 fork。
App 外壳和运行时打包来自上游；本 fork 只维护下面列出的改动。

**当前版本：[1.4.0](https://github.com/Htao-uu/dsh-android/releases/tag/v1.4.0)**

### 下载

- [`dsh-android-1.4.0-release.apk`](https://github.com/Htao-uu/dsh-android/releases/download/v1.4.0/dsh-android-1.4.0-release.apk)
- [全部 Release](https://github.com/Htao-uu/dsh-android/releases)

要求：Android 10+（arm64），建议 WebView 116+。版本 1.4.0，versionCode 14000。
安装：

```sh
adb install -r --no-incremental dsh-android-1.4.0-release.apk
```

### 1.4.0 主要变化

- 内置 **Node.js 24.22.1**、**DeepSeek Harness 0.2.2-alpha.2**（Node 最低 24.9）。
- 内置 **`dsh-mobile-shell` 0.7.5**，适配新版 DSH 设置界面：隐藏原生右侧顶栏和重复操作区，
  保留自定义返回按钮，列表页 / 内容页状态分离。
- **可重复安装的沙箱解包**：旧 rootfs 先移到一边再全量替换；删除前恢复可写权限；
  manifest 根目录条目不再 chmod rootfs 根目录，避免安装标记写入失败。覆盖安装不清 App 数据。
- **按版本执行的启动修复**：只有 payload / DSH / 修复脚本版本变化时才重新执行。
- **Office / PDF 预览兼容**：PDF 主线程和 worker 补充 `Iterator`、`Promise.try`、
  `Promise.withResolvers`、`Uint8Array.toHex`、`Map.getOrInsertComputed`、
  `Math.sumPrecise` 等回退，并支持系统字体回退。
- **登录健壮性**：处理 DSH 登录使用的 `window.open("about:blank")`，避免 WebView 停在空白页；
  Android 返回键增加 WebView 历史兜底。

### 内置内容

- Ubuntu arm64 rootfs，内含 Node.js 24.22.1 和 DSH 0.2.2-alpha.2。
- 默认插件：`dsh-mobile-shell`、`dsh-archived-chat-cleanup`、`agnes-media`，
  以及 Android 沙箱 / PTY 桥接。
- PRoot 来自 [Htao-uu/proot-write-policy](https://github.com/Htao-uu/proot-write-policy)，
  在没有 bubblewrap / Landlock 的主机上使用写路径策略。

### 构建

见 `docs/BUILD.md`，简要流程：

```sh
scripts/prepare_rootfs.sh
scripts/build_apk.sh
```

Release 使用本 fork 的签名密钥；换签名密钥需要卸载重装。

### 许可

App 代码沿用上游 MIT 许可（`LICENSE`）。PRoot fork 为 GPL-2.0-or-later，
源码发布在上面的仓库；分发本 App 的构建产物需要提供对应 PRoot 源码。
