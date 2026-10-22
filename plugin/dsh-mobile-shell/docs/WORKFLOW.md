# Development workflow / 开发流程

## 1. Prerequisites / 前置条件

- Node.js 20+（仓库脚本只用 `node:` 内置模块，无第三方构建依赖）。
- 一个可写的 DSH Web profile（**不要**在包含真实会话的 profile 上开发）。
- 手机或桌面浏览器的移动视口，用于验收。

## 2. Layout / 目录

```text
dsh-mobile-shell/
├─ package.json          plugin manifest (dsh.client / dsh.bundle)
├─ cordis.patch.yml      one Loader row
├─ lib/
│  ├─ index.js           host half (no-op; keeps the row visible)
│  └─ client.js          built browser bundle (committed)
├─ src/
│  ├─ client.js.tpl      browser source with __CSS_JSON__ placeholder
│  └─ styles.css         all CSS, embedded into the bundle at build time
├─ scripts/build.mjs     the only build step
└─ docs/                 glossary, workflow, design notes, screenshots
```

## 3. Edit → build → verify / 修改 → 构建 → 验证

```sh
# 1. edit src/client.js.tpl or src/styles.css
# 2. rebuild the single-file bundle (required; lib/ is generated)
npm run build

# 3. install into a disposable DSH Web profile
dsh plugin --profile <profile> add link:/path/to/dsh-mobile-shell
#    then add the bundle row in that profile's cordis.patch.yml:
#      - insert:
#          - id: dsh-mobile-shell
#            name: 'dsh-mobile-shell'
#    and restart the harness once so the new row is composed.
#
#    Without pnpm, skip the plugin-add step and copy the directory instead:
#      cp -R dsh-mobile-shell <DSH_HOME>/profiles/<profile>/node_modules/
#    (package.json + lib/ intact), then add the same patch row.

# 4. after the first load, edits to lib/client.js hot-reload through HMR
#    (host reloads the plugin within ~500 ms; no restart needed)
```

## 4. Verification / 验收清单

- Viewport `<= 1023px`：左侧栏隐藏，顶栏出现 ☰ / panel / ＋ 三个按钮。
- ☰ 或左边缘右滑：左侧抽屉出现，宽度约 88vw，剩余区域变暗且可点击关闭。
- 右边缘左滑或顶栏 panel：右侧详情抽屉出现，左侧保留约 12% 可见区域。
- 设置：全屏面板、左上返回箭头、分组卡片列表、横向分类胶囊。
- 返回键（Android）：依次关闭设置 → 右侧抽屉 → 左侧抽屉；全部关闭后再交给宿主默认行为。
- 桌面视口（>= 1024px）：插件完全 no-op（无按钮、无 scrim、无手势）。
- 深色 / 浅色：继承宿主主题变量；切换后无白块或颜色断层。

## 5. Selector rules / 选择器纪律

1. 优先 `data-*` 属性（`[data-composer-card]`、`[data-composer-seat]`、`[data-shortcut-modal="settings"]`）。
2. 其次匹配稳定类名后缀（`[class*="_sidebarCol"]`、`[class*="_rightbarCol"]`），**不要**硬编码 CSS-module 哈希。
3. 不移动宿主 React 节点；只添加自己的 DOM（按钮、scrim、style）与状态标记。
4. 每个新加的控件都必须考虑桌面端隐藏与插件卸载时的清理。

## 6. Release / 发布前

- `npm run build` 后检查 `lib/client.js` 已更新并提交。
- 确认 `git status` 只有预期文件；截图不含个人信息/真实会话内容。
- 打 tag，推送，按宿主版本在 Release 说明中标注兼容范围。
