# dsh-android (fork: proot-write-policy)

[中文](#中文) | [English](#english)

## English

This is a fork of [itiswdwa/dsh-android](https://github.com/itiswdwa/dsh-android). The app code, UX and
runtime packaging are upstream work; this fork changes the pieces listed below.

**Current release: [1.2.3](https://github.com/Htao-uu/dsh-android/releases/tag/v1.2.3)**

### Download

- [`dsh-android-1.2.3.apk`](https://github.com/Htao-uu/dsh-android/releases/download/v1.2.3/dsh-android-1.2.3.apk) — versioned APK
- [`dsh-hot.zip`](https://github.com/Htao-uu/dsh-android/releases/download/v1.2.3/dsh-hot.zip) — optional hot package, only for manual migration
- [All releases](https://github.com/Htao-uu/dsh-android/releases)

Requirements: Android 10+ (arm64), WebView 116+ recommended. Version 1.2.3, versionCode 10219.
Install with `adb install -r -d dsh-android-1.2.3.apk` (same signing key as 1.2.2; data is preserved).

### What's new in 1.2.3

- **Native photo bridge (`window.DSHNative`).** The attach sheet now shows the "recent photos"
  strip and uses native camera / gallery / file pickers. The app implements the documented
  `capabilities` / `recentPhotos` / `openRecent` / `pickImages` / `pickFiles` methods
  (240px / ≤40 KB thumbnails as data URLs) and hands picked media to the page through a
  loopback-only, random-port, random-token, 5-minute, read-only content service with CORS and
  Range support — never a `content://` URI or an arbitrary path. When the bridge is absent or
  a call fails the plugin still hides the strip and falls back to the file chooser below.
- **Camera and gallery buttons now open the right system UI.** The WebView file chooser routes by
  input type: `capture` opens the system camera (the photo is written into MediaStore and handed
  back to the page), `accept="image/*"` opens the system photo picker (Android 13+ Photo Picker,
  gallery on older releases), and everything else still opens the document picker. Multi-select,
  cancel and camera results follow the WebView contract.
- **Three plugins now ship as defaults**: `dsh-mobile-shell` (App-style mobile shell),
  `dsh-archived-chat-cleanup` (archived-session cleanup with attachment GC) and `agnes-media`
  (`generate_image` / `generate_video` tools). Fresh installs get them from the seed profile;
  already-installed devices get the files from the bundled hot overlay and an idempotent
  `repair-profile.mjs` migration — no reinstall and no payload re-extract.
- Upgrading from 1.2.2 keeps app data (same signing key, versionCode 10219 > 10215).

### What is dsh-hot.zip

`dsh-hot.zip` is a **small guest-side hot overlay**, not an APK and not a full dsh/plugin update.
In 1.2.3 it carries the boot scripts plus the three default plugins:

- `opt/dsh/android/repair-profile.mjs` — idempotently tops up the profile (plugin dependency and
  bundle rows, the `android-sandbox` patch row, the OTel disable row; writes `.bak-otel` first);
- `opt/dsh/android/start-dsh.sh` — the guest entry script (single boot-prep process, deferred PTY);
- `@home/.dsh/profiles/web/node_modules/{dsh-mobile-shell,dsh-archived-chat-cleanup,agnes-media}/`
  — the default plugins' runtime files;
- `hot.json` — hot package version `1.2.3-t3-sp0`.

On launch the app writes these files into the app's guest home, so an installed device gets the
plugins and migrations **without re-extracting the payload**. The 1.2.3 APK already bundles the same
overlay (and the payload carries it as the fresh-install seed); the Release asset is only for manual
application or migration from older builds. A 1.2.2 app will not apply a `1.2.3-t3` hot package.

### Differences from upstream

- **PRoot build**: `libproot.so` comes from [Htao-uu/proot-write-policy](https://github.com/Htao-uu/proot-write-policy)
  (a termux/proot fork with a write-path policy for `workspace-write` on hosts without
  bubblewrap/Landlock). `scripts/fetch-proot.sh` pins the release asset by sha256.
- **Web frontend polyfill**: `repair-dsh.mjs` injects `AbortSignal.any` (needed by Huawei WebView 114)
  and configures `@deepseek-ai/dsh-sandbox-local` to run commands through the policy runner.
- **Default plugins**: `dsh-mobile-shell` (mobile shell UI), `dsh-archived-chat-cleanup` and
  `agnes-media` are vendored under `plugin/`, seeded through `profile/package.json` and kept
  up to date on already-installed devices by `repair-profile.mjs`.
- **File chooser**: camera / gallery / file inputs are routed to the system camera, the system photo
  picker and the document picker respectively (see `docs/ANDROID-BRIDGE.md` in dsh-mobile-shell).
- **Native photo bridge**: `window.DSHNative` (recent photos, native pickers, loopback content
  service) as specified by ANDROID-BRIDGE.md; the file chooser above stays the fallback.
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
adb install -r -d dsh-android-1.2.3.apk
adb shell am start -n dev.dsh.android/.MainActivity
adb logcat -v threadtime | grep -E 'dsh web|127.0.0.1:3080'
```

### Licence

App code stays under the upstream MIT licence (`LICENSE`). The PRoot fork is GPL-2.0-or-later;
its source is published in the repository above. Anyone distributing a build of this app must
make that corresponding source available.

## 中文

这是 [itiswdwa/dsh-android](https://github.com/itiswdwa/dsh-android) 的 fork。应用代码、交互和运行时打包来自上游；本 fork 只修改下面列出的部分。

**当前版本：[1.2.3](https://github.com/Htao-uu/dsh-android/releases/tag/v1.2.3)**

### 下载

- [`dsh-android-1.2.3.apk`](https://github.com/Htao-uu/dsh-android/releases/download/v1.2.3/dsh-android-1.2.3.apk)：按版本名命名的安装包
- [`dsh-hot.zip`](https://github.com/Htao-uu/dsh-android/releases/download/v1.2.3/dsh-hot.zip)：可选热包（仅用于手动迁移）
- [全部 Release](https://github.com/Htao-uu/dsh-android/releases)

要求：Android 10+（arm64），建议 WebView 116+。版本 1.2.3，versionCode 10219。
安装：`adb install -r -d dsh-android-1.2.3.apk`（与 1.2.2 同签名，覆盖安装保留数据）。

### 1.2.3 主要变化

- **原生照片桥（`window.DSHNative`）**：附件弹层会显示「最近照片」，拍照 / 相册 / 文件按钮走原生选择器。App 实现 ANDROID-BRIDGE.md 里的 `capabilities` / `recentPhotos` / `openRecent` / `pickImages` / `pickFiles`（缩略图长边 ≤240、单张 ≤40 KB 的 data URL），选中的文件经 127.0.0.1 随机端口 + 随机令牌 + 5 分钟有效 + 只读 + CORS/Range 的临时内容服务交给页面，不暴露 `content://` 或任意路径；桥缺失/失败时插件仍隐藏该区域并回退到文件选择器。
- **拍照 / 相册按钮走对系统界面**：WebView 文件选择器按 input 类型分流 —— `capture` 打开系统相机（照片写入 MediaStore 后回传给页面）、`accept="image/*"` 打开系统图片选择器（Android 13+ 的 Photo Picker，旧系统走图库），其余仍走文件选择器；多选、取消与相机返回都按 WebView 约定处理。
- **三个插件默认内置**：`dsh-mobile-shell`（App 风格移动外壳）、`dsh-archived-chat-cleanup`（已归档会话清理与附件回收）、`agnes-media`（`generate_image` / `generate_video` 工具）。新装从 seed profile 直接可用；已装设备由内置 hot overlay 补齐文件，并由 `repair-profile.mjs` 幂等补 profile 行，不需要重装或重新解包。
- 1.2.2 → 1.2.3 覆盖升级：同签名、versionCode 10219 > 10215，app 私有数据（会话、API key）保留。

### 热包（dsh-hot.zip）说明

`dsh-hot.zip` 是 **guest 侧的小脚本热覆盖**，不是 APK，也不是完整的 dsh/插件更新。1.2.3 里它包含启动脚本和三个默认插件：

- `opt/dsh/android/repair-profile.mjs`：启动时幂等修补 profile（插件依赖与 bundle 行、`android-sandbox` patch 行、OTel 禁用行；写前备份 `.bak-otel`）；
- `opt/dsh/android/start-dsh.sh`：guest 启动脚本（boot-prep 单进程、PTY 延迟启动）；
- `@home/.dsh/profiles/web/node_modules/{dsh-mobile-shell,dsh-archived-chat-cleanup,agnes-media}/`：三个默认插件的运行时文件；
- `hot.json`：热包版本 `1.2.3-t3-sp0`。

App 启动时会把它们写入 guest home，因此已装设备**不重新解包 payload** 也能拿到插件与迁移。1.2.3 APK 内已内置同一份 overlay（payload 的 seed 也带同一份，供新装直接使用）；Release 里的 `dsh-hot.zip` 仅用于手动应用或从旧版本迁移，1.2.2 的 App 不会应用 `1.2.3-t3` 这条线的热包。

### 相对上游的差异

- **PRoot**：`libproot.so` 来自 [Htao-uu/proot-write-policy](https://github.com/Htao-uu/proot-write-policy)（termux/proot 的 fork，新增写路径策略，用于没有 bubblewrap/Landlock 的 `workspace-write`）；`scripts/fetch-proot.sh` 用 sha256 固定 release 资产。
- **前端 polyfill**：`repair-dsh.mjs` 注入 `AbortSignal.any`（华为 WebView 114 需要），并把 `@deepseek-ai/dsh-sandbox-local` 配置成走策略 runner。
- **默认插件**：`dsh-mobile-shell`（移动外壳 UI）、`dsh-archived-chat-cleanup`、`agnes-media` 以 vendored 形式放在 `plugin/`，通过 `profile/package.json` 播种，并由 `repair-profile.mjs` 给已装设备补齐。
- **文件选择器**：拍照 / 相册 / 文件 input 分别路由到系统相机、系统图片选择器和文档选择器（协议见 dsh-mobile-shell 的 `docs/ANDROID-BRIDGE.md`）。
- **Runner**：`payload/usr/local/bin/sandbox-run` 把沙箱的 bwrap 风格参数翻译成 `DSH_SANDBOX_*` 标记，交由 PRoot 扩展执行。
- **启动修复**：`boot-prep.mjs`、PTY 延迟启动、`DSH_HOME` 保护（见 `docs/FINDINGS.md` §13）。
- **OTel 已禁用**：seed profile patch + `repair-profile.mjs` 幂等迁移。
- `THIRD_PARTY.md` 记录 PRoot 的来源、版本与许可。

### 构建

完整流程见 `docs/BUILD.md`：先用 `scripts/assemble_payload.sh` 组装 Ubuntu arm64 rootfs，再用 Android SDK + JDK 跑 `scripts/build_apk.sh`。当前发布使用 fork 自己的签名密钥；换钥必须卸载重装。

### 验证

```
adb devices
adb install -r -d dsh-android-1.2.3.apk
adb shell am start -n dev.dsh.android/.MainActivity
adb logcat -v threadtime | grep -E 'dsh web|127.0.0.1:3080'
```

### 许可

应用代码仍为上游 MIT（`LICENSE`）；PRoot fork 为 GPL-2.0-or-later，源码发布在上述仓库，分发本 app 的构建产物时须提供对应的 PRoot 源码。
