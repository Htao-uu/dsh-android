# 第三方组件与来源

本仓库包含或依赖以下第三方内容，版权归各自所有者：

## 仓库内

| 内容 | 来源 | 许可 |
|---|---|---|
| `assets/whale.svg` | [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web 前端 favicon（品牌标识） | MIT（标识本身是 DeepSeek 的商标） |
| `app/libs/shizuku-*.jar` | `dev.rikka.shizuku:api|aidl|shared|provider:13.1.5`，从 Maven Central 取（经 aliyun 镜像） | Apache-2.0 |
| `payload/etc/bash.bashrc` | Ubuntu 24.04 的 `/etc/bash.bashrc`，只改了一处（`$(groups)` → `id -Gn 2>/dev/null`） | GPL-3.0 |
| `libproot.so`（**不进 git；作为 release 资产按固定 sha256 取**） | 本机应用挂载路径 `/var/minis/mounts/Download/libproot.so`（266,152 B，sha256 `f6b0381a…`）—— **来源与许可待确认**：没有核对过上游出处；PRoot 本身是 GPL-2.0，这一份的实际来源与许可**待核**。见 `scripts/fetch-proot.sh` | 待确认 |
| `payload/home/.dsh/profiles/web/node_modules/dshmarket/`（vendor，固定 1.66.21） | npm [`dshmarket@1.66.21`](https://www.npmjs.com/package/dshmarket)（仓库 [github.com/dsh-market/dsh-market](https://github.com/dsh-market/dsh-market)）—— 插件市场。tarball sha256 `f75bfc1206c91b0d82b939334f1457a5c515cb0cadde75e69b15f8ee87e3da38`，解包内容与 npm tarball `diff -r` 零差异 | MIT |
| 同上的 `undici@7.30.0` / `js-yaml@4.3.2` / `argparse@2.0.1` | npm（`dshmarket` 的运行时依赖；argparse 是 js-yaml 的依赖）—— vendor 进来是为了**安装时不联网**。sha256 见 §vendor 记录 | MIT / MIT / Python-2.0 |
| `payload/usr/local/bin/pnpm`（**按需下载，不进 git**） | `@pnpm/exe.linux-arm64` 12.11.2 —— pnpm 的自包含单文件 arm64 可执行（43,403,704 B），由 `scripts/fetch-pnpm.sh` 按固定版本 + npm 的 sha512 + 二进制的 sha256 校验后下载（`.gitignore` 排除，41 MB 不进 git 历史）。只进 payload，**不发热包**（见 `scripts/make_hot_zip.py` 的 `HOT_EXCLUDED`） | MIT |

`app/libs/` 里放预编译 jar 是刻意的：这样构建不需要联网取 Maven 依赖。

**第三方站点（用户应知情）**：`dshmarket` 运行时默认会访问 **`https://awesome-dsh-plugin.com/`**
（目录 `plugins.json`、更新说明 `updates.json`，可用环境变量 `DSHM_UPDATES_ORIGIN` 覆盖），
另外也有 npm 通道（包内 `lib/catalog-npm.js`）。也就是说：市场目录的可用性依赖那个站点，
**离线时目录会取不到**（面板本身仍能打开）。这是插件自身的运行时行为，本发行版只负责预装它。

## 构建时下载

| 内容 | 来源 | 许可 |
|---|---|---|
| Ubuntu base rootfs (arm64) | cdimage.ubuntu.com | 各软件包各自的许可（主要为 GPL 与 MIT 系） |
| Node.js 官方 arm64 构建 | nodejs.org | MIT |
| `@deepseek-ai/dsh` 及其依赖 | npm | MIT（各依赖见其自身许可；其中 `@deepseek-ai/libreoffice-kit-wasm` 被打包脚本裁掉） |

## 本项目

非官方移植，与 DeepSeek 无隶属关系。「DeepSeek」「DeepSeek Harness」及其标识为 DeepSeek 的商标，
本项目使用它们仅用于说明兼容对象。
