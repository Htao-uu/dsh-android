window.__ModuleLoader__.load({
  id: "dsh-mobile-shell",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

var DMS = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/loader.js
  var loader_exports = {};
  __export(loader_exports, {
    INJECT: () => INJECT,
    apply: () => apply
  });

  // src/core/state.js
  var state = {
    // 左栏可见状态：左抽屉的单一状态源，sync() 据此切 dms-left-open，手势/返回键/自动关闭都读它。
    leftVisible: false,
    // 右栏可见状态：右抽屉的单一状态源，sync() 据此切 dms-right-open；打开/关闭/返回键/顶栏都依赖它。
    rightVisible: false,
    // 左栏宿主挂载忙标记：向宿主发出展开/toggle 请求期间为 true，防止重复点击再次 toggle 宿主。
    sidebarExpandBusy: false,
    // 左栏宿主挂载阶段：idle/requesting/mounted/failed；预挂载、失败判定和手势 arm 等待都读它。
    sidebarMountState: "idle",
    // 预加载点击放行标记：preloadRight 程序化点击宿主按钮时置 true，让 topbar 拦截器不要吞掉这次点击。
    rightPreloadClick: false,
    // 右栏预加载状态：idle/请求中(busy)/成功(ok)/失败(fail)/取消(cancelled)；控制 preloadRight 是否重入。
    rightPreloadState: "idle",
    // 已尝试预加载过的会话 ID 集合：同一 session 只尝试一次，避免反复切换宿主右栏。
    rightPreloadAttempts: /* @__PURE__ */ new Set(),
    // 监听宿主菜单 DOM 的 MutationObserver 句柄：菜单节点变化时重新扫描并注入 tab 项，销毁时必须 disconnect。
    rightViewMenuObserver: null,
    // 菜单扫描的 requestAnimationFrame 句柄：合并同一帧内的多次 DOM 变化，避免重复扫描。
    rightViewMenuRaf: 0,
    // 右栏预加载节流时间戳：距上次预加载不足 2000ms 时直接跳过，避免频繁点击宿主 expand。
    lastRightPreloadAt: 0,
    // 上一个会话 key：定期 watcher / rAF 快速 watcher 用它判断是否切换了会话。
    sessionKeyPrev: "",
    // 最近一次指针是否落在编辑器/输入区内：blurHostEditor 用来判断是否要保留宿主输入焦点。
    lastPointerInEditor: false,
    // 最近一次指针时间戳：与 lastPointerInEditor 配合，900ms 内不强制抢焦点。
    lastPointerAt: 0,
    // Cordis 插件上下文引用：back-stack/settings/left-drawer 通过它访问 layout 面板状态和返回逻辑。
    ctxRef: null,
    // 手势忙碌锁：一次手势/spring 未结束时阻止新的 touch 手势进入，避免叠加动画和状态错乱。
    gestureBusy: false,
    // 弹簧动画进行中标记：起始/结束/清理时同步；用于调试和防止手势与 spring 冲突。
    springAnimating: false,
    // 调试关闭集合：解析 URL 的 ?dms-off=styles,observer,... 后保存，对应模块据此跳过安装。
    DEBUG_OFF: /* @__PURE__ */ new Set(),
    // 会话快速观察截止时间戳：指针/切换会话后 1500ms 内用 rAF 高频检查 session key。
    sessionFastUntil: 0,
    // 会话快速观察的 rAF 句柄：避免重复启动快速检查循环，销毁时取消。
    sessionFastRaf: 0
  };

  // src/core/constants.js
  var MEDIA = "(max-width: 10230px)";
  var LOCK = 3;
  var ICONS = {
    menu: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    panel: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M14.5 4.5v15"/></svg>',
    camera: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 8.5h3l1.4-2h7.2L17 8.5h3A1.5 1.5 0 0 1 21.5 10v7.5A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5V10A1.5 1.5 0 0 1 4 8.5Z"/><circle cx="12" cy="13.7" r="3.3"/></svg>',
    image: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.2" cy="9.2" r="1.6"/><path d="m4.8 17 4.4-4.3 3 2.8 2.6-2.3 4.4 3.8"/></svg>',
    full: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V5.8A1.8 1.8 0 0 1 5.8 4H9M15 4h3.2A1.8 1.8 0 0 1 20 5.8V9M20 15v3.2a1.8 1.8 0 0 1-1.8 1.8H15M9 20H5.8A1.8 1.8 0 0 1 4 18.2V15"/></svg>',
    exitFull: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v3.2A1.8 1.8 0 0 1 7.2 9H4M15 4v3.2A1.8 1.8 0 0 0 16.8 9H20M9 20v-3.2A1.8 1.8 0 0 0 7.2 15H4M15 20v-3.2a1.8 1.8 0 0 1 1.8-1.8H20"/></svg>',
    file: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6 3.5h7l5 5v12H6z"/><path d="M13 3.5v5h5"/></svg>',
    check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.5 4.5L19 7"/></svg>'
  };
  var CHEVRON_LEFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
  var GEAR_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.14.35.4.65.73.86"/></svg>';

  // src/core/dom.js
  var $ = (sel, root) => (root || document).querySelector(sel);
  var $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  var isPhone = () => window.matchMedia(MEDIA).matches;
  var frame = () => $('[class*="_frame"]');
  var sidebarCol = () => $('[class*="_sidebarCol"]');
  var rightbarCol = () => $('[class*="_rightbarCol"]');
  var settingsPanel = () => $('[data-shortcut-modal="settings"]');
  var hostLeftOpen = () => {
    const f = frame();
    return f !== null && !f.hasAttribute("data-sidebar-collapsed");
  };
  function cloneIcon(selector) {
    const host = $(selector);
    const svg = host === null ? null : host.querySelector("svg");
    return svg === null ? "" : svg.outerHTML;
  }
  function iconFor(kind) {
    if (kind === "menu") return ICONS.menu;
    if (kind === "plus") return cloneIcon('[class*="_sidebarCol"] [class*="_newSession"]') || ICONS.plus;
    if (kind === "panel") return cloneIcon("[data-sidebar-right-expand]") || ICONS.panel;
    return "";
  }
  function makeButton(kind, label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dms-iconbtn dms-" + kind;
    b.setAttribute("aria-label", label);
    b.innerHTML = iconFor(kind);
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return b;
  }
  function showToast(text) {
    let el = $(".dms-toast");
    if (el === null) {
      el = document.createElement("div");
      el.className = "dms-toast";
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => el.classList.remove("show"), 1800);
  }
  function normalizeSeparators(rootEl) {
    if (rootEl === null) return;
    try {
      const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
      let node = null;
      while ((node = walker.nextNode()) !== null) {
        const value = node.nodeValue;
        if (value && value.indexOf("\xB7") >= 0) node.nodeValue = value.replace(/\s*·\s*/g, " ").trim();
      }
    } catch (error) {
    }
  }

  // src/styles/tokens.css
  var tokens_default = ":root {\r\n  --dms-blue: #426efe;\r\n  --dms-bg: #ffffff;\r\n  --dms-bg-soft: #f5f7fb;\r\n  --dms-surface: #ffffff;\r\n  --dms-surface-2: #f2f4f8;\r\n  --dms-text: #0f0f0f;\r\n  --dms-text-2: #6b7280;\r\n  --dms-line: rgba(15, 15, 15, 0.07);\r\n  --dms-scrim: rgba(16, 19, 26, 0.32);\r\n  --dms-radius-lg: 28px;\r\n  --dms-radius: 14px;\r\n  --dms-topbar: 52px;\r\n  --dms-shadow-card: 0 2px 14px rgba(15, 23, 42, 0.06), 0 0 0 0.5px rgba(15, 23, 42, 0.04);\r\n  --dms-shadow-drawer: 0 0 48px rgba(15, 23, 42, 0.22);\r\n  color-scheme: light;\r\n}\r\nhtml[data-ds-dark-theme], body[data-ds-dark-theme], [data-ds-dark-theme] {\r\n  --dms-bg: #10131a;\r\n  --dms-bg-soft: #0b0e13;\r\n  --dms-surface: #191b23;\r\n  --dms-surface-2: #23262f;\r\n  --dms-text: #f5f5f5;\r\n  --dms-text-2: #9aa0aa;\r\n  --dms-line: rgba(255, 255, 255, 0.08);\r\n  --dms-scrim: rgba(0, 0, 0, 0.52);\r\n  --dms-shadow-card: 0 2px 16px rgba(0, 0, 0, 0.4);\r\n  color-scheme: dark;\r\n}\r\n\r\n@media (max-width: 1023px) {\r\n  /* One source of truth for the drawer width: drawers and the page push must use the\r\n     same value or a gap appears between the pushed page and the drawer edge (hotfix\r\n     Bug3: \u53F3\u680F\u4E0E\u4E3B\u754C\u9762\u4E4B\u95F4\u6709\u7A7A\u9699). */\r\n  html { --dms-drawer-w: min(326px, 80vw); }\r\n  html, body { background: var(--dms-bg); }\r\n  body { -webkit-tap-highlight-color: transparent; overscroll-behavior: none; }\r\n\r\n";

  // src/styles/frame.css
  var frame_default = '  /* ---------- frame: one viewport, status bar clear ------------------------ */\r\n  html body [class*="_frame"] {\r\n    grid-template-columns: 0 minmax(0, 1fr) 0 !important;\r\n    background: var(--dms-bg) !important;\r\n    box-sizing: border-box !important;\r\n    padding-top: env(safe-area-inset-top, 0px) !important;\r\n  }\r\n  [class*="_centerCol"] { grid-column: 2 !important; background: var(--dms-bg) !important; }\r\n  [class*="_frame"] > [class*="_sidebarCol"] { background: var(--dms-bg) !important; }\r\n  [class*="_rightbarCol"] { grid-column: 3 !important; }\r\n  [class*="_bottomRow"],\r\n  [class*="_composerStack"], [class*="_composerHero"],\r\n  [class*="_heroWorkspaceRow"], [class*="_heroOptions"] { background: transparent !important; }\r\n  [class*="_handle"] { display: none !important; }\r\n\r\n';

  // src/styles/left-drawer.css
  var left_drawer_default = `  /* ---------- left drawer ------------------------------------------------- */\r
  [class*="_frame"][data-sidebar-collapsed] > [class*="_sidebarCol"] { display: none !important; }\r
  [class*="_frame"]:not([data-sidebar-collapsed]) > [class*="_sidebarCol"] {\r
    display: block !important;\r
    position: fixed !important;\r
    left: 0 !important;\r
    top: 0 !important;\r
    bottom: 0 !important;\r
    width: var(--dms-drawer-w) !important;\r
    max-width: var(--dms-drawer-w) !important;\r
    height: 100% !important;\r
    z-index: 90 !important;\r
    background: var(--dms-bg-soft) !important;\r
    border-right: none !important;\r
    border-radius: 0 !important;\r
    box-shadow: 10px 0 28px rgba(15, 23, 42, 0.18) !important;\r
    /* The sidebar is preloaded and already painted under the page, so opening it\r
       must not replay a slide-in animation (that was the source of the white\r
       frame on fast drawer switches). Only the page push animates. */\r
    animation: none !important;\r
    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\r
    box-sizing: border-box !important;\r
    padding-top: env(safe-area-inset-top, 0px) !important;\r
    padding-bottom: env(safe-area-inset-bottom, 0px) !important;\r
    overflow: hidden !important;\r
  }\r
  [class*="_frame"]:not([data-sidebar-collapsed]) > [class*="_sidebarCol"] > *,\r
  [class*="_frame"]:not([data-sidebar-collapsed]) > [class*="_sidebarCol"] [class*="_root"] {\r
    width: 100% !important;\r
    max-width: none !important;\r
  }\r
  [class*="_sidebarCol"] [class*="_root"] { background: transparent !important; width: 100% !important; }\r
  [class*="_sidebarCol"] [class*="_logoRow"] { padding: 6px 10px 2px !important; }\r
  [class*="_sidebarCol"] [class*="_regionArea"],\r
  [class*="_sidebarCol"] [class*="_panelList"] { overflow-x: hidden !important; }\r
  [class*="_sidebarCol"] [class*="_regionArea"] { padding-left: 8px !important; padding-right: 8px !important; }\r
  [class*="_sidebarCol"] [class*="_workspaceHeader"],\r
  [class*="_sidebarCol"] [class*="_workspaceRow"],\r
  [class*="_sidebarCol"] [class*="_regionHeader"] {\r
    width: 100% !important; min-width: 0 !important;\r
    padding-left: 2px !important; padding-right: 2px !important;\r
    display: flex !important; align-items: center !important; gap: 2px !important;\r
    overflow: visible !important;\r
  }\r
  [class*="_sidebarCol"] [class*="_workspaceHeader"] > *:first-child,\r
  [class*="_sidebarCol"] [class*="_workspaceRow"] > *:first-child {\r
    min-width: 0 !important; flex: 0 1 auto !important;\r
    overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;\r
  }\r
  [class*="_sidebarCol"] [class*="_workspaceHeader"] button,\r
  [class*="_sidebarCol"] [class*="_workspaceRow"] button { margin-left: 0 !important; margin-right: 0 !important; }\r
  [class*="_sidebarCol"] [class*="_workspaceHeader"] > *:last-child,\r
  [class*="_sidebarCol"] [class*="_workspaceRow"] > *:last-child { margin-right: 2px !important; }\r
  [class*="_sidebarCol"] [class*="_sectionHeader"],\r
  [class*="_sidebarCol"] [class*="_workspaceHeader"] {\r
    width: 100% !important; min-width: 0 !important;\r
    padding-left: 2px !important; padding-right: 2px !important;\r
    gap: 2px !important; overflow: visible !important;\r
    display: flex !important; align-items: center !important;\r
  }\r
  [class*="_sidebarCol"] [class*="_sectionHeader"] > *:first-child {\r
    min-width: 40px !important; flex: 0 0 auto !important;\r
    overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;\r
  }\r
  [class*="_sidebarCol"] [class*="_sectionHeader"] [class*="_searchSlot"] {\r
    flex: 1 1 auto !important; width: auto !important; min-width: 24px !important;\r
  }\r
  [class*="_sidebarCol"] [class*="_sectionHeader"] button {\r
    width: 24px !important; height: 24px !important; min-width: 24px !important;\r
    margin-left: 0 !important; margin-right: 2px !important;\r
  }\r
  [class*="_sidebarCol"] [class*="_sectionHeader"] [class*="_searchSlot"] + * { margin-left: auto !important; }\r
  [class*="_sidebarCol"] [class*="_sectionHeader"] svg { width: 16px !important; height: 16px !important; }\r
  [class*="_sidebarCol"] [class*="_workspaceHeader"] { font-size: 11px !important; }\r
  [class*="_sidebarCol"] [class*="_workspaceHeader"] button {\r
    width: 24px !important; height: 24px !important; min-width: 24px !important;\r
  }\r
  [class*="_sidebarCol"] [class*="_workspaceHeader"] svg { width: 16px !important; height: 16px !important; }\r
  [class*="_sidebarCol"] [class*="_workspaceHeader"] [class*="_search"] {\r
    width: 24px !important; min-width: 24px !important;\r
  }\r
  [class*="_sidebarCol"] [class*="_workspaceHeader"] > *,\r
  [class*="_sidebarCol"] [class*="_workspaceRow"] > * { min-width: 0 !important; }\r
  [class*="_sidebarCol"] [class*="_workspaceHeader"] button,\r
  [class*="_sidebarCol"] [class*="_workspaceRow"] button { flex: 0 0 auto !important; }\r
  /* the host hides these at narrow widths; a phone drawer still has room */\r
  [class*="_sidebarCol"] [class*="_search"],\r
  [class*="_sidebarCol"] [class*="_searchButton"] {\r
    width: auto !important; min-width: 28px !important; max-width: none !important;\r
    overflow: visible !important; flex: 0 0 auto !important;\r
  }\r
  [class*="_sidebarCol"] [class*="_search"] svg,\r
  [class*="_sidebarCol"] [class*="_searchButton"] svg {\r
    display: block !important; width: 20px !important; height: 20px !important; opacity: 1 !important;\r
  }\r
  [class*="_sidebarCol"] button[aria-label="\u641C\u7D22\u4F1A\u8BDD"],\r
  [class*="_sidebarCol"] button[aria-label="\u89C6\u56FE\u9009\u9879"],\r
  [class*="_sidebarCol"] button[aria-label="\u6DFB\u52A0\u5DE5\u4F5C\u533A"],\r
  [class*="_sidebarCol"] [class*="_workspaceActions"] button,\r
  [class*="_sidebarCol"] [class*="_searchButton"],\r
  [class*="_sidebarCol"] [class*="_workspaceSearch"] {\r
    display: inline-flex !important;\r
    visibility: visible !important;\r
    opacity: 1 !important;\r
  }\r
  [class*="_sidebarCol"] [class*="_newSession"] {\r
    justify-content: center !important;\r
    gap: 8px !important;\r
    text-align: center !important;\r
  }\r
  [class*="_sidebarCol"] [class*="_toggle"] { display: none !important; }\r
  [class*="_sidebarCol"] [class*="_rowActions"] { display: none !important; }\r
  .dshm-scrim { display: none !important; }\r
  /* \u4EFB\u52A129\uFF1A\u9876\u90E8\u5DE6\u4E0A\u89D2\u7EDF\u4E00\u4E3A\u63D2\u4EF6\u6CE8\u5165\u7684\u300C\u4E09\u300D\u6C49\u5821\u6309\u94AE\uFF1B\u5BBF\u4E3B leading \u91CC\u7684\u539F\u56FE\u6807/\u5176\u5B83\r
     \u6CE8\u5165\u9879\u4E00\u5F8B\u9690\u85CF\uFF0C\u907F\u514D\u51FA\u73B0\u65B9\u6846\u6216\u91CD\u590D\u6309\u94AE\u3002 */\r
  [data-conversation-header-leading] > :not(.dms-menu):not([data-sidebar-right-expand]):not(:has([data-sidebar-right-expand])) { display: none !important; }\r
  /* \u4EFB\u52A1 28\uFF1A\u5BF9\u8BDD\u9875/\u4E3B\u9875\u9762\u53F3\u4E0A\u89D2\u76F4\u63A5\u7528\u5BBF\u4E3B\u81EA\u5E26\u7684 expand \u56FE\u6807\uFF08\u4E0D\u6CE8\u5165\u81EA\u5EFA\u6309\u94AE\uFF09\uFF0C\r
     \u7EDF\u4E00\u6210 DSH \u5B98\u65B9 28\xD728/16px \u900F\u660E\u56FE\u6807\u6309\u94AE\u89C4\u683C\u3002 */\r
  [class*="_centerCol"] header [data-sidebar-right-expand][data-dms-hidden="1"] {\r
    display: none !important;\r
  }\r
  .dms-right-menu {\r
    display: inline-flex !important;\r
    align-items: center !important;\r
    justify-content: center !important;\r
    width: 28px !important;\r
    height: 28px !important;\r
    min-width: 28px !important;\r
    min-height: 28px !important;\r
    padding: 0 !important;\r
    margin: 0 2px !important;\r
    border: 0 !important;\r
    border-radius: var(--dsw-radius-sm, 8px) !important;\r
    background: transparent !important;\r
    color: var(--dsw-alias-label-secondary, var(--dms-text-2)) !important;\r
  }\r
  .dms-right-menu svg { width: 16px !important; height: 16px !important; }\r
  /* Only the plugin-injected .dms-right-menu is shown. The host's own expand\r
     button can render on either side of "..." for one frame during startup;\r
     hide it from CSS immediately so the two never flash together. */\r
  [data-sidebar-right-expand] {\r
    display: none !important;\r
    visibility: hidden !important;\r
    pointer-events: none !important;\r
  }\r
\r
`;

  // src/styles/right-drawer.css
  var right_drawer_default = '  /* ---------- right drawer ------------------------------------------------ */\r\n  [class*="_frame"] > [class*="_rightbarCol"] {\r\n    --dsh-sidebar-width: var(--dms-drawer-w) !important;\r\n    display: block !important;\r\n    position: fixed !important;\r\n    top: 0 !important;\r\n    right: 0 !important;\r\n    bottom: 0 !important;\r\n    width: var(--dms-drawer-w) !important;\r\n    max-width: var(--dms-drawer-w) !important;\r\n    height: 100% !important;\r\n    z-index: 90 !important;\r\n    background: var(--dms-bg) !important;\r\n    border-radius: 0 !important;\r\n    box-shadow: -10px 0 28px rgba(15, 23, 42, 0.18) !important;\r\n    transform: translateX(100%) !important;\r\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\r\n    box-sizing: border-box !important;\r\n    padding-top: env(safe-area-inset-top, 0px) !important;\r\n    padding-bottom: env(safe-area-inset-bottom, 0px) !important;\r\n    overflow: hidden !important;\r\n  }\r\n  html.dms-right-open [class*="_frame"] > [class*="_rightbarCol"] {\r\n    transform: translateX(0) !important;\r\n    box-shadow: -10px 0 28px rgba(15, 23, 42, 0.18) !important;\r\n  }\r\n  [class*="_rightbarCol"] > * { width: 100% !important; height: 100% !important; }\r\n  [class*="_rightbarCol"] [class*="_panel"],\r\n  [class*="_rightbarCol"] [class*="_session"] {\r\n    width: 100% !important;\r\n    max-width: none !important;\r\n    left: 0 !important;\r\n    right: auto !important;\r\n    transform: none !important;\r\n    background: var(--dms-bg) !important;\r\n  }\r\n  [class*="_rightbarCol"] [class*="_tabBody"] { width: 100% !important; }\r\n\r\n  /* \u4EFB\u52A1 28\uFF1A\u5BBF\u4E3B\u53F3\u680F\u9762\u677F\u5728 preload \u540E\u4FDD\u6301 collapsed\uFF08\u5BBF\u4E3B state \u4E0D\u518D\u6539\u52A8\uFF09\uFF0C\r\n     \u9762\u677F\u5185\u5BB9\uFF08\u542B\u5BBF\u4E3B\u81EA\u5DF1\u7684 chrome [\u5168\u5C4F][\u6536\u8D77] \u6309\u94AE\uFF09\u7531\u63D2\u4EF6 CSS \u653E\u51FA\u5E76\u968F\u9762\u677F\u79FB\u52A8\u3002 */\r\n  html.dms-right-open [data-sidebar-right-session] [data-dockkit-host=dock],\r\n  html.dms-right-open [data-sidebar-right-session] [data-dockkit-empty],\r\n  html.dms-right-open [data-sidebar-right-session] [data-dockkit-divider] {\r\n    transform: none !important;\r\n    visibility: visible !important;\r\n    transition: none !important;\r\n  }\r\n  html.dms-preload-right [data-sidebar-right-panel],\r\n  html.dms-right-open [data-sidebar-right-panel] {\r\n    width: 100% !important;\r\n    max-width: 100% !important;\r\n    --dsh-sidebar-width: var(--dms-drawer-w) !important;\r\n  }\r\n  html.dms-preload-right [data-sidebar-right-session] { pointer-events: none !important; }\r\n  /* \u4EFB\u52A132\uFF1A\u6253\u5F00\u6001\u5F3A\u5236\u53EF\u89C1/\u4E0D\u900F\u660E/\u53EF\u70B9\uFF0C\u8986\u76D6\u5BBF\u4E3B aria-hidden \u4E0E collapsed \u89C6\u89C9\u3002 */\r\n  html.dms-right-open [data-sidebar-right-session],\r\n  html.dms-right-open [data-sidebar-right-session][aria-hidden="true"] {\r\n    opacity: 1 !important;\r\n    visibility: visible !important;\r\n    pointer-events: auto !important;\r\n  }\r\n  /* \u5BBF\u4E3B chrome \u56FE\u6807\u6309\u94AE\uFF1A\u6CBF\u7528\u5BBF\u4E3B\u5B98\u65B9\u6837\u5F0F\uFF0828\xD728/15px \u56FE\u6807\uFF09\uFF0C\u8FD9\u91CC\u53EA\u4FDD\u8BC1\u53EF\u89C1\u53EF\u8FBE\u3002 */\r\n  html.dms-right-open [data-sidebar-right-session] [data-sidebar-right-mode],\r\n  html.dms-right-open [data-sidebar-right-session] [data-sidebar-right-toggle] {\r\n    display: inline-flex !important;\r\n    pointer-events: auto !important;\r\n  }\r\n\r\n  /* fullscreen right panel: host state is data-sidebar-right-panel="fullscreen";\r\n     sync() mirrors it to html.dms-right-full. The drawer covers the page and the\r\n     edge gestures are disabled in JS while this class is present. */\r\n    html.dms-right-full [class*="_frame"] > [class*="_rightbarCol"] {\r\n    width: 100vw !important;\r\n    max-width: 100vw !important;\r\n    z-index: 95 !important;\r\n    box-shadow: -10px 0 28px rgba(15, 23, 42, 0.18) !important;\r\n    transform: translateX(0) !important;\r\n  }\r\n  html.dms-right-full [class*="_centerCol"],\r\n  html.dms-right-full.dms-right-open [class*="_centerCol"] { transform: none !important; }\r\n  html.dms-right-full .dms-scrim { display: none !important; }\r\n\r\n';

  // src/styles/right-drawer-loading.css
  var right_drawer_loading_default = '  /* \u4EFB\u52A133\uFF1Aheader \u7684\u300C\u5BF9\u8BDD/\u8F68\u8FF9\u300Dtab \u884C\u79FB\u5165\u300C...\u300D\u83DC\u5355\uFF1B\u672A\u6210\u529F\u6CE8\u5165\u65F6\u7531 JS \u79FB\u9664\r\n     dms-vtabs-menu\uFF0C\u56DE\u9000\u4E3A header \u5E38\u9A7B\u3002:\u9690\u85CF\u539F\u59CB\u7684\u300C\u5BF9\u8BDD / \u8F68\u8FF9\u300D\u6807\u7B7E\u884C\u3002 */\r\n  html.dms-vtabs-menu [data-conversation-tabs] { display: none !important; }\r\n\r\n  /* \u4EFB\u52A134\uFF1A\u9634\u5F71\u53EA\u6302\u5728\u9762\u677F/rightbarCol \u4E0A\uFF0C\u968F\u62BD\u5C49\u4E00\u8D77\u79FB\u52A8\uFF1B\u5220\u6389 body::after \u56FA\u5B9A\u6E10\u53D8\u3002 */\r\n  html.dms-right-open [class*="_frame"] > [class*="_rightbarCol"],\r\n  html.dms-right-full [class*="_frame"] > [class*="_rightbarCol"] {\r\n    overflow: visible !important;\r\n  }\r\n  html.dms-right-open [data-sidebar-right-session],\r\n  html.dms-right-full [data-sidebar-right-session] {\r\n    box-shadow: -10px 0 28px rgba(15, 23, 42, 0.18) !important;\r\n  }\r\n  /* \u88C1\u526A\u515C\u5E95\uFF1A\u5728 rightbarCol \u5DE6\u8FB9\u7F18\u753B\u968F\u62BD\u5C49\u79FB\u52A8\u7684\u6E10\u53D8\uFF08rightbarCol overflow:visible \u65F6\u53EF\u89C1\uFF09\u3002 */\r\n  html.dms-right-open [class*="_frame"] > [class*="_rightbarCol"]::before,\r\n  html.dms-right-full [class*="_frame"] > [class*="_rightbarCol"]::before {\r\n    content: "";\r\n    position: absolute;\r\n    top: 0; bottom: 0; left: 0;\r\n    width: 24px;\r\n    transform: translateX(-100%);\r\n    background: linear-gradient(to left, rgba(15, 23, 42, 0.20), rgba(15, 23, 42, 0));\r\n    pointer-events: none;\r\n    z-index: 5;\r\n  }\r\n\r\n  /* \u4EFB\u52A135\uFF1A\u6253\u5F00\u6001\u5F3A\u5236\u53EF\u4EA4\u4E92\u2014\u2014\u8986\u76D6 preload \u7684 pointer-events:none\uFF1Bscrim(z80) \u5728\u9762\u677F(z90) \u4E4B\u4E0B\u4E0D\u6321\u70B9\u51FB\u3002 */\r\n  html.dms-right-open [class*="_frame"] > [class*="_rightbarCol"],\r\n  html.dms-right-open [class*="_frame"] > [class*="_rightbarCol"] *,\r\n  html.dms-right-open [data-sidebar-right-session],\r\n  html.dms-right-open [data-sidebar-right-session] *,\r\n  html.dms-right-open [data-sidebar-right-panel],\r\n  html.dms-right-open [data-sidebar-right-panel] * {\r\n    pointer-events: auto !important;\r\n  }\r\n\r\n';

  // src/styles/scrim.css
  var scrim_default = '  /* ---------- scrim ------------------------------------------------------- */\r\n  .dms-scrim {\r\n    position: fixed; inset: 0; z-index: 80;\r\n    background: transparent !important;\r\n    opacity: 0; pointer-events: none;\r\n    transition: opacity 0.2s ease;\r\n  }\r\n  html.dms-left-open .dms-scrim,\r\n  html.dms-right-open .dms-scrim { opacity: 1; pointer-events: auto; }\r\n\r\n  /* App-style push: the page moves with the drawer. This deliberately revisits\r\n     the "never push" rule in HANDOVER \xA714 \u2014 the blank strip seen then came from\r\n     the host sidebar not being mounted yet; with the P0 preload fix it is always\r\n     painted under the page, so pushing exposes the drawer, not a white gap.\r\n     Duration/easing match the drawer transition (0.24s) for a single motion. */\r\n  html.dms-left-open [class*="_centerCol"] {\r\n    transform: translate3d(var(--dms-drawer-w), 0, 0) !important;\r\n    opacity: 1 !important;\r\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\r\n  }\r\n  /* Right drawer is an app-style push again. The preloaded left sidebar is\r\n     hidden while the page is shifted, so closing cannot expose it. */\r\n  html.dms-right-open [class*="_centerCol"] {\r\n    transform: translate3d(calc(-1 * var(--dms-drawer-w)), 0, 0) !important;\r\n    opacity: 1 !important;\r\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\r\n  }\r\n  html:not(.dms-left-open):not(.dms-right-open) [class*="_centerCol"] {\r\n    transform: none !important;\r\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\r\n  }\r\n\r\n';

  // src/styles/topbar.css
  var topbar_default = `  /* ---------- top bar (host header, restyled) ----------------------------- */\r
  [class*="_centerCol"] header.dms-topbar {\r
    height: var(--dms-topbar) !important;\r
    min-height: var(--dms-topbar) !important;\r
    padding: 0 12px !important;\r
    background: var(--dms-bg) !important;\r
    border-bottom: none !important;\r
    box-sizing: border-box !important;\r
    align-items: center !important;\r
    position: relative !important;\r
    z-index: 30 !important;\r
  }\r
  [class*="_centerCol"] header.dms-topbar [class*="_headerLeading"] {\r
    display: flex !important; align-items: center !important;\r
    gap: 4px !important; min-width: 0 !important; height: 100%;\r
  }\r
  [class*="_centerCol"] header.dms-topbar [class*="_headerCorner"] {\r
    display: flex !important; align-items: center !important; gap: 4px !important;\r
    position: relative !important; right: auto !important; top: auto !important;\r
    height: 100%;\r
  }  [class*="_centerCol"] header.dms-topbar [data-conversation-header-leading],\r
  [class*="_centerCol"] header.dms-topbar [data-conversation-header-corner] {\r
    gap: 4px !important; align-items: center !important;\r
  }\r
  [class*="_centerCol"] header.dms-topbar [class*="_titleRow"] { align-items: center !important; min-height: 100%; }\r
  [class*="_centerCol"] header.dms-topbar[class*="headerBlank"] .dms-plus { display: none !important; }\r
\r
  .dms-menu { position: relative !important; z-index: 6 !important; }\r
  /* 0.6.18: all injected header buttons copy the DSH host icon-button metrics\r
     (ui-sidebar HeaderLeadingControls): 28px square, radius-sm, label-secondary,\r
     16px glyph, transparent + interactive hover. No custom sizes/colors. */\r
  /* 0.6.18 \u4FEE\u6B63\uFF1A\u6240\u6709\u6CE8\u5165\u6309\u94AE\u7EDF\u4E00 DSH \u5BBF\u4E3B\u5B98\u65B9\u56FE\u6807\u6309\u94AE\u89C4\u683C\r
     \u2014\u2014 28\xD728\u3001\u900F\u660E\u5E95\u300116px \u56FE\u6807\u3001\u6309\u4E0B\u6D45\u8272\u53CD\u9988\uFF08\u9876\u90E8\u680F\u4E0E\u53F3\u680F\u5171\u7528\u540C\u4E00\u5957\uFF09\u3002 */\r
  .dms-iconbtn {\r
    width: 28px; height: 28px; flex: 0 0 28px;\r
    display: inline-flex; align-items: center; justify-content: center;\r
    border: 0; border-radius: var(--dsw-radius-sm, 8px); padding: 0; margin: 0;\r
    background: transparent; color: var(--dsw-alias-label-secondary, var(--dms-text-2));\r
    -webkit-tap-highlight-color: transparent;\r
    cursor: pointer;\r
  }\r
  .dms-iconbtn:active { background: var(--dsw-alias-interactive-bg-hover, var(--dms-surface-2)) !important; }\r
  .dms-iconbtn svg { display: block; width: 16px !important; height: 16px !important; }\r
  /* Do not inflate the host's own header buttons: keep the official 28px/16px so\r
     the injected icons and the host actions share one compact row. */\r
  [class*="_centerCol"] header.dms-topbar [class*="_button_"],\r
  [class*="_centerCol"] header.dms-topbar [class*="_iconButton"] {\r
    width: 28px !important; height: 28px !important; min-width: 28px !important;\r
    border-radius: var(--dsw-radius-sm, 8px) !important;\r
    color: var(--dsw-alias-label-secondary, var(--dms-text-2)) !important;\r
  }\r
  [class*="_centerCol"] header.dms-topbar [class*="_button_"] svg,\r
  [class*="_centerCol"] header.dms-topbar [class*="_iconButton"] svg { width: 16px !important; height: 16px !important; }\r
`;

  // src/styles/hero.css
  var hero_default = '  /* ---------- hero -------------------------------------------------------- */\r\n  [class*="_centerCol"] [class*="_headline"] {\r\n    flex-direction: column !important;\r\n    align-items: center !important;\r\n    justify-content: center !important;\r\n    gap: 14px !important;\r\n  }\r\n  [class*="_centerCol"] [class*="_fishHitbox"] svg { width: 64px !important; height: 48px !important; }\r\n  [class*="_centerCol"] [class*="_titleGroup"] { gap: 0 !important; }\r\n  [class*="_centerCol"] [class*="_titleGroup"] > span:first-child {\r\n    font-size: 21px !important; font-weight: 600 !important; letter-spacing: 0.2px !important;\r\n  }\r\n  [class*="_previewBadge"] { display: none !important; }\r\n\r\n  /* hero page: keep the greeter centred but pin the composer to the bottom */\r\n  html.dms-hero-home [class*="_scrollBody"] { justify-content: flex-start !important; }\r\n  html.dms-hero-home [data-composer-seat] {\r\n    flex: 1 1 auto !important; min-height: 0 !important;\r\n    display: flex !important; flex-direction: column !important;\r\n  }\r\n  html.dms-hero-home [class*="_composerHero"] {\r\n    flex: 1 1 auto !important; min-height: 0 !important;\r\n    display: flex !important; flex-direction: column !important;\r\n    justify-content: flex-end !important;\r\n  }\r\n  html.dms-hero-home [class*="_composerHero"] > [class*="_root"] {\r\n    margin-top: auto !important; margin-bottom: auto !important;\r\n  }\r\n  /* 0.6.15: compress the vertical rhythm only - the logo and \u63A2\u7D22\u672A\u81F3\u4E4B\u5883 keep\r\n     their host font/logo sizes (the user asked to undo the 0.6.14 shrink). */\r\n  html.dms-attach-open [class*="_centerCol"] [class*="_headline"] {\r\n    gap: 6px !important;\r\n    margin-top: 0 !important;\r\n  }\r\n\r\n  /* conversation messages align with the composer card width */\r\n  [class*="_centerCol"] [class*="_scroll"]:has(> [class*="_column"]) {\r\n    padding-left: 12px !important;\r\n    padding-right: 12px !important;\r\n  }\r\n\r\n';

  // src/styles/composer.css
  var composer_default = '  /* ---------- composer ---------------------------------------------------- */\r\n  [data-composer-seat] { background: var(--dms-bg) !important; }\r\n  [data-composer-card] {\r\n    border-radius: var(--dms-radius-lg) !important;\r\n    background: var(--dms-surface) !important;\r\n    border: 0 !important;\r\n    box-shadow: var(--dms-shadow-card) !important;\r\n    padding: 12px 12px 10px !important;\r\n    margin: 0 12px calc(8px + env(safe-area-inset-bottom, 0px)) !important;\r\n  }\r\n  [data-composer-input] { font-size: 16px !important; line-height: 1.45 !important; color: var(--dms-text) !important; }\r\n  [data-composer-placeholder] { font-size: 16px !important; color: var(--dms-text-2) !important; }\r\n  [data-composer-card] [class*="_row"] { gap: 6px !important; }\r\n  [data-composer-card] [class*="_add"] {\r\n    width: 36px !important; height: 36px !important; min-width: 36px !important;\r\n    border-radius: 50% !important; background: var(--dms-surface-2) !important;\r\n    color: var(--dms-text) !important; border: 0 !important;\r\n  }\r\n  [data-composer-card] [class*="_add"] svg { width: 18px !important; height: 18px !important; }\r\n  [data-composer-card] [class*="_primary"] {\r\n    width: 38px !important; height: 38px !important; min-width: 38px !important;\r\n    border-radius: 50% !important;\r\n    background: var(--dms-blue) !important;\r\n    color: #fff !important;\r\n    border: 0 !important;\r\n    box-shadow: 0 4px 12px rgba(66, 110, 254, 0.32) !important;\r\n    transition: background 0.16s ease, transform 0.12s ease !important;\r\n  }\r\n  [data-composer-card] [class*="_primary"]:disabled,\r\n  [data-composer-card] [class*="_primary"][aria-disabled="true"] {\r\n    background: var(--dms-surface-2) !important;\r\n    color: var(--dms-text-2) !important;\r\n    box-shadow: none !important;\r\n  }\r\n  [data-composer-card] [class*="_primary"] svg { width: 19px !important; height: 19px !important; }\r\n  [data-composer-card] [class*="_primary"]:active { transform: scale(0.94); }\r\n\r\n  /* DSH-style round icon controls: permission + model, no labels/chevrons */\r\n  [class*="_modes"] button, [class*="_standardControls"] button {\r\n    width: 36px !important; height: 36px !important; min-width: 36px !important;\r\n    padding: 0 !important;\r\n    border-radius: 50% !important;\r\n    background: var(--dms-surface-2) !important;\r\n    border: 0 !important;\r\n    color: var(--dms-text) !important;\r\n    font-size: 0 !important;\r\n    display: inline-flex !important; align-items: center !important; justify-content: center !important;\r\n    overflow: hidden !important;\r\n  }\r\n  [class*="_modes"] button [class*="_triggerLabel"],\r\n  [class*="_modes"] button [class*="_chevron"],\r\n  [class*="_standardControls"] button [class*="_triggerLabel"],\r\n  [class*="_standardControls"] button [class*="_chevron"] { display: none !important; }\r\n  [class*="_modes"] button svg, [class*="_standardControls"] button svg {\r\n    display: block !important;\r\n    width: 18px !important; height: 18px !important; color: var(--dms-text) !important;\r\n  }\r\n  [class*="_standardControls"] button svg:last-child { display: none !important; }\r\n  .dms-menu svg { transform: scaleX(-1); }\r\n  [class*="_notice"] { color: var(--dms-text-2) !important; background: transparent !important; }\r\n\r\n  /* conversation footer stats: keep the three parts on one compact line */\r\n';

  // src/styles/composer-stats.css
  var composer_stats_default = '  [class*="_composerDock"], [data-composer-dock] {\r\n    padding: 0 8px calc(3px + env(safe-area-inset-bottom, 0px)) !important;\r\n    min-height: 16px !important;\r\n    font-size: 10.5px !important;\r\n    color: var(--dms-text-2) !important;\r\n    display: flex !important; align-items: center !important;\r\n    gap: 4px !important;\r\n    overflow: hidden !important;\r\n  }\r\n  [class*="_composerDock"] > *, [data-composer-dock] > * {\r\n    min-width: 0 !important;\r\n    overflow: hidden !important;\r\n    text-overflow: ellipsis !important;\r\n    white-space: nowrap !important;\r\n    font-size: 10.5px !important;\r\n    line-height: 1.25 !important;\r\n    gap: 3px !important;\r\n  }\r\n  [class*="_composerDock"] svg, [data-composer-dock] svg { width: 12px !important; height: 12px !important; }\r\n  [class*="_composerDock"] button, [data-composer-dock] button { font-size: 10.5px !important; height: auto !important; padding: 0 1px !important; }\r\n  [data-composer-stats] {\r\n    gap: 0 !important;\r\n    justify-content: space-between !important;\r\n    width: 100% !important;\r\n    max-width: 100% !important;\r\n    padding: 0 6px !important;\r\n    font-size: 10px !important;\r\n    line-height: 1.25 !important;\r\n    overflow: visible !important;\r\n  }\r\n  [data-composer-stats] > * {\r\n    flex: 0 0 auto !important;\r\n    max-width: none !important;\r\n    min-width: 0 !important;\r\n    overflow: visible !important;\r\n  }\r\n  [data-composer-stats] [class*="_pill"] {\r\n    max-width: none !important;\r\n    padding: 0 1px !important;\r\n    gap: 2px !important;\r\n    font-size: 10px !important;\r\n    white-space: nowrap !important;\r\n  }\r\n  [data-composer-stats] [class*="_label"] {\r\n    min-width: 0 !important;\r\n    overflow: visible !important;\r\n    text-overflow: clip !important;\r\n    white-space: nowrap !important;\r\n  }\r\n  [data-composer-stats] [class*="_sep"] {\r\n    display: inline-block !important;\r\n    width: 5px !important;\r\n    height: 1px !important;\r\n    margin: 0 2px !important;\r\n    overflow: hidden !important;\r\n    color: transparent !important;\r\n    font-size: 0 !important;\r\n    vertical-align: middle !important;\r\n  }\r\n  [data-composer-stats] { gap: 6px !important; }\r\n  [data-composer-stats] [class*="_label"] { display: inline-flex !important; align-items: center !important; gap: 2px !important; }\r\n  [data-composer-stats] svg { width: 10px !important; height: 10px !important; }\r\n  [class*="_statusBar"], [class*="_statusLine"], [class*="_sessionStats"], [class*="_statsLine"], [class*="_usageBar"] {\r\n    font-size: 11px !important;\r\n    gap: 6px !important;\r\n    padding-left: 12px !important; padding-right: 12px !important;\r\n    overflow: hidden !important;\r\n  }\r\n  [class*="_statusBar"] > *, [class*="_statusLine"] > *, [class*="_sessionStats"] > *, [class*="_statsLine"] > * {\r\n    min-width: 0 !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;\r\n  }\r\n\r\n';

  // src/styles/settings.css
  var settings_default = '  /* ---------- settings ---------------------------------------------------- */\r\n  [data-shortcut-modal="settings"], [data-shortcut-modal="settings"] * { box-sizing: border-box !important; }\r\n  [data-shortcut-modal="settings"] {\r\n    position: fixed !important;\r\n    inset: 0 !important;\r\n    width: 100vw !important;\r\n    max-width: none !important;\r\n    height: 100% !important;\r\n    max-height: none !important;\r\n    margin: 0 !important;\r\n    border-radius: 0 !important;\r\n    background: var(--dms-bg-soft) !important;\r\n    display: flex !important;\r\n    flex-direction: column !important;\r\n    padding: calc(52px + env(safe-area-inset-top, 0px)) 0 0 !important;\r\n    overflow: hidden !important;\r\n  }\r\n  .dms-settings-chrome {\r\n    display: none;\r\n    position: fixed;\r\n    left: 0; right: 0; top: 0;\r\n    height: calc(52px + env(safe-area-inset-top, 0px));\r\n    padding-top: env(safe-area-inset-top, 0px);\r\n    box-sizing: border-box;\r\n    align-items: center;\r\n    justify-content: center;\r\n    background: var(--dms-bg);\r\n    border-bottom: 1px solid var(--dms-line);\r\n    z-index: 2147483000;\r\n  }\r\n  html.dms-settings-open .dms-settings-chrome { display: flex; }\r\n  .dms-settings-chrome .dms-settings-back {\r\n    position: absolute; left: 4px; top: 50%; transform: translateY(-50%);\r\n    width: 44px; height: 44px; border: 0; border-radius: 50%;\r\n    background: transparent; color: var(--dms-text);\r\n    display: inline-flex; align-items: center; justify-content: center;\r\n  }\r\n  .dms-settings-chrome .dms-settings-back:active { background: var(--dms-surface-2); }\r\n  .dms-settings-chrome .dms-settings-back svg { width: 22px; height: 22px; }\r\n  .dms-settings-chrome .dms-settings-title {\r\n    display: flex; align-items: center; gap: 7px;\r\n    font-size: 17px; font-weight: 600; color: var(--dms-text); line-height: 1;\r\n  }\r\n  .dms-settings-chrome .dms-settings-title svg { width: 19px; height: 19px; }\r\n\r\n  /* settings list page */\r\n  [data-shortcut-modal="settings"] > [class*="_nav"] {\r\n    display: flex !important; flex-direction: column !important;\r\n    width: 100% !important;\r\n    padding: 8px 12px calc(16px + env(safe-area-inset-bottom, 0px)) !important;\r\n    background: transparent !important;\r\n    border-bottom: 0 !important;\r\n    overflow: auto !important;\r\n  }\r\n  [data-shortcut-modal="settings"] > [class*="_nav"] [class*="_navTitle"] { display: none !important; }\r\n  [data-shortcut-modal="settings"] > [class*="_nav"] [class*="_navList"] {\r\n    display: flex !important; flex-direction: column !important;\r\n    width: 100% !important; gap: 0 !important;\r\n    overflow: hidden !important; padding: 0 !important;\r\n    background: var(--dms-surface) !important;\r\n    border-radius: 12px !important;\r\n  }\r\n  [data-shortcut-modal="settings"] > [class*="_nav"] [class*="_navCell"] {\r\n    width: 100% !important; height: 46px !important;\r\n    flex: 0 0 auto !important;\r\n    display: flex !important; flex-direction: row !important;\r\n    align-items: center !important; justify-content: flex-start !important;\r\n    gap: 10px !important;\r\n    padding: 0 12px !important;\r\n    border-radius: 0 !important;\r\n    background: transparent !important;\r\n    border-bottom: 1px solid var(--dms-line) !important;\r\n    color: var(--dms-text) !important;\r\n    font-size: 15px !important; font-weight: 400 !important;\r\n    border: 0 !important;\r\n    position: relative !important;\r\n    white-space: nowrap !important;\r\n  }\r\n  [data-shortcut-modal="settings"] > [class*="_nav"] [class*="_navCell"] svg {\r\n    width: 20px !important; height: 20px !important;\r\n    flex: 0 0 20px !important; color: var(--dms-text) !important;\r\n  }\r\n  [data-shortcut-modal="settings"] > [class*="_nav"] [class*="_navCell"]::after {\r\n    content: "\\203A"; position: absolute; right: 12px;\r\n    font-size: 20px; line-height: 1; color: var(--dms-text-2);\r\n  }\r\n  [data-shortcut-modal="settings"] > [class*="_nav"] [class*="_navCell"][class*="_active"] {\r\n    background: transparent !important; color: var(--dms-text) !important; font-weight: 400 !important;\r\n  }\r\n  [data-shortcut-modal="settings"] > [class*="_nav"] [class*="_navCell"]:last-child { border-bottom: 0 !important; }\r\n\r\n  /* mode switches only touch direct children so nested dialogs stay usable */\r\n  html.dms-settings-list [data-shortcut-modal="settings"] > [class*="_content"] { display: none !important; }\r\n  html.dms-settings-section [data-shortcut-modal="settings"] > [class*="_nav"] { display: none !important; }\r\n  html.dms-settings-section [data-shortcut-modal="settings"] > [class*="_content"] {\r\n    display: flex !important; flex-direction: column !important;\r\n    flex: 1 1 auto !important; min-height: 0 !important; overflow: hidden !important;\r\n  }\r\n  html.dms-settings-section [data-shortcut-modal="settings"] > [class*="_content"] > [class*="_header"] { display: none !important; }\r\n  [data-shortcut-modal="settings"] > [class*="_content"] > [class*="_options"] {\r\n    flex: 1 1 auto !important;\r\n    overflow-y: auto !important;\r\n    overflow-x: hidden !important;\r\n    padding: 8px 12px calc(20px + env(safe-area-inset-bottom, 0px)) !important;\r\n  }\r\n  [data-shortcut-modal="settings"] > [class*="_content"] > [class*="_options"]::-webkit-scrollbar,\r\n  [data-shortcut-modal="settings"] > [class*="_nav"]::-webkit-scrollbar { width: 0 !important; height: 0 !important; }\r\n  [data-shortcut-modal="settings"] > [class*="_content"] > [class*="_options"] { scrollbar-width: none !important; }\r\n\r\n  [data-shortcut-modal="settings"] [class*="_section"] {\r\n    width: 100% !important;\r\n    background: var(--dms-surface) !important;\r\n    border-radius: 12px !important;\r\n    margin: 0 0 6px !important;\r\n    padding: 0 12px !important;\r\n    overflow: hidden !important;\r\n  }\r\n  [data-shortcut-modal="settings"] [class*="_section"] > * {\r\n    border-bottom: 1px solid var(--dms-line) !important;\r\n    padding: 10px 0 !important;\r\n  }\r\n  [data-shortcut-modal="settings"] [class*="_section"] > *:last-child { border-bottom: 0 !important; }\r\n  [data-shortcut-modal="settings"] [class*="_group"] { padding: 10px 0 !important; }\r\n  [data-shortcut-modal="settings"] [class*="_group"] [class*="_title"] {\r\n    font-size: 12.5px !important; color: var(--dms-text-2) !important; font-weight: 500 !important;\r\n    margin-bottom: 6px !important;\r\n  }\r\n  [data-shortcut-modal="settings"] [class*="_row"] {\r\n    display: flex !important; align-items: center !important; gap: 10px !important;\r\n    width: 100% !important; max-width: 100% !important; min-width: 0 !important;\r\n  }\r\n  [class*="_rowText"] { flex: 1 1 auto !important; min-width: 0 !important; align-items: flex-start !important; padding-right: 0 !important; }\r\n  [class*="_rowText"] [class*="_title"], [class*="_rowText"] [class*="_desc"] {\r\n    text-align: left !important; margin-left: 0 !important;\r\n    width: auto !important; max-width: 100% !important;\r\n  }\r\n  [class*="_rowText"] [class*="_desc"] { flex: 1 1 auto !important; align-self: stretch !important; width: 100% !important; }\r\n  [data-shortcut-modal="settings"] [class*="_title"] {\r\n    font-size: 14.5px !important; color: var(--dms-text) !important; font-weight: 500 !important;\r\n    text-align: left !important; white-space: normal !important;\r\n  }\r\n  body [data-shortcut-modal="settings"] [class*="_rowText"] { align-items: flex-start !important; }\r\n  body [data-shortcut-modal="settings"] [class*="_title"] { text-align: left !important; width: 100% !important; }\r\n  [class*="_desc"], [class*="_description"] {\r\n    font-size: 12px !important; color: var(--dms-text-2) !important;\r\n    margin-top: 2px !important; line-height: 1.4 !important;\r\n  }\r\n  [data-shortcut-modal="settings"] [class*="_selector"] {\r\n    flex: 0 0 auto !important;\r\n    width: auto !important;\r\n    max-width: 62% !important;\r\n    min-width: 0 !important;\r\n    height: 30px !important;\r\n    padding: 0 9px !important;\r\n    font-size: 12px !important;\r\n    display: inline-flex !important; align-items: center !important;\r\n    color: var(--dms-text-2) !important;\r\n    white-space: nowrap !important;\r\n  }\r\n  [data-shortcut-modal="settings"] [class*="_cubeRow"] { display: flex !important; flex-direction: row !important; gap: 8px !important; }\r\n  [data-shortcut-modal="settings"] [class*="_themeCube"] {\r\n    flex: 1 1 0 !important; min-width: 0 !important; width: auto !important;\r\n    white-space: nowrap !important;\r\n  }\r\n  [data-shortcut-modal="settings"] [class*="_themeCube"]:not([class*="_selected"]) {\r\n    background: transparent !important;\r\n  }\r\n\r\n  /* provider/model editor page */\r\n  [data-shortcut-modal="settings"] [class*="_editorActions"] {\r\n    display: flex !important; flex-wrap: wrap !important; gap: 8px !important;\r\n  }\r\n  [data-shortcut-modal="settings"] [class*="_modelRow"] {\r\n    display: flex !important; flex-wrap: wrap !important; gap: 8px !important;\r\n    width: 100% !important;\r\n  }\r\n  [data-shortcut-modal="settings"] [class*="_modelRow"] input {\r\n    flex: 1 1 110px !important; min-width: 0 !important;\r\n    font-size: 12px !important; padding: 0 6px !important;\r\n  }\r\n  [data-shortcut-modal="settings"] [class*="_modelRow"] [class*="_iconButton"] {\r\n    width: 24px !important; height: 24px !important; min-width: 24px !important; padding: 0 !important;\r\n  }\r\n  [data-shortcut-modal="settings"] [class*="_modelEntry"] { width: 100% !important; }\r\n  [data-shortcut-modal="settings"] [class*="_addModelButton"],\r\n  [data-shortcut-modal="settings"] [class*="_addButton"] {\r\n    width: auto !important; height: auto !important; min-width: 0 !important;\r\n    white-space: nowrap !important;\r\n  }\r\n  [data-shortcut-modal="settings"] [class*="_modelList"],\r\n  [data-shortcut-modal="settings"] [class*="_customizedBody"] { width: 100% !important; }\r\n\r\n  /* long model names wrap instead of clipping */\r\n  [role=menu] [role=menuitem], [class*="_modelItem"], [class*="_optionItem"] { white-space: normal !important; height: auto !important; min-height: 40px !important; }\r\n  [role=menu] [role=menuitem] [class*="_label"], [class*="_modelItem"] [class*="_label"] { white-space: normal !important; line-height: 1.35 !important; }\r\n\r\n  /* the host sidebar is kept mounted (preloaded) and pinned off-screen; opening slides it in */\r\n  html.dms-preload-left [class*="_frame"] > [class*="_sidebarCol"] {\r\n    /* Keep the host sidebar expanded and *under* the opaque page. It is fully\r\n       visible to the renderer (so plugins/sidebar content paint before the\r\n       first touch) but covered by centerCol; opening only raises its z-index.\r\n       Off-screen/opacity-0 preloads skipped paint and produced a white first frame. */\r\n    transform: none !important;\r\n    opacity: 1 !important;\r\n    z-index: 0 !important;\r\n    animation: none !important;\r\n    transition: none !important;\r\n    pointer-events: none !important;\r\n  }\r\n  html.dms-preload-left [class*="_centerCol"] {\r\n    position: relative !important;\r\n    z-index: 1 !important;\r\n    background: var(--dms-bg) !important;\r\n    /* Promote the page once at phone-layout time. The right drawer pushes this\r\n       layer; without a pre-existing compositor layer the first transform frame\r\n       re-rasterized a large conversation DOM and stalled mid-animation. */\r\n    will-change: transform !important;\r\n    backface-visibility: hidden !important;\r\n  }\r\n  html.dms-left-hide [class*="_frame"] > [class*="_sidebarCol"] {\r\n    transform: translateX(-100%) !important;\r\n    animation: none !important;\r\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\r\n  }\r\n  /* while a gesture mounts a drawer, pin it off-screen until our compositor frame lands */\r\n  html.dms-gesture-arming [class*="_frame"] > [class*="_sidebarCol"] {\r\n    animation: none !important;\r\n    transition: none !important;\r\n    transform: translateX(-100%) !important;\r\n    will-change: transform !important;\r\n  }\r\n  html.dms-gesture-arming-right [class*="_frame"] > [class*="_rightbarCol"] {\r\n    animation: none !important;\r\n    transition: none !important;\r\n    transform: translateX(100%) !important;\r\n    will-change: transform !important;\r\n  }\r\n  /* The preload rules keep the host sidebar under the page; while the drawer is\r\n     open it must come back above the pushed page. Overriding the combined state\r\n     (instead of removing dms-preload-left on open) avoids a class churn that\r\n     re-ran the host animation and flashed white on fast drawer switches. */\r\n  html.dms-preload-left.dms-left-open [class*="_frame"] > [class*="_sidebarCol"],\r\n  html.dms-left-open [class*="_frame"]:not([data-sidebar-collapsed]) > [class*="_sidebarCol"] {\r\n    z-index: 90 !important;\r\n    pointer-events: auto !important;\r\n    animation: none !important;\r\n    transition: none !important;\r\n    transform: none !important;\r\n  }\r\n\r\n  /* Right drawer follows the left one: the host panel is preloaded and stays\r\n     mounted off-screen; opening/closing only moves it (state = plugin rightVisible). */\r\n  html.dms-preload-right [class*="_frame"] > [class*="_rightbarCol"] {\r\n    transform: translateX(100%) !important;\r\n    opacity: 1 !important;\r\n    z-index: 0 !important;\r\n    animation: none !important;\r\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\r\n    pointer-events: none !important;\r\n  }\r\n  html.dms-preload-right [class*="_centerCol"] {\r\n    position: relative !important;\r\n    z-index: 1 !important;\r\n    background: var(--dms-bg) !important;\r\n  }\r\n  html.dms-preload-right.dms-right-open [class*="_frame"] > [class*="_rightbarCol"],\r\n  html.dms-right-open [class*="_frame"] > [class*="_rightbarCol"] {\r\n    transform: translateX(0) !important;\r\n    pointer-events: auto !important;\r\n    z-index: 90 !important;\r\n  }\r\n\r\n';

  // src/styles/toast.css
  var toast_default = '  /* ---------- toast ------------------------------------------------------- */\r\n  .dms-toast {\r\n    position: fixed; left: 50%;\r\n    bottom: calc(190px + env(safe-area-inset-bottom, 0px));\r\n    transform: translateX(-50%) translateY(8px);\r\n    max-width: 76vw;\r\n    padding: 9px 16px;\r\n    border-radius: 999px;\r\n    background: rgba(22, 24, 30, 0.86);\r\n    color: #fff;\r\n    font-size: 13px;\r\n    line-height: 1.2;\r\n    white-space: nowrap;\r\n    z-index: 2147483600;\r\n    opacity: 0; pointer-events: none;\r\n    transition: opacity 0.16s ease, transform 0.16s ease;\r\n  }\r\n  .dms-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }\r\n\r\n  html.dms-gesture-opened [class*="_frame"]:not([data-sidebar-collapsed]) > [class*="_sidebarCol"] { animation: none !important; }\r\n\r\n';

  // src/styles/gestures.css
  var gestures_default = '  /* ---------- drawer drag (direct compositor transforms) ------------------ */\r\n  html.dms-dragging-left [class*="_centerCol"],\r\n  html.dms-dragging-right [class*="_centerCol"],\r\n  html.dms-drag-close-left [class*="_centerCol"],\r\n  html.dms-drag-close-right [class*="_centerCol"] { transition: none !important; }\r\n  html.dms-dragging-left [class*="_frame"]:not([data-sidebar-collapsed]) > [class*="_sidebarCol"],\r\n  html.dms-drag-close-left [class*="_frame"]:not([data-sidebar-collapsed]) > [class*="_sidebarCol"],\r\n  html.dms-dragging-right [class*="_frame"] > [class*="_rightbarCol"],\r\n  html.dms-drag-close-right [class*="_frame"] > [class*="_rightbarCol"] {\r\n    animation: none !important;\r\n    transition: none !important;\r\n    will-change: transform !important;\r\n    backface-visibility: hidden !important;\r\n  }\r\n\r\n  /* hover-only message actions stay reachable on touch; sidebar rows open theirs on long-press */\r\n  [class*="_message"] [class*="_actions"],\r\n  [class*="_message"] [class*="_actionBar"] {\r\n    opacity: 1 !important;\r\n    visibility: visible !important;\r\n  }\r\n\r\n';

  // src/styles/attach-sheet.css
  var attach_sheet_default = '  /* ---------- composer attach sheet --------------------------------------- */\r\n  .dms-attach-backdrop {\r\n    display: block;\r\n    position: fixed; inset: 0; z-index: 1040;\r\n    background: transparent;\r\n    opacity: 0; pointer-events: none;\r\n    transition: opacity 0.2s ease-out;\r\n  }\r\n  html.dms-attach-open .dms-attach-backdrop { opacity: 1; }\r\n  .dms-attach-sheet {\r\n    display: flex;\r\n    position: fixed; left: 0; right: 0; bottom: 0; z-index: 1049;\r\n    transform: translateY(105%); opacity: 1; pointer-events: none;\r\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);\r\n    background: var(--dms-bg);\r\n    border-radius: 18px 18px 0 0;\r\n    /* 0.6.16: restore the 0.6.13 size/spacing; no upward shadow and no grabber\r\n       line (both read as the dark line the user flagged above \u6700\u8FD1\u7167\u7247). */\r\n    padding: 8px 14px calc(14px + env(safe-area-inset-bottom, 0px));\r\n    box-shadow: none;\r\n    border: 0;\r\n    flex-direction: column; gap: 12px;\r\n    max-height: 50vh;\r\n    /* If the available height cannot fit the strip + action row, scroll inside\r\n       the sheet instead of squashing the content (\u7528\u6237 \u4FEE\u6B631.3). */\r\n    overflow-y: auto;\r\n    overscroll-behavior: contain;\r\n    -webkit-overflow-scrolling: touch;\r\n    scrollbar-width: none;\r\n  }\r\n  .dms-attach-sheet::-webkit-scrollbar { display: none; }\r\n  .dms-attach-recent, .dms-attach-actions { flex: 0 0 auto; }\r\n  html.dms-attach-open .dms-attach-sheet { transform: translateY(0); pointer-events: auto; }\r\n  .dms-attach-recent { display: flex; flex-direction: column; gap: 7px; }\r\n  .dms-attach-recent[hidden] { display: none !important; }\r\n  .dms-attach-recent-title { font-size: 12px; line-height: 1.25; color: var(--dms-text-2); padding: 0 2px; }\r\n  .dms-attach-recent-strip {\r\n    display: flex; gap: 8px; overflow-x: auto; overflow-y: hidden;\r\n    padding: 2px 2px 4px; min-height: 72px; scrollbar-width: none;\r\n    scroll-behavior: auto;\r\n  }\r\n  .dms-attach-recent-strip::-webkit-scrollbar { display: none; }\r\n  .dms-attach-loading {\r\n    font-size: 12px; color: var(--dms-text-2);\r\n    display: flex; align-items: center;\r\n    min-height: 72px; width: 100%;\r\n    pointer-events: none;\r\n  }\r\n  .dms-attach-photo {\r\n    position: relative;\r\n    flex: 0 0 72px; width: 72px; height: 72px; padding: 0;\r\n    border: 0; border-radius: 10px; overflow: hidden; background: var(--dms-surface-2);\r\n  }\r\n  .dms-photo-check {\r\n    position: absolute; top: 4px; right: 4px;\r\n    width: 17px; height: 17px; border-radius: 50%;\r\n    background: rgba(0, 0, 0, 0.34); border: 1.5px solid rgba(255, 255, 255, 0.95);\r\n    color: transparent; display: flex; align-items: center; justify-content: center;\r\n    box-sizing: border-box;\r\n  }\r\n  .dms-attach-photo.selected .dms-photo-check { background: var(--dms-blue); color: #fff; border-color: #fff; }\r\n  .dms-attach-photo.selected img { opacity: 0.86; }\r\n  /* host attachment remove control: keep it the official compact size */\r\n  [class*="_remove"] {\r\n    width: 18px !important; height: 18px !important;\r\n    min-width: 18px !important; min-height: 18px !important;\r\n    font-size: 11px !important; line-height: 1 !important;\r\n  }\r\n  [class*="_remove"] svg { width: 10px !important; height: 10px !important; }\r\n  .dms-attach-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }\r\n  .dms-attach-recent-strip, .dms-attach-photo, .dms-attach-photo img {\r\n    -webkit-touch-callout: none;\r\n    -webkit-user-select: none;\r\n    user-select: none;\r\n  }\r\n  .dms-attach-actions { display: flex; gap: 10px; }\r\n  .dms-attach-action {\r\n    flex: 1 1 0; min-width: 0;\r\n    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px;\r\n    height: 86px; border: 0; border-radius: 14px;\r\n    background: var(--dms-surface-2); color: var(--dms-text);\r\n    font-size: 13px; font-weight: 500;\r\n  }\r\n  .dms-attach-action:active { background: var(--dms-line); }\r\n  .dms-attach-ico { display: inline-flex; color: var(--dms-text); }\r\n  .dms-attach-ico svg { width: 24px; height: 24px; }\r\n\r\n  /* the host "+" rotates into an "x" in step with the sheet (same 0.24s curve) */\r\n  button[data-dms-plus="1"] svg {\r\n    transform: rotate(0deg) !important;\r\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\r\n  }\r\n  html.dms-attach-open button[data-dms-plus="1"] svg { transform: rotate(45deg) !important; }\r\n\r\n';

  // src/styles/keyboard.css
  var keyboard_default = `  /* keyboard-inset fallback (only when the host did not resize the layout) */\r
  html.dms-kb-open [data-composer-seat] {\r
    transform: translateY(calc(-1 * var(--dms-kb, 0px))) !important;\r
    transition: transform 0.16s ease-out !important;\r
  }\r
  html.dms-attach-open [data-composer-seat] {\r
    transform: translateY(calc(-1 * var(--dms-sheet-h, 0px))) !important;\r
    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\r
  }\r
  /* The composer's shield/context popovers live inside centerCol and use host\r
     layer z-index 1100. While the sheet is open drop centerCol's own stacking\r
     context so those popovers can paint above the sheet instead of being\r
     clipped behind it (\u4E0B\u65B9\u754C\u9762\u4E0D\u6D88\u5931\u3001\u6309\u94AE GUI \u53EF\u89C1). */\r
  html.dms-attach-open [class*="_centerCol"] { z-index: auto !important; }\r
  /* the sheet must be gone in the same frame the keyboard starts opening */\r
  html.dms-sheet-instant .dms-attach-sheet,\r
  html.dms-sheet-instant [data-composer-seat],\r
  html.dms-sheet-instant button[data-dms-plus="1"] svg { transition: none !important; }\r
  @keyframes dms-drawer-in {\r
    from { transform: translateX(-100%); }\r
    to { transform: translateX(0); }\r
  }\r
}\r
`;

  // src/styles/desktop.css
  var desktop_default = "@media (min-width: 1024px) {\r\n  .dms-iconbtn, .dms-scrim { display: none !important; }\r\n}";

  // src/core/style.js
  var CSS = [tokens_default, frame_default, left_drawer_default, right_drawer_default, right_drawer_loading_default, scrim_default, topbar_default, hero_default, composer_default, composer_stats_default, settings_default, toast_default, gestures_default, attach_sheet_default, keyboard_default, desktop_default].join("");
  function styleOnce() {
    let tag = document.querySelector('style[data-dsh-mobile-shell="styles"]');
    if (tag === null) {
      tag = document.createElement("style");
      tag.dataset.dshMobileShell = "styles";
      tag.dataset.plugin = "dsh-mobile-shell";
      document.head.appendChild(tag);
    }
    if (tag.textContent !== CSS) tag.textContent = CSS;
    return tag;
  }

  // src/features/left-drawer.js
  var mountRequest = null;
  var mountSeq = 0;
  var lastMountFailureAt = -1;
  var MOUNT_TIMEOUT_MS = 1500;
  var gestureDebug = () => {
    try {
      return new URLSearchParams(location.search).has("dms-gesture-debug");
    } catch (error) {
      return false;
    }
  };
  var dlog = (...args) => {
    if (!gestureDebug()) return;
    try {
      const line = "[dshm-drawer] " + Math.round(performance.now()) + " " + args.map((arg) => String(arg)).join(" ");
      const win = window;
      win.__dshmDrawerLog = win.__dshmDrawerLog || [];
      win.__dshmDrawerLog.push(line);
      if (win.__dshmDrawerLog.length > 120) win.__dshmDrawerLog.shift();
      console.log(line);
    } catch (error) {
    }
  };
  var hostMounted = () => hostLeftOpen();
  function finishMount(ok) {
    const request = mountRequest;
    if (request === null) return;
    mountRequest = null;
    state.sidebarExpandBusy = false;
    state.sidebarMountState = ok ? "mounted" : "failed";
    if (!ok) lastMountFailureAt = performance.now();
    dlog("mount-" + (ok ? "ready" : "timeout"), "reason=" + request.reason, "ms=" + Math.round(performance.now() - request.startedAt));
  }
  function requestMount(reason) {
    if (!isPhone()) return false;
    if (state.rightVisible || document.documentElement.classList.contains("dms-right-open")) return false;
    const root = document.documentElement;
    root.classList.add("dms-preload-left");
    if (hostMounted()) {
      state.sidebarExpandBusy = false;
      state.sidebarMountState = "mounted";
      return true;
    }
    if (mountRequest !== null) return false;
    if (lastMountFailureAt >= 0 && performance.now() - lastMountFailureAt < 500) return false;
    mountRequest = { seq: ++mountSeq, startedAt: performance.now(), reason: reason || "ensure" };
    state.sidebarExpandBusy = true;
    state.sidebarMountState = "requesting";
    dlog("mount-request", "reason=" + mountRequest.reason, "seq=" + mountRequest.seq);
    const layout = state.ctxRef && state.ctxRef.layout;
    if (layout && typeof layout.toggleSidebar === "function") layout.toggleSidebar();
    else {
      const col = sidebarCol();
      const btn = col ? col.querySelector('[class*="_toggle"]') : null;
      if (btn) btn.click();
    }
    const deadline = mountRequest.startedAt + MOUNT_TIMEOUT_MS;
    const waitForHost = () => {
      const request = mountRequest;
      if (request === null || request.seq !== mountSeq) return;
      if (hostMounted()) {
        finishMount(true);
        return;
      }
      if (performance.now() > deadline) {
        finishMount(false);
        return;
      }
      requestAnimationFrame(waitForHost);
    };
    requestAnimationFrame(waitForHost);
    return false;
  }
  function ensureSidebarMounted() {
    return requestMount("ensure");
  }
  function forceMountSidebar() {
    if (!isPhone() || state.leftVisible || state.rightVisible) return;
    document.documentElement.classList.add("dms-preload-left");
    if (hostMounted()) return;
    requestMount("sync");
  }
  function repairLeftHost() {
    if (!state.leftVisible) return;
    const root = document.documentElement;
    root.classList.remove("dms-left-hide");
    root.classList.add("dms-preload-left");
    if (!hostMounted() && !state.rightVisible && !root.classList.contains("dms-right-open")) {
      requestMount("repair");
    }
  }
  function clearDrawerInline() {
    const col = sidebarCol();
    if (col !== null) {
      col.style.removeProperty("animation");
      col.style.removeProperty("transition");
      col.style.removeProperty("transform");
      col.style.removeProperty("z-index");
      col.style.removeProperty("will-change");
    }
    const center = $('[class*="_centerCol"]');
    if (center !== null) {
      center.style.removeProperty("transform");
      center.style.removeProperty("opacity");
      center.style.removeProperty("transition");
      center.style.removeProperty("will-change");
    }
  }
  function openLeftVisual(fromGesture) {
    state.leftVisible = true;
    const leftCol = sidebarCol();
    if (leftCol !== null) leftCol.style.removeProperty("display");
    const root = document.documentElement;
    root.classList.remove("dms-left-hide");
    root.classList.add("dms-left-open");
    if (!hostMounted()) requestMount("open");
    const col = sidebarCol();
    if (col !== null) {
      col.style.setProperty("animation", "none", "important");
      col.style.setProperty("transition", "none", "important");
      col.style.setProperty("transform", fromGesture ? "translate3d(calc(-1 * var(--dms-drawer-w)),0,0)" : "none", "important");
      col.style.setProperty("z-index", "90", "important");
    }
    dlog("open-visual", "hostMounted=" + hostMounted());
    repairLeftHost();
  }
  function closeLeftVisual(animated) {
    if (!state.leftVisible) return;
    state.leftVisible = false;
    dlog("close-visual", "animated=" + animated);
    clearDrawerInline();
    const root = document.documentElement;
    root.classList.remove("dms-left-open");
    if (animated) {
      root.classList.add("dms-left-hide");
      setTimeout(() => {
        if (!leftOpen()) {
          root.classList.remove("dms-left-hide");
          root.classList.add("dms-preload-left");
        }
      }, 260);
    } else {
      root.classList.add("dms-preload-left");
    }
  }
  function toggleLeft() {
    if (leftOpen()) closeLeftVisual(true);
    else openLeftVisual();
  }
  function leftOpen() {
    return state.leftVisible;
  }

  // src/core/events.js
  var listeners = /* @__PURE__ */ new Map();
  function on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, /* @__PURE__ */ new Set());
    listeners.get(event).add(handler);
    return () => {
      const set = listeners.get(event);
      if (set !== void 0) set.delete(handler);
    };
  }
  function emit(event, ...args) {
    const set = listeners.get(event);
    if (set === void 0) return;
    for (const handler of [...set]) {
      try {
        handler(...args);
      } catch (error) {
      }
    }
  }

  // src/features/right-drawer.js
  var preloadGeneration = 0;
  function rightDebugEnabled() {
    try {
      return new URLSearchParams(location.search).has("dms-gesture-debug");
    } catch (error) {
      return false;
    }
  }
  function rlog(...args) {
    if (!rightDebugEnabled()) return;
    try {
      const line = "[dshm-right] " + Math.round(performance.now()) + " " + args.map((arg) => String(arg)).join(" ");
      const win = window;
      win.__dshmRightLog = win.__dshmRightLog || [];
      win.__dshmRightLog.push(line);
      if (win.__dshmRightLog.length > 120) win.__dshmRightLog.shift();
      console.log(line);
    } catch (error) {
    }
  }
  function rightPanelEl() {
    return $("[data-sidebar-right-session]:not([hidden])") || $("[data-sidebar-right-session]");
  }
  function rightSessionId() {
    const panel = rightPanelEl();
    return panel === null ? "" : panel.getAttribute("data-sidebar-right-session") || "";
  }
  function rightPanelHasTab() {
    const panel = rightPanelEl();
    return panel !== null && panel.querySelector("[data-dockkit-tab], [data-sidebar-right-tab]") !== null;
  }
  function rightTabBodyEl() {
    const panel = rightPanelEl();
    return panel === null ? null : panel.querySelector('[class*="_tabBody"], [data-dockkit-tab-body]');
  }
  function rightPanelContentReady() {
    const panel = rightPanelEl();
    if (panel === null) return false;
    if (panel.querySelector("[data-dockkit-tab], [data-sidebar-right-tab]") === null) return false;
    const body = rightTabBodyEl();
    if (body === null) return false;
    const text = (body.textContent || "").replace(/\s+/g, "");
    if (text.length > 2) return true;
    return body.querySelector("button, [class*='_entry'], [class*='_guide'], img, svg, input, textarea, iframe, canvas, video, [contenteditable='true']") !== null;
  }
  var clickHost = (el) => {
    if (el === null) return false;
    state.rightPreloadClick = true;
    try {
      el.click();
    } catch (error) {
    } finally {
      state.rightPreloadClick = false;
    }
    return true;
  };
  function preloadRight() {
    if (!isPhone() || settingsPanel() !== null || state.rightVisible) return;
    if (state.rightPreloadState === "busy") return;
    const sid = rightSessionId();
    if (sid === "") return;
    if (state.rightPreloadAttempts.has(sid)) return;
    if (hostRightOpen()) {
      state.rightPreloadAttempts.add(sid);
      clickHost($("[data-sidebar-right-toggle]"));
      state.rightPreloadState = rightPanelHasTab() ? "ok" : "idle";
      return;
    }
    const expand = $("[data-sidebar-right-expand]");
    if (expand === null) return;
    const now = performance.now();
    if (now - state.lastRightPreloadAt < 2e3) return;
    state.lastRightPreloadAt = now;
    state.rightPreloadAttempts.add(sid);
    state.rightPreloadState = "busy";
    const generation = ++preloadGeneration;
    document.documentElement.classList.add("dms-preload-right");
    clickHost(expand);
    const started = now;
    let addTried = false;
    let collapsed = false;
    const collapse = () => {
      if (collapsed) return;
      if (generation !== preloadGeneration || state.rightVisible) {
        collapsed = true;
        return;
      }
      if (hostRightOpen()) {
        if (!rightPanelHasTab() && !addTried) {
          const addBtn = $("[data-dockkit-add-tab]");
          if (addBtn !== null) {
            addTried = true;
            clickHost(addBtn);
          }
        }
        if (rightPanelContentReady()) {
          collapsed = true;
          setTimeout(() => {
            if (generation !== preloadGeneration || state.rightVisible) return;
            clickHost($("[data-sidebar-right-toggle]"));
            state.rightPreloadState = "ok";
            document.documentElement.setAttribute("data-dms-right-preloaded", "1");
          }, 80);
          return;
        }
      }
      if (performance.now() - started > 2600) {
        if (generation !== preloadGeneration || state.rightVisible) {
          collapsed = true;
          return;
        }
        collapsed = true;
        clickHost($("[data-sidebar-right-toggle]"));
        state.rightPreloadState = "fail";
        document.documentElement.setAttribute("data-dms-right-preload-failed", "1");
        return;
      }
      requestAnimationFrame(collapse);
    };
    requestAnimationFrame(collapse);
  }
  var unlockedInert = [];
  var restoreLeftToken = 0;
  function hideLeftSidebar() {
    const col = document.querySelector('[class*="_sidebarCol"]');
    if (col !== null) col.style.setProperty("display", "none", "important");
  }
  function restoreLeftAfterShift() {
    const token = ++restoreLeftToken;
    const col = document.querySelector('[class*="_sidebarCol"]');
    const center = document.querySelector('[class*="_centerCol"]');
    const finish = () => {
      if (token !== restoreLeftToken) return;
      if (state.rightVisible) return;
      if (col !== null) col.style.removeProperty("display");
    };
    if (col === null || center === null) {
      finish();
      return;
    }
    center.addEventListener("transitionend", (event) => {
      if (event.target === center && event.propertyName === "transform") finish();
    }, { once: true });
    const check = () => {
      if (token !== restoreLeftToken) return;
      if (state.rightVisible) return;
      const transform = window.getComputedStyle(center).transform;
      if (transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)") {
        finish();
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }
  function unlockRightPanel() {
    const session = document.querySelector("[data-sidebar-right-session]");
    if (session === null) return;
    const nodes = [];
    if (session.hasAttribute("inert")) nodes.push(session);
    const panel = session.closest("[data-sidebar-right-panel]");
    if (panel !== null && panel.hasAttribute("inert")) nodes.push(panel);
    const inertNodes = session.querySelectorAll("[inert]");
    for (const el of inertNodes) nodes.push(el);
    for (const el of nodes) {
      if (unlockedInert.indexOf(el) < 0) unlockedInert.push(el);
      el.removeAttribute("inert");
    }
  }
  function lockRightPanel() {
    for (const el of unlockedInert) {
      if (el.isConnected && !el.hasAttribute("inert")) el.setAttribute("inert", "");
    }
    unlockedInert = [];
  }
  function openRight() {
    state.rightVisible = true;
    preloadGeneration += 1;
    if (state.rightPreloadState === "busy") state.rightPreloadState = "cancelled";
    restoreLeftToken += 1;
    hideLeftSidebar();
    document.documentElement.classList.remove("dms-preload-right");
    document.documentElement.classList.add("dms-right-open");
    unlockRightPanel();
    rlog("open", "preloaded=" + document.documentElement.hasAttribute("data-dms-right-preloaded"));
  }
  function closeRight() {
    state.rightVisible = false;
    emit("drawer-close", "right");
    lockRightPanel();
    const root = document.documentElement;
    root.removeAttribute("data-dms-right-wait-timeout");
    root.classList.remove("dms-right-full");
    root.classList.remove("dms-right-open");
    root.classList.add("dms-preload-right");
    restoreLeftAfterShift();
  }
  function toggleRightFullscreen() {
    const root = document.documentElement;
    if (root.classList.contains("dms-right-full")) {
      root.classList.remove("dms-right-full");
    } else {
      state.rightVisible = true;
      root.classList.remove("dms-preload-right");
      root.classList.add("dms-right-open");
      root.classList.add("dms-right-full");
      unlockRightPanel();
    }
    syncRightChrome();
  }
  function syncRightChrome() {
    if (!isPhone()) return;
    const modeBtn = $("[data-sidebar-right-mode]");
    if (modeBtn === null) return;
    const full = document.documentElement.classList.contains("dms-right-full");
    const want = full ? ICONS.exitFull : ICONS.full;
    try {
      if (modeBtn.innerHTML !== want) modeBtn.innerHTML = want;
    } catch (error) {
    }
    const label = full ? "\u9000\u51FA\u5168\u5C4F" : "\u8FDB\u5165\u5168\u5C4F";
    if (modeBtn.getAttribute("aria-label") !== label) modeBtn.setAttribute("aria-label", label);
  }
  var hostRightOpen = () => $("[data-sidebar-right-session]:not([hidden]) [data-sidebar-right-open]") !== null;
  function rightExpandTrigger(node) {
    if (!(node instanceof Element)) return null;
    if (node.closest("[data-sidebar-right-session]") !== null) return null;
    const direct = node.closest("[data-sidebar-right-expand]");
    if (direct !== null) return direct;
    const labelled = node.closest('[aria-label="\u6253\u5F00\u53F3\u4FA7\u8FB9\u680F"], [aria-label="\u5C55\u5F00\u53F3\u4FA7\u8FB9\u680F"], [aria-label="Open right sidebar"], [aria-label="Expand right sidebar"], [aria-label*="\u53F3\u4FA7\u680F"], [aria-label*="\u53F3\u4FA7\u8FB9\u680F"]');
    if (labelled !== null) return labelled;
    const header = node.closest("header");
    if (header === null) return null;
    let el = node;
    for (let depth = 0; el !== null && el !== header && depth < 5; depth++, el = el.parentElement) {
      const cls = typeof el.className === "string" ? el.className : "";
      if ((el.tagName === "BUTTON" || el.getAttribute("role") === "button") && /expand|sidebar-right/i.test(cls + " " + (el.getAttribute("data-sidebar-right-expand") || ""))) return el;
    }
    return null;
  }
  function exitRightFullscreen(closeDrawer) {
    document.documentElement.classList.remove("dms-right-full");
    if (closeDrawer === true) closeRight();
  }

  // src/features/topbar.js
  function bindMenuPreload(menu) {
    if (menu.dataset.dmsPreloadBound === "1") return;
    menu.dataset.dmsPreloadBound = "1";
    menu.addEventListener("pointerdown", () => ensureSidebarMounted(), { passive: true });
  }
  function installMenuButton(leading) {
    const existing = leading.querySelector(".dms-menu");
    if (existing !== null) {
      bindMenuPreload(existing);
      return;
    }
    const menu = makeButton("menu", "\u6253\u5F00\u4FA7\u8FB9\u680F", () => toggleLeft());
    bindMenuPreload(menu);
    leading.appendChild(menu);
  }
  function installRightButton(header, moreButton) {
    const utilities = moreButton !== null && moreButton.parentElement !== null ? moreButton.parentElement : header.querySelector('[class*="_headerUtilities"]');
    const misplaced = [...header.querySelectorAll(".dms-right-menu")];
    if (utilities === null) {
      for (const button of misplaced) button.remove();
      return;
    }
    let existing = utilities.querySelector(".dms-right-menu");
    for (const button of misplaced) {
      if (button !== existing) button.remove();
    }
    if (existing === null) {
      existing = makeButton("panel", "\u6253\u5F00\u53F3\u4FA7\u680F", () => openRight());
      existing.classList.add("dms-right-menu");
    }
    if (moreButton !== null && moreButton.parentElement === utilities) {
      if (existing.previousElementSibling !== moreButton) utilities.insertBefore(existing, moreButton.nextSibling);
    } else if (existing.parentElement !== utilities) {
      utilities.appendChild(existing);
    }
    for (const hostExpand of header.querySelectorAll("[data-sidebar-right-expand]")) {
      if (hostExpand === existing) continue;
      hostExpand.dataset.dmsHidden = "1";
    }
  }
  function ensureTopButtons() {
    if (!isPhone()) return;
    const header = $('[class*="_centerCol"] header');
    if (header === null) return;
    const leading = header.querySelector("[data-conversation-header-leading]");
    if (leading !== null) installMenuButton(leading);
    const moreButton = header.querySelector('[aria-label*="\u66F4\u591A"], [aria-label*="More"], [aria-label="..."]');
    installRightButton(header, moreButton);
  }
  function installTopbarRepair() {
    let headerObserver = null;
    let centerObserver = null;
    let observedHeader = null;
    let observedCenter = null;
    let repairing = false;
    const bind = () => {
      const center = $('[class*="_centerCol"]');
      if (center !== observedCenter) {
        if (centerObserver !== null) centerObserver.disconnect();
        observedCenter = center;
        if (center !== null) {
          centerObserver = new MutationObserver(repair);
          centerObserver.observe(center, { childList: true });
        }
      }
      const header = $('[class*="_centerCol"] header');
      if (header !== observedHeader) {
        if (headerObserver !== null) headerObserver.disconnect();
        observedHeader = header;
        if (header !== null) {
          headerObserver = new MutationObserver(repair);
          headerObserver.observe(header, { childList: true, subtree: true });
        }
      }
    };
    function repair() {
      if (repairing) return;
      repairing = true;
      try {
        ensureTopButtons();
        bind();
      } catch (error) {
      } finally {
        repairing = false;
      }
    }
    const onPointerUp = () => repair();
    document.addEventListener("pointerup", onPointerUp, { capture: true, passive: true });
    ensureTopButtons();
    bind();
    return () => {
      document.removeEventListener("pointerup", onPointerUp, { capture: true });
      if (headerObserver !== null) headerObserver.disconnect();
      if (centerObserver !== null) centerObserver.disconnect();
      headerObserver = null;
      centerObserver = null;
      observedHeader = null;
      observedCenter = null;
    };
  }
  function installRightInterceptors() {
    const disposers = [];
    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      disposers.push(() => target.removeEventListener(type, handler, options));
    };
    listen(document, "click", (event) => {
      if (state.rightPreloadClick) return;
      if (!isPhone()) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target === null) return;
      const ownRight = target.closest(".dms-right-menu");
      if (ownRight !== null) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        openRight();
        return;
      }
      const toggle = target.closest("[data-sidebar-right-toggle]");
      const modeBtn = target.closest("[data-sidebar-right-mode]");
      const expanded = toggle === null && modeBtn === null ? rightExpandTrigger(target) : null;
      if (expanded === null && modeBtn === null && toggle === null) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      if (toggle !== null) {
        closeRight();
        return;
      }
      if (modeBtn !== null) {
        toggleRightFullscreen();
        return;
      }
      if (expanded !== null) {
        state.rightVisible = true;
        document.documentElement.classList.add("dms-right-open");
        try {
          openRight();
        } catch (error) {
        }
        return;
      }
      try {
        openRight();
      } catch (error) {
        state.rightVisible = true;
        document.documentElement.classList.add("dms-right-open");
      }
    }, true);
    return () => {
      for (let index = disposers.length - 1; index >= 0; index -= 1) disposers[index]();
    };
  }

  // src/features/settings.js
  function settingsBack() {
    const root = document.documentElement;
    if (root.classList.contains("dms-settings-section")) {
      root.classList.remove("dms-settings-section");
      root.classList.add("dms-settings-list");
      const title = $(".dms-settings-title-text");
      if (title !== null) title.textContent = "\u8BBE\u7F6E";
      return true;
    }
    const panel = settingsPanel();
    const close = panel === null ? null : panel.querySelector('[class*="_close"]');
    if (close !== null) {
      close.click();
      return true;
    }
    return false;
  }
  function openSettingsSection(cell) {
    const root = document.documentElement;
    root.classList.remove("dms-settings-list");
    root.classList.add("dms-settings-section");
    const label = cell.querySelector('[class*="_navLabel"]');
    const title = $(".dms-settings-title-text");
    if (title !== null) title.textContent = label === null ? "\u8BBE\u7F6E" : label.textContent.trim();
    const options = settingsPanel() === null ? null : settingsPanel().querySelector('[class*="_options"]');
    if (options !== null) options.scrollTop = 0;
  }
  function settingsChrome() {
    let chrome = $(".dms-settings-chrome");
    if (chrome === null) {
      chrome = document.createElement("div");
      chrome.className = "dms-settings-chrome";
      const back = document.createElement("button");
      back.type = "button";
      back.className = "dms-settings-back";
      back.setAttribute("aria-label", "\u8FD4\u56DE");
      back.innerHTML = CHEVRON_LEFT;
      back.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        settingsBack();
      });
      const title = document.createElement("div");
      title.className = "dms-settings-title";
      title.innerHTML = GEAR_ICON + '<span class="dms-settings-title-text">\u8BBE\u7F6E</span>';
      chrome.appendChild(back);
      chrome.appendChild(title);
      document.body.appendChild(chrome);
    }
    return chrome;
  }
  function ensureSettings(panel) {
    settingsChrome();
    const root = document.documentElement;
    const section = panel.querySelector('[class*="_options"]');
    const sectionText = section === null ? "" : (section.innerText || "").slice(0, 120);
    const pluginPage = panel.querySelector('[class*="_market"], [data-dsh-market]') !== null || sectionText.indexOf("\u63D2\u4EF6\u5E02\u573A") >= 0;
    root.classList.toggle("dms-plugin-section", pluginPage);
    if (root.classList.contains("dms-settings-chrome-init") !== true) {
      root.classList.remove("dms-settings-section");
      root.classList.add("dms-settings-list");
      root.classList.add("dms-settings-chrome-init");
      const title = $(".dms-settings-title-text");
      if (title !== null) title.textContent = "\u8BBE\u7F6E";
    }
    if (panel.dataset.dmsNavBound !== "1") {
      panel.dataset.dmsNavBound = "1";
      panel.addEventListener("click", (e) => {
        const target = e.target instanceof Element ? e.target : null;
        const cell = target === null ? null : target.closest('[class*="_navCell"]');
        if (cell !== null) setTimeout(() => openSettingsSection(cell), 30);
      }, true);
    }
  }
  function installSettingsWatcher() {
    const root = document.documentElement;
    const apply2 = () => {
      const panel = settingsPanel();
      if (panel === null) {
        root.classList.remove("dms-settings-open", "dms-settings-list", "dms-settings-section", "dms-settings-chrome-init", "dms-plugin-section");
        return;
      }
      if (root.classList.contains("dms-settings-open")) return;
      settingsChrome();
      root.classList.add("dms-settings-open", "dms-settings-list", "dms-settings-chrome-init");
      root.classList.remove("dms-settings-section");
      const title = $(".dms-settings-title-text");
      if (title !== null) title.textContent = "\u8BBE\u7F6E";
      const options = panel.querySelector('[class*="_options"]');
      if (options !== null) options.scrollTop = 0;
    };
    const observer = new MutationObserver(apply2);
    observer.observe(document.body, { childList: true, subtree: true });
    apply2();
    return () => observer.disconnect();
  }

  // src/features/gestures.js
  function installGestures() {
    const disposers = [];
    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      disposers.push(() => target.removeEventListener(type, handler, options));
    };
    let mode = null;
    let startX = 0, startY = 0, width = 0, locked = false;
    let lastX = 0, lastT = 0, velocity = 0, lastDx = 0;
    let samples = [];
    let activeEl = null, centerEl = null, springRaf = 0, drawerX = 0;
    let gestureSeq = 0;
    let gestureWidth = 0;
    let cachedFrame = null;
    let armRaf = 0;
    let armSide = null;
    let pendingSettle = null;
    let touchSuppressClick = false;
    const root = document.documentElement;
    const debugGesture = () => {
      try {
        return new URLSearchParams(location.search).has("dms-gesture-debug");
      } catch (error) {
        return false;
      }
    };
    const dlog2 = (...args) => {
      if (!debugGesture()) return;
      try {
        const line = "[dshm-gesture] " + Math.round(performance.now()) + " " + args.map((arg) => String(arg)).join(" ");
        const win = window;
        win.__dshmGestureLog = win.__dshmGestureLog || [];
        win.__dshmGestureLog.push(line);
        if (win.__dshmGestureLog.length > 120) win.__dshmGestureLog.shift();
        console.log(line);
      } catch (error) {
      }
    };
    const drawerWidth = () => Math.min(326, Math.round((gestureWidth || window.innerWidth) * 0.8));
    const elFor = (side) => side === "left" ? sidebarCol() : rightbarCol();
    const hostFrame = () => {
      if (cachedFrame === null || !cachedFrame.isConnected) cachedFrame = frame();
      return cachedFrame;
    };
    const leftHostOpen = () => {
      const host = hostFrame();
      return host !== null && !host.hasAttribute("data-sidebar-collapsed");
    };
    const armReady = (side) => side === "left" ? leftHostOpen() : rightbarCol() !== null;
    const stopArm = () => {
      if (armRaf !== 0) {
        cancelAnimationFrame(armRaf);
        armRaf = 0;
      }
      armSide = null;
    };
    const dragClassFor = (m) => m === "open-left" ? "dms-dragging-left" : m === "open-right" ? "dms-dragging-right" : m === "close-left" ? "dms-drag-close-left" : "dms-drag-close-right";
    const clearDragClasses = () => root.classList.remove("dms-dragging-left", "dms-dragging-right", "dms-drag-close-left", "dms-drag-close-right", "dms-gesture-arming", "dms-gesture-arming-right");
    let visualX = null;
    let lastFrameT = 0;
    const MAX_SPEED = 2300;
    const applyFrame = (side, targetX) => {
      const W = drawerWidth();
      const now = performance.now();
      const dt = Math.max(4e-3, Math.min(0.05, lastFrameT === 0 ? 0.016 : (now - lastFrameT) / 1e3));
      lastFrameT = now;
      if (visualX === null) visualX = targetX;
      const maxStep = Math.max(2, MAX_SPEED * dt);
      let x = targetX;
      if (x - visualX > maxStep) x = visualX + maxStep;
      else if (visualX - x > maxStep) x = visualX - maxStep;
      visualX = x;
      if (activeEl === null || !activeEl.isConnected) activeEl = elFor(side);
      if (activeEl !== null) {
        root.classList.remove("dms-gesture-arming", "dms-gesture-arming-right");
        activeEl.style.setProperty("animation", "none", "important");
        activeEl.style.setProperty("transition", "none", "important");
        activeEl.style.setProperty("transform", "translate3d(" + Math.round(x) + "px,0,0)", "important");
        activeEl.style.setProperty("will-change", "transform", "important");
      }
      if (centerEl === null) centerEl = $('[class*="_centerCol"]');
      if (centerEl !== null) {
        const pageX = side === "left" ? Math.max(0, Math.min(W, W + x)) : Math.min(0, Math.max(-W, x - W));
        centerEl.style.setProperty("transition", "none", "important");
        centerEl.style.setProperty("transform", pageX === 0 ? "none" : "translate3d(" + Math.round(pageX) + "px,0,0)", "important");
        centerEl.style.setProperty("opacity", "1", "important");
      }
      drawerX = x;
    };
    const clearInline = () => {
      state.springAnimating = false;
      clearDragClasses();
      if (activeEl !== null) {
        activeEl.style.removeProperty("transform");
        activeEl.style.removeProperty("transition");
        activeEl.style.removeProperty("animation");
        activeEl.style.removeProperty("will-change");
        activeEl.style.removeProperty("z-index");
      }
      if (centerEl !== null) {
        centerEl.style.removeProperty("transform");
        centerEl.style.removeProperty("opacity");
        centerEl.style.removeProperty("transition");
        centerEl.style.removeProperty("will-change");
      }
      activeEl = null;
    };
    const inHorizontalScroller = (node) => {
      let el = node instanceof Element ? node : null;
      for (let depth = 0; el !== null && el !== document.body && depth < 8; depth++) {
        const style = window.getComputedStyle(el);
        if ((style.overflowX === "auto" || style.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 2) return true;
        el = el.parentElement;
      }
      return false;
    };
    const springTo = (side, targetX, willClose, done) => {
      if (springRaf !== 0) cancelAnimationFrame(springRaf);
      dlog2("spring-start", side, "target=" + Math.round(targetX), "close=" + willClose);
      state.gestureBusy = true;
      state.springAnimating = true;
      if (activeEl === null) activeEl = elFor(side);
      let x = drawerX;
      let v = 0;
      const stiffness = 1500;
      const damping = 0.9;
      const dragC = 2 * damping * Math.sqrt(stiffness);
      let last = performance.now();
      const step = (now) => {
        const dt = Math.min(0.034, Math.max(1e-3, (now - last) / 1e3));
        last = now;
        const accel = -stiffness * (x - targetX) - dragC * v;
        v += accel * dt;
        x += v * dt;
        applyFrame(side, x);
        if (Math.abs(x - targetX) > 0.5 || Math.abs(v) > 8) {
          springRaf = requestAnimationFrame(step);
        } else {
          springRaf = 0;
          dlog2("spring-end", side, "close=" + willClose);
          if (willClose) {
            root.classList.remove("dms-left-open", "dms-right-open");
            clearInline();
            state.gestureBusy = false;
            state.springAnimating = false;
            if (typeof done === "function") done();
          } else {
            clearInline();
            state.gestureBusy = false;
            state.springAnimating = false;
            if (typeof done === "function") done();
          }
        }
      };
      springRaf = requestAnimationFrame(step);
    };
    function startArm(side) {
      stopArm();
      const seq = gestureSeq;
      const began = performance.now();
      const deadline = began + 2200;
      let mountRetries = 0;
      let lastMountTry = began;
      armSide = side;
      const tick = () => {
        if (seq !== gestureSeq) return;
        if (armReady(side)) {
          const el = elFor(side);
          armRaf = 0;
          armSide = null;
          if (mode !== null) {
            activeEl = el;
            visualX = null;
            lastFrameT = 0;
            const W = drawerWidth();
            const target = side === "left" ? Math.min(0, lastDx - W) : Math.max(0, W + lastDx);
            applyFrame(side, target);
            dlog2("first-frame", side, "target=" + Math.round(target), "dx=" + Math.round(lastDx));
            return;
          }
          const settle = pendingSettle;
          if (settle !== null && settle.seq === seq) {
            pendingSettle = null;
            runSettle(settle, true);
          }
          return;
        }
        const now = performance.now();
        if (!state.sidebarExpandBusy && mountRetries < 2 && now - lastMountTry > 350) {
          mountRetries += 1;
          lastMountTry = now;
          ensureSidebarMounted();
          dlog2("arm-mount-retry", side, "n=" + mountRetries);
        }
        if (now > deadline) {
          armRaf = 0;
          armSide = null;
          dlog2("arm-timeout", side);
          const settle = pendingSettle;
          if (settle !== null && settle.seq === seq) {
            pendingSettle = null;
            runSettle(settle, false);
          }
          return;
        }
        armRaf = requestAnimationFrame(tick);
      };
      armRaf = requestAnimationFrame(tick);
    }
    function runSettle(settle, paintable) {
      const m = settle.m;
      const dx = settle.dx;
      const threshold = settle.threshold;
      const W = settle.W;
      const fast = settle.fast;
      const stableVelocity = settle.stableVelocity;
      const side = m === "open-left" || m === "close-left" ? "left" : "right";
      dlog2("settle-pending", m, "dx=" + Math.round(dx), "fast=" + fast, "paintable=" + paintable);
      const finalizeWithoutPaint = () => {
        if (m === "open-left") {
          if (dx >= threshold || fast && stableVelocity > 0) root.classList.add("dms-left-open", "dms-gesture-opened");
          else closeLeftVisual(false);
        } else if (m === "open-right") {
          if (-dx >= threshold || fast && stableVelocity < 0) root.classList.add("dms-right-open");
          else closeRight();
        } else if (m === "close-left") {
          if (-dx >= threshold || fast && stableVelocity < 0) closeLeftVisual(false);
          else root.classList.add("dms-left-open");
        } else if (m === "close-right") {
          if (dx >= threshold || fast && stableVelocity > 0) closeRight();
          else root.classList.add("dms-right-open");
        }
        requestAnimationFrame(() => {
          clearInline();
          state.gestureBusy = false;
        });
      };
      if (!paintable) {
        finalizeWithoutPaint();
        return;
      }
      if (!armReady(side)) {
        finalizeWithoutPaint();
        return;
      }
      const el = elFor(side);
      const startX2 = m === "open-left" ? Math.min(0, dx - W) : m === "open-right" ? Math.max(0, W + dx) : m === "close-left" ? Math.min(0, dx) : Math.max(0, dx);
      activeEl = el;
      visualX = null;
      lastFrameT = 0;
      applyFrame(side, startX2);
      dlog2("settle-pending-continue", m, "start=" + Math.round(startX2));
      if (m === "open-left") {
        if (dx >= threshold || fast && stableVelocity > 0) {
          root.classList.add("dms-left-open", "dms-gesture-opened");
          springTo("left", 0, false);
        } else {
          springTo("left", -W, true, () => closeLeftVisual(false));
        }
        return;
      }
      if (m === "open-right") {
        if (-dx >= threshold || fast && stableVelocity < 0) {
          root.classList.add("dms-right-open");
          springTo("right", 0, false);
        } else {
          springTo("right", W, true, () => closeRight());
        }
        return;
      }
      if (m === "close-left") {
        if (-dx >= threshold || fast && stableVelocity < 0) springTo("left", -W, true, () => closeLeftVisual(false));
        else {
          root.classList.add("dms-left-open");
          springTo("left", 0, false);
        }
        return;
      }
      if (m === "close-right") {
        if (dx >= threshold || fast && stableVelocity > 0) springTo("right", W, true, () => closeRight());
        else {
          root.classList.add("dms-right-open");
          springTo("right", 0, false);
        }
      }
    }
    const cancelGesture = () => {
      mode = null;
      locked = false;
      pendingSettle = null;
      stopArm();
      state.gestureBusy = false;
      clearInline();
    };
    const onTouchStart = (e) => {
      if (!isPhone() || e.touches.length !== 1) return;
      if (state.gestureBusy || springRaf !== 0) return;
      gestureSeq += 1;
      gestureWidth = window.innerWidth;
      touchSuppressClick = false;
      stopArm();
      pendingSettle = null;
      clearInline();
      visualX = null;
      lastFrameT = 0;
      mode = null;
      locked = false;
      velocity = 0;
      if (settingsPanel() !== null) return;
      if (root.classList.contains("dms-attach-open") || root.classList.contains("dms-right-full")) return;
      if ($("[data-composer-card]") === null && !leftOpen() && !state.rightVisible) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      lastX = startX;
      lastT = performance.now();
      samples = [{ x: startX, t: lastT }];
      width = window.innerWidth;
      const target = e.target instanceof Element ? e.target : document.elementFromPoint(t.clientX, t.clientY);
      if (leftOpen()) {
        mode = "close-left";
      } else if (state.rightVisible) {
        mode = "close-right";
      } else {
        if (target && target.closest('[contenteditable], input, textarea, [role="textbox"], [role="dialog"], [data-composer-card] button')) return;
        if (target && inHorizontalScroller(target)) return;
        mode = "pending";
      }
      dlog2("touch-start", "mode=" + mode, "x=" + Math.round(startX));
    };
    listen(document, "touchstart", onTouchStart, { passive: true, capture: true });
    const onTouchMove = (e) => {
      if (mode === null || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const now = performance.now();
      lastDx = dx;
      if (now - lastT > 0) velocity = velocity * 0.6 + (t.clientX - lastX) / (now - lastT) * 0.4;
      lastX = t.clientX;
      lastT = now;
      samples.push({ x: t.clientX, t: now });
      while (samples.length > 2 && now - samples[0].t > 110) samples.shift();
      if (!locked) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          mode = null;
          return;
        }
        if (Math.abs(dx) <= LOCK) return;
        if (mode === "pending" && Math.abs(dx) <= Math.abs(dy) * 1.1) return;
        if (mode === "pending") {
          mode = dx > 0 ? "open-left" : "open-right";
          root.classList.add(dragClassFor(mode));
          const openSide = mode === "open-left" ? "left" : "right";
          if (openSide === "left") {
            root.classList.add("dms-gesture-arming");
            ensureSidebarMounted();
            openLeftVisual(true);
          } else {
            root.classList.add("dms-gesture-arming-right");
            if (!state.rightVisible) openRight();
          }
          dlog2("recognized", mode, "dx=" + Math.round(dx));
          startArm(openSide);
        }
        locked = true;
        state.gestureBusy = true;
        if (mode === "open-left") visualX = -drawerWidth();
        else if (mode === "open-right") visualX = drawerWidth();
        else visualX = 0;
        lastFrameT = performance.now();
      }
      if (e.cancelable) e.preventDefault();
      const W = drawerWidth();
      if (mode === "open-left") applyFrame("left", Math.min(0, dx - W));
      else if (mode === "close-left") applyFrame("left", Math.min(0, dx));
      else if (mode === "open-right") applyFrame("right", Math.max(0, W + dx));
      else applyFrame("right", Math.max(0, dx));
    };
    listen(document, "touchmove", onTouchMove, { passive: false, capture: true });
    const paint = (dx) => {
      const W = drawerWidth();
      const m = mode;
      if (m === "open-left") applyFrame("left", Math.min(0, dx - W));
      else if (m === "open-right") applyFrame("right", Math.max(0, W + dx));
      else if (m === "close-left") applyFrame("left", Math.min(0, dx));
      else if (m === "close-right") applyFrame("right", Math.max(0, dx));
    };
    const finish = (e) => {
      if (mode === null || !locked) {
        mode = null;
        locked = false;
        state.gestureBusy = false;
        clearInline();
        return;
      }
      const t = e.changedTouches && e.changedTouches[0];
      const dx = t ? t.clientX - startX : 0;
      const m = mode;
      const side = m === "open-left" || m === "close-left" ? "left" : "right";
      const W = drawerWidth();
      const threshold = W * 0.38;
      const endT = performance.now();
      const recent = samples.filter((s) => endT - s.t <= 110);
      let stableVelocity = 0;
      if (recent.length >= 2) {
        const first = recent[0];
        const last = recent[recent.length - 1];
        if (last.t - first.t >= 8) stableVelocity = (last.x - first.x) / (last.t - first.t);
      }
      const fast = Math.abs(stableVelocity) > 0.08 && Math.abs(dx) >= 20;
      if (!armReady(side)) {
        pendingSettle = { seq: gestureSeq, m, dx, fast, stableVelocity, W, threshold };
        mode = null;
        locked = false;
        touchSuppressClick = true;
        setTimeout(() => {
          touchSuppressClick = false;
        }, 80);
        dlog2("release-waiting-host", m, "dx=" + Math.round(dx), "fast=" + fast);
        startArm(side);
        return;
      }
      if (locked) {
        touchSuppressClick = true;
        setTimeout(() => {
          touchSuppressClick = false;
        }, 80);
      }
      mode = null;
      locked = false;
      dlog2("finish", m, "dx=" + Math.round(dx), "fast=" + fast);
      if (m === "open-left") {
        if (dx >= threshold || fast && stableVelocity > 0) {
          root.classList.add("dms-left-open", "dms-gesture-opened");
          springTo("left", 0, false);
        } else springTo("left", -W, true, () => closeLeftVisual(false));
      } else if (m === "open-right") {
        if (-dx >= threshold || fast && stableVelocity < 0) {
          root.classList.add("dms-right-open");
          springTo("right", 0, false);
        } else springTo("right", W, true, () => closeRight());
      } else if (m === "close-left") {
        if (-dx >= threshold || fast && stableVelocity < 0) springTo("left", -W, true, () => closeLeftVisual(false));
        else {
          root.classList.add("dms-left-open");
          springTo("left", 0, false);
        }
      } else if (m === "close-right") {
        if (dx >= threshold || fast && stableVelocity > 0) springTo("right", W, true, () => closeRight());
        else {
          root.classList.add("dms-right-open");
          springTo("right", 0, false);
        }
      } else {
        state.gestureBusy = false;
        clearInline();
      }
    };
    listen(document, "touchend", finish, { passive: true, capture: true });
    listen(document, "touchcancel", cancelGesture, { passive: true, capture: true });
    let mouseActive = false;
    let mouseStarted = false;
    let mouseSuppressClick = false;
    const pointOf = (event) => ({ clientX: event.clientX, clientY: event.clientY });
    const fakeTouch = (event) => ({
      target: event.target,
      touches: [pointOf(event)],
      changedTouches: [pointOf(event)],
      cancelable: event.cancelable,
      preventDefault: () => event.preventDefault()
    });
    const onPointerDown = (event) => {
      if (event.pointerType === "touch" || event.button !== 0) return;
      mouseSuppressClick = false;
      onTouchStart(fakeTouch(event));
      mouseActive = mode !== null;
      mouseStarted = mouseActive;
      if (mouseActive) {
        try {
          document.documentElement.setPointerCapture(event.pointerId);
        } catch (error) {
        }
        if (event.cancelable) event.preventDefault();
      }
    };
    const onPointerMove = (event) => {
      if (!mouseActive || event.pointerType === "touch") return;
      onTouchMove(fakeTouch(event));
      if (mode !== null && locked) mouseSuppressClick = true;
      if (event.cancelable) event.preventDefault();
    };
    const onPointerEnd = (event) => {
      if (!mouseActive || event.pointerType === "touch") return;
      mouseActive = false;
      try {
        document.documentElement.releasePointerCapture(event.pointerId);
      } catch (error) {
      }
      finish(fakeTouch(event));
      if (mouseStarted) {
        mouseStarted = false;
        mouseSuppressClick = true;
        setTimeout(() => {
          mouseSuppressClick = false;
        }, 180);
      }
    };
    const onPointerCancel = (event) => {
      if (!mouseActive || event.pointerType === "touch") return;
      mouseActive = false;
      mouseStarted = false;
      try {
        document.documentElement.releasePointerCapture(event.pointerId);
      } catch (error) {
      }
      cancelGesture();
    };
    const onClickSuppress = (event) => {
      if (!mouseSuppressClick && !touchSuppressClick) return;
      mouseSuppressClick = false;
      touchSuppressClick = false;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    };
    listen(document, "pointerdown", onPointerDown, { capture: true });
    listen(document, "pointermove", onPointerMove, { capture: true, passive: false });
    listen(document, "pointerup", onPointerEnd, { capture: true });
    listen(document, "pointercancel", onPointerCancel, { capture: true });
    listen(document, "click", onClickSuppress, { capture: true });
    const hardResetGesture = () => {
      if (springRaf !== 0) {
        cancelAnimationFrame(springRaf);
        springRaf = 0;
      }
      stopArm();
      pendingSettle = null;
      mode = null;
      locked = false;
      state.gestureBusy = false;
      state.springAnimating = false;
      clearInline();
    };
    const offDrawerClose = on("drawer-close", hardResetGesture);
    return () => {
      offDrawerClose();
      for (let index = disposers.length - 1; index >= 0; index -= 1) disposers[index]();
      try {
        clearInline();
      } catch (error) {
      }
    };
  }
  function installDrawerAutoClose() {
    const disposers = [];
    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      disposers.push(() => target.removeEventListener(type, handler, options));
    };
    listen(document, "click", (e) => {
      if (!isPhone() || !leftOpen()) return;
      const target = e.target instanceof Element ? e.target : null;
      const col = sidebarCol();
      if (target === null || col === null || !col.contains(target)) return;
      const closeAfter = () => setTimeout(() => {
        if (leftOpen()) toggleLeft();
      }, 60);
      if (target.closest('[class*="_panelRow"]') !== null || target.closest('[class*="_newSession"]') !== null) {
        closeAfter();
        return;
      }
      const row = target.closest('[class*="_sessionRow"]');
      if (row !== null) {
        if (target.closest("button, [role=menuitem], [aria-haspopup=menu]") === null) closeAfter();
        return;
      }
      if (target.closest('[class*="_settingsArea"]') !== null) closeAfter();
    }, true);
    return () => {
      for (let index = disposers.length - 1; index >= 0; index -= 1) disposers[index]();
    };
  }

  // src/features/view-tabs.js
  function sessionActionsAnchor() {
    return $('header [aria-label="\u66F4\u591A\u64CD\u4F5C"], header [aria-label="More actions"], header [aria-haspopup="menu"][class*="_moreButton"]');
  }
  function hostViewTabs() {
    return $$('[data-conversation-tabs] [role="tab"]');
  }
  function closeSessionActionsMenu() {
    const anchor = sessionActionsAnchor();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    setTimeout(() => {
      if (anchor !== null && anchor.getAttribute("aria-expanded") === "true") {
        try {
          anchor.click();
        } catch (error) {
        }
      }
    }, 40);
  }
  function injectViewTabsIntoMenu(menu) {
    if (menu === null) return false;
    const tabs = hostViewTabs().filter((tab) => /^(对话|轨迹|Chat|Trajectory)$/.test(tab.textContent));
    if (tabs.length === 0) return false;
    const sample = menu.querySelector('[role="menuitem"]');
    if (sample === null) return false;
    const signature = tabs.map((tab) => tab.textContent + (tab.getAttribute("aria-selected") === "true" ? "1" : "0")).join("|");
    const existing = menu.querySelectorAll("[data-dms-view-tab]");
    if (existing.length === 1 && menu.getAttribute("data-dms-vtab-sig") === signature) return true;
    for (const old of existing) old.remove();
    const tab_texts = tabs.map((tab) => tab.textContent);
    const item = sample.cloneNode(true);
    item.setAttribute("data-dms-view-tab", tab_texts.join("|"));
    item.setAttribute("role", "menuitem");
    item.removeAttribute("aria-disabled");
    item.removeAttribute("disabled");
    const svg = item.querySelector("svg");
    if (svg !== null) svg.remove();
    const first_active = tabs[0].getAttribute("aria-selected") === "true";
    const spans = [...item.querySelectorAll("span")].filter((span) => (span.textContent || "").trim().length > 0);
    const labelEl = spans.length > 0 ? spans[spans.length - 1] : null;
    if (first_active) {
      labelEl.textContent = "\u21C4" + tab_texts[1];
    } else {
      labelEl.textContent = "\u21C4" + tab_texts[0];
    }
    item.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        tabs[first_active ? 1 : 0].click();
      } catch (error) {
        console.error("\u5207\u6362\u89C6\u56FE\u5931\u8D25\uFF1A", error);
      }
      closeSessionActionsMenu();
    });
    menu.appendChild(item);
    menu.setAttribute("data-dms-vtab-sig", signature);
    document.documentElement.classList.add("dms-vtabs-menu");
    return true;
  }
  function scanViewTabsMenu() {
    for (const menu of $$('[role="menu"]')) {
      const isSessionMenu = /下载 Session 日志|Download session log/.test(menu.textContent || "");
      if (!isSessionMenu) continue;
      if (injectViewTabsIntoMenu(menu)) return;
      document.documentElement.classList.remove("dms-vtabs-menu");
    }
  }
  function installViewTabsMenu() {
    const disposers = [];
    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      disposers.push(() => target.removeEventListener(type, handler, options));
    };
    document.documentElement.classList.add("dms-vtabs-menu");
    const schedule = () => {
      if (state.rightViewMenuRaf !== 0) return;
      state.rightViewMenuRaf = requestAnimationFrame(() => {
        state.rightViewMenuRaf = 0;
        scanViewTabsMenu();
      });
    };
    listen(document, "click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target === null || target.closest('[aria-haspopup="menu"]') === null) return;
      setTimeout(scanViewTabsMenu, 30);
    }, true);
    state.rightViewMenuObserver = new MutationObserver(schedule);
    state.rightViewMenuObserver.observe(document.body, { childList: true, subtree: true });
    disposers.push(() => {
      if (state.rightViewMenuObserver !== null) state.rightViewMenuObserver.disconnect();
    });
    disposers.push(() => {
      if (state.rightViewMenuRaf !== 0) cancelAnimationFrame(state.rightViewMenuRaf);
    });
    return () => {
      for (let index = disposers.length - 1; index >= 0; index -= 1) disposers[index]();
    };
  }

  // src/features/keyboard.js
  function installKeyboard() {
    const disposers = [];
    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      disposers.push(() => target.removeEventListener(type, handler, options));
    };
    const vv = window.visualViewport;
    if (!vv) return;
    const apply2 = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const shift = kb > 90 ? Math.round(kb) : 0;
      const root = document.documentElement;
      root.style.setProperty("--dms-kb", shift + "px");
      root.classList.toggle("dms-kb-open", shift > 0);
    };
    listen(vv, "resize", apply2);
    listen(vv, "scroll", apply2);
    listen(window, "orientationchange", () => setTimeout(apply2, 260));
    const bootTimer = setTimeout(apply2, 400);
    disposers.push(() => clearTimeout(bootTimer));
    return () => {
      for (let index = disposers.length - 1; index >= 0; index -= 1) disposers[index]();
    };
  }

  // src/features/long-press.js
  function installLongPress() {
    const disposers = [];
    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      disposers.push(() => target.removeEventListener(type, handler, options));
    };
    let timer = 0;
    let startX = 0, startY = 0;
    let node = null;
    const cancel = () => {
      if (timer !== 0) {
        clearTimeout(timer);
        timer = 0;
      }
    };
    const activate = (target, cx, cy) => {
      if (!(target instanceof Element)) return;
      const session = target.closest('[class*="_sessionRow"]');
      if (session !== null) {
        const overflow = session.querySelector('[class*="_sessionOverflowButton"]') || session.querySelector('[class*="_rowActions"] button');
        if (overflow !== null) {
          overflow.click();
          return;
        }
      }
      const msg = target.closest('[class*="_message"]');
      if (msg !== null) {
        msg.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
      }
    };
    listen(document, "touchstart", (e) => {
      if (!isPhone() || e.touches.length !== 1) return;
      cancel();
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      node = e.target instanceof Element ? e.target : null;
      if (node === null) return;
      timer = setTimeout(() => {
        timer = 0;
        activate(node, startX, startY);
      }, 500);
    }, { passive: true, capture: true });
    listen(document, "touchmove", (e) => {
      if (timer === 0 || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10) cancel();
    }, { passive: true, capture: true });
    listen(document, "touchend", cancel, { passive: true, capture: true });
    listen(document, "touchcancel", cancel, { passive: true, capture: true });
    return () => {
      for (let index = disposers.length - 1; index >= 0; index -= 1) disposers[index]();
    };
  }

  // src/features/observer.js
  var DEBOUNCE_MS = 80;
  function installObserver(syncFn) {
    let timer = 0;
    let scheduled = false;
    let disposed = false;
    const observed = /* @__PURE__ */ new WeakSet();
    const chromeObserver = new MutationObserver(schedule);
    const bodyObserver = new MutationObserver(schedule);
    const frameObserver = new MutationObserver(schedule);
    function schedule() {
      if (disposed || scheduled) return;
      scheduled = true;
      timer = setTimeout(run, DEBOUNCE_MS);
    }
    function run() {
      scheduled = false;
      timer = 0;
      if (disposed) return;
      observeAll();
      if (state.DEBUG_OFF.has("observer-sync")) return;
      try {
        syncFn();
      } catch (error) {
      }
      observeAll();
    }
    function observe(target, options, observer) {
      if (!(target instanceof Node) || observed.has(target)) return;
      try {
        observer.observe(target, options);
        observed.add(target);
      } catch (error) {
      }
    }
    function observeAll() {
      observe(document.body, { childList: true }, bodyObserver);
      const header = $('[class*="_centerCol"] header');
      if (header !== null) observe(header, { childList: true, subtree: true }, chromeObserver);
      const panel = settingsPanel();
      if (panel !== null) observe(panel, { childList: true, subtree: true }, chromeObserver);
      const composer = $('[data-composer-card], [class*="_composerDock"]');
      if (composer !== null) observe(composer, { childList: true, subtree: true }, chromeObserver);
      const rightbar = $('[class*="_rightbarCol"]');
      if (rightbar !== null) observe(rightbar, { childList: true, subtree: true }, chromeObserver);
      const f = frame();
      if (f !== null) observe(f, { attributes: true, attributeFilter: ["class", "data-sidebar-collapsed"] }, frameObserver);
    }
    const listeners2 = [];
    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      listeners2.push(() => target.removeEventListener(type, handler, options));
    };
    listen(document, "pointerup", schedule, { capture: true, passive: true });
    listen(document, "visibilitychange", () => {
      if (!document.hidden) schedule();
    });
    listen(window, "resize", schedule, { passive: true });
    listen(window, "orientationchange", schedule, { passive: true });
    listen(window, "popstate", schedule);
    listen(window, "hashchange", schedule);
    const offSession = on("session-switch", schedule);
    observeAll();
    return () => {
      disposed = true;
      if (timer !== 0) clearTimeout(timer);
      chromeObserver.disconnect();
      bodyObserver.disconnect();
      frameObserver.disconnect();
      for (let index = listeners2.length - 1; index >= 0; index -= 1) listeners2[index]();
      if (typeof offSession === "function") offSession();
    };
  }

  // src/features/back-stack.js
  function installBackStack() {
    const previous = window.__dshmBack;
    const back = function dshMobileShellBack() {
      if (settingsPanel() !== null) {
        if (settingsBack()) return true;
      }
      if (document.documentElement.classList.contains("dms-right-full")) {
        exitRightFullscreen(true);
        return true;
      }
      if (state.rightVisible) {
        closeRight();
        return true;
      }
      if (leftOpen()) {
        toggleLeft();
        return true;
      }
      const layout = state.ctxRef && state.ctxRef.layout;
      if (layout && typeof layout.selectPanel === "function" && $("[data-composer-card]") === null) {
        try {
          layout.selectPanel(null);
          return true;
        } catch (error) {
        }
      }
      if (typeof previous === "function" && document.querySelector('[role="dialog"], [role="menu"]') !== null) return previous();
      return false;
    };
    window.__dshmBack = back;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (state.rightVisible || leftOpen()) {
        e.preventDefault();
        window.__dshmBack();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (window.__dshmBack === back) window.__dshmBack = previous;
    };
  }
  function installExitGuard() {
    const base = window.__dshmBack;
    let lastAt = 0;
    const guard = function dshMobileShellBackGuard() {
      const handled = typeof base === "function" ? base() : false;
      if (handled) return true;
      const now = Date.now();
      if (now - lastAt < 2e3) {
        lastAt = 0;
        return false;
      }
      lastAt = now;
      showToast("\u518D\u6309\u4E00\u6B21\u9000\u51FA");
      return true;
    };
    window.__dshmBack = guard;
    return () => {
      if (window.__dshmBack === guard) window.__dshmBack = base;
    };
  }

  // src/features/attach-sheet.js
  function installAttachSheet() {
    const disposers = [];
    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      disposers.push(() => target.removeEventListener(type, handler, options));
    };
    const root = document.documentElement;
    let sheet = null;
    let backdrop = null;
    let recentWrap = null;
    let recentStrip = null;
    let nativeSeq = 0;
    let nativeCaps = null;
    let nativeCapsPromise = null;
    const nativePending = /* @__PURE__ */ new Map();
    let photoGesture = null;
    let photoPaint = null;
    let photoDragPoint = null;
    let photoAutoScrollRaf = 0;
    let photoLongPressTimer = 0;
    let suppressPhotoClick = false;
    let sheetMeasureDone = false;
    let photoSuppressTimer = 0;
    const nativeBridge = () => {
      const api = window.DSHNative;
      return api && typeof api.request === "function" ? api : null;
    };
    function nativeCall(method, params, timeoutMs) {
      const api = nativeBridge();
      if (api === null) return Promise.reject(new Error("native bridge unavailable"));
      return new Promise((resolve, reject) => {
        const id = "dms_" + ++nativeSeq;
        const timer = setTimeout(() => {
          nativePending.delete(id);
          reject(new Error("native bridge timeout: " + method));
        }, timeoutMs || 1500);
        nativePending.set(id, { resolve, reject, timer });
        try {
          api.request(JSON.stringify({ id, method, params: params || {} }));
        } catch (error) {
          clearTimeout(timer);
          nativePending.delete(id);
          reject(error);
        }
      });
    }
    window.__dshNativeResult = (id, payload) => {
      const entry = nativePending.get(id);
      if (!entry) return;
      nativePending.delete(id);
      clearTimeout(entry.timer);
      try {
        entry.resolve(typeof payload === "string" ? JSON.parse(payload) : payload);
      } catch (error) {
        entry.reject(error);
      }
    };
    function ensureUi() {
      if (backdrop === null) {
        backdrop = document.createElement("div");
        backdrop.className = "dms-attach-backdrop";
        backdrop.setAttribute("aria-hidden", "true");
        document.body.appendChild(backdrop);
      }
      if (sheet === null) {
        sheet = document.createElement("div");
        sheet.className = "dms-attach-sheet";
        sheet.setAttribute("role", "dialog");
        sheet.setAttribute("aria-label", "\u6DFB\u52A0\u9644\u4EF6");
        sheet.innerHTML = '<div class="dms-attach-recent" hidden><div class="dms-attach-recent-title">\u6700\u8FD1\u7167\u7247</div><div class="dms-attach-recent-strip"></div></div><div class="dms-attach-actions"><button type="button" class="dms-attach-action" data-kind="camera"><span class="dms-attach-ico">' + ICONS.camera + '</span><span>\u62CD\u7167</span></button><button type="button" class="dms-attach-action" data-kind="gallery"><span class="dms-attach-ico">' + ICONS.image + '</span><span>\u76F8\u518C</span></button><button type="button" class="dms-attach-action" data-kind="files"><span class="dms-attach-ico">' + ICONS.file + "</span><span>\u6587\u4EF6</span></button></div>";
        document.body.appendChild(sheet);
        recentWrap = sheet.querySelector(".dms-attach-recent");
        recentStrip = sheet.querySelector(".dms-attach-recent-strip");
        const PHOTO_LONG_PRESS_MS = 500;
        const PHOTO_MOVE_SLOP = 6;
        const cancelPhotoLongPress = () => {
          if (photoLongPressTimer !== 0) {
            clearTimeout(photoLongPressTimer);
            photoLongPressTimer = 0;
          }
        };
        const endPhotoGesture = () => {
          cancelPhotoLongPress();
          const gesture = photoGesture;
          const painted = gesture !== null && gesture.mode === "paint";
          photoGesture = null;
          photoPaint = null;
          photoDragPoint = null;
          stopPhotoAutoScroll();
          if (painted) {
            suppressPhotoClick = true;
            if (photoSuppressTimer !== 0) clearTimeout(photoSuppressTimer);
            photoSuppressTimer = setTimeout(() => {
              photoSuppressTimer = 0;
              suppressPhotoClick = false;
            }, 420);
          }
        };
        recentStrip.addEventListener("contextmenu", (event) => {
          event.preventDefault();
        }, { passive: false });
        recentStrip.addEventListener("touchstart", (event) => {
          const cell = event.target instanceof Element ? event.target.closest(".dms-attach-photo") : null;
          if (cell === null || event.touches.length !== 1) return;
          const t = event.touches[0];
          cancelPhotoLongPress();
          suppressPhotoClick = false;
          photoGesture = { startX: t.clientX, startY: t.clientY, cell, mode: "pending" };
          photoPaint = null;
          photoDragPoint = null;
          stopPhotoAutoScroll();
          photoLongPressTimer = setTimeout(() => {
            photoLongPressTimer = 0;
            const gesture = photoGesture;
            if (gesture === null || gesture.mode !== "pending") return;
            gesture.mode = "paint";
            photoPaint = { last: null };
            suppressPhotoClick = true;
            photoDragPoint = { x: gesture.startX, y: gesture.startY };
            photoDragTo(gesture.cell);
            startPhotoAutoScroll();
            try {
              if (navigator !== void 0 && typeof navigator.vibrate === "function") navigator.vibrate(10);
            } catch (error) {
            }
          }, PHOTO_LONG_PRESS_MS);
        }, { passive: true });
        recentStrip.addEventListener("touchmove", (event) => {
          const gesture = photoGesture;
          if (gesture === null || event.touches.length !== 1) return;
          const t = event.touches[0];
          const dx = t.clientX - gesture.startX;
          const dy = t.clientY - gesture.startY;
          if (gesture.mode === "pending") {
            if (Math.abs(dx) <= PHOTO_MOVE_SLOP && Math.abs(dy) <= PHOTO_MOVE_SLOP) return;
            cancelPhotoLongPress();
            gesture.mode = "native";
            return;
          }
          if (gesture.mode !== "paint") return;
          if (event.cancelable) event.preventDefault();
          photoDragPoint = { x: t.clientX, y: t.clientY };
          photoDragTo(photoCellAtPoint(t.clientX, t.clientY));
          startPhotoAutoScroll();
        }, { passive: false });
        recentStrip.addEventListener("touchend", endPhotoGesture, { passive: true });
        recentStrip.addEventListener("touchcancel", endPhotoGesture, { passive: true });
        let stripMouseDrag = null;
        recentStrip.addEventListener("pointerdown", (event) => {
          if (event.pointerType === "touch" || event.button !== 0) return;
          const cell = event.target instanceof Element ? event.target.closest(".dms-attach-photo") : null;
          if (cell === null) return;
          stripMouseDrag = { startX: event.clientX, scrollLeft: recentStrip.scrollLeft, moved: false };
          try {
            recentStrip.setPointerCapture(event.pointerId);
          } catch (error) {
          }
        });
        recentStrip.addEventListener("pointermove", (event) => {
          const drag = stripMouseDrag;
          if (drag === null || event.pointerType === "touch") return;
          const dx = event.clientX - drag.startX;
          if (!drag.moved && Math.abs(dx) <= PHOTO_MOVE_SLOP) return;
          drag.moved = true;
          recentStrip.scrollLeft = drag.scrollLeft - dx;
          if (event.cancelable) event.preventDefault();
        }, { passive: false });
        const endStripMouseDrag = (event) => {
          if (stripMouseDrag === null) return;
          if (stripMouseDrag.moved) {
            suppressPhotoClick = true;
            if (photoSuppressTimer !== 0) clearTimeout(photoSuppressTimer);
            photoSuppressTimer = setTimeout(() => {
              photoSuppressTimer = 0;
              suppressPhotoClick = false;
            }, 420);
          }
          stripMouseDrag = null;
          try {
            recentStrip.releasePointerCapture(event.pointerId);
          } catch (error) {
          }
        };
        recentStrip.addEventListener("pointerup", endStripMouseDrag);
        recentStrip.addEventListener("pointercancel", endStripMouseDrag);
        recentStrip.addEventListener("click", (event) => {
          const cell = event.target instanceof Element ? event.target.closest(".dms-attach-photo") : null;
          if (cell === null) return;
          if (suppressPhotoClick) {
            suppressPhotoClick = false;
            return;
          }
          togglePhoto(cell);
        });
        sheet.addEventListener("click", (event) => {
          const action = event.target instanceof Element ? event.target.closest("[data-kind]") : null;
          if (action !== null) {
            event.preventDefault();
            pickFromDevice(action.getAttribute("data-kind"));
          }
        });
      }
    }
    function makeInput(accept, capture, multiple) {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = multiple !== false;
      input.hidden = true;
      if (accept) input.accept = accept;
      if (capture) input.setAttribute("capture", capture);
      input.addEventListener("change", () => {
        const files = input.files === null ? [] : Array.from(input.files);
        input.value = "";
        input.remove();
        if (files.length > 0) intake(files);
      });
      document.body.appendChild(input);
      return input;
    }
    function loadNativeCaps() {
      if (nativeBridge() === null) return Promise.resolve(null);
      if (nativeCapsPromise !== null) return nativeCapsPromise;
      nativeCapsPromise = nativeCall("capabilities", {}, 1200).then((caps) => {
        nativeCaps = caps || null;
        return nativeCaps;
      }).catch(() => null);
      return nativeCapsPromise;
    }
    async function pickNative(kind) {
      const source = kind === "camera" ? "camera" : kind === "gallery" ? "gallery" : "files";
      const method = kind === "files" ? "pickFiles" : "pickImages";
      const params = kind === "files" ? { multiple: true, max: 20 } : { source, multiple: kind !== "camera", max: 20 };
      const reply = await nativeCall(method, params, 6e5);
      const items = reply && Array.isArray(reply.files) ? reply.files : [];
      if (items.length === 0) {
        return true;
      }
      const files = [];
      for (const item of items) {
        if (!item || typeof item.url !== "string") continue;
        const response = await fetch(item.url);
        if (!response.ok) continue;
        const blob = await response.blob();
        files.push(new File([blob], item.name || (kind === "camera" ? "camera.jpg" : "file"), { type: item.mime || blob.type || "application/octet-stream" }));
      }
      if (files.length > 0) intake(files);
      return true;
    }
    function pickFromDevice(kind) {
      closeSheet();
      if (nativeBridge() === null) {
        fallbackPick(kind);
        return;
      }
      loadNativeCaps().then((caps) => {
        if (caps !== null && caps.pickers === true) {
          pickNative(kind).catch(() => {
            const label = kind === "camera" ? "\u76F8\u673A" : kind === "gallery" ? "\u76F8\u518C" : "\u6587\u4EF6\u9009\u62E9\u5668";
            showToast(label + "\u8C03\u7528\u5931\u8D25\uFF0C\u6539\u7528\u7CFB\u7EDF\u9009\u62E9\u5668");
            fallbackPick(kind);
          });
        } else {
          fallbackPick(kind);
        }
      });
    }
    function fallbackPick(kind) {
      if (kind === "camera") makeInput("image/*", "camera", false).click();
      else if (kind === "gallery") makeInput("image/*", null, true).click();
      else makeInput("*/*", null, true).click();
    }
    const MAX_FILE = 1024 * 1024 * 1024;
    const MAX_TOTAL = 5 * 1024 * 1024 * 1024;
    function intake(files) {
      let total = 0;
      const accepted = [];
      for (const file of files) {
        if (file.size > MAX_FILE) {
          showToast("\u5355\u4E2A\u6587\u4EF6\u4E0D\u80FD\u8D85\u8FC7 1GB");
          continue;
        }
        total += file.size;
        if (total > MAX_TOTAL) {
          showToast("\u5355\u6B21\u9644\u4EF6\u603B\u5927\u5C0F\u4E0D\u80FD\u8D85\u8FC7 5GB");
          break;
        }
        accepted.push(file);
      }
      if (accepted.length === 0) return;
      const card = $("[data-composer-card]") || $("[data-composer-seat]") || $('[class*="_inputBar"]');
      if (card === null) {
        showToast("\u6CA1\u6709\u53EF\u7528\u7684\u8F93\u5165\u6846");
        return;
      }
      const dt = new DataTransfer();
      for (const file of accepted) dt.items.add(file);
      const editor = card.querySelector('[contenteditable="true"], [role="textbox"], textarea') || card;
      let delivered = false;
      try {
        const paste = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt });
        editor.dispatchEvent(paste);
        delivered = paste.defaultPrevented;
      } catch (error) {
      }
      if (!delivered) {
        try {
          const drop = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt });
          card.dispatchEvent(drop);
          delivered = drop.defaultPrevented;
        } catch (error) {
        }
      }
      if (!delivered) showToast("\u8FD9\u5757\u8F93\u5165\u6846\u6682\u4E0D\u652F\u6301\u6DFB\u52A0\u9644\u4EF6");
    }
    function composerAttachmentLabels() {
      const card = $("[data-composer-card]") || $("[data-composer-seat]") || $('[class*="_inputBar"]');
      if (card === null) return [];
      return $$('[class*="_remove"]', card).map((btn) => btn.getAttribute("aria-label") || "").filter((label) => label.length > 0);
    }
    function composerHasAttachment(name) {
      if (!name) return false;
      return composerAttachmentLabels().some((label) => label.indexOf(name) >= 0);
    }
    function composerRemoveByName(name) {
      if (!name) return false;
      const card = $("[data-composer-card]") || $("[data-composer-seat]") || $('[class*="_inputBar"]');
      if (card === null) return false;
      const matches = $$('[class*="_remove"]', card).filter((btn) => (btn.getAttribute("aria-label") || "").indexOf(name) >= 0);
      if (matches.length !== 1) return false;
      matches[0].click();
      return true;
    }
    function selectPhoto(cell) {
      if (cell.classList.contains("selected") || cell.dataset.dmsPending === "1") return;
      const name = cell.dataset.dmsName || "";
      if (name && composerHasAttachment(name)) {
        cell.classList.add("selected");
        return;
      }
      cell.dataset.dmsPending = "1";
      cell.classList.add("selected");
      void openRecent(cell.getAttribute("data-photo-id"), cell);
    }
    function deselectPhoto(cell) {
      if (!cell.classList.contains("selected")) return;
      cell.classList.remove("selected");
      const name = cell.dataset.dmsName || "";
      if (name && !composerRemoveByName(name) && photoPaint === null) {
        showToast("\u672A\u80FD\u5728\u8F93\u5165\u6846\u627E\u5230\u8BE5\u9644\u4EF6\uFF0C\u8BF7\u624B\u52A8\u79FB\u9664");
      }
    }
    function togglePhoto(cell) {
      if (cell.classList.contains("selected")) deselectPhoto(cell);
      else selectPhoto(cell);
    }
    function photoCellAtPoint(x, y) {
      if (recentStrip === null) return null;
      const rect = recentStrip.getBoundingClientRect();
      const cx = Math.min(Math.max(x, rect.left + 4), rect.right - 4);
      const cy = Math.min(Math.max(y, rect.top + 4), rect.bottom - 4);
      const el = document.elementFromPoint(cx, cy);
      return el instanceof Element ? el.closest(".dms-attach-photo") : null;
    }
    function photoDragTo(cell) {
      if (photoPaint === null || cell === null || cell === photoPaint.last) return;
      photoPaint.last = cell;
      togglePhoto(cell);
    }
    function stopPhotoAutoScroll() {
      if (photoAutoScrollRaf !== 0) {
        cancelAnimationFrame(photoAutoScrollRaf);
        photoAutoScrollRaf = 0;
      }
    }
    function startPhotoAutoScroll() {
      stopPhotoAutoScroll();
      if (photoPaint === null || photoDragPoint === null || recentStrip === null) return;
      const step = () => {
        photoAutoScrollRaf = 0;
        if (photoPaint === null || photoDragPoint === null || recentStrip === null) return;
        const rect = recentStrip.getBoundingClientRect();
        const edge = 44;
        let delta = 0;
        if (photoDragPoint.x < rect.left + edge) delta = -Math.max(5, (rect.left + edge - photoDragPoint.x) * 0.6);
        else if (photoDragPoint.x > rect.right - edge) delta = Math.max(5, (photoDragPoint.x - (rect.right - edge)) * 0.6);
        if (delta !== 0) {
          recentStrip.scrollLeft += delta;
          photoDragTo(photoCellAtPoint(photoDragPoint.x, photoDragPoint.y));
          photoAutoScrollRaf = requestAnimationFrame(step);
        }
      };
      photoAutoScrollRaf = requestAnimationFrame(step);
    }
    async function renderRecent() {
      if (recentWrap === null || recentStrip === null) return;
      const api = nativeBridge();
      if (api === null) {
        recentWrap.hidden = true;
        return;
      }
      recentWrap.hidden = false;
      recentStrip.innerHTML = '<div class="dms-attach-loading">\u6B63\u5728\u8BFB\u53D6\u6700\u8FD1\u7167\u7247\u2026</div>';
      try {
        const reply = await nativeCall("recentPhotos", { limit: 20 }, 1800);
        const photos = reply && Array.isArray(reply.photos) ? reply.photos : [];
        recentStrip.innerHTML = "";
        if (photos.length === 0) {
          recentStrip.innerHTML = '<div class="dms-attach-loading">\u6682\u65E0\u6700\u8FD1\u7167\u7247</div>';
          return;
        }
        for (const photo of photos) {
          if (!photo || typeof photo.thumbDataUrl !== "string") continue;
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "dms-attach-photo";
          const img = document.createElement("img");
          img.src = photo.thumbDataUrl;
          img.alt = photo.name || "\u7167\u7247";
          img.loading = "lazy";
          cell.appendChild(img);
          const check = document.createElement("span");
          check.className = "dms-photo-check";
          check.innerHTML = ICONS.check;
          cell.appendChild(check);
          cell.setAttribute("data-photo-id", photo.id === void 0 || photo.id === null ? "" : String(photo.id));
          if (typeof photo.name === "string" && photo.name.length > 0) {
            cell.dataset.dmsName = photo.name;
            if (composerHasAttachment(photo.name)) cell.classList.add("selected");
          }
          recentStrip.appendChild(cell);
        }
        if (recentStrip.childElementCount === 0) recentStrip.innerHTML = '<div class="dms-attach-loading">\u6682\u65E0\u6700\u8FD1\u7167\u7247</div>';
      } catch (error) {
        recentStrip.innerHTML = '<div class="dms-attach-loading">\u6682\u65E0\u6700\u8FD1\u7167\u7247</div>';
      }
    }
    async function openRecent(id, cell) {
      if (id === void 0 || id === null) return;
      try {
        const reply = await nativeCall("openRecent", { id }, 3e3);
        if (!reply || typeof reply.url !== "string") throw new Error("missing url");
        if (cell !== void 0 && cell !== null && !cell.classList.contains("selected")) return;
        const response = await fetch(reply.url);
        if (!response.ok) throw new Error("fetch failed");
        const blob = await response.blob();
        const file = new File([blob], reply.name || "photo.jpg", { type: reply.mime || blob.type || "image/jpeg" });
        if (cell !== void 0 && cell !== null) {
          cell.dataset.dmsPending = "0";
          cell.dataset.dmsName = file.name;
        }
        intake([file]);
        requestAnimationFrame(measureSheet);
      } catch (error) {
        if (cell !== void 0 && cell !== null) {
          cell.classList.remove("selected");
          cell.dataset.dmsPending = "0";
        }
        showToast("\u8BFB\u53D6\u7167\u7247\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
      }
    }
    function measureSheet(force) {
      if (sheet === null) return;
      if (!root.classList.contains("dms-attach-open")) {
        root.style.setProperty("--dms-sheet-h", "0px");
        return;
      }
      if (sheetMeasureDone && force !== true) return;
      const height = sheet.getBoundingClientRect().height;
      const card = $("[data-composer-card]") || $("[data-composer-seat]");
      let shift = height;
      if (card !== null) {
        const current = parseFloat(window.getComputedStyle(root).getPropertyValue("--dms-sheet-h")) || 0;
        const naturalBottom = card.getBoundingClientRect().bottom + current;
        shift = height - Math.max(0, window.innerHeight - naturalBottom);
      }
      root.style.setProperty("--dms-sheet-h", Math.max(0, Math.round(shift)) + "px");
      sheetMeasureDone = true;
    }
    function openSheet() {
      ensureUi();
      const add = $('[data-composer-card] button[aria-haspopup="listbox"], [class*="_inputBar"] button[aria-haspopup="listbox"]');
      if (add !== null) add.setAttribute("data-dms-plus", "1");
      root.classList.add("dms-attach-open");
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
      const hero = $('[class*="_centerCol"] [class*="_headline"]');
      if (hero !== null) {
        let scroller = hero.parentElement;
        for (let depth = 0; scroller !== null && depth < 6; depth++) {
          if (scroller.scrollHeight > scroller.clientHeight + 2) {
            scroller.scrollTop = 0;
            break;
          }
          scroller = scroller.parentElement;
        }
      }
      sheetMeasureDone = false;
      requestAnimationFrame(() => requestAnimationFrame(() => measureSheet()));
      loadNativeCaps();
      renderRecent();
    }
    function closeSheet(instant) {
      photoGesture = null;
      photoPaint = null;
      photoDragPoint = null;
      if (photoLongPressTimer !== 0) {
        clearTimeout(photoLongPressTimer);
        photoLongPressTimer = 0;
      }
      stopPhotoAutoScroll();
      suppressPhotoClick = false;
      if (photoSuppressTimer !== 0) {
        clearTimeout(photoSuppressTimer);
        photoSuppressTimer = 0;
      }
      root.classList.remove("dms-attach-open");
      if (instant === true) {
        root.classList.add("dms-sheet-instant");
        root.style.setProperty("--dms-sheet-h", "0px");
        setTimeout(() => {
          root.classList.remove("dms-sheet-instant");
        }, 90);
      } else {
        root.style.setProperty("--dms-sheet-h", "0px");
      }
    }
    const offSession = on("session-switch", () => {
      if (root.classList.contains("dms-attach-open")) closeSheet(true);
    });
    listen(window, "resize", () => measureSheet(true));
    function toggleSheet() {
      if (root.classList.contains("dms-attach-open")) closeSheet();
      else openSheet();
    }
    listen(document, "click", (event) => {
      if (!isPhone()) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target === null) return;
      const add = target.closest('button[aria-haspopup="listbox"]');
      if (add === null) return;
      if (add.closest('[data-composer-card], [data-composer-seat], [class*="_inputBar"]') === null) return;
      if (!/(^|[\s_-])add([\s_-]|$)/.test(add.className) && add.getAttribute("aria-label") !== "\u6DFB\u52A0\u6587\u4EF6\u6216\u8C03\u7528\u6307\u4EE4") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleSheet();
    }, true);
    listen(document, "click", (event) => {
      if (!root.classList.contains("dms-attach-open")) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target === null) return;
      if (target.closest(".dms-attach-sheet") !== null) return;
      if (target.closest('[data-composer-card], [data-composer-seat], [class*="_inputBar"]') !== null) return;
      if (target.closest('[role="menu"], [role="listbox"], [role="dialog"]') !== null) return;
      closeSheet();
    }, true);
    listen(document, "mousedown", (event) => {
      if (!root.classList.contains("dms-attach-open")) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target === null) return;
      if (target.closest(".dms-attach-sheet") !== null) return;
      const composer = target.closest('[data-composer-card], [data-composer-seat], [class*="_inputBar"]');
      if (composer === null) return;
      if (target.closest('button[aria-haspopup="listbox"]') !== null) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (target.closest('button, [role="button"], [aria-haspopup], a, input, select') !== null) {
        event.preventDefault();
        event.stopPropagation();
        return;
      } else {
        closeSheet(true);
        const editor = composer.querySelector('[contenteditable="true"], [role="textbox"], textarea');
        if (editor !== null && typeof editor.focus === "function") {
          try {
            editor.focus();
          } catch (error) {
          }
        }
      }
    }, true);
    listen(document, "keydown", (event) => {
      if (event.key === "Escape" && root.classList.contains("dms-attach-open")) {
        event.preventDefault();
        closeSheet();
      }
    }, true);
    const originalBack = window.__dshmBack;
    const attachBack = function dshMobileShellBack() {
      if (root.classList.contains("dms-attach-open")) {
        closeSheet();
        return true;
      }
      return typeof originalBack === "function" ? originalBack() : false;
    };
    window.__dshmBack = attachBack;
    return () => {
      for (let index = disposers.length - 1; index >= 0; index -= 1) disposers[index]();
      if (window.__dshmBack === attachBack) window.__dshmBack = originalBack;
      if (typeof offSession === "function") offSession();
    };
  }

  // src/features/session-watch.js
  function conversationSessionKey() {
    const content = $("[data-conversation-content]");
    const id = content === null ? "" : content.getAttribute("data-conversation-session") || "";
    return id + "@" + location.pathname + location.search;
  }
  function isEditorTarget(el) {
    if (!(el instanceof Element)) return false;
    if (el.closest("[data-composer-input]") !== null) return true;
    return el.closest('[data-composer-card], [data-composer-seat], [class*="_inputBar"]') !== null;
  }
  function blurHostEditor(force) {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === document.body) return;
    if (!isEditorTarget(active)) return;
    if (!force && state.lastPointerInEditor && performance.now() - state.lastPointerAt < 900) return;
    try {
      active.blur();
    } catch (error) {
    }
  }
  function handleSessionSwitch() {
    emit("session-switch");
    blurHostEditor(true);
    setTimeout(() => blurHostEditor(false), 80);
    setTimeout(() => blurHostEditor(false), 320);
    setTimeout(() => preloadRight(), 900);
  }
  function fastSessionWatch() {
    state.sessionFastRaf = 0;
    const key = conversationSessionKey();
    if (key !== state.sessionKeyPrev) {
      state.sessionKeyPrev = key;
      state.sessionFastUntil = 0;
      handleSessionSwitch();
      return;
    }
    if (performance.now() > state.sessionFastUntil) return;
    state.sessionFastRaf = requestAnimationFrame(fastSessionWatch);
  }
  function installSessionWatcher() {
    const disposers = [];
    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      disposers.push(() => target.removeEventListener(type, handler, options));
    };
    state.sessionKeyPrev = conversationSessionKey();
    const startFastWatch = () => {
      state.sessionFastUntil = performance.now() + 1500;
      if (state.sessionFastRaf === 0) state.sessionFastRaf = requestAnimationFrame(fastSessionWatch);
    };
    const pointer = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      state.lastPointerAt = performance.now();
      state.lastPointerInEditor = target !== null && target.closest('[contenteditable="true"], [role="textbox"], textarea, input, [data-composer-card], [data-composer-seat], [class*="_inputBar"]') !== null;
      if (target !== null && target.closest('[class*="_sessionRow"]') !== null) startFastWatch();
    };
    listen(document, "touchstart", pointer, { passive: true, capture: true });
    listen(document, "pointerdown", pointer, { passive: true, capture: true });
    const timer = setInterval(() => {
      if (state.DEBUG_OFF.has("session-watch")) return;
      const key = conversationSessionKey();
      if (key === state.sessionKeyPrev) return;
      state.sessionKeyPrev = key;
      handleSessionSwitch();
    }, 120);
    if (timer && typeof timer.unref === "function") timer.unref();
    disposers.push(() => clearInterval(timer));
    disposers.push(() => {
      if (state.sessionFastRaf !== 0) cancelAnimationFrame(state.sessionFastRaf);
    });
    return () => {
      for (let index = disposers.length - 1; index >= 0; index -= 1) disposers[index]();
    };
  }

  // src/index.js
  function sync() {
    const f = frame();
    if (f === null) return;
    f.setAttribute("data-dms-frame", "frame");
    const root = document.documentElement;
    root.classList.toggle("dms-left-open", leftOpen());
    root.classList.toggle("dms-right-open", state.rightVisible);
    if (state.rightVisible) unlockRightPanel();
    const panel = settingsPanel();
    root.classList.toggle("dms-settings-open", panel !== null);
    if (panel !== null) ensureSettings(panel);
    else {
      root.classList.remove("dms-settings-list");
      root.classList.remove("dms-settings-section");
      root.classList.remove("dms-settings-chrome-init");
      root.classList.remove("dms-plugin-section");
      if (!leftOpen()) root.classList.remove("dms-gesture-opened");
    }
    if (!state.rightViewTabsFallback) document.documentElement.classList.add("dms-vtabs-menu");
    ensureTopButtons();
    for (const header of $$('[class*="_centerCol"] header')) {
      const conversation = header.querySelector("[data-conversation-header-leading], [data-conversation-header-corner]") !== null;
      header.classList.toggle("dms-topbar", conversation);
    }
    const dock = $('[data-composer-dock], [class*="_composerDock"], [data-composer-stats]');
    if (dock !== null) normalizeSeparators(dock);
    for (const extra of $$('[class*="_statusLine"], [class*="_sessionStats"]')) normalizeSeparators(extra);
    const hero = $('[class*="_composerHero"]');
    root.classList.toggle("dms-hero-home", hero !== null && panel === null);
    syncRightChrome();
    if (isPhone()) {
      if (state.leftVisible) repairLeftHost();
      else if (!state.rightVisible) forceMountSidebar();
    }
  }
  function scrimOnce() {
    let el = $(".dms-scrim");
    if (el === null) {
      el = document.createElement("div");
      el.className = "dms-scrim";
      el.setAttribute("aria-hidden", "true");
      el.addEventListener("click", () => {
        if (state.rightVisible) closeRight();
        else if (leftOpen()) toggleLeft();
      });
      document.body.appendChild(el);
    }
    return el;
  }
  var INJECT = ["layout", "uiWorkspace", "workspaces"];
  function apply(ctx) {
    state.ctxRef = ctx;
    const disposers = [];
    let started = false;
    const collect = (dispose) => {
      if (typeof dispose === "function") disposers.push(dispose);
    };
    const start = () => {
      if (started) return;
      started = true;
      const off = new Set((new URLSearchParams(location.search).get("dms-off") || "").split(","));
      state.DEBUG_OFF = off;
      if (!off.has("styles")) styleOnce();
      scrimOnce();
      collect(installTopbarRepair());
      collect(installBackStack());
      collect(installExitGuard());
      collect(installGestures());
      collect(installRightInterceptors());
      collect(installViewTabsMenu());
      collect(installKeyboard());
      collect(installSettingsWatcher());
      collect(installAttachSheet());
      collect(installSessionWatcher());
      if (!off.has("autoclose")) collect(installDrawerAutoClose());
      if (!off.has("longpress")) collect(installLongPress());
      if (!off.has("observer")) collect(installObserver(sync));
      sync();
      let leftPreloadTries = 0;
      let leftPreloadTimer = 0;
      const ensureLeftPreload = () => {
        leftPreloadTimer = 0;
        if (!isPhone() || state.leftVisible || state.rightVisible) return;
        if (hostLeftOpen()) return;
        if (state.sidebarMountState === "failed") return;
        if (state.sidebarExpandBusy) {
          if (leftPreloadTries++ < 40) leftPreloadTimer = setTimeout(ensureLeftPreload, 150);
          return;
        }
        forceMountSidebar();
        if (leftPreloadTries++ < 8) leftPreloadTimer = setTimeout(ensureLeftPreload, 200);
      };
      leftPreloadTimer = setTimeout(ensureLeftPreload, 120);
      disposers.push(() => {
        if (leftPreloadTimer !== 0) clearTimeout(leftPreloadTimer);
      });
      const preloadTimer = setTimeout(() => preloadRight(), 800);
      disposers.push(() => clearTimeout(preloadTimer));
      const wanted = new URLSearchParams(location.search).get("dms");
      if (wanted === "left" && !leftOpen()) {
        const leftTimer = setTimeout(() => toggleLeft(), 600);
        disposers.push(() => clearTimeout(leftTimer));
      }
      if (wanted === "right" && !state.rightVisible) {
        const rightTimer = setTimeout(() => openRight(), 900);
        disposers.push(() => clearTimeout(rightTimer));
      }
    };
    if (document.readyState === "loading") {
      const onReady = () => start();
      document.addEventListener("DOMContentLoaded", onReady, { once: true });
      disposers.push(() => document.removeEventListener("DOMContentLoaded", onReady));
    } else {
      start();
    }
    ctx.effect(() => () => {
      for (let index = disposers.length - 1; index >= 0; index -= 1) {
        try {
          disposers[index]();
        } catch (error) {
        }
      }
      for (const tag of $$('style[data-dsh-mobile-shell="styles"]')) tag.remove();
      for (const el of $$(".dms-scrim")) el.remove();
      for (const el of $$(".dms-attach-sheet, .dms-attach-backdrop")) el.remove();
    }, "dsh-mobile-shell: teardown");
  }
  return __toCommonJS(loader_exports);
})();
    exports.apply = DMS.apply;
    exports.inject = DMS.INJECT.slice();
    return module.exports;
  }
});

