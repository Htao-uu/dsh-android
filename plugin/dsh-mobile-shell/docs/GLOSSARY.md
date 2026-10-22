# Glossary / 术语表

| 中文 | English | 定义 |
| --- | --- | --- |
| 主界面 | Home / Hero screen | 没有选中会话时的起始页：品牌区、工作区/模式选择、输入卡。 |
| 对话界面 | Conversation screen | 选中会话后的消息流页面，顶部为会话顶栏，底部为输入卡。 |
| 宿主 | Host | 提供 Web UI、会话与 Agent 能力的 DSH 运行时；本插件只改浏览器半区。 |
| 客户端插件 | Client plugin | 通过 `dsh.client` 声明、由宿主注入浏览器执行的插件包（本仓库即一个）。 |
| 席位 / Slot | Slot | 宿主 UI 的扩展点（`sidebar.*`、`conversation.*`、`settings.*` 等）。 |
| 插件行 | Patch row | `cordis.patch.yml` 中的一条 Loader 条目，决定插件是否被加载。 |
| 顶栏 | Top bar | 页面最上方的应用栏：左菜单、标题、右侧动作。 |
| 左侧边栏 / 会话抽屉 | Left drawer / session drawer | 由宿主侧栏内容构成的左抽屉，用于新建会话、切换会话、进入插件与设置。 |
| 右侧边栏 / 详情抽屉 | Right drawer / details drawer | 由宿主右侧 details 面板构成的右抽屉：工作区文件、终端、Agent 浏览器等。 |
| 底部输入卡 | Composer card | 页面底部的圆角输入区域：输入框、附件入口、权限/模型选择、发送/停止。 |
| 底部面板 | Bottom sheet | 从底部升起的二级面板；本阶段仅样式规范，后续功能沿用。 |
| 返回栈 | Back stack | 硬件返回键/浏览器返回的关闭顺序：设置 → 右侧边栏 → 左侧边栏 → 宿主。 |
| 边缘手势 | Edge swipe | 从屏幕左右边缘起手、横向滑动以打开/关闭抽屉的手势。 |
| 轴锁 | Axis lock | 手势判定：横向位移超过阈值且大于纵向位移后才接管，避免与纵向滚动冲突。 |
| 提交阈值 | Commit threshold | 松手时判定手势成立的最小横向距离（当前 56 CSS px）。 |
| 安全区 | Safe area | 刘海/状态栏/手势条区域；通过 `env(safe-area-inset-*)` 避开。 |
| 热重载 | HMR | 宿主每 500ms 检查插件 `lib/client.js`，变化后自动重载页面插件。 |
| 状态标记 | DOM marker | 插件写在宿主 DOM 上的 `data-dms-*` / 类名，用于样式与状态同步。 |
