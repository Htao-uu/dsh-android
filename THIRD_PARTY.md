# 第三方组件与来源

本仓库包含或依赖以下第三方内容，版权归各自所有者：

## 仓库内

| 内容 | 来源 | 许可 |
|---|---|---|
| `assets/whale.svg` | [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web 前端 favicon（品牌标识） | MIT（标识本身是 DeepSeek 的商标） |
| `app/libs/shizuku-*.jar` | `dev.rikka.shizuku:api|aidl|shared|provider:13.1.5`，从 Maven Central 取（经 aliyun 镜像） | Apache-2.0 |
| `payload/etc/bash.bashrc` | Ubuntu 24.04 的 `/etc/bash.bashrc`，只改了一处（`$(groups)` → `id -Gn 2>/dev/null`） | GPL-3.0 |
| `libproot.so`（**不进 git；按固定 sha256 从 release 取**） | [Htao-uu/proot-write-policy](https://github.com/Htao-uu/proot-write-policy)（termux/proot 的 fork，含写路径策略扩展），release `v1.0.0` 资产 `libproot.so`，sha256 `${sha}` | GPL-2.0-or-later（源码见该仓库；分发 APK 时必须随附或提供该源码） |
| `payload/home/.dsh/profiles/web/node_modules/dshmarket/`（vendor，固定 1.66.21） | npm [`dshmarket@1.66.21`](https://www.npmjs.com/package/dshmarket)（仓库 [github.com/dsh-market/dsh-market](https://github.com/dsh-market/dsh-market)）—— 插件市场。tarball sha256 `f75bfc1206c91b0d82b939334f1457a5c515cb0cadde75e69b15f8ee87e3da38`，解包内容与 npm tarball `diff -r` 零差异 | MIT |
| 同上的 `undici@7.30.0` / `js-yaml@4.3.2` / `argparse@2.0.1` | npm（`dshmarket` 的运行时依赖；argparse 是 js-yaml 的依赖）—— vendor 进来是为了**安装时不联网**。sha256 见 §vendor 记录 | MIT / MIT / Python-2.0 |
| `payload/usr/local/bin/pnpm`（**按需下载，不进 git**） | `@pnpm/exe.linux-arm64` 12.11.2 —— pnpm 的自包含单文件 arm64 可执行（43,403,704 B），由 `scripts/fetch-pnpm.sh` 按固定版本 + npm 的 sha512 + 二进制的 sha256 校验后下载（`.gitignore` 排除，41 MB 不进 git 历史）。只进 payload，**不发热包**（见 `scripts/make_hot_zip.py` 的 `HOT_EXCLUDED`） | MIT |

`app/libs/` 里放预编译 jar 是刻意的：这样构建不需要联网取 Maven 依赖。

**第三方站点（用户应知情）**：`dshmarket` 运行时的目录有**三条来源** —— 站点
`https://awesome-dsh-plugin.com/plugins.json`、以及两条 npm 镜像（实测回退到
`mirrors.cloud.tencent.com/npm/dsh-plugin-catalog`）；更新说明取 `updates.json`。
**实测表现**（独立环境）：
- **只封站点、npm 能通** → 目录接口**仍 200 / 约 1.0 秒 / 4.4 MB**（自动走 npm 镜像回退），**市场照常可用**；
- **完全断网** → Harness 正常启动、其它接口 5–42ms 照常；目录接口**约 27ms** 返回 502 与一句
  列明"试过哪些源、走了哪个代理、各自为何失败"的可读错误（面板仍能打开）。

可用环境变量 `DSHM_UPDATES_ORIGIN` 换源。**这是插件自身的运行时行为**，本发行版只负责预装它；
面向用户的说明（默认连哪些主机、离线表现、如何停用、以及它注册的
`/restart`·`/rollback`·`/backup`·`/restore`·`/approve-builds` 等写能力）见
[`docs/preinstalled-plugins.md`](docs/preinstalled-plugins.md)。

## 内置默认插件（vendor）

APK 默认启用以下三个插件：`profile/package.json` 的 `dependencies` + `dsh.profile.bundles`
预置它们，已装设备的 profile 由 `payload/opt/dsh/android/repair-profile.mjs` 在下次启动时
幂等补行。三个插件的**运行时文件按上游发布物原样** vendored 在 `plugin/<name>/`
（不带 test/docs/dev 文件），热包把它们写到 guest 的
`@home/.dsh/profiles/web/node_modules/<name>/`。

三者都不需要额外的第三方运行时依赖：host 半只用 node 内置模块与 `@deepseek-ai/*`
（harness 运行时提供），client 半只用 Web client 运行时提供的 `react` / `@deepseek-ai/*`
（与仓库内 `dsh-plugin-android` 同一模式），所以 vendor 目录里没有它们自己的
`node_modules`。

| 插件 | 版本 | 来源 | 许可 |
|---|---|---|---|
| `dsh-mobile-shell` | 0.6.18 | [Htao-uu/dsh-mobile-shell](https://github.com/Htao-uu/dsh-mobile-shell)（作者 Htao-uu，DSH 手机壳 UI） | MIT |
| `dsh-archived-chat-cleanup` | 1.0.0 | [Htao-uu/dsh-archived-chat-cleanup](https://github.com/Htao-uu/dsh-archived-chat-cleanup)（作者 Htao-uu，已归档会话清理） | MIT |
| `agnes-media` | 1.8.3 | 上游 [LittleBeaverStudio/agnes-media](https://github.com/LittleBeaverStudio/agnes-media)（Copyright (c) 2026 LittleBeaverStudio，Agnes 图片/视频生成工具） | MIT |

每个 `plugin/<name>/LICENSE` 都保留了上游的版权声明。`agnes-media` 是**联网**插件：调用时
会向默认端点 `https://apihub.agnes-ai.cn/v1`（可用 `AGNES_MEDIA_BASE_URL` 覆盖）发请求，
密钥读 `AGNES_MEDIA_API_KEY` / `AGNES_API_KEY`（或 DSH credentials），未配置时工具返回
可读错误而不是发请求。这是插件自身的运行时行为，本发行版只负责预装它。

## 构建时下载

| 内容 | 来源 | 许可 |
|---|---|---|
| Ubuntu base rootfs (arm64) | cdimage.ubuntu.com | 各软件包各自的许可（主要为 GPL 与 MIT 系） |
| Node.js 官方 arm64 构建 | nodejs.org | MIT |
| `@deepseek-ai/dsh` 及其依赖 | npm | MIT（各依赖见其自身许可；其中 `@deepseek-ai/libreoffice-kit-wasm` 被打包脚本裁掉） |

## 本项目

非官方移植，与 DeepSeek 无隶属关系。「DeepSeek」「DeepSeek Harness」及其标识为 DeepSeek 的商标，
本项目使用它们仅用于说明兼容对象。
