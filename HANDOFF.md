# HANDOFF —— dsh-android 现场交接

> 写于 **2026-10-16 11:2x（Asia/Shanghai）**，作者：本会话的 agent（模型侧），对象：**接手的人 / 下一个 agent**。
> 标注约定：**✅** = 我在这台设备上亲自跑过、有输出；**🔶** = 读代码或从别处得知但没复验；**❓** = 未验证 / 待你确认。
>
> 旧的 1.1.5 时代工作笔记（1447 行，含大量历史背景、t2 发布陷阱、悬浮球/终端改造过程）**原文保留**在
> [`docs/HANDOFF-history.md`](docs/HANDOFF-history.md)。本文只讲**现在**。
>
> 本文写的是**文件与现场**，不代替 README / BUILD / ARCHITECTURE / CHANGELOG。改动都在 `main` 上，
> 最新提交见下面 §3。

---

## 0. 三十秒版本（接手者先读这 8 条）

1. **这是什么**：DeepSeek Harness 的非官方 Android 移植。APK（WebView 外壳）+ 一个 PRoot Ubuntu 沙箱，
   沙箱里跑 `dsh web`（默认 127.0.0.1:3080）。**App 与 harness 是两个东西**，改哪边决定用哪条发布通道。
2. **你正在用的这个会话就跑在那个沙箱里** —— 替换 `/opt/dsh/node_modules` 等于抽掉自己脚下的地板，
   所以"升级沙箱里的 dsh"必须**走恢复模式**、由脚本做（§6.1）。
3. **仓库**：`github.com/itiswdwa/dsh-android`，分支 `main`，最新 `9084feb`（还有一条 t3 的修改正在收尾）。
   检出在 **`/mnt/Documents/_repo_probe/repo`**（注意：`/mnt/Documents` 是手机存储，FUSE 挂载，**不能执行**里面的文件）。
4. **版本账目当前是**：`VERSION=1.2.1`（**尚未发布**）、`VERSION_CODE=10214`、`ROOTFS_VERSION=3`
   ⇒ 版本串 **`1.2.1-t3-sp0`**。`update.json` 还停在 **1.2.0 / 10210 / t2**（故意：设备看不到还没出的版本）。
5. **这台设备的沙箱已经手工升到 dsh `0.2.0-rc.2`** ✅（0.1.7-rc.2 → 0.2.0-rc.2，离线、走恢复模式、冒烟通过），
   备份在 `/opt/dsh-backups/20261016-024027-0.1.7-rc.2/`。
6. **正在进行**：把 t3（载荷里烘 `0.2.0-rc.2`）交给 CI 出包。CI 跑了两次、都失败，
   **第 2 次失败点正是我新加的"guest 工具"步骤，根因已查明（§5）**，方案待定。
7. **最大的两个坑**：① Android 不给应用进程 `link()` → 上游的 publish 路径必须打补丁，否则文件静默变悬空软链；
   ② 手机上跑 600MB 级重活（`cp -a` + `npm i`）会把 App 拖到被 Android 杀掉、沙箱重启（§7.15）。
8. **别把密钥和 PAT 提交进去**。签名密钥在 `keystore/dsh.p12`（gitignore），PAT 在对话里明文出现过，建议轮换（§10）。

---

## 1. 运行结构（一屏图）

```
┌─ Android App (dev.dsh.android, Java + WebView) ─────────────────────────────┐
│  MainActivity/WebView ── http://127.0.0.1:<port> ──┐                        │
│  DshService（前台服务 + 通知 + 看门狗 3 次失败进恢复模式）                    │
│  BridgeServer（控制桥，loopback 8399，每进程一个 x-dsh-token）               │
│   ├ /snapshot /logs /server/{start,stop,restart} /panel /ui /ball/*        │
│   └ /recovery/{status,start,stop,token}      ← 恢复模式的控制面              │
│  BallService（悬浮球，独立窗口，ball_doing 单行状态）                        │
│  Payload（载荷解包 + 热包覆盖）      Proot（用 lib/arm64-v8a/libproot.so）   │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ proot -0 -r <runtime> ... /bin/bash start-dsh.sh
┌─ 沙箱（PRoot Ubuntu 24.04, arm64）───────────────────────────────────────────┐
│  /usr/local/bin/node 22.23.2（官方）                                         │
│  /opt/dsh/                                                                  │
│   ├ node_modules/@deepseek-ai/dsh  ← 现为 0.2.0-rc.2（手工升的）             │
│   ├ android/{start-dsh.sh, pty-server.mjs, recovery.sh, recovery-console.html,
│   │          repair-dsh.mjs, repair-profile.mjs, linkfix.so, liblinkfix.so}  │
│   └ dsh-home-seed/  ← 播种 profile（首次启动拷进 /root/.dsh）                │
│  /root/.dsh/         ← 用户数据：sessions / profiles / skills / 凭据 / 附件  │
│  dsh web 0.0.0.0?不，127.0.0.1:3080   pty-server 127.0.0.1:3099（终端）      │
│  恢复模式：不加载 harness，起 sshd 0.0.0.0:8022 + pty console               │
└─────────────────────────────────────────────────────────────────────────────┘
```

**两种"进沙箱"的入口**：正常模式的 harness（3080）、恢复模式（8022 + 手机内控制台）。
两者**不会同时在用**：恢复模式期间 harness 不在运行。

---

## 2. 版本模型与当前账目

三段式 `<app>-t<terminal>-sp<n>`（例如 `1.2.0-t2-sp1` = 1.2.0 这条应用线、t2 这条运行时线、第 1 个热包）。
渲染全部走 `scripts/version.py`，**不要手写版本串**。

| 账本 | 现在 | 含义 |
|---|---|---|
| `VERSION` | **1.2.1** | 应用版本（**未发布**；1.2.0 是线上最新） |
| `VERSION_CODE` | **10214** | 设备比较的是它；1.2.1 这条线原地重发过（10211/10212/10213 都在别人机器上出现过），所以它落在仓库里 |
| `ROOTFS_VERSION` | **3**（t3） | 运行时线。t3 = 载荷里的 harness 钉到 `0.2.0-rc.2` |
| `HOT` | `1.2.0-t2-sp15`（hash `6406cc6356d10fc4`） | 上一次热包账本，**属于 1.2.0-t2 线**，本次没动 |
| `update.json` | app `1.2.0/10210`、terminal `2/t2`、hot `1.2.0-t2-sp15` | App 轮询的清单。**故意没提前打 1.2.1**：APK 还不存在时提前改会让设备循环下载一个 404 |
| `scripts/version.py` 输出 | `1.2.1-t3-sp0`，code `10214` | ✅ |

**已发布**：`t2`（载荷 `payload.zip` 194,782,033 B）、`v1.2.0`（全量 APK + 瘦包 + `dsh-hot.zip` + `SHA256SUMS`），
以及更早的 `v1.1.3–v1.1.5`。远端 tags：`t2 v1.1.3 v1.1.4 v1.1.5 v1.2.0 v1.2.1`。

**设备上实际装的**：`versionCode=10211 versionName=1.2.0` ✅（比仓库旧两代；`1.2.1` 的瘦包已在
`/sdcard/Download/dsh-android-1.2.1-slim.apk`，2,130,618 B，**没装**）。
**设备沙箱里的运行时**：`/opt/dsh/node_modules/@deepseek-ai/dsh` = **0.2.0-rc.2** ✅。

三条发布通道（细节见 BUILD.md）：`release_hot.sh`（只换插件/脚本，应用内一键）、
`release_terminal.sh`（换载荷，tag `t<N>`）、`release.sh`（换 APK，tag `v<VERSION>`）。

---

## 3. 仓库 / 远端 / 最近提交

```
远端   https://github.com/itiswdwa/dsh-android   （main）
检出   /mnt/Documents/_repo_probe/repo           （在手机上；/mnt/Documents 是 FUSE，不能执行文件）
工作树 干净（写本文时 0 个未提交改动）

9084feb  CI 修 apksig 的下载地址：它在 Google Maven，不在 Maven Central
7b700ee  CI 也能构建载荷：注册 binfmt + qemu，guest 工具那步按"能不能执行"判断
22b4aef  t3：载荷里的 harness 钉到 0.2.0-rc.2，并补上 prepare_rootfs.sh 一直缺的 guest 工具步骤
25eebac  docs: 记录 0.1.7-rc.2 → 0.2.0-rc.2 的真机升级实录（离线、冒烟通过）与踩到的两个 bug
53b91c4  upgrade-dsh.sh 修两个把自己卡住的 bug（都是第一次真机跑的现场）
fb58a92  upgrade-dsh.sh：支持用预下载的树离线升级（--bundle / bundle-<版本>/）
01db8b7  升级 dsh 用恢复模式的脚本：先备份，装完逐项校验 + 市场冒烟，失败自动回滚，也可 rec 手动回滚
031042d  CI：用 setup-node 固定宿主 Node 22.23.2
e2ccd7c  1.2.1：恢复模式 + 瘦包先行补全量包的 CI + versionCode 落到仓库
```

**tag 注意**：`v1.2.1` 已经被我**强制挪到 `7b700ee`**（原来指着 `031042d`）。原因：CI 是**照 tag 检出**的
（`release-full.yml` 里 `ref: ${{ github.event.release.tag_name || inputs.tag }}`），tag 不挪就会构建旧代码。
这个 tag 从没发布过 release，所以挪动无副作用 🔶（是我的判断，未与作者确认）。

---

## 4. 这台设备上的现场

| 项 | 现状 | 怎么看 |
|---|---|---|
| harness | **在跑**（3080 ✅ / pty 3099 ✅ / 桥 8399 ✅） | `env \| grep DSH_`；`node -e 'net.connect(3080)'` |
| 沙箱里 dsh | **0.2.0-rc.2** ✅（762M） | `node -p "require('/opt/dsh/node_modules/@deepseek-ai/dsh/package.json').version"` |
| 硬链接补丁 | 4 处都在 ✅（fs-local / session-persistence ×2 / attachment-local） | `grep -c LINK_UNSUPPORTED_CODES …` |
| 升级备份 | `/opt/dsh-backups/20261016-024027-0.1.7-rc.2/`（234M） | `ls -d /opt/dsh-backups/*/` |
| 升级工具 | `/root/.dsh-upgrade/`：`upgrade-dsh.sh`、`apply-hardlink-patch.py`、`smoke-market-llm.sh` | |
| 预下载包 | `/root/.dsh-upgrade/bundle-0.2.0-rc.2/`（527M，543 包） | 离线升级用；确认没问题后可删 |
| npm 缓存 | `/root/.dsh-upgrade/npmhome/.npm`（246M） | 可删 |
| 挪开的旧树 | `/opt/dsh/node_modules.replaced-20261016-024041`（234M） | 可删（备份才是回滚用的那份） |
| root 密码 | `*`（已锁）✅ | `sudo grep '^root:' /etc/shadow` |
| 8022（恢复模式 sshd） | 关闭 ✅（没在跑） | 恢复模式一进一出后**务必复查**（§7.7） |
| 磁盘 | `/opt` 可用 ~157G | |
| App 版本 | `10211` / `1.2.0` ✅ | `shiz dumpsys package dev.dsh.android \| grep version` |

**恢复模式的现场细节**：令牌每次进入时随机生成、退出即失效；面板会显示令牌 + `ssh -p 8022 root@<手机IP>`
与 `adb forward tcp:8022 tcp:8022`；手机内控制台是 `recovery-console.html`（行模式终端）。
自动进入：连续 3 次启动失败（`RecoveryPlan.FAILURE_THRESHOLD`，10 分钟窗口）或看门狗触发。
**退出恢复模式后 harness 会用当时的 `/opt/dsh` 起来** —— 也就是说恢复模式里改过的运行时，退出即生效。

---

## 5. 进行中：v1.2.1 与 t3 的发布（CI）

**目标**：出一个新 APK，载荷（t3）里**自带 dsh `0.2.0-rc.2`**，这样新装的设备不再需要手工升级。

**做了什么**（都在 main 上）：`prepare_rootfs.sh` 钉 `@deepseek-ai/dsh@0.2.0-rc.2`（`DSH_VERSION` 可覆盖）、
`ROOTFS_VERSION=3`、`VERSION_CODE=10214`、CHANGELOG 加「运行时（t3）」段、`docs/BUILD.md` / `docs/verify-ondevice.sh`
同步、`release-full.yml` 加 `docker/setup-qemu-action`（让 x86_64 runner 能执行载荷里的 arm64 二进制）。

**Secrets 已配好** ✅（3 个：`ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS`）。

**触发方式**（PAT 需 `Actions: write` + `Secrets: read`）：

```sh
curl -sS -X POST -H "Authorization: Bearer $PAT" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/itiswdwa/dsh-android/actions/workflows/release-full.yml/dispatches \
  -d '{"ref":"main","inputs":{"tag":"v1.2.1","dry_run":"true"}}'
```

### 两次 dry run 的结果

| # | run | 结果 | 失败步骤 | 根因 | 状态 |
|---|---|---|---|---|---|
| 1 | [38843322563](https://github.com/itiswdwa/dsh-android/actions/runs/38843322563) | 失败（44 秒） | 6. 交叉编译器 + apksig | apksig 从 `repo1.maven.org`（Maven Central）下载 → **404**。它只在 **Google Maven** 上 | ✅ 已修：`dl.google.com/android/maven2/...`，并把该步整段在本机跑通（下载 506,609 B、`sha256sum -c` 通过） |
| 2 | [38843590230](https://github.com/itiswdwa/dsh-android/actions/runs/38843590230) | 失败 | 12. 准备 rootfs | **guest 工具那一步**（我新加的）——见下 | ❌ **未修，方案待定** |

### 第 2 次失败的根因（本轮查明，三条各自独立）

1. **`\;` 不是命令分隔符**。脚本里写的是
   `proot … /usr/bin/env -i PATH=… apt-get update -qq \; apt-get install -y …` ——
   转义后的 `;` 会被当成**普通参数**传给 `env`，`apt-get` 收到 `update -qq ; apt-get install …` 一坨，
   第二条命令**根本没执行**。正确写法是 `… /bin/sh -c "apt-get update -qq && apt-get install -y …"`。
2. **`build/proot/libproot.so` 不是可用的 proot CLI**。它是**给 Android bionic 用的** PRoot，
   App 把它当 native library 打包、由 app 自己执行（`Proot.java: LIB_NAME = "libproot.so"`）。
   在沙箱里（或在 CI runner 上）直接执行会失败：本机实测
   `cannot execute: required file not found`（即使复制到 `/tmp` 并 `chmod +x` 也一样）✅。
   → **`prepare_rootfs.sh` 里的 proot 路线在沙箱与 CI 上都跑不通。**
3. **仓库在 FUSE 上**。`/mnt/Documents` 是手机存储（FUSE），**不允许可执行位**：`chmod +x` 后仍是
   `-rw-rw----` ✅；而且在那里跑 600MB 级构建又慢又危险（§7.15）。而 `chroot` 在**本机是可行的**
   （`chroot / /bin/echo` → 成功 ✅），CI 上 `sudo chroot` + binfmt 也可行。

### 待选方案（**接手者要先定这个**）

| 方案 | 做法 | 代价 / 风险 |
|---|---|---|
| **A. chroot**（设备上可行） | guest 工具步骤改成 chroot（本机 fake-root 就能 chroot；CI 用 `sudo chroot`），rootfs 必须先落到 **app 私有存储**（不能放 `/sdcard`），临时写一份 `etc/resolv.conf` | rootfs 602M 要复制到私有存储（内存/IO 压力，见 §7.15）；dpkg postinst 可能想要 `/proc`、`/dev` |
| **B. 真正的 glibc proot CLI** | 取一个能在沙箱里跑的 `proot`（Ubuntu 包/tag 的 release），而不是 app 那份 bionic `.so` | 多一个外部依赖要钉版本/哈希 |
| **C. 把 guest 工具做成预置 tarball**（**我倾向这个**） | 现在这台设备上就有一份**装好全部工具**的 t3 等价 rootfs 来源：老构建树 `/mnt/Documents/dsh-full/dsh-android/build/rootfs-ubuntu`（602M，含 git/curl/python3/tmux/sshd ✅）。把它的 `usr/`、`bin/`、`lib/`、`etc/` 里属于这些包的部分打成**发布资产/仓库内 tarball**，构建时**只解包、不执行任何目标二进制** | 需要在某处存一份 tarball（几十 MB）；但**任何主机都能构建**，最可复现 |
| **D. 先不烘 t3** | 保持"设备侧用 `upgrade-dsh.sh` 手工升"，APK 里仍是 0.1.7-rc.2 | 不解决"新装设备拿到旧 harness" |

> 无论选哪个，**guest 工具的"装完硬校验"都留着**：缺 `sshd` 的载荷表现是"恢复模式起不来"，
> 必须在构建时就失败（这正是这次发现的真问题：这个步骤以前是**手工**做的，仓库脚本里没有）。

---

## 6. 运行手册（Runbook）

### 6.1 升级沙箱里的 dsh（**走恢复模式，可回滚**）

脚本：`scripts/upgrade-dsh.sh`（每次会把自己和补丁/冒烟脚本放进 `$HOME/.dsh-upgrade/`）。
**先下好目标版本**（免得恢复模式里还要联网）：

```sh
cd "$HOME/.dsh-upgrade" && mkdir -p bundle-0.2.0-rc.2
cp /opt/dsh/package.json /opt/dsh/package-lock.json bundle-0.2.0-rc.2/
cd bundle-0.2.0-rc.2
HOME="$HOME/.dsh-upgrade/npmhome" npm i --no-audit --no-fund \
  --os=linux --cpu=arm64 --libc=glibc "@deepseek-ai/dsh@0.2.0-rc.2"
```

然后**两条命令**（同一条命令会按"有没有待办标记 / 桥说在不在恢复模式"自己选阶段）：

```sh
# ① 普通模式（应用内的沙箱终端）
sh /mnt/Documents/_repo_probe/repo/scripts/upgrade-dsh.sh      # 检查 → 问 y → 调桥进恢复模式（会话会断）
# ② 恢复模式（面板「手机内控制台」，或 ssh -p 8022）
sh /root/.dsh-upgrade/upgrade-dsh.sh                           # 备份 → 换树 → 打补丁 → 校验 → 市场冒烟 → 自动退出恢复模式
# 想回滚
sh /root/.dsh-upgrade/upgrade-dsh.sh rec
```

它**逐项校验**：版本、`lib/bin.js` 入口、`web --no-open/--host/--port/--trusted-host`（`start-dsh.sh` 靠这四个）、
四个发布点的硬链接补丁、Node 主版本必须是 22。任一失败 → **自动回滚**（`--keep-broken` 可保留现场）。
日志：`$HOME/.dsh-upgrade/upgrade.log`。细节与实测记录见 [`docs/UPGRADE-DSH.md`](docs/UPGRADE-DSH.md)。
⚠️ **注意**：换 t（装全量包/新终端版本）会把手工升的版本覆盖回载荷里的那份。

### 6.2 进 / 出恢复模式（手机上）

- 面板（≡ 按钮）→「进入恢复模式」；harness 在跑时 ≡ 是隐藏的，可以先停止服务（通知栏里能停）。
- 或在普通模式的终端里跑 `upgrade-dsh.sh`（它会替你调 `POST /recovery/start`）。
- 恢复模式里：面板自动弹出（有令牌 + 命令），点「手机内控制台」用行模式终端；SSH 也行。
- 退出：面板「退出恢复模式」，或 `POST /recovery/stop`（`upgrade-dsh.sh` 成功时会自动调）。
- **退出后务必复查**：`root` 密码回到 `*`、8022 关闭（§7.7）。

### 6.3 本机构建（**必须在 app 私有存储，不要在 `/sdcard`**）

```sh
sh scripts/prepare_rootfs.sh                              # ubuntu-base + node + guest 工具 + dsh（见 §5 的待定方案）
DSH_ROOTFS=… sh scripts/assemble_payload.sh                # 打补丁 + 覆盖 payload/ + 播种 profile + 自检
python3 scripts/make_payload_zip.py <rootfs> build/payload-assets/payload.zip
SLIM=1 sh scripts/build_apk.sh                             # 瘦包（~2.1MB）
sh scripts/build_apk.sh                                    # 全量（~197MB，含载荷 + hot.zip + update manifest）
```

工具链默认值（都可以用环境变量覆盖）见 §9。`build_apk.sh` 会自己生成 `hot.zip`（`--base`，恒 sp0）、
`BuildInfo.java`、图标，然后 sign（v2+v3，`Sign.java` + apksig，不依赖 apksigner）。

### 6.4 发布

```sh
DSH_SLIM_ONLY=1 sh scripts/release.sh      # 只发瘦包（给 release.sh 的 tag 由 DSH_RELEASE_TAG 指定）
sh scripts/release_terminal.sh             # 换载荷 → tag t<N>（资产 payload.zip + payload.manifest + SHA256SUMS-terminal）
sh scripts/release_hot.sh                  # 热包（tag/release 随应用线）
```
CI（`release-full.yml`）现在也能干全量包这一份：`release: published` 或 `workflow_dispatch`
→ 判断该不该构建（`scripts/ci_plan.py`，幂等）→ 构建 → 挂资产 → **补 `update.json`**（`ci_patch_update_json.py`）
→ 回读验证。**`update.json` 不更新的话设备看不到新版本**（App 比的是 versionCode）。

### 6.5 验证（本机可跑的那些）

```sh
sh -n scripts/*.sh scripts/*/*.sh            # 所有 shell（注意 dash 语法，不是 bash）
python3 docs/release-notes-test.py           # 11 checks：CHANGELOG → release 正文
python3 scripts/ci_plan.py …                 # 5 个场景（有/无全量、t2、dispatch…）
node --check payload/opt/dsh/android/pty-server.mjs
# JVM 纯逻辑单测（RecoveryPlanTest 48 checks 等）用 javac 直接编、main 里断言
sh docs/verify-ondevice.sh                   # 真机核对清单（EXPECT_APP=1.2.1 EXPEC_CODE=10214 已改成 t3）
```

### 6.6 回滚

- **运行时**：`sh /root/.dsh-upgrade/upgrade-dsh.sh rec`（从 `/opt/dsh-backups/` 恢复，恢复后自动复验）。
- **应用**：APK `versionCode` 只能升不能降 —— 要回退就装一个 `versionCode` 更大的旧功能包，
  或用 `/sdcard/Download/dsh-ROLLBACK-1.1.5-before-merge.apk` 这类历史包（会丢数据，自己权衡）。
- **版本账本**：改 `VERSION` / `VERSION_CODE` / `ROOTFS_VERSION` / `HOT` / `update.json` 后必须**一起**想清楚
  （App 比 versionCode；`update.json` 决定设备看到什么）。

---

## 7. 陷阱清单（每条都标了"怎么发现的"）

| # | 现象 | 根因 / 规避 |
|---|---|---|
| 1 | `write` 工具报成功但文件是**悬空软链**；附件/子会话发布失败 | Android SELinux 不给应用 `link()`。载荷里的树对上游 4 个 publish 点打了补丁（`patches/apply-hardlink-patch.py`，`copyFile(..., 1)` 替代 link）✅。**换 dsh 版本后必须重打**，脚本会在锚点对不上时**拒绝**（fail-closed） |
| 2 | 用 PRoot `--link2symlink` 想让 link 成功 | 它返回一个**指向 staging 的软链**，调用方随后删掉 staging → 文件静默变悬空。**别开** |
| 3 | 载荷缺 `git`/`sshd`（新装设备恢复模式起不来） | guest 工具**历来是手工装的**，`prepare_rootfs.sh` 里没有这一步（§5）。现在脚本里有 + 硬校验 |
| 4 | CI 里 `apt-get update -qq ; apt-get install …` 只跑了第一条 | shell 里写 `\;` 得到的是**普通参数**，不是分隔符。用 `sh -c "… && …"` |
| 5 | 直接在沙箱/CI 里跑 `build/proot/libproot.so` → `cannot execute: required file not found` | 它是 **bionic** 二进制（App 的 native library），只该由 App 执行 |
| 6 | `chmod +x` 后文件仍不可执行 | 仓库在 `/mnt/Documents`——**FUSE/手机存储不允许可执行位**，也不能当构建目录。构建放进 app 私有存储 |
| 7 | 退出恢复模式后 `root` 密码字段仍是哈希、8022 还开着 | 10211 那版 `start-dsh.sh` **没有"正常启动时锁一次"**（1.2.1 加了）；且应用停沙箱是直接杀进程，恢复脚本的 trap 可能没机会跑。**每次进出恢复模式后手工复查**：`printf 'root:*\n' \| chpasswd -e` |
| 8 | 应用留下**孤儿** PRoot 树 / harness（实测一次留下 2 棵恢复树 + 1 个孤儿 harness） | `ServerBus` 在连续重启时丢掉旧进程引用，`--kill-on-exit` 没机会生效（1.2.1 修了一部分，装新 APK 才会生效）。**清理**：按 `DSH_PORT` 认领自己的 harness，别用会匹配到自己 shell 的模式 |
| 9 | 明明在恢复模式，脚本却说"harness 正在运行" | 孤儿 harness 占着 3080，端口/进程探针被骗。**判定要以桥的 `/recovery/status` 为准**（`upgrade-dsh.sh` 已按这个改） |
| 10 | 应用内终端"连接已断开" | pty 服务随沙箱重启消失；`App` 的 pty 令牌**每个 app 进程重新生成**，页面拿的是旧值。点重连或**关掉标签重开**；另外 3099 被旧实例占着时新实例起不来（`EADDRINUSE`） |
| 11 | 改脚本时"锚点不唯一/找不到"，明明看着一样 | 用 `sed 's/^/  /'` 加前缀看输出后**数缩进会错**（我栽过两次）。用 `python3 -c "print(repr(...))"` 看**真实字节** |
| 12 | `git push --force-with-lease` 报 `stale info` | 本地 remote-tracking 过期（用 URL 直推时它不更新）。用 `--force-with-lease=main:<远端真实 sha>` |
| 13 | commit message 被截断、`root: command not found` | `-m "…含 ASCII 双引号…"` 把 shell 引号提前闭合了。用 **heredoc + `-F`**，正文里用「」代替 `"` |
| 14 | 清理进程时把自己的 shell 杀了 | `pkill`/`grep '[p]attern'` 会匹配到**执行这条命令的 shell**（它的 cmdline 里就有那个 pattern）。按 `/proc/*/exe` 过滤，或只 kill 显式 pid |
| 15 | **手机卡住/沙箱重启**（2026-10-16 实测：harness pid `18576`→`23553`） | 在沙箱里跑重活（602MB `cp -a` + `npm i` ≈ 2.5GB IO）时，设备内存已经很紧（15.3G 总、**空闲 208M**、swap 已用 6.2G）→ Android 杀掉 App。**重活交给 CI**；本机做就分步、每步前看 `free -m` |
| 16 | 本机 `aapt2` 跑不了 | 它是 **x86_64** 二进制 → 设备上经 `qemu-x86_64`（`AAPT2_RUNNER` 可覆盖）；CI 的 x86_64 runner 反而原生 |
| 17 | 发了 release 但设备"检查更新"没反应 | `update.json` 没更新（App 比 versionCode）；或 `app.url` 指向的 tag 上没有那个资产 |
| 18 | `releases/latest/download/...` 404 | `latest` 是"最近发布的 release"，曾被 `t2`（只有 payload）占着 → `app.url`/`hot.url` 全 404。发版时注意把带完整资产的 release 标 latest（或前一个也行） |
| 19 | 热包跨应用线不生效 | App 侧 `sameLine` 按 `<app>-t<terminal>-` 前缀判断：t2 设备收不到 t3 热包 |
| 20 | 恢复模式里"会话列表空了、不能对话" | 预期行为：恢复模式**不加载 harness**，它是在"修"而不是"用" |

---

## 8. 未决与待办（按优先级）

1. **定 §5 的 t3 guest 工具方案（A/B/C/D）并让 CI 出包**。这是当前唯一挡在 `1.2.1` 发布前的事。
   （`binfmt` 那步已经成功；失败在第 12 步，前 11 步全绿 ✅）
2. **发布 v1.2.1**：dry run 通过后跑非 dry run —— 它会创建 `v1.2.1` release、上传资产、并把
   `update.json` 打到 1.2.1/10214。**这一步会让设备看到更新**，要作者点头。
3. **设备侧**：装 `1.2.1` 的瘦包（`/sdcard/Download/dsh-android-1.2.1-slim.apk`）——
   它带"启动时自愈锁 root 密码"和 `ServerBus` 收进程的修复，正是 §7.7/§7.8 两个现场问题的解药。
   **瘦包不带载荷，不会把 0.2.0-rc.2 冲掉** ✅ 这点是设计使然。
4. **审计 backlog（8 条，都还没做）**：`/snapshot` 的 ZipFile/fd 泄漏 + `applyHot` 在主线程；
   导出的 `MainActivity` 接受 `EXTRA_PROMPT`（注入面）；WebView<116 的 `AbortSignal.any` 垫片；
   热包瘦身（81% 是未改动的 vendored 依赖）；`assemble_payload.sh:53` 的 seed 深度 bug + `/root/.dsh/.dsh` 残留；
   xterm 死重量（终端已重写，`@xterm/*` 不再被加载，但 `assemble_payload.sh` 的自检还要求它在）；
   `/snapshot` 里 API key 的遮蔽；`allowBackup=false`（issue #5 CWE-312）。
5. **可以回收的磁盘**（确认新版无问题后）：预下载包 527M + npm 缓存 246M + `node_modules.replaced-*` 234M；
   **备份 234M 建议留着**（`rec` 靠它）。
6. **PAT 轮换**（§10）；把 `docs/HANDOFF-history.md` 里已被取代的口径（t2 版本线、`releases/latest` 的旧做法）
   在下次真发版后再核一遍。

---

## 9. 环境与工具链（这台设备 = 沙箱）

| 东西 | 位置 / 版本 |
|---|---|
| JDK | `openjdk-21-jdk-headless`（`javac`/`keytool` 可用） |
| android.jar | `/tmp/platform/android-36/android.jar`（27,768,026 B） |
| aapt2 | `/tmp/aapt2dir/aapt2`（x86_64，经 `qemu-x86_64`；`QEMU_LD_PREFIX` 指向解出来的 Debian 库） |
| d8 / r8 | `/tmp/r8.jar`（9.5.26，sha256 `3502f087388ce95bbf5254555927f09385dc2636873964d0bd53f3eaf4fb49ad`） |
| apksig | `/tmp/apksig.jar`（9.4.1，sha256 `7ae2e5980c77d853e3513074ee7c822bbdcdcde1668889d17faa7fe8bc8aa821`，**Google Maven**） |
| 签名密钥 | `keystore/dsh.p12`（PKCS12，口令 `dshandroid`，别名 `dsh`；证书 SHA-256 `3B:04:AC:2C:41:52:E5:79:35:16:A1:EC:E4:E9:41:25:7D:61:3A:B9:E4:42:92:A9:E7:41:6D:E0:68:48:CA:62` —— 与线上 v1.2.0 同一个，所以可原地覆盖升级） |
| proot | `build/proot/libproot.so`（**bionic**，只给 App 用；见 §7.5） |
| 老构建树 | `/mnt/Documents/dsh-full/dsh-android`（2.2G；含 602M 的 `build/rootfs-ubuntu`，**已经装好 guest 工具**，是方案 C 的现成来源） |
| t2 载荷 | `/mnt/Documents/_repo_probe/repo/build/payload-assets/payload.zip`（194,782,033 B）+ `payload.manifest`（1,350,283 B） |
| apt 源 | `scripts/restore-build-toolchain.sh` 会把源改成 `mirrors.aliyun.com/ubuntu-ports/`（这台设备直连 archive.ubuntu.com 很慢） |
| 网络注意 | 手机上可能是 VPN fake-IP（`198.18.0.0/15`）：`web_fetch` 会拒绝，改用 `node -e 'fetch(...)'`；GitHub 的 **日志 blob 主机**（`productionresultssa*.blob.core.windows.net`）在这里常被重置，CI 日志可能拉不下来（**用 run 页面看**） |

---

## 10. 安全与卫生

- **PAT**：作者在对话里贴过一个 full-access PAT（明文）。建议**轮换**。仓库 `origin` URL 是干净的（没有 token）；
  我推送时用 `git -c http.version=HTTP/1.1 push https://x-access-token:$PAT@…`（偶尔 TLS 会断，重试即可）。
- **签名密钥**：只在 `keystore/`（gitignore）+ GitHub Secrets（3 个）。**永远别提交**；
  之前为了手工配 Secrets 生成过一份 base64 到 `/sdcard/Download/dsh-keystore-base64.txt` ——
  **确认没用就删掉**（那是密钥的明文副本，落在手机共享存储上）❓（我没删，不知道作者是否已删）。
- **恢复模式的密码**：每次进入新生成、退出即失效；`/etc/shadow` 里应是 `*`。8022 **按需开**，用完关（§7.7）。
- **恢复模式是 root shell**：同一 Wi-Fi 下谁能拿到令牌谁能进。局域网不可信时**别开着**。
- 沙箱预装 `pnpm`、git、curl、python3、tmux —— 对用户是功能，对攻击者是工具，注意 profile 里装的第三方 bundle。

---

## 11. 来源与延伸阅读

- 架构与运行结构：[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- 构建（含各步骤在做什么）：[`docs/BUILD.md`](docs/BUILD.md)
- 恢复模式（含密码三层保证、实测记录）：[`docs/RECOVERY.md`](docs/RECOVERY.md)
- 升级 dsh（恢复模式 + 离线 + 回滚 + 真机实录）：[`docs/UPGRADE-DSH.md`](docs/UPGRADE-DSH.md)
- CI（通道、Secrets、`update.json` 谁负责）：[`docs/CI.md`](docs/CI.md)
- 预装插件与市场风险（undici 争用）：[`docs/preinstalled-plugins.md`](docs/preinstalled-plugins.md)
- Android 平台的硬约束（link/PRoot/内存）：[`docs/FINDINGS.md`](docs/FINDINGS.md)
- 版本与发布历史：[`CHANGELOG.md`](CHANGELOG.md)
- **1.1.5 时代的工作笔记（历史）**：[`docs/HANDOFF-history.md`](docs/HANDOFF-history.md)
