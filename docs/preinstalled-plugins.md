# 预装的插件市场会做什么（用户须知）

本应用预装了一个第三方插件市场 **`dshmarket` 1.66.21**（MIT，仓库
[github.com/dsh-market/dsh-market](https://github.com/dsh-market/dsh-market)）。
你可以在 Harness 里逛插件、点一下安装。**这份说明讲清楚它会做什么、会连哪些网、离线怎么办、怎么关掉。**

技术出处与哈希见仓库根目录 [`THIRD_PARTY.md`](../THIRD_PARTY.md)；本页只讲**行为与你的选择**。

## 1. 预装的是什么

| 项 | 值 |
|---|---|
| 包 / 版本 | `dshmarket` `1.66.21`（公开 npm 包，随应用放在 profile 的 `node_modules/` 里） |
| 来源 | `https://registry.npmjs.org/dshmarket/-/dshmarket-1.66.21.tgz` |
| sha256 | `f75bfc1206c91b0d82b939334f1457a5c515cb0cadde75e69b15f8ee87e3da38`（与 npm 上那份逐字节一致） |
| 许可 / 仓库 | MIT / `github.com/dsh-market/dsh-market` |
| 依赖 | `undici`、`js-yaml`（同样已随应用放在本地）——**安装"插件市场"本身不需要联网** |

它由两部分组成：Harness 里的一张**市场界面**，以及一组**本地服务**（读已装插件、装卸插件、备份与回滚、
重启 Harness 等）。这些都在你的设备上运行。

## 2. 默认会连哪些主机

市场**能离线启动**（界面、已装列表都在本地）；只有**拉取"可装插件目录"**和**实际安装插件**时才联网。

| 主机 | 什么时候用 | 传什么 | 能否改 |
|---|---|---|---|
| `awesome-dsh-plugin.com` | 拉"精选插件目录"（`plugins.json`）与更新说明（`updates.json`） | 就这两个 GET 请求，不含你的会话内容 | 更新说明可用环境变量 `DSHM_UPDATES_ORIGIN` 换地址 |
| `mirrors.cloud.tencent.com`、`registry.npmjs.org` | 上一条失败时的**目录回退**；安装插件时下载 npm 包 | 包名/版本查询、包下载 | 随 profile 的 npm registry 配置 |
| `github.com`、`codeload.github.com`、`gh-proxy.com`、`ghfast.top` | 当你选择**从 GitHub 仓库**安装插件时 | 仓库地址与代码包 | 由插件自身的分区（region）逻辑决定 |
| 你设置的 `HTTP_PROXY` / `HTTPS_PROXY` | 以上全部请求（若设置了） | —— | 环境变量；设了代理则所有出网都走它 |

> **目录数据来自第三方站点 `awesome-dsh-plugin.com`**，不是本应用维护的列表。
> 本应用只保证"预装的这份包与 npm 上发布的逐字节一致"（sha256 见上），
> **不保证它拉回来的插件列表内容**。装什么插件由你决定——装上的是第三方代码，会以你的权限运行。

## 3. 离线 / 网络不好时的实测表现

在 Android 真机（PRoot 沙箱）上实测过三种情况：

| 情况 | 实测表现 |
|---|---|
| 网络正常 | 目录约 **1 秒**拉到（约 4.4 MB），插件可正常安装 |
| `awesome-dsh-plugin.com` 不通、npm 能通 | **照常可用**：自动改用 npm 镜像拿到同一份目录（实测仍 200、约 1.0 秒、4.4 MB） |
| 完全断网 | Harness **正常启动**，其它功能不受影响（实测接口仍在 5–42ms 内响应）；市场拉目录失败时 **约 27ms 内**返回 **HTTP 502** 与一句人话，不会卡住界面：`fetch failed (0s, 4 attempts) · tried through the configured proxy … · earlier: npm:https://mirrors.cloud.tencent.com/npm/dsh-plugin-catalog — fetch failed · url:https://awesome-dsh-plugin.com/plugins.json — fetch failed`（把试过的源与失败原因都列出来） |

## 4. 它有哪些"能改动系统"的能力

它注册了这些**写操作**（都只在本机、经 Harness 的鉴权通道调用，界面上的按钮就是它们）：

| 路由 | 作用 |
|---|---|
| `/dsh-market/api/v1/restart` | **重启 Harness** |
| `/dsh-market/api/v1/rollback` | 回滚到之前的插件状态 |
| `/dsh-market/backup`、`/dsh-market/restore` | 备份 / 还原 |
| `/dsh-market/approve-builds` | 放行需要本地编译的插件 |
| 安装 / 卸载 / 启停插件 | 改动 profile 与 `node_modules` |

这些能力**等同于你在终端里手动做这些事**。所以：不要在不认识的人让你点的时候点"重启/回滚"。

此外，市场自己也会提示：
_Install only plugins you trust: they run with your permissions and can damage DeepSeek Harness or leak your data._

## 5. 已知风险（重要）

**① 运行时 Node 版本必须保持在 22.x。**

市场依赖 `undici@7`，而 Harness 自身的网络层依赖 `undici@8`。上游有一份**尚未解决**的报告
（[dsh-market#861](https://github.com/dsh-market/dsh-market/issues/861)）：在 **Node 24.14.1 + DSH 0.2.0-rc.2**
上加载市场之后，宿主自己的出站请求与**模型对话全部失败**（`TRANSPORT` / `Connection error` /
`could not reach …/models`），根因是两套 undici 争用全局 dispatcher 符号。

本发行版当前组合（**Node 22.23.2** + DSH 0.1.7-rc.2 + market 1.66.21）**实测未复现**：真实模型调用 3/3 正常，
两种加载顺序下三条 fetch 路径全部 200。**但这是“未复现”，不是“不存在”** —— 差异很可能就在 Node 大版本上。因此：

- **把 App 的 Node 升到 24.x 之前，必须先跑一次“启用市场 + 一次真实模型调用”的验证。**
  仓库里有现成脚本：`sh scripts/smoke-market-llm.sh`（约 10 秒；对照组与实验组各一次真实调用，失败即退出码非 0）。
- **把 DSH 升到 0.2.x 之前也要跑同一脚本**（报告环境正是 0.2.0-rc.2 + Node 24）。
- **2026-10-16 补充实测：`Node 22.23.2` + `DSH 0.2.0-rc.2` 这一组合通过了同一条冒烟脚本**
  （在隔离副本上做的升级彩排，见 [UPGRADE-DSH.md](UPGRADE-DSH.md)），所以报告里的差异确实指向
  Node 大版本而不是 DSH 版本。`scripts/upgrade-dsh.sh` 已经把这条冒烟写成升级门禁：不通过就回滚。

**② 万一出现模型/网络异常，先按官方规避处理。**

在 profile 的 patch（`cordis.patch.yml`）里禁用市场这一行，然后重启：

```yaml
- id: dsh-market
  disabled: true
```

禁用后市场界面与它的全部服务都不加载（包文件留在磁盘上，不影响其它功能），宿主网络与模型对话应立刻恢复。
如果你遇到了这个现象，把现象与日志反馈给我们 —— 这是上游未解决的冲突，不是你的配置问题。

## 6. 你可以怎么改

- **换或关掉更新说明源**：设环境变量 `DSHM_UPDATES_ORIGIN`（指向你自己的镜像，或指向一个不可达地址让它失效）。
- **让所有请求走代理**：设 `HTTP_PROXY` / `HTTPS_PROXY`（实测被它显式读取）。
- **不用这个市场**：把它从 profile 的 `dsh.profile.bundles` 里去掉即可（`node_modules` 里的文件留着不影响）。
  去掉后市场界面与它的全部服务都不会加载，目录也不会被请求。
- **只装你信得过的插件**：目录里的插件是第三方代码，安装等于让它在你的设备上以你的权限运行。
## 7. 另外三个默认内置插件（1.2.3 起）

从 1.2.3 起，APK 还默认内置并按 bundle 启用三个插件。它们和上面的市场一样，**代码随应用走、离线可用**，
来源与许可见 [THIRD_PARTY.md](../THIRD_PARTY.md)「内置默认插件（vendor）」一节。

| 插件 | 版本 | 做什么 | 联网吗 |
|---|---|---|---|
| `dsh-mobile-shell` | 0.6.18 | App 风格的移动端外壳：抽屉导航（跟手 push）、附件弹层（拍照 / 相册 / 文件 / 最近照片连选）、App 式输入框与设置页、右栏全屏 | 不联网 |
| `dsh-archived-chat-cleanup` | 1.0.0 | 删除已归档会话：级联子代理会话、按引用回收附件，整事务可回滚 | 不联网（只操作本机会话数据） |
| `agnes-media` | 1.8.3 | 注册 `generate_image` / `generate_video` 两个媒体生成工具（Agnes AI 模型） | **会联网**：默认请求 `https://apihub.agnes-ai.cn/v1` |

`agnes-media` 的说明：

- 端点可用环境变量 `AGNES_MEDIA_BASE_URL` 覆盖；密钥读 `AGNES_MEDIA_API_KEY` / `AGNES_API_KEY`（或 DSH credentials）。**没配置密钥时工具返回一条可读错误，不会发出请求**。
- 只有你（或 agent）实际调用生成工具时才会联网；插件加载本身不联网。

**不想用其中某个？** 从 profile 的 `dsh.profile.bundles` 里去掉它对应的行，然后重启 Harness 即可；`node_modules` 里的文件留着不影响其它功能。**想升级？** 它们随 APK 内置（内置热包在每次启动时补齐），也可以通过热更新包替换；版本号在设置页的版本信息里能看到。
