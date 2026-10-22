# Design notes / 设计说明

## 1. Goal / 目标

让 DSH Web 在竖屏触摸手机上呈现与官方 DeepSeek App 一致的壳层：以抽屉为主导航、顶栏左右分区、底部圆角输入卡、官方风格的设置页，并让 Android 返回键沿着一条明确的返回栈工作。

本仓库是**浏览器端插件**：不改 DSH 服务端、不替换前端 dist、不移动宿主 React 节点。所有变化由一层 CSS 与少量自有 DOM（顶栏按钮、scrim、样式）实现，宿主类名通过稳定后缀匹配。

## 2. Shell mapping / 壳层映射

| 官方 App 元素 | DSH 宿主来源 | 本插件的做法 |
| --- | --- | --- |
| 左上菜单按钮 | 会话顶部 header 的 leading 区域 | 注入 `.dms-menu`，调用 `ctx.layout.toggleSidebar()` |
| 右上图标 | header corner / 右侧详情展开按钮 | 注入 `.dms-panel`（开/关右抽屉）与 `.dms-plus`（新建会话），隐藏宿主重复的展开按钮 |
| 左侧会话抽屉 | 宿主左栏（brand / 新会话 / 会话列表 / 面板 / 设置） | 固定定位、88vw、圆角 + 阴影 + scrim；隐藏常驻 icon rail |
| 右侧详情抽屉 | 宿主 rightbar（工作区文件 / 终端 / Agent 浏览器） | 同一宿主内容固定到右侧、88vw、translateX 过渡；保留左侧约 12% 页面可见 |
| 底部输入卡 | composer（`[data-composer-card]`） | 28px 圆角、轻阴影、蓝色圆形发送/停止、浅蓝胶囊控件 |
| 设置页 | `[data-shortcut-modal="settings"]` | 全屏、返回箭头、横向分类胶囊、白色分组卡片 |
| 欢迎页 | hero（`_headline`） | 鲸鱼 logo 上移、标题加粗、隐藏“预览版”徽章 |

## 3. Tokens / 设计令牌

| Token | Light | Dark |
| --- | --- | --- |
| `--dms-blue` | `#426efe` | same |
| `--dms-bg` | `#ffffff` | `#10131a` |
| `--dms-bg-soft` | `#f5f7fb` | `#0b0e13` |
| `--dms-surface` | `#ffffff` | `#191b23` |
| `--dms-surface-2` | `#f2f4f8` | `#23262f` |
| `--dms-text` | `#0f0f0f` | `#f5f5f5` |
| `--dms-text-2` | `#6b7280` | `#9aa0aa` |
| `--dms-radius-lg` | 28px（输入卡） | same |
| `--dms-radius` | 16px（设置卡） | same |
| `--dms-topbar` | 52px + safe-area | same |

## 4. Interaction contract / 交互契约

- 抽屉宽度：`88vw`（左右一致），保留约 12% 底层页面可见。
- 左抽屉：☰ 或左边缘（26px 内）向右滑（>56px）打开；scrim 点击、左滑、返回键关闭。
- 右抽屉：panel 按钮或右边缘（26px 内）向左滑（>56px）打开；面板自带收起按钮、右滑、返回键关闭。
- 手势轴锁：横向位移 >10px 且大于纵向位移才接管；不打断纵向滚动。
- 返回栈：设置 → 右侧抽屉 → 左侧抽屉 → 宿主默认行为（`window.__dshmBack` 包装宿主实现）。
- 桌面（`min-width: 1024px`）：按钮、scrim、手势全部禁用，宿主布局不受影响。

## 5. Non-goals for this phase / 本阶段不做

- 不重排消息列表与气泡（宿主消息组件保持原样）。
- 不改造附件选择/上传浮层的行为（样式随 composer 卡片继承）。
- 不加入语音输入（DSH Web 无 ASR；发送按钮始终可用）。
- 不替换设置页的配置项，只调整布局与视觉。

## 6. Compatibility & limits / 兼容与限制

- 选择器按稳定后缀匹配，适配 DSH Web 0.2.x 的 layout / sidebar / sidebar-right / conversation / settings-general 结构。
- 宿主大版本改动可能调整 DOM；升级后请按 `docs/WORKFLOW.md` 的验收清单重跑一遍。
- 若宿主自身已安装其它移动端补丁，可能出现叠加（本插件以运行时后注入的样式为准）。
- 已在移动视口（360×780 CSS px，DPR 3）完成浅色/深色、抽屉、设置与返回栈的静态验证；真机手感与键盘场景需在目标设备复核。
