# dsh-mobile-shell UI 插件交接文档

更新时间：2026-10-22  
当前版本：**0.6.10**  
仓库：<https://github.com/Htao-uu/dsh-mobile-shell>  
npm：`dsh-mobile-shell`（latest = 0.6.10）

> 本文覆盖 **UI 插件（Web 客户端）** 的开发、调试、发布和已知坑。  
> 详细的交互设计见 `docs/DESIGN.md`，构建流程见 `docs/WORKFLOW.md`，  
> Android 原生桥协议见 `docs/ANDROID-BRIDGE.md`。

---

## 1. 交付物与当前状态

| 交付物 | 说明 |
|---|---|
| npm 包 | `dsh-mobile-shell@0.6.10`，已发布 |
| GitHub | `main` = `fb21f77`，tag `v0.6.10` |
| Android APK | `dsh-android-1.2.3-0.6.6-nohot.apk`，versionCode **10218**，已移除 `assets/hot.zip` |
| 手机测试环境 | 本地 0.6.10 已装到 profile；npm 版本与 GitHub 一致 |

APK 插件基线是 **0.6.6**；0.6.7–0.6.10 是 UI 实验改动，通过 npm/本地 tar 更新，不进入 APK 内置热包。

**重要：白屏问题尚未解决**，0.6.10 的预加载是实验性实现，不要当成“已修复”继续发布。

---

## 2. 插件是怎么被 DSH 加载的

- 包必须是 DSH 插件：`package.json` 里有 `dsh.bundle.patch` 和 `dsh.client`；
- `dsh.client.platform = "web"`，DSH Web 启动时通过 `window.__ModuleLoader__.load({id, factory})` 加载 `lib/client.js`；
- `lib/client.js` 是**单文件构建产物**，由 `scripts/build.mjs` 把 `src/client.js.tpl` + `src/styles.css` 内联生成；
- 插件只应通过宿主公开 API 或稳定 DOM 锚点工作，**不要直接依赖 hash class 全名**（如 `_sidebarCol_ab12`），用 `[class*="_sidebarCol"]`；
- 当前 `exports.inject = ["layout", "uiWorkspace", "workspaces"]`；如需读写会话数据可再加 `"sessions"`。

---

## 3. 目录与构建

```text
dsh-mobile-shell/
├─ src/
│  ├─ client.js.tpl      # 源码（不是 .js，构建时转成 IIFE bundle）
│  └─ styles.css         # 所有移动端样式
├─ lib/client.js         # 构建产物，提交到 git & npm
├─ scripts/build.mjs     # 构建脚本
├─ docs/
│  ├─ HANDOVER.md        # 本文
│  ├─ DESIGN.md
│  ├─ WORKFLOW.md
│  ├─ ANDROID-BRIDGE.md
│  ├─ GLOSSARY.md
│  └─ images/
├─ package.json
└─ README.md
```

构建：

```sh
cd dsh-mobile-shell
node scripts/build.mjs
node --check lib/client.js
```

**每次改 `src/` 必须重新 build 并提交 `lib/client.js`**。npm 包只发 `lib/`，不发 `src/`。

---

## 4. 代码地图（src/client.js.tpl）

| 区域 | 关键函数 | 作用 |
|---|---|---|
| 样式注入 | `styleOnce`, `scrimOnce` | 注入唯一 style/scrim；重复 apply 不重复插 |
| 图标/按钮 | `cloneIcon`, `iconFor`, `makeButton` | 复用宿主 SVG，避免自己画一套 |
| 左栏预加载 | `ensureSidebarMounted`, `forceMountSidebar`, `preloadSidebar`, `repairLeftHost` | 让宿主 sidebar 常驻/展开（实验，见 §13） |
| 左栏状态 | `openLeftVisual`, `closeLeftVisual`, `toggleLeft` | 只控制视觉状态 `leftVisible` 和 class |
| 右栏状态 | `openRight`, `closeRight` | 走宿主 `[data-sidebar-right-expand/toggle/open]` |
| 顶栏 | `ensureTopButtons` | 往 header 注入 `.dms-menu/.dms-panel/.dms-plus` |
| 设置页 | `settingsChrome`, `ensureSettings`, `installSettingsWatcher`, `openSettingsSection`, `settingsBack` | 接管官方设置弹层，改成 App 式列表/子页 |
| 手势 | `installGestures` | 左/右抽屉拖动、speed cap、spring |
| 返回栈/退出 | `installBackStack`, `installExitGuard` | Android back → 关抽屉/设置/附件，再退出 |
| 键盘 | `installKeyboard` | visualViewport + `--dms-kb` |
| 附件 | `installAttachSheet` | 底部弹层、最近照片、拍照/相册/文件 |
| 自动关栏 | `installDrawerAutoClose` | 点侧栏条目后自动收 |
| 长按 | `installLongPress` | 会话行/消息长按出宿主菜单 |
| 宿主同步 | `sync` | 400ms 低频率校正，不是 MutationObserver |
| 调试 | `installDebug` | `?dms-debug` 显示左下角 badge |

---

## 5. 宿主 DOM 锚点（目前用到的）

| 锚点 | 用途 |
|---|---|
| `[class*="_frame"]` | 判断 host 侧栏是否折叠：`data-sidebar-collapsed` |
| `[class*="_sidebarCol"]` | 左栏元素 |
| `[class*="_rightbarCol"]` | 右栏元素 |
| `[class*="_centerCol"]` | 内容列/页面平移对象 |
| `[data-composer-card]` / `[data-composer-seat]` | 输入框卡片 |
| `[data-composer-placeholder]` | 判定冷启动是否没选工作区 |
| `[data-shortcut-modal="settings"]` | 设置弹层 |
| `button[aria-haspopup="listbox"]` | 输入框“+”按钮（附件入口） |
| `[data-sidebar-right-expand]` | 打开右栏按钮 |
| `[data-sidebar-right-toggle]` | 收起右栏按钮 |
| `[data-sidebar-right-open]` | 右栏已展开标记 |
| `[class*="_sessionRow"]`, `[class*="_rowActions"]` | 会话行/长按菜单 |
| `[class*="_navCell"]`, `[class*="_options"]` | 设置列表/子页 |
| `[class*="_newSession"]`, `[class*="_panelRow"]` | 新会话/插件/终端行 |

改宿主版本后先跑一遍选择器检查，不要只看 hash class。

---

## 6. CSS 结构

全部包在 `@media (max-width: 1023px)`，不影响桌面。

关键 class：

- `html.dms-preload-left`：左栏常驻预加载（当前实现在页面下层）
- `html.dms-left-open` / `html.dms-right-open`：抽屉打开
- `html.dms-left-hide`：左栏关闭过渡
- `html.dms-gesture-arming` / `dms-gesture-arming-right`：手势首次挂载时先隐藏
- `dms-dragging-left|right`, `dms-drag-close-left|right`：拖动中
- `dms-gesture-opened`：手势打开完成
- `dms-settings-open`, `dms-settings-list`, `dms-settings-section`, `dms-settings-chrome-init`, `dms-plugin-section`
- `dms-attach-open` / `dms-attach-sheet` / `dms-attach-backdrop`
- `dms-kb-open`, `--dms-kb`

设计 token（`src/styles.css` 顶部）：

```css
--dms-blue:#426efe; --dms-bg:#fff; --dms-bg-soft:#f5f7fb;
--dms-surface:#fff; --dms-surface-2:#f2f4f8;
--dms-text:#0f0f0f; --dms-text-2:#6b7280; --dms-line:rgba(15,15,15,.07);
--dms-radius:14px; --dms-radius-lg:28px; --dms-topbar:52px;
```

暗色只覆盖 token，不要写死颜色。

---

## 7. 抽屉实现

### 7.1 状态

- `leftVisible`：插件自己的逻辑状态（不是 host 状态）
- `rightVisible`：插件自己的右栏状态；同步时用 `rightVisible` 而不是 `rightOpen()` 决定 `dms-right-open` class
- `rightActivityAt`：最近一次右栏动作时间，用于避免左/右栏互相打架
- `sidebarExpandBusy`, `leftRepairTimer`, `sidebarExpandTimer`

### 7.2 打开左栏

```js
openLeftVisual()
  if (leftVisible) return;
  if (rightOpen()/dms-right-open) { closeRight(); setTimeout(重试, 450); return; }
  leftVisible = true;
  清掉 preload/left-hide，加 dms-left-open；
  清 centerCol 的 transform/opacity；
  清 host sidebar 的 animation/transition/transform，z-index=90；
  repairLeftHost();
```

注意：左/右栏应互斥；代码里已有 closeRight/closeLeft 的延迟重试，但**仍可能弹两次/白屏**（见 §13）。

### 7.3 关闭左栏

`closeLeftVisual(animated)`：加 `dms-left-hide`，260ms 后加 `dms-preload-left`。

### 7.4 为什么有 preload

宿主 sidebar 在移动端**第一次展开时才真正 mount React 树**；直接打开会先给一张白帧。  
曾经尝试过 `translateX(-100%)`、`opacity:0`、`opacity:.01`、页面下层预绘、强制打开 host 等，**均未稳定消除白帧**（详见 §14）。

---

## 8. 手势

- 监听 `document` 的 `touchstart/touchmove/touchend`，capture，passive 按需；
- 闭环：触摸时长/位移/速度 → 锁定 open/close 左/右；
- `LOCK = 1`（CSS px），低于旧版 10px；
- `MAX_SPEED = 2300 px/s`，每帧最大位移；
- 速度用**最近 110ms 稳定窗口**，并要求 fast 至少位移 36px，避免慢拖被末尾采样误判为 fling；
- spring：`stiffness=1500, damping=0.9`；
- 拖动期间 `gestureBusy/springAnimating` 时跳过 `sync()`；
- 拖动 class 用 `transform/opacity`，尽量走 compositor。

已知问题：**小幅度慢拖仍可能无响应/突然出现一段**，根因和左栏首次 mount 相同；`LOCK=1` 只是减小阈值，没有消除宿主首帧。

---

## 9. 附件弹层与原生桥

DOM：

```html
<div class="dms-attach-backdrop"></div>
<div class="dms-attach-sheet" role="dialog">
  <div class="dms-attach-handle"></div>
  <div class="dms-attach-recent"><div class="dms-attach-recent-strip">…</div></div>
  <div class="dms-attach-actions">
    <button data-kind="camera">拍照</button>
    <button data-kind="gallery">相册</button>
    <button data-kind="files">文件</button>
  </div>
</div>
```

行为：

1. 拦截 composer 的 plus（`button[aria-haspopup="listbox"]`），打开弹层；
2. 有 `window.DSHNative` 时调用：
   - `recentPhotos` → 最近照片条，最多 20 张，缩略图 data URL；
   - `openRecent(id)` → 取原图 File 注入 composer；
   - `pickImages(mode)` / `pickFiles()` → 原生相机/相册/文件选择器；
3. 无 native bridge 时回退到隐藏 `<input type=file multiple>`（WebView 默认 DocumentsUI）；
4. 照片多选：`.dms-photo-check` 圆圈；选中后**不关闭弹层**，继续添加；
5. 动画：`transform: translateY(105%)` ↔ `0`，`dms-attach-open` 控制；
6. 限制：单文件 1GB、批量 5GB（插件侧预检）；真正的断点续传未实现。

原生协议完整定义在 `docs/ANDROID-BRIDGE.md`。相机/相册打不开系统 App 时，需要 APK 侧 `onShowFileChooser`/桥实现，不是纯 Web 插件能修。

---

## 10. 设置、返回、键盘

- 设置：监听 `[data-shortcut-modal="settings"]` 出现，包一层 App 式 chrome：
  - 列表页 `dms-settings-list`
  - 子页 `dms-settings-section`
  - 插件市场页 `dms-plugin-section`
- 返回栈优先级：
  1. 附件弹层打开 → 关附件
  2. 设置子页 → 回列表
  3. 设置打开 → 关设置
  4. 左/右栏打开 → 关栏
  5. 否则退出
- 键盘：`visualViewport` 变化时设置 `--dms-kb` 和 `dms-kb-open`，抽屉/附件高度要跟着让位。

---

## 11. Android / APK 集成

当前 APK 策略（应用侧）：

- **APK 不再带 `assets/hot.zip`**，`BuildInfo.HOT_IN_PAYLOAD=true`；
- APK 内置插件基线与 payload seed 是 0.6.6；
- 插件升级走 npm/本地 tar 装进 profile，**不会被 APK 每次启动覆盖**；
- `dsh-android-fork` 的 `plugin/dsh-mobile-shell` 必须与 npm 版本同步；
- 改 App 的 `MainActivity.onShowFileChooser`/桥后才走系统相机/相册，见 `docs/ANDROID-BRIDGE.md`。

包内改动流程（应用侧参考）：

1. 更新 `dsh-android-fork/plugin/dsh-mobile-shell`；
2. 重建 payload/APK，确认 hot 不再包含 `dsh-mobile-shell`；
3. 用原签名覆盖安装，保留用户数据；
4. 安装后用终端确认 profile 插件版本。

---

## 12. 测试与调试

### 12.1 本地 demo profile（推荐）

- 独立 `DSH_HOME` + 测试工作区，绝不能用真实用户数据截图/上传；
- 启动 DSH Web 后可以用 headless Edge + CDP 在 360×780、DPR 3 下截图/模拟触摸；
- 也可用 `?dms-off=styles,observer,autoclose` 分段排查。

### 12.2 真机 60fps 录屏

录屏用 scrcpy（无音频），手指轨迹用 `getevent`：

```sh
adb shell getevent -lt /dev/input/event1 > touch.log
```

事件格式：`EV_ABS ABS_MT_POSITION_X/Y`、`EV_KEY BTN_TOUCH DOWN/UP`、`EV_SYN SYN_REPORT`。  
触摸时钟和 scrcpy PTS 都是设备 uptime，可按秒对齐。

录屏脚本 `scrcpy/recorder_pts.mjs` 已改成**每帧追加 `*.pts.json.ndjson`**，这样提前停止也能保留帧时间戳；完整结束还会写 `.pts.json`。

分析：

- 解码 h264 为小图 raw，算每帧白像素比例，找白帧区间；
- 结合 touch 的 DOWN/UP、位移、速度，判断白帧发生在哪个动作；
- **不要只看截图**：截图会漏帧，60fps 视频才能看到白帧持续时长。

### 12.3 安装本地插件（手机）

由于 profile 在 PRoot guest 内，adb 不能直接写。可靠做法：

1. `npm pack`，推 tar 到 `/sdcard/`；
2. App 内打开「终端」；
3. `cd /root/.dsh/profiles/web`；
4. `rm -rf node_modules/dsh-mobile-shell && mkdir -p ... && tar -xzf ... --strip-components=1`；
5. `md5sum node_modules/dsh-mobile-shell/lib/client.js`，和本地 `lib/client.js` 对比；
6. 强制停止 App 再打开（热重载不会重载已初始化插件）。

> 常见坑：App 冷启动约 16s，太早点侧栏/终端会点在加载页上，命令其实没执行。装完必须 md5 校验，否则会拿旧包测半天。

---

## 13. 已知问题（交接重点）

### 13.1 第一次打开左侧栏白屏（未解决）

- 60fps 视频：点击左栏后约 **0.3–0.7s 整屏白**，随后抽屉内容才出现；
- 根因方向：宿主 sidebar 在移动端首次展开才 mount React 树，WebView 先绘制白帧；
- 已验证失败的修法：
  - `translateX(-100%)` 预加载；
  - `opacity:0` / `opacity:0.01` 预绘；
  - 页面下层预绘 + z-index 提升；
  - `ctx.layout.toggleSidebar()` 提前展开/重复重试；
  - 隐藏页面 push、只做 overlay；
  - 去掉宿主动画/加 will-change。
- **不要再重复这些尝试**；要么换“自绘抽屉”（会丢第三方 sidebar slot 扩展兼容性），要么接受骨架占位。

### 13.2 右滑后再左滑，左栏白屏且弹两次

- 和 13.1 同源，另加左右栏状态竞争；
- 现有代码有 open/close 幂等和 450ms 互斥重试，但**未彻底修好**；
- 复现：右栏打开 → 打开左栏 → 左栏白屏/动画重复；
- 排查顺序：`dms-right-open` 与 `leftVisible` 是否同时为真、host sidebar 是否重新 mount、`dms-left-open` class 是否被 sync 反复 toggle。

### 13.3 小距离拖动无响应/突然出现一段

- `LOCK` 已从 10 降到 1，仍未解决；
- 与宿主首帧 mount 一致；手势里的 `ensureSidebarMounted`/repair 可能再次触发 host 重排；
- 不要把 `MAX_SPEED` 调得太小，会变成“延迟跟随”，用户会感觉更卡。

### 13.4 其它

- WebView 未开 remote debugging（APK 未调用 `setWebContentsDebuggingEnabled`），DOM 只能靠截图/录屏判断；
- 宿主同步是 400ms 定时器，拖动/spring 期间已跳过，但仍有偶发重复 class；
- 官方更新可能改 DOM 锚点；升级 DSH 后必须回归所有选择器。

---

## 14. 失败路线记录（避免重复）

以下都在 0.6.7–0.6.10 试过，手机端 md5 校验确认代码已加载，仍白屏：

1. CSS 预加载：`translateX(-100%)`；
2. `opacity:0` 预加载；
3. `opacity:0.01` 强制绘制；
4. sidebar 放页面下层（z-index 0）预绘；
5. 启动时无条件 `ctx.layout.toggleSidebar()`；
6. 每 1.2s 重试展开直到成功；
7. 去掉宿主抽屉动画、只保留 opacity；
8. 页面完全不 push/不 fade（overlay 模式）。

共同结论：**白帧来自 host sidebar 的 React 首次挂载，CSS/预加载无法让它在用户点击前完成**。

---

## 15. 下一步建议

优先方案（保留官方 sidebar、插件兼容性）：

- 在 App 启动后 16s 主界面就绪时，**一次性**把 host sidebar 真正展开并保持；
- 用官方 layout store 的事件确认展开成功，而不是只看 `data-sidebar-collapsed`；
- 若仍白，接受“骨架占位”或转自绘抽屉。

自绘抽屉方案（方案 2）代价：

- 会丢第三方插件通过 `sidebar.workspaces / sidebar.panellist / sidebar.settings` 注入的按钮；
- 需要自己接 `ctx.sessions/workspaces` 数据和切换 API；
- 官方更新后维护成本更高。

**在没确认能接受这些代价前，不要轻易上方案 2。**

---

## 16. 发布 checklist

```sh
# 1. 版本
# package.json version = 0.6.x
# 2. 构建 + 语法检查
node scripts/build.mjs
node --check lib/client.js
# 3. 提交源码与 lib
git add src lib package.json README.md docs
git commit -m "release: 0.6.x — ..."
# 4. npm
npm publish --access public
# 5. GitHub
git push origin main
git tag -f v0.6.x && git push origin v0.6.x -f
# 6. 验证
npm view dsh-mobile-shell dist-tags --json
git ls-remote https://github.com/Htao-uu/dsh-mobile-shell.git refs/heads/main refs/tags/v0.6.x
```

- npm 发布 token 不要写进仓库；用临时 npmrc，发布后删除；
- GitHub 凭据用 credential helper，不要打印 token；
- README 只保留总览/截图，不写 changelog；更新记录放 commit；
- APK 侧不要再把 `dsh-mobile-shell` 放进 `assets/hot.zip`。

---

## 17. 常用命令 / 路径

```text
仓库：<repo>
构建：node scripts/build.mjs
APK（无热包）：dsh-android-<version>-<plugin>-nohot.apk
手机 adb：<Android SDK>/platform-tools/adb
scrcpy jar：<scrcpy>/scrcpy-server.jar
录屏脚本：<scrcpy>/recorder_pts.mjs
```

---

## 18. 归属与协作

- 插件仓库/UI：Htao-uu（本仓库）
- Android APK/原生桥：应用侧（dsh-android-fork）
- 交接时请先读本文 §13/§14，再决定是否继续在 host sidebar 上做预加载；否则很容易重复已经失败的一轮。

---

*本文不包含任何 token、密钥、用户会话或设备隐私数据。*
