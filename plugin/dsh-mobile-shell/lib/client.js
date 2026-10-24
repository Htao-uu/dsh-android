/**
 * dsh-mobile-shell — browser half.
 *
 * A client-only DSH Web UI plugin that turns the stock three-column shell into
 * a phone-first shell modelled on the official DeepSeek app:
 *
 *   - the permanent left rail is hidden; a hamburger opens the original
 *     sidebar content as an 88vw drawer with a dimmed scrim;
 *   - the right details panel becomes a right-hand drawer, leaving part of the
 *     conversation visible behind it;
 *   - the session header gets app-style left/right action buttons;
 *   - the composer, hero and settings surfaces are restyled with the app's
 *     palette, radii and spacing;
 *   - edge swipes open/close both drawers and the Android hardware back key is
 *     routed through a single back stack (settings -> right drawer -> left
 *     drawer -> host).
 *
 * The plugin never moves a host React node: it only adds its own DOM
 * (buttons, scrims, one style tag) and a handful of data-* markers on the
 * existing frame. Host classes are matched by their stable suffix
 * ([class*="_sidebarCol"]) so version hash churn is irrelevant.
 */
window.__ModuleLoader__.load({
  id: "dsh-mobile-shell",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    const CSS = ":root {\n  --dms-blue: #426efe;\n  --dms-bg: #ffffff;\n  --dms-bg-soft: #f5f7fb;\n  --dms-surface: #ffffff;\n  --dms-surface-2: #f2f4f8;\n  --dms-text: #0f0f0f;\n  --dms-text-2: #6b7280;\n  --dms-line: rgba(15, 15, 15, 0.07);\n  --dms-scrim: rgba(16, 19, 26, 0.32);\n  --dms-radius-lg: 28px;\n  --dms-radius: 14px;\n  --dms-topbar: 52px;\n  --dms-shadow-card: 0 2px 14px rgba(15, 23, 42, 0.06), 0 0 0 0.5px rgba(15, 23, 42, 0.04);\n  --dms-shadow-drawer: 0 0 48px rgba(15, 23, 42, 0.22);\n  color-scheme: light;\n}\nhtml[data-ds-dark-theme], body[data-ds-dark-theme], [data-ds-dark-theme] {\n  --dms-bg: #10131a;\n  --dms-bg-soft: #0b0e13;\n  --dms-surface: #191b23;\n  --dms-surface-2: #23262f;\n  --dms-text: #f5f5f5;\n  --dms-text-2: #9aa0aa;\n  --dms-line: rgba(255, 255, 255, 0.08);\n  --dms-scrim: rgba(0, 0, 0, 0.52);\n  --dms-shadow-card: 0 2px 16px rgba(0, 0, 0, 0.4);\n  color-scheme: dark;\n}\n\n@media (max-width: 1023px) {\n  /* One source of truth for the drawer width: drawers and the page push must use the\n     same value or a gap appears between the pushed page and the drawer edge (hotfix\n     Bug3: 右栏与主界面之间有空隙). */\n  html { --dms-drawer-w: min(326px, 80vw); }\n  html, body { background: var(--dms-bg); }\n  body { -webkit-tap-highlight-color: transparent; overscroll-behavior: none; }\n\n  /* ---------- frame: one viewport, status bar clear ------------------------ */\n  html body [class*=\"_frame\"] {\n    grid-template-columns: 0 minmax(0, 1fr) 0 !important;\n    background: var(--dms-bg) !important;\n    box-sizing: border-box !important;\n    padding-top: env(safe-area-inset-top, 0px) !important;\n  }\n  [class*=\"_centerCol\"] { grid-column: 2 !important; background: var(--dms-bg) !important; }\n  [class*=\"_frame\"] > [class*=\"_sidebarCol\"] { background: var(--dms-bg) !important; }\n  [class*=\"_rightbarCol\"] { grid-column: 3 !important; }\n  [class*=\"_bottomRow\"],\n  [class*=\"_composerStack\"], [class*=\"_composerHero\"],\n  [class*=\"_heroWorkspaceRow\"], [class*=\"_heroOptions\"] { background: transparent !important; }\n  [class*=\"_handle\"] { display: none !important; }\n\n  /* ---------- left drawer ------------------------------------------------- */\n  [class*=\"_frame\"][data-sidebar-collapsed] > [class*=\"_sidebarCol\"] { display: none !important; }\n  [class*=\"_frame\"]:not([data-sidebar-collapsed]) > [class*=\"_sidebarCol\"] {\n    display: block !important;\n    position: fixed !important;\n    left: 0 !important;\n    top: 0 !important;\n    bottom: 0 !important;\n    width: var(--dms-drawer-w) !important;\n    max-width: var(--dms-drawer-w) !important;\n    height: 100% !important;\n    z-index: 90 !important;\n    background: var(--dms-bg-soft) !important;\n    border-right: none !important;\n    border-radius: 0 !important;\n    box-shadow: 10px 0 28px rgba(15, 23, 42, 0.18) !important;\n    /* The sidebar is preloaded and already painted under the page, so opening it\n       must not replay a slide-in animation (that was the source of the white\n       frame on fast drawer switches). Only the page push animates. */\n    animation: none !important;\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\n    box-sizing: border-box !important;\n    padding-top: env(safe-area-inset-top, 0px) !important;\n    padding-bottom: env(safe-area-inset-bottom, 0px) !important;\n    overflow: hidden !important;\n  }\n  [class*=\"_frame\"]:not([data-sidebar-collapsed]) > [class*=\"_sidebarCol\"] > *,\n  [class*=\"_frame\"]:not([data-sidebar-collapsed]) > [class*=\"_sidebarCol\"] [class*=\"_root\"] {\n    width: 100% !important;\n    max-width: none !important;\n  }\n  [class*=\"_sidebarCol\"] [class*=\"_root\"] { background: transparent !important; width: 100% !important; }\n  [class*=\"_sidebarCol\"] [class*=\"_logoRow\"] { padding: 6px 10px 2px !important; }\n  [class*=\"_sidebarCol\"] [class*=\"_regionArea\"],\n  [class*=\"_sidebarCol\"] [class*=\"_panelList\"] { overflow-x: hidden !important; }\n  [class*=\"_sidebarCol\"] [class*=\"_regionArea\"] { padding-left: 8px !important; padding-right: 8px !important; }\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"],\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceRow\"],\n  [class*=\"_sidebarCol\"] [class*=\"_regionHeader\"] {\n    width: 100% !important; min-width: 0 !important;\n    padding-left: 2px !important; padding-right: 2px !important;\n    display: flex !important; align-items: center !important; gap: 2px !important;\n    overflow: visible !important;\n  }\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] > *:first-child,\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceRow\"] > *:first-child {\n    min-width: 0 !important; flex: 0 1 auto !important;\n    overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;\n  }\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] button,\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceRow\"] button { margin-left: 0 !important; margin-right: 0 !important; }\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] > *:last-child,\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceRow\"] > *:last-child { margin-right: 2px !important; }\n  [class*=\"_sidebarCol\"] [class*=\"_sectionHeader\"],\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] {\n    width: 100% !important; min-width: 0 !important;\n    padding-left: 2px !important; padding-right: 2px !important;\n    gap: 2px !important; overflow: visible !important;\n    display: flex !important; align-items: center !important;\n  }\n  [class*=\"_sidebarCol\"] [class*=\"_sectionHeader\"] > *:first-child {\n    min-width: 40px !important; flex: 0 0 auto !important;\n    overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;\n  }\n  [class*=\"_sidebarCol\"] [class*=\"_sectionHeader\"] [class*=\"_searchSlot\"] {\n    flex: 1 1 auto !important; width: auto !important; min-width: 24px !important;\n  }\n  [class*=\"_sidebarCol\"] [class*=\"_sectionHeader\"] button {\n    width: 24px !important; height: 24px !important; min-width: 24px !important;\n    margin-left: 0 !important; margin-right: 2px !important;\n  }\n  [class*=\"_sidebarCol\"] [class*=\"_sectionHeader\"] [class*=\"_searchSlot\"] + * { margin-left: auto !important; }\n  [class*=\"_sidebarCol\"] [class*=\"_sectionHeader\"] svg { width: 16px !important; height: 16px !important; }\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] { font-size: 11px !important; }\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] button {\n    width: 24px !important; height: 24px !important; min-width: 24px !important;\n  }\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] svg { width: 16px !important; height: 16px !important; }\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] [class*=\"_search\"] {\n    width: 24px !important; min-width: 24px !important;\n  }\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] > *,\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceRow\"] > * { min-width: 0 !important; }\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] button,\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceRow\"] button { flex: 0 0 auto !important; }\n  /* the host hides these at narrow widths; a phone drawer still has room */\n  [class*=\"_sidebarCol\"] [class*=\"_search\"],\n  [class*=\"_sidebarCol\"] [class*=\"_searchButton\"] {\n    width: auto !important; min-width: 28px !important; max-width: none !important;\n    overflow: visible !important; flex: 0 0 auto !important;\n  }\n  [class*=\"_sidebarCol\"] [class*=\"_search\"] svg,\n  [class*=\"_sidebarCol\"] [class*=\"_searchButton\"] svg {\n    display: block !important; width: 20px !important; height: 20px !important; opacity: 1 !important;\n  }\n  [class*=\"_sidebarCol\"] button[aria-label=\"搜索会话\"],\n  [class*=\"_sidebarCol\"] button[aria-label=\"视图选项\"],\n  [class*=\"_sidebarCol\"] button[aria-label=\"添加工作区\"],\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceActions\"] button,\n  [class*=\"_sidebarCol\"] [class*=\"_searchButton\"],\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceSearch\"] {\n    display: inline-flex !important;\n    visibility: visible !important;\n    opacity: 1 !important;\n  }\n  [class*=\"_sidebarCol\"] [class*=\"_newSession\"] {\n    justify-content: center !important;\n    gap: 8px !important;\n    text-align: center !important;\n  }\n  [class*=\"_sidebarCol\"] [class*=\"_toggle\"] { display: none !important; }\n  [class*=\"_sidebarCol\"] [class*=\"_rowActions\"] { display: none !important; }\n  .dshm-scrim { display: none !important; }\n  /* 任务29：顶部左上角统一为插件注入的「三」汉堡按钮；宿主 leading 里的原图标/其它\n     注入项一律隐藏，避免出现方框或重复按钮。 */\n  [data-conversation-header-leading] > :not(.dms-menu) { display: none !important; }\n  /* 任务 28：对话页/主页面右上角直接用宿主自带的 expand 图标（不注入自建按钮），\n     统一成 DSH 官方 28×28/16px 透明图标按钮规格。 */\n  [class*=\"_centerCol\"] header [data-sidebar-right-expand] {\n    display: inline-flex !important;\n    align-items: center !important; justify-content: center !important;\n    width: 28px !important; height: 28px !important;\n    min-width: 28px !important; min-height: 28px !important;\n    padding: 0 !important; border: 0 !important;\n    border-radius: var(--dsw-radius-sm, 8px) !important;\n    background: transparent !important;\n    color: var(--dsw-alias-label-secondary, var(--dms-text-2)) !important;\n  }\n  [class*=\"_centerCol\"] header [data-sidebar-right-expand] svg { width: 16px !important; height: 16px !important; }\n\n  /* ---------- right drawer ------------------------------------------------ */\n  [class*=\"_frame\"] > [class*=\"_rightbarCol\"] {\n    --dsh-sidebar-width: var(--dms-drawer-w) !important;\n    display: block !important;\n    position: fixed !important;\n    top: 0 !important;\n    right: 0 !important;\n    bottom: 0 !important;\n    width: var(--dms-drawer-w) !important;\n    max-width: var(--dms-drawer-w) !important;\n    height: 100% !important;\n    z-index: 90 !important;\n    background: var(--dms-bg) !important;\n    border-radius: 0 !important;\n    box-shadow: -10px 0 28px rgba(15, 23, 42, 0.18) !important;\n    transform: translateX(100%) !important;\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\n    box-sizing: border-box !important;\n    padding-top: env(safe-area-inset-top, 0px) !important;\n    padding-bottom: env(safe-area-inset-bottom, 0px) !important;\n    overflow: hidden !important;\n  }\n  html.dms-right-open [class*=\"_frame\"] > [class*=\"_rightbarCol\"] { transform: translateX(0) !important; }\n  [class*=\"_rightbarCol\"] > * { width: 100% !important; height: 100% !important; }\n  [class*=\"_rightbarCol\"] [class*=\"_panel\"],\n  [class*=\"_rightbarCol\"] [class*=\"_session\"] {\n    width: 100% !important;\n    max-width: none !important;\n    left: 0 !important;\n    right: auto !important;\n    transform: none !important;\n    background: var(--dms-bg) !important;\n  }\n  [class*=\"_rightbarCol\"] [class*=\"_tabBody\"] { width: 100% !important; }\n\n  /* 任务 28：宿主右栏面板在 preload 后保持 collapsed（宿主 state 不再改动），\n     面板内容（含宿主自己的 chrome [全屏][收起] 按钮）由插件 CSS 放出并随面板移动。 */\n  html.dms-right-open [data-sidebar-right-session] [data-dockkit-host=dock],\n  html.dms-right-open [data-sidebar-right-session] [data-dockkit-empty],\n  html.dms-right-open [data-sidebar-right-session] [data-dockkit-divider] {\n    transform: none !important;\n    visibility: visible !important;\n    transition: none !important;\n  }\n  html.dms-preload-right [data-sidebar-right-panel] {\n    width: 100% !important;\n    max-width: 100% !important;\n    --dsh-sidebar-width: var(--dms-drawer-w) !important;\n  }\n  html.dms-preload-right [data-sidebar-right-session] { pointer-events: none !important; }\n  html.dms-right-open [data-sidebar-right-session] { pointer-events: auto !important; }\n  /* 宿主 chrome 图标按钮：沿用宿主官方样式（28×28/15px 图标），这里只保证可见可达。 */\n  html.dms-right-open [data-sidebar-right-session] [data-sidebar-right-mode],\n  html.dms-right-open [data-sidebar-right-session] [data-sidebar-right-toggle] {\n    display: inline-flex !important;\n    pointer-events: auto !important;\n  }\n\n  /* fullscreen right panel: host state is data-sidebar-right-panel=\"fullscreen\";\n     sync() mirrors it to html.dms-right-full. The drawer covers the page and the\n     edge gestures are disabled in JS while this class is present. */\n  html.dms-right-full [class*=\"_frame\"] > [class*=\"_rightbarCol\"] {\n    width: 100vw !important;\n    max-width: 100vw !important;\n    z-index: 95 !important;\n    box-shadow: none !important;\n    transform: translateX(0) !important;\n  }\n  html.dms-right-full [class*=\"_centerCol\"],\n  html.dms-right-full.dms-right-open [class*=\"_centerCol\"] { transform: none !important; }\n  html.dms-right-full .dms-scrim { display: none !important; }\n\n  /* ---------- scrim ------------------------------------------------------- */\n  .dms-scrim {\n    position: fixed; inset: 0; z-index: 80;\n    background: transparent !important;\n    opacity: 0; pointer-events: none;\n    transition: opacity 0.2s ease;\n  }\n  html.dms-left-open .dms-scrim,\n  html.dms-right-open .dms-scrim { opacity: 1; pointer-events: auto; }\n\n  /* App-style push: the page moves with the drawer. This deliberately revisits\n     the \"never push\" rule in HANDOVER §14 — the blank strip seen then came from\n     the host sidebar not being mounted yet; with the P0 preload fix it is always\n     painted under the page, so pushing exposes the drawer, not a white gap.\n     Duration/easing match the drawer transition (0.24s) for a single motion. */\n  html.dms-left-open [class*=\"_centerCol\"] {\n    transform: translate3d(var(--dms-drawer-w), 0, 0) !important;\n    opacity: 1 !important;\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\n  }\n  html.dms-right-open [class*=\"_centerCol\"] {\n    transform: translate3d(calc(-1 * var(--dms-drawer-w)), 0, 0) !important;\n    opacity: 1 !important;\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\n  }\n  html:not(.dms-left-open):not(.dms-right-open) [class*=\"_centerCol\"] {\n    transform: none !important;\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\n  }\n\n  /* ---------- top bar (host header, restyled) ----------------------------- */\n  [class*=\"_centerCol\"] header.dms-topbar {\n    height: var(--dms-topbar) !important;\n    min-height: var(--dms-topbar) !important;\n    padding: 0 12px !important;\n    background: var(--dms-bg) !important;\n    border-bottom: none !important;\n    box-sizing: border-box !important;\n    align-items: center !important;\n    position: relative !important;\n    z-index: 30 !important;\n  }\n  [class*=\"_centerCol\"] header.dms-topbar [class*=\"_headerLeading\"] {\n    display: flex !important; align-items: center !important;\n    gap: 4px !important; min-width: 0 !important; height: 100%;\n  }\n  [class*=\"_centerCol\"] header.dms-topbar [class*=\"_headerCorner\"] {\n    display: flex !important; align-items: center !important; gap: 4px !important;\n    position: relative !important; right: auto !important; top: auto !important;\n    height: 100%;\n  }  [class*=\"_centerCol\"] header.dms-topbar [data-conversation-header-leading],\n  [class*=\"_centerCol\"] header.dms-topbar [data-conversation-header-corner] {\n    gap: 4px !important; align-items: center !important;\n  }\n  [class*=\"_centerCol\"] header.dms-topbar [class*=\"_titleRow\"] { align-items: center !important; min-height: 100%; }\n  [class*=\"_centerCol\"] header.dms-topbar [data-conversation-tabs],\n  [class*=\"_centerCol\"] header.dms-topbar [class*=\"_tabs\"] { display: none !important; }\n  [class*=\"_centerCol\"] header.dms-topbar[class*=\"headerBlank\"] .dms-plus { display: none !important; }\n\n  .dms-menu { position: relative !important; z-index: 6 !important; }\n  /* 0.6.18: all injected header buttons copy the DSH host icon-button metrics\n     (ui-sidebar HeaderLeadingControls): 28px square, radius-sm, label-secondary,\n     16px glyph, transparent + interactive hover. No custom sizes/colors. */\n  /* 0.6.18 修正：所有注入按钮统一 DSH 宿主官方图标按钮规格\n     —— 28×28、透明底、16px 图标、按下浅色反馈（顶部栏与右栏共用同一套）。 */\n  .dms-iconbtn {\n    width: 28px; height: 28px; flex: 0 0 28px;\n    display: inline-flex; align-items: center; justify-content: center;\n    border: 0; border-radius: var(--dsw-radius-sm, 8px); padding: 0; margin: 0;\n    background: transparent; color: var(--dsw-alias-label-secondary, var(--dms-text-2));\n    -webkit-tap-highlight-color: transparent;\n    cursor: pointer;\n  }\n  .dms-iconbtn:active { background: var(--dsw-alias-interactive-bg-hover, var(--dms-surface-2)) !important; }\n  .dms-iconbtn svg { display: block; width: 16px !important; height: 16px !important; }\n  /* Do not inflate the host's own header buttons: keep the official 28px/16px so\n     the injected icons and the host actions share one compact row. */\n  [class*=\"_centerCol\"] header.dms-topbar [class*=\"_button_\"],\n  [class*=\"_centerCol\"] header.dms-topbar [class*=\"_iconButton\"] {\n    width: 28px !important; height: 28px !important; min-width: 28px !important;\n    border-radius: var(--dsw-radius-sm, 8px) !important;\n    color: var(--dsw-alias-label-secondary, var(--dms-text-2)) !important;\n  }\n  [class*=\"_centerCol\"] header.dms-topbar [class*=\"_button_\"] svg,\n  [class*=\"_centerCol\"] header.dms-topbar [class*=\"_iconButton\"] svg { width: 16px !important; height: 16px !important; }\n\n  /* ---------- hero -------------------------------------------------------- */\n  [class*=\"_centerCol\"] [class*=\"_headline\"] {\n    flex-direction: column !important;\n    align-items: center !important;\n    justify-content: center !important;\n    gap: 14px !important;\n  }\n  [class*=\"_centerCol\"] [class*=\"_fishHitbox\"] svg { width: 64px !important; height: 48px !important; }\n  [class*=\"_centerCol\"] [class*=\"_titleGroup\"] { gap: 0 !important; }\n  [class*=\"_centerCol\"] [class*=\"_titleGroup\"] > span:first-child {\n    font-size: 21px !important; font-weight: 600 !important; letter-spacing: 0.2px !important;\n  }\n  [class*=\"_previewBadge\"] { display: none !important; }\n\n  /* hero page: keep the greeter centred but pin the composer to the bottom */\n  html.dms-hero-home [class*=\"_scrollBody\"] { justify-content: flex-start !important; }\n  html.dms-hero-home [data-composer-seat] {\n    flex: 1 1 auto !important; min-height: 0 !important;\n    display: flex !important; flex-direction: column !important;\n  }\n  html.dms-hero-home [class*=\"_composerHero\"] {\n    flex: 1 1 auto !important; min-height: 0 !important;\n    display: flex !important; flex-direction: column !important;\n    justify-content: flex-end !important;\n  }\n  html.dms-hero-home [class*=\"_composerHero\"] > [class*=\"_root\"] {\n    margin-top: auto !important; margin-bottom: auto !important;\n  }\n  /* 0.6.15: compress the vertical rhythm only - the logo and 探索未至之境 keep\n     their host font/logo sizes (the user asked to undo the 0.6.14 shrink). */\n  html.dms-attach-open [class*=\"_centerCol\"] [class*=\"_headline\"] {\n    gap: 6px !important;\n    margin-top: 0 !important;\n  }\n\n  /* conversation messages align with the composer card width */\n  [class*=\"_centerCol\"] [class*=\"_scroll\"]:has(> [class*=\"_column\"]) {\n    padding-left: 12px !important;\n    padding-right: 12px !important;\n  }\n\n  /* ---------- composer ---------------------------------------------------- */\n  [data-composer-seat] { background: var(--dms-bg) !important; }\n  [data-composer-card] {\n    border-radius: var(--dms-radius-lg) !important;\n    background: var(--dms-surface) !important;\n    border: 0 !important;\n    box-shadow: var(--dms-shadow-card) !important;\n    padding: 12px 12px 10px !important;\n    margin: 0 12px calc(8px + env(safe-area-inset-bottom, 0px)) !important;\n  }\n  [data-composer-input] { font-size: 16px !important; line-height: 1.45 !important; color: var(--dms-text) !important; }\n  [data-composer-placeholder] { font-size: 16px !important; color: var(--dms-text-2) !important; }\n  [data-composer-card] [class*=\"_row\"] { gap: 6px !important; }\n  [data-composer-card] [class*=\"_add\"] {\n    width: 36px !important; height: 36px !important; min-width: 36px !important;\n    border-radius: 50% !important; background: var(--dms-surface-2) !important;\n    color: var(--dms-text) !important; border: 0 !important;\n  }\n  [data-composer-card] [class*=\"_add\"] svg { width: 18px !important; height: 18px !important; }\n  [data-composer-card] [class*=\"_primary\"] {\n    width: 38px !important; height: 38px !important; min-width: 38px !important;\n    border-radius: 50% !important;\n    background: var(--dms-blue) !important;\n    color: #fff !important;\n    border: 0 !important;\n    box-shadow: 0 4px 12px rgba(66, 110, 254, 0.32) !important;\n    transition: background 0.16s ease, transform 0.12s ease !important;\n  }\n  [data-composer-card] [class*=\"_primary\"]:disabled,\n  [data-composer-card] [class*=\"_primary\"][aria-disabled=\"true\"] {\n    background: var(--dms-surface-2) !important;\n    color: var(--dms-text-2) !important;\n    box-shadow: none !important;\n  }\n  [data-composer-card] [class*=\"_primary\"] svg { width: 19px !important; height: 19px !important; }\n  [data-composer-card] [class*=\"_primary\"]:active { transform: scale(0.94); }\n\n  /* DSH-style round icon controls: permission + model, no labels/chevrons */\n  [class*=\"_modes\"] button, [class*=\"_standardControls\"] button {\n    width: 36px !important; height: 36px !important; min-width: 36px !important;\n    padding: 0 !important;\n    border-radius: 50% !important;\n    background: var(--dms-surface-2) !important;\n    border: 0 !important;\n    color: var(--dms-text) !important;\n    font-size: 0 !important;\n    display: inline-flex !important; align-items: center !important; justify-content: center !important;\n    overflow: hidden !important;\n  }\n  [class*=\"_modes\"] button [class*=\"_triggerLabel\"],\n  [class*=\"_modes\"] button [class*=\"_chevron\"],\n  [class*=\"_standardControls\"] button [class*=\"_triggerLabel\"],\n  [class*=\"_standardControls\"] button [class*=\"_chevron\"] { display: none !important; }\n  [class*=\"_modes\"] button svg, [class*=\"_standardControls\"] button svg {\n    display: block !important;\n    width: 18px !important; height: 18px !important; color: var(--dms-text) !important;\n  }\n  [class*=\"_standardControls\"] button svg:last-child { display: none !important; }\n  .dms-menu svg { transform: scaleX(-1); }\n  [class*=\"_notice\"] { color: var(--dms-text-2) !important; background: transparent !important; }\n\n  /* conversation footer stats: keep the three parts on one compact line */\n  [class*=\"_composerDock\"], [data-composer-dock] {\n    padding: 0 8px calc(3px + env(safe-area-inset-bottom, 0px)) !important;\n    min-height: 16px !important;\n    font-size: 10.5px !important;\n    color: var(--dms-text-2) !important;\n    display: flex !important; align-items: center !important;\n    gap: 4px !important;\n    overflow: hidden !important;\n  }\n  [class*=\"_composerDock\"] > *, [data-composer-dock] > * {\n    min-width: 0 !important;\n    overflow: hidden !important;\n    text-overflow: ellipsis !important;\n    white-space: nowrap !important;\n    font-size: 10.5px !important;\n    line-height: 1.25 !important;\n    gap: 3px !important;\n  }\n  [class*=\"_composerDock\"] svg, [data-composer-dock] svg { width: 12px !important; height: 12px !important; }\n  [class*=\"_composerDock\"] button, [data-composer-dock] button { font-size: 10.5px !important; height: auto !important; padding: 0 1px !important; }\n  [data-composer-stats] {\n    gap: 0 !important;\n    justify-content: space-between !important;\n    width: 100% !important;\n    max-width: 100% !important;\n    padding: 0 6px !important;\n    font-size: 10px !important;\n    line-height: 1.25 !important;\n    overflow: visible !important;\n  }\n  [data-composer-stats] > * {\n    flex: 0 0 auto !important;\n    max-width: none !important;\n    min-width: 0 !important;\n    overflow: visible !important;\n  }\n  [data-composer-stats] [class*=\"_pill\"] {\n    max-width: none !important;\n    padding: 0 1px !important;\n    gap: 2px !important;\n    font-size: 10px !important;\n    white-space: nowrap !important;\n  }\n  [data-composer-stats] [class*=\"_label\"] {\n    min-width: 0 !important;\n    overflow: visible !important;\n    text-overflow: clip !important;\n    white-space: nowrap !important;\n  }\n  [data-composer-stats] [class*=\"_sep\"] {\n    display: inline-block !important;\n    width: 5px !important;\n    height: 1px !important;\n    margin: 0 2px !important;\n    overflow: hidden !important;\n    color: transparent !important;\n    font-size: 0 !important;\n    vertical-align: middle !important;\n  }\n  [data-composer-stats] { gap: 6px !important; }\n  [data-composer-stats] [class*=\"_label\"] { display: inline-flex !important; align-items: center !important; gap: 2px !important; }\n  [data-composer-stats] svg { width: 10px !important; height: 10px !important; }\n  [class*=\"_statusBar\"], [class*=\"_statusLine\"], [class*=\"_sessionStats\"], [class*=\"_statsLine\"], [class*=\"_usageBar\"] {\n    font-size: 11px !important;\n    gap: 6px !important;\n    padding-left: 12px !important; padding-right: 12px !important;\n    overflow: hidden !important;\n  }\n  [class*=\"_statusBar\"] > *, [class*=\"_statusLine\"] > *, [class*=\"_sessionStats\"] > *, [class*=\"_statsLine\"] > * {\n    min-width: 0 !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;\n  }\n\n  /* ---------- settings ---------------------------------------------------- */\n  [data-shortcut-modal=\"settings\"], [data-shortcut-modal=\"settings\"] * { box-sizing: border-box !important; }\n  [data-shortcut-modal=\"settings\"] {\n    position: fixed !important;\n    inset: 0 !important;\n    width: 100vw !important;\n    max-width: none !important;\n    height: 100% !important;\n    max-height: none !important;\n    margin: 0 !important;\n    border-radius: 0 !important;\n    background: var(--dms-bg-soft) !important;\n    display: flex !important;\n    flex-direction: column !important;\n    padding: calc(52px + env(safe-area-inset-top, 0px)) 0 0 !important;\n    overflow: hidden !important;\n  }\n  .dms-settings-chrome {\n    display: none;\n    position: fixed;\n    left: 0; right: 0; top: 0;\n    height: calc(52px + env(safe-area-inset-top, 0px));\n    padding-top: env(safe-area-inset-top, 0px);\n    box-sizing: border-box;\n    align-items: center;\n    justify-content: center;\n    background: var(--dms-bg);\n    border-bottom: 1px solid var(--dms-line);\n    z-index: 2147483000;\n  }\n  html.dms-settings-open .dms-settings-chrome { display: flex; }\n  .dms-settings-chrome .dms-settings-back {\n    position: absolute; left: 4px; top: 50%; transform: translateY(-50%);\n    width: 44px; height: 44px; border: 0; border-radius: 50%;\n    background: transparent; color: var(--dms-text);\n    display: inline-flex; align-items: center; justify-content: center;\n  }\n  .dms-settings-chrome .dms-settings-back:active { background: var(--dms-surface-2); }\n  .dms-settings-chrome .dms-settings-back svg { width: 22px; height: 22px; }\n  .dms-settings-chrome .dms-settings-title {\n    display: flex; align-items: center; gap: 7px;\n    font-size: 17px; font-weight: 600; color: var(--dms-text); line-height: 1;\n  }\n  .dms-settings-chrome .dms-settings-title svg { width: 19px; height: 19px; }\n\n  /* settings list page */\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] {\n    display: flex !important; flex-direction: column !important;\n    width: 100% !important;\n    padding: 8px 12px calc(16px + env(safe-area-inset-bottom, 0px)) !important;\n    background: transparent !important;\n    border-bottom: 0 !important;\n    overflow: auto !important;\n  }\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] [class*=\"_navTitle\"] { display: none !important; }\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] [class*=\"_navList\"] {\n    display: flex !important; flex-direction: column !important;\n    width: 100% !important; gap: 0 !important;\n    overflow: hidden !important; padding: 0 !important;\n    background: var(--dms-surface) !important;\n    border-radius: 12px !important;\n  }\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] [class*=\"_navCell\"] {\n    width: 100% !important; height: 46px !important;\n    flex: 0 0 auto !important;\n    display: flex !important; flex-direction: row !important;\n    align-items: center !important; justify-content: flex-start !important;\n    gap: 10px !important;\n    padding: 0 12px !important;\n    border-radius: 0 !important;\n    background: transparent !important;\n    border-bottom: 1px solid var(--dms-line) !important;\n    color: var(--dms-text) !important;\n    font-size: 15px !important; font-weight: 400 !important;\n    border: 0 !important;\n    position: relative !important;\n    white-space: nowrap !important;\n  }\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] [class*=\"_navCell\"] svg {\n    width: 20px !important; height: 20px !important;\n    flex: 0 0 20px !important; color: var(--dms-text) !important;\n  }\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] [class*=\"_navCell\"]::after {\n    content: \"\\203A\"; position: absolute; right: 12px;\n    font-size: 20px; line-height: 1; color: var(--dms-text-2);\n  }\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] [class*=\"_navCell\"][class*=\"_active\"] {\n    background: transparent !important; color: var(--dms-text) !important; font-weight: 400 !important;\n  }\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] [class*=\"_navCell\"]:last-child { border-bottom: 0 !important; }\n\n  /* mode switches only touch direct children so nested dialogs stay usable */\n  html.dms-settings-list [data-shortcut-modal=\"settings\"] > [class*=\"_content\"] { display: none !important; }\n  html.dms-settings-section [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] { display: none !important; }\n  html.dms-settings-section [data-shortcut-modal=\"settings\"] > [class*=\"_content\"] {\n    display: flex !important; flex-direction: column !important;\n    flex: 1 1 auto !important; min-height: 0 !important; overflow: hidden !important;\n  }\n  html.dms-settings-section [data-shortcut-modal=\"settings\"] > [class*=\"_content\"] > [class*=\"_header\"] { display: none !important; }\n  [data-shortcut-modal=\"settings\"] > [class*=\"_content\"] > [class*=\"_options\"] {\n    flex: 1 1 auto !important;\n    overflow-y: auto !important;\n    overflow-x: hidden !important;\n    padding: 8px 12px calc(20px + env(safe-area-inset-bottom, 0px)) !important;\n  }\n  [data-shortcut-modal=\"settings\"] > [class*=\"_content\"] > [class*=\"_options\"]::-webkit-scrollbar,\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"]::-webkit-scrollbar { width: 0 !important; height: 0 !important; }\n  [data-shortcut-modal=\"settings\"] > [class*=\"_content\"] > [class*=\"_options\"] { scrollbar-width: none !important; }\n\n  [data-shortcut-modal=\"settings\"] [class*=\"_section\"] {\n    width: 100% !important;\n    background: var(--dms-surface) !important;\n    border-radius: 12px !important;\n    margin: 0 0 6px !important;\n    padding: 0 12px !important;\n    overflow: hidden !important;\n  }\n  [data-shortcut-modal=\"settings\"] [class*=\"_section\"] > * {\n    border-bottom: 1px solid var(--dms-line) !important;\n    padding: 10px 0 !important;\n  }\n  [data-shortcut-modal=\"settings\"] [class*=\"_section\"] > *:last-child { border-bottom: 0 !important; }\n  [data-shortcut-modal=\"settings\"] [class*=\"_group\"] { padding: 10px 0 !important; }\n  [data-shortcut-modal=\"settings\"] [class*=\"_group\"] [class*=\"_title\"] {\n    font-size: 12.5px !important; color: var(--dms-text-2) !important; font-weight: 500 !important;\n    margin-bottom: 6px !important;\n  }\n  [data-shortcut-modal=\"settings\"] [class*=\"_row\"] {\n    display: flex !important; align-items: center !important; gap: 10px !important;\n    width: 100% !important; max-width: 100% !important; min-width: 0 !important;\n  }\n  [class*=\"_rowText\"] { flex: 1 1 auto !important; min-width: 0 !important; align-items: flex-start !important; padding-right: 0 !important; }\n  [class*=\"_rowText\"] [class*=\"_title\"], [class*=\"_rowText\"] [class*=\"_desc\"] {\n    text-align: left !important; margin-left: 0 !important;\n    width: auto !important; max-width: 100% !important;\n  }\n  [class*=\"_rowText\"] [class*=\"_desc\"] { flex: 1 1 auto !important; align-self: stretch !important; width: 100% !important; }\n  [data-shortcut-modal=\"settings\"] [class*=\"_title\"] {\n    font-size: 14.5px !important; color: var(--dms-text) !important; font-weight: 500 !important;\n    text-align: left !important; white-space: normal !important;\n  }\n  body [data-shortcut-modal=\"settings\"] [class*=\"_rowText\"] { align-items: flex-start !important; }\n  body [data-shortcut-modal=\"settings\"] [class*=\"_title\"] { text-align: left !important; width: 100% !important; }\n  [class*=\"_desc\"], [class*=\"_description\"] {\n    font-size: 12px !important; color: var(--dms-text-2) !important;\n    margin-top: 2px !important; line-height: 1.4 !important;\n  }\n  [data-shortcut-modal=\"settings\"] [class*=\"_selector\"] {\n    flex: 0 0 auto !important;\n    width: auto !important;\n    max-width: 62% !important;\n    min-width: 0 !important;\n    height: 30px !important;\n    padding: 0 9px !important;\n    font-size: 12px !important;\n    display: inline-flex !important; align-items: center !important;\n    color: var(--dms-text-2) !important;\n    white-space: nowrap !important;\n  }\n  [data-shortcut-modal=\"settings\"] [class*=\"_cubeRow\"] { display: flex !important; flex-direction: row !important; gap: 8px !important; }\n  [data-shortcut-modal=\"settings\"] [class*=\"_themeCube\"] {\n    flex: 1 1 0 !important; min-width: 0 !important; width: auto !important;\n    white-space: nowrap !important;\n  }\n  [data-shortcut-modal=\"settings\"] [class*=\"_themeCube\"]:not([class*=\"_selected\"]) {\n    background: transparent !important;\n  }\n\n  /* provider/model editor page */\n  [data-shortcut-modal=\"settings\"] [class*=\"_editorActions\"] {\n    display: flex !important; flex-wrap: wrap !important; gap: 8px !important;\n  }\n  [data-shortcut-modal=\"settings\"] [class*=\"_modelRow\"] {\n    display: flex !important; flex-wrap: wrap !important; gap: 8px !important;\n    width: 100% !important;\n  }\n  [data-shortcut-modal=\"settings\"] [class*=\"_modelRow\"] input {\n    flex: 1 1 110px !important; min-width: 0 !important;\n    font-size: 12px !important; padding: 0 6px !important;\n  }\n  [data-shortcut-modal=\"settings\"] [class*=\"_modelRow\"] [class*=\"_iconButton\"] {\n    width: 24px !important; height: 24px !important; min-width: 24px !important; padding: 0 !important;\n  }\n  [data-shortcut-modal=\"settings\"] [class*=\"_modelEntry\"] { width: 100% !important; }\n  [data-shortcut-modal=\"settings\"] [class*=\"_addModelButton\"],\n  [data-shortcut-modal=\"settings\"] [class*=\"_addButton\"] {\n    width: auto !important; height: auto !important; min-width: 0 !important;\n    white-space: nowrap !important;\n  }\n  [data-shortcut-modal=\"settings\"] [class*=\"_modelList\"],\n  [data-shortcut-modal=\"settings\"] [class*=\"_customizedBody\"] { width: 100% !important; }\n\n  /* long model names wrap instead of clipping */\n  [role=menu] [role=menuitem], [class*=\"_modelItem\"], [class*=\"_optionItem\"] { white-space: normal !important; height: auto !important; min-height: 40px !important; }\n  [role=menu] [role=menuitem] [class*=\"_label\"], [class*=\"_modelItem\"] [class*=\"_label\"] { white-space: normal !important; line-height: 1.35 !important; }\n\n  /* the host sidebar is kept mounted (preloaded) and pinned off-screen; opening slides it in */\n  html.dms-preload-left [class*=\"_frame\"] > [class*=\"_sidebarCol\"] {\n    /* Keep the host sidebar expanded and *under* the opaque page. It is fully\n       visible to the renderer (so plugins/sidebar content paint before the\n       first touch) but covered by centerCol; opening only raises its z-index.\n       Off-screen/opacity-0 preloads skipped paint and produced a white first frame. */\n    transform: none !important;\n    opacity: 1 !important;\n    z-index: 0 !important;\n    animation: none !important;\n    transition: none !important;\n    pointer-events: none !important;\n  }\n  html.dms-preload-left [class*=\"_centerCol\"] {\n    position: relative !important;\n    z-index: 1 !important;\n    background: var(--dms-bg) !important;\n  }\n  html.dms-left-hide [class*=\"_frame\"] > [class*=\"_sidebarCol\"] {\n    transform: translateX(-100%) !important;\n    animation: none !important;\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\n  }\n  /* while a gesture mounts a drawer, pin it off-screen until our compositor frame lands */\n  html.dms-gesture-arming [class*=\"_frame\"] > [class*=\"_sidebarCol\"] {\n    animation: none !important;\n    transition: none !important;\n    transform: translateX(-100%) !important;\n    will-change: transform !important;\n  }\n  html.dms-gesture-arming-right [class*=\"_frame\"] > [class*=\"_rightbarCol\"] {\n    animation: none !important;\n    transition: none !important;\n    transform: translateX(100%) !important;\n    will-change: transform !important;\n  }\n  /* The preload rules keep the host sidebar under the page; while the drawer is\n     open it must come back above the pushed page. Overriding the combined state\n     (instead of removing dms-preload-left on open) avoids a class churn that\n     re-ran the host animation and flashed white on fast drawer switches. */\n  html.dms-preload-left.dms-left-open [class*=\"_frame\"] > [class*=\"_sidebarCol\"],\n  html.dms-left-open [class*=\"_frame\"]:not([data-sidebar-collapsed]) > [class*=\"_sidebarCol\"] {\n    z-index: 90 !important;\n    pointer-events: auto !important;\n    animation: none !important;\n    transition: none !important;\n    transform: none !important;\n  }\n\n  /* Right drawer follows the left one: the host panel is preloaded and stays\n     mounted off-screen; opening/closing only moves it (state = plugin rightVisible). */\n  html.dms-preload-right [class*=\"_frame\"] > [class*=\"_rightbarCol\"] {\n    transform: translateX(100%) !important;\n    opacity: 1 !important;\n    z-index: 0 !important;\n    animation: none !important;\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\n    pointer-events: none !important;\n  }\n  html.dms-preload-right [class*=\"_centerCol\"] {\n    position: relative !important;\n    z-index: 1 !important;\n    background: var(--dms-bg) !important;\n  }\n  html.dms-preload-right.dms-right-open [class*=\"_frame\"] > [class*=\"_rightbarCol\"],\n  html.dms-right-open [class*=\"_frame\"] > [class*=\"_rightbarCol\"] {\n    transform: translateX(0) !important;\n    pointer-events: auto !important;\n    z-index: 90 !important;\n  }\n\n  /* ---------- toast ------------------------------------------------------- */\n  .dms-toast {\n    position: fixed; left: 50%;\n    bottom: calc(190px + env(safe-area-inset-bottom, 0px));\n    transform: translateX(-50%) translateY(8px);\n    max-width: 76vw;\n    padding: 9px 16px;\n    border-radius: 999px;\n    background: rgba(22, 24, 30, 0.86);\n    color: #fff;\n    font-size: 13px;\n    line-height: 1.2;\n    white-space: nowrap;\n    z-index: 2147483600;\n    opacity: 0; pointer-events: none;\n    transition: opacity 0.16s ease, transform 0.16s ease;\n  }\n  .dms-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }\n\n  html.dms-gesture-opened [class*=\"_frame\"]:not([data-sidebar-collapsed]) > [class*=\"_sidebarCol\"] { animation: none !important; }\n\n  /* ---------- drawer drag (direct compositor transforms) ------------------ */\n  html.dms-dragging-left [class*=\"_centerCol\"],\n  html.dms-dragging-right [class*=\"_centerCol\"],\n  html.dms-drag-close-left [class*=\"_centerCol\"],\n  html.dms-drag-close-right [class*=\"_centerCol\"] { transition: none !important; }\n  html.dms-dragging-left [class*=\"_frame\"]:not([data-sidebar-collapsed]) > [class*=\"_sidebarCol\"],\n  html.dms-drag-close-left [class*=\"_frame\"]:not([data-sidebar-collapsed]) > [class*=\"_sidebarCol\"],\n  html.dms-dragging-right [class*=\"_frame\"] > [class*=\"_rightbarCol\"],\n  html.dms-drag-close-right [class*=\"_frame\"] > [class*=\"_rightbarCol\"] {\n    animation: none !important;\n    transition: none !important;\n    will-change: transform !important;\n    backface-visibility: hidden !important;\n  }\n\n  /* hover-only message actions stay reachable on touch; sidebar rows open theirs on long-press */\n  [class*=\"_message\"] [class*=\"_actions\"],\n  [class*=\"_message\"] [class*=\"_actionBar\"] {\n    opacity: 1 !important;\n    visibility: visible !important;\n  }\n\n  /* ---------- composer attach sheet --------------------------------------- */\n  .dms-attach-backdrop {\n    display: block;\n    position: fixed; inset: 0; z-index: 1040;\n    background: transparent;\n    opacity: 0; pointer-events: none;\n    transition: opacity 0.2s ease-out;\n  }\n  html.dms-attach-open .dms-attach-backdrop { opacity: 1; }\n  .dms-attach-sheet {\n    display: flex;\n    position: fixed; left: 0; right: 0; bottom: 0; z-index: 1049;\n    transform: translateY(105%); opacity: 1; pointer-events: none;\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);\n    background: var(--dms-bg);\n    border-radius: 18px 18px 0 0;\n    /* 0.6.16: restore the 0.6.13 size/spacing; no upward shadow and no grabber\n       line (both read as the dark line the user flagged above 最近照片). */\n    padding: 8px 14px calc(14px + env(safe-area-inset-bottom, 0px));\n    box-shadow: none;\n    border: 0;\n    flex-direction: column; gap: 12px;\n    max-height: 50vh;\n    /* If the available height cannot fit the strip + action row, scroll inside\n       the sheet instead of squashing the content (用户 修正1.3). */\n    overflow-y: auto;\n    overscroll-behavior: contain;\n    -webkit-overflow-scrolling: touch;\n    scrollbar-width: none;\n  }\n  .dms-attach-sheet::-webkit-scrollbar { display: none; }\n  .dms-attach-recent, .dms-attach-actions { flex: 0 0 auto; }\n  html.dms-attach-open .dms-attach-sheet { transform: translateY(0); pointer-events: auto; }\n  .dms-attach-recent { display: flex; flex-direction: column; gap: 7px; }\n  .dms-attach-recent[hidden] { display: none !important; }\n  .dms-attach-recent-title { font-size: 12px; line-height: 1.25; color: var(--dms-text-2); padding: 0 2px; }\n  .dms-attach-recent-strip {\n    display: flex; gap: 8px; overflow-x: auto; overflow-y: hidden;\n    padding: 2px 2px 4px; min-height: 72px; scrollbar-width: none;\n    scroll-behavior: auto;\n  }\n  .dms-attach-recent-strip::-webkit-scrollbar { display: none; }\n  .dms-attach-loading { font-size: 12px; color: var(--dms-text-2); align-self: center; }\n  .dms-attach-photo {\n    position: relative;\n    flex: 0 0 72px; width: 72px; height: 72px; padding: 0;\n    border: 0; border-radius: 10px; overflow: hidden; background: var(--dms-surface-2);\n  }\n  .dms-photo-check {\n    position: absolute; top: 4px; right: 4px;\n    width: 17px; height: 17px; border-radius: 50%;\n    background: rgba(0, 0, 0, 0.34); border: 1.5px solid rgba(255, 255, 255, 0.95);\n    color: transparent; display: flex; align-items: center; justify-content: center;\n    box-sizing: border-box;\n  }\n  .dms-attach-photo.selected .dms-photo-check { background: var(--dms-blue); color: #fff; border-color: #fff; }\n  .dms-attach-photo.selected img { opacity: 0.86; }\n  /* host attachment remove control: keep it the official compact size */\n  [class*=\"_remove\"] {\n    width: 18px !important; height: 18px !important;\n    min-width: 18px !important; min-height: 18px !important;\n    font-size: 11px !important; line-height: 1 !important;\n  }\n  [class*=\"_remove\"] svg { width: 10px !important; height: 10px !important; }\n  .dms-attach-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }\n  .dms-attach-recent-strip, .dms-attach-photo, .dms-attach-photo img {\n    -webkit-touch-callout: none;\n    -webkit-user-select: none;\n    user-select: none;\n  }\n  .dms-attach-actions { display: flex; gap: 10px; }\n  .dms-attach-action {\n    flex: 1 1 0; min-width: 0;\n    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px;\n    height: 86px; border: 0; border-radius: 14px;\n    background: var(--dms-surface-2); color: var(--dms-text);\n    font-size: 13px; font-weight: 500;\n  }\n  .dms-attach-action:active { background: var(--dms-line); }\n  .dms-attach-ico { display: inline-flex; color: var(--dms-text); }\n  .dms-attach-ico svg { width: 24px; height: 24px; }\n\n  /* the host \"+\" rotates into an \"x\" in step with the sheet (same 0.24s curve) */\n  button[data-dms-plus=\"1\"] svg {\n    transform: rotate(0deg) !important;\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\n  }\n  html.dms-attach-open button[data-dms-plus=\"1\"] svg { transform: rotate(45deg) !important; }\n\n  /* keyboard-inset fallback (only when the host did not resize the layout) */\n  html.dms-kb-open [data-composer-seat] {\n    transform: translateY(calc(-1 * var(--dms-kb, 0px))) !important;\n    transition: transform 0.16s ease-out !important;\n  }\n  html.dms-attach-open [data-composer-seat] {\n    transform: translateY(calc(-1 * var(--dms-sheet-h, 0px))) !important;\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\n  }\n  /* The composer's shield/context popovers live inside centerCol and use host\n     layer z-index 1100. While the sheet is open drop centerCol's own stacking\n     context so those popovers can paint above the sheet instead of being\n     clipped behind it (下方界面不消失、按钮 GUI 可见). */\n  html.dms-attach-open [class*=\"_centerCol\"] { z-index: auto !important; }\n  /* the sheet must be gone in the same frame the keyboard starts opening */\n  html.dms-sheet-instant .dms-attach-sheet,\n  html.dms-sheet-instant [data-composer-seat],\n  html.dms-sheet-instant button[data-dms-plus=\"1\"] svg { transition: none !important; }\n  @keyframes dms-drawer-in {\n    from { transform: translateX(-100%); }\n    to { transform: translateX(0); }\n  }\n}\n@media (min-width: 1024px) {\n  .dms-iconbtn, .dms-scrim { display: none !important; }\n}\n";
    const MEDIA = "(max-width: 1023px)";
    const EDGE = 26;
    const TRIGGER = 56;
    const LOCK = 6;

    const ICONS = {
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

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
    const isPhone = () => window.matchMedia(MEDIA).matches;
    const frame = () => $('[class*="_frame"]');
    const sidebarCol = () => $('[class*="_sidebarCol"]');
    const rightbarCol = () => $('[class*="_rightbarCol"]');
    const settingsPanel = () => $('[data-shortcut-modal="settings"]');
    const hostLeftOpen = () => { const f = frame(); return f !== null && !f.hasAttribute("data-sidebar-collapsed"); };
    let leftVisible = false;
    let rightVisible = false;
    let sidebarExpandBusy = false;
    let sidebarExpandTimer = 0;
    let rightActivityAt = 0;
    let leftRepairTimer = 0;
    const leftOpen = () => leftVisible;
    const rightOpen = () => $("[data-sidebar-right-open]") !== null;
    const hostRightOpen = () => $("[data-sidebar-right-session]:not([hidden]) [data-sidebar-right-open]") !== null;
    let rightPreloadBusy = false;
    let rightPreloadClick = false;
    let lastRightPreloadAt = 0;
    let rightPreloadTries = 0;
    let closeAttachForSession = null;
    let sessionKeyPrev = "";
    let lastPointerInEditor = false;
    let lastPointerAt = 0;
    let rightMountBusy = false;
    let lastRightMountAttempt = 0;

    let ctxRef = null;
    let gestureBusy = false;
    let springAnimating = false;
    let DEBUG_OFF = new Set();

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

    function scrimOnce() {
      let el = $(".dms-scrim");
      if (el === null) {
        el = document.createElement("div");
        el.className = "dms-scrim";
        el.setAttribute("aria-hidden", "true");
        el.addEventListener("click", () => {
          if (rightVisible) closeRight();
          else if (leftOpen()) toggleLeft();
        });
        document.body.appendChild(el);
      }
      return el;
    }

    function cloneIcon(selector) {
      const host = $(selector);
      const svg = host === null ? null : host.querySelector("svg");
      return svg === null ? "" : svg.outerHTML;
    }
    function iconFor(kind) {
      // 任务29：左上角永远用我们的「三」汉堡图标，不克隆宿主 expand/panel 的方框图标
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
      b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
      return b;
    }

    function ensureSidebarMounted() {
      if (!isPhone() || hostLeftOpen() || sidebarExpandBusy) return;
      if (rightVisible || document.documentElement.classList.contains("dms-right-open")) return;
      sidebarExpandBusy = true;
      document.documentElement.classList.add("dms-preload-left");
      const layout = ctxRef && ctxRef.layout;
      if (layout && typeof layout.toggleSidebar === "function") layout.toggleSidebar();
      else {
        const col = sidebarCol();
        const btn = col ? col.querySelector('[class*="_toggle"]') : null;
        if (btn) btn.click();
      }
      setTimeout(() => { sidebarExpandBusy = false; }, 900);
    }
    let lastMountAttempt = 0;
    function forceMountSidebar() {
      if (!isPhone() || leftVisible || rightVisible) return;
      const root = document.documentElement;
      root.classList.add("dms-preload-left");
      const f = frame();
      if (f === null) return;
      if (!f.hasAttribute("data-sidebar-collapsed")) return;
      const now = performance.now();
      if (now - lastMountAttempt < 450) return;
      lastMountAttempt = now;
      const layout = ctxRef && ctxRef.layout;
      if (layout && typeof layout.toggleSidebar === "function") layout.toggleSidebar();
      else {
        const col = sidebarCol();
        const btn = col ? col.querySelector('[class*="_toggle"]') : null;
        if (btn) btn.click();
      }
    }

    function preloadSidebar() {
      if (!isPhone() || leftVisible || rightVisible || settingsPanel() !== null) return;
      if (hostLeftOpen() || sidebarExpandBusy) return;
      const root = document.documentElement;
      root.classList.add("dms-preload-left");
      ensureSidebarMounted();
    }

    // 右侧栏沿用左抽屉的做法：启动时把宿主右栏展开一次并常驻挂载，之后即使视觉
    // 关闭也保留 DOM（CSS 移出屏幕）。打开/关闭只改插件状态 + 动画，绝不再点击
    // 宿主的 open/close 按钮，避免循环开合（用户 2026-10-22）。
    function rightPanelEl() {
      return $("[data-sidebar-right-session]:not([hidden])") || $("[data-sidebar-right-session]");
    }
    function rightPanelMounted() {
      const panel = rightPanelEl();
      return panel !== null && panel.querySelector("[data-dockkit-pane], [data-dockkit-tab]") !== null;
    }
    const clickHost = (el) => {
      if (el === null) return false;
      rightPreloadClick = true;
      try { el.click(); } catch (error) { /* host busy */ } finally { rightPreloadClick = false; }
      return true;
    };
    // 宿主右栏的 preload：点一次 expand 让宿主挂载内容（mobile autoFullscreen 时面板
    // 100vw，但插件 CSS 立即把它藏到屏幕外），等面板/内容出现后立刻点 toggle 回到
    // collapsed；之后宿主 state 不再改动，打开/关闭/跟手/全屏完全由插件实现。
    function preloadRight(force) {
      if (!isPhone() || settingsPanel() !== null) return;
      if (rightVisible && force !== true) return;
      if (rightPreloadBusy) return;
      if (!force && rightPanelMounted()) return;
      if (force) rightPreloadTries = 0;
      if (rightPreloadTries >= 3) return;
      const now = performance.now();
      if (!force && now - lastRightPreloadAt < 900) return;
      if (hostRightOpen()) {
        // A leftover expanded host state (previous session/HMR) is normalised to
        // collapsed once here; after the preload the host state is never touched.
        clickHost($("[data-sidebar-right-toggle]"));
        rightPreloadBusy = false;
        if (rightPanelMounted()) document.documentElement.setAttribute("data-dms-right-preloaded", "1");
        return;
      }
      const expand = $("[data-sidebar-right-expand]");
      if (expand === null) return;
      lastRightPreloadAt = now;
      rightPreloadTries += 1;
      rightPreloadBusy = true;
      document.documentElement.classList.add("dms-preload-right");
      clickHost(expand);
      const started = performance.now();
      const collapse = () => {
        if (hostRightOpen() && rightPanelMounted()) {
          setTimeout(() => {
            clickHost($("[data-sidebar-right-toggle]"));
            rightPreloadBusy = false;
            rightPreloadTries = 0;
            document.documentElement.setAttribute("data-dms-right-preloaded", "1");
          }, 60);
          return;
        }
        if (performance.now() - started > 3000) { rightPreloadBusy = false; return; }
        requestAnimationFrame(collapse);
      };
      requestAnimationFrame(collapse);
    }
    function repairLeftHost() {
      if (leftRepairTimer !== 0) { clearTimeout(leftRepairTimer); leftRepairTimer = 0; }
      if (!leftVisible) return;
      const root = document.documentElement;
      root.classList.remove("dms-left-hide");
      if (!hostLeftOpen()) {
        if (!rightVisible && !root.classList.contains("dms-right-open")) {
          sidebarExpandBusy = false;
          ensureSidebarMounted();
        }
      } else {
        // Keep the preload pin in place while the drawer is open: the combined
        // html.dms-preload-left.dms-left-open CSS already lifts it above the page,
        // and not toggling the class avoids a repaint/white flash on fast switches.
        root.classList.add("dms-preload-left");
      }
      leftRepairTimer = setTimeout(repairLeftHost, 350);
    }
    // openLeftVisual()/gesture frames write !important inline overrides onto the
    // host sidebar and center column. A closed drawer must not keep them: the
    // inline z-index:90 would beat html.dms-preload-left (z-index:0) and leave
    // the already-expanded host sidebar covering the page. The CSS slide-out
    // also needs the inline transition/transform gone to be able to animate.
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
    function openLeftVisual() {
      leftVisible = true;
      const root = document.documentElement;
      // Keep dms-preload-left: the host sidebar stays mounted and painted under
      // the page (P0 fix), so opening only needs to raise it above the page and
      // let the CSS push move centerCol. Removing preload here re-ran the host
      // slide-in animation and could show a white frame on fast drawer switches.
      root.classList.remove("dms-left-hide");
      root.classList.add("dms-left-open");
      const col = sidebarCol();
      if (col !== null) {
        col.style.setProperty("animation", "none", "important");
        col.style.setProperty("transition", "none", "important");
        col.style.setProperty("transform", "none", "important");
        col.style.setProperty("z-index", "90", "important");
      }
      repairLeftHost();
    }
    function closeLeftVisual(animated) {
      if (!leftVisible) return;
      leftVisible = false;
      if (leftRepairTimer !== 0) { clearTimeout(leftRepairTimer); leftRepairTimer = 0; }
      // Drop the inline overrides first so the CSS close transition/class can win
      // and the preloaded sidebar falls back under the page.
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
    function openRight() {
      rightVisible = true;
      rightActivityAt = performance.now();
      rightFullIntent = false;
      // Preload already mounted the host panel content while the host stayed
      // collapsed; opening changes only plugin state + CSS (page push + panel slide).
      if (!rightPanelMounted()) preloadRight(true);
      document.documentElement.classList.add("dms-right-open");
    }
    function closeRight() {
      rightVisible = false;
      rightFullIntent = false;
      rightActivityAt = performance.now();
      const root = document.documentElement;
      root.classList.remove("dms-right-full");
      root.classList.remove("dms-right-open");
      // The host panel keeps its content mounted while collapsed (host behaviour);
      // the plugin only ever changes its own visual state here.
    }
    // Plugin-owned intent: only our [全屏] button may put the host panel into its
    // fullscreen layout. Everything else (edge swipe, back key, host re-render)
    // normalizes back to the 88vw sidebar state (用户 0.6.18 修正第一条).
    let rightFullIntent = false;
        function exitRightFullscreen(closeDrawer) {
      rightFullIntent = false;
      document.documentElement.classList.remove("dms-right-full");
      if (closeDrawer === true) closeRight();
    }
        function newSession() {
      const btn = $('[class*="_newSession"]');
      if (btn) btn.click();
    }

    function toggleRightFullscreen() {
      const root = document.documentElement;
      if (root.classList.contains("dms-right-full")) {
        rightFullIntent = false;
        root.classList.remove("dms-right-full");
      } else {
        rightFullIntent = true;
        rightVisible = true;
        root.classList.add("dms-right-open");
        root.classList.add("dms-right-full");
      }
      syncRightChrome();
    }
    // 宿主 chrome 的 [全屏] glyph 由宿主 fullscreen 状态决定；手机上 autoFullscreen
    // 恒真，glyph 会一直是“退出全屏”。插件按自己的 dms-right-full 状态替换 svg
    // （按钮仍然是宿主的，不自建按钮）。
    function syncRightChrome() {
      if (!isPhone()) return;
      const modeBtn = $("[data-sidebar-right-mode]");
      if (modeBtn === null) return;
      const full = document.documentElement.classList.contains("dms-right-full");
      const want = full ? ICONS.exitFull : ICONS.full;
      try {
        if (modeBtn.innerHTML !== want) modeBtn.innerHTML = want;
      } catch (error) { /* host busy */ }
      modeBtn.setAttribute("aria-label", full ? "退出全屏" : "进入全屏");
    }
    function installRightInterceptors() {
      document.addEventListener("click", (event) => {
        if (rightPreloadClick) return; // programmatic preload clicks must reach the host
        if (!isPhone()) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target === null) return;
        const expanded = target.closest("[data-sidebar-right-expand]");
        const modeBtn = target.closest("[data-sidebar-right-mode]");
        const toggle = target.closest("[data-sidebar-right-toggle]");
        if (expanded === null && modeBtn === null && toggle === null) return;
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        if (toggle !== null) {
          // 宿主 [收起] = 关闭插件抽屉（全屏态先退全屏，FEATURES 语义）
          closeRight();
          return;
        }
        if (modeBtn !== null) {
          toggleRightFullscreen();
          return;
        }
        openRight();
      }, true);
    }
    function ensureTopButtons() {
      if (!isPhone()) return;
      const header = $('[class*="_centerCol"] header');
      if (header === null) return;
      const leading = header.querySelector("[data-conversation-header-leading]");
      if (leading !== null) {
        // 任务29：左上角统一为「三」汉堡；保留并修正一个 .dms-menu（旧版本/HMR 可能
        // 注入了克隆宿主图标的按钮），多余的删除，宿主的 leading 图标由 CSS 隐藏。
        const menus = leading.querySelectorAll(".dms-menu");
        let menu = menus.length > 0 ? menus[0] : null;
        for (let i = 1; i < menus.length; i++) menus[i].remove();
        if (menu === null) {
          menu = makeButton("menu", "打开侧边栏", () => toggleLeft());
          leading.appendChild(menu);
        } else if (menu.innerHTML !== ICONS.menu) {
          menu.innerHTML = ICONS.menu;
        }
        if (menu.getAttribute("aria-label") !== "打开侧边栏") menu.setAttribute("aria-label", "打开侧边栏");
      }
      const corner = header.querySelector("[data-conversation-header-corner]") ||
        header.querySelector('[class*="_headerCorner"]');
      if (corner !== null) {
        // 任务 28：右栏入口改用宿主自带的 [data-sidebar-right-expand] 图标，
        // 不再注入自建 .dms-panel；只清理旧版本可能残留的注入按钮（HMR）。
        for (const stale of corner.querySelectorAll(".dms-panel, .dms-plus")) stale.remove();
      }
    }

    const CHEVRON_LEFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
    const GEAR_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.14.35.4.65.73.86"/></svg>';

    function panelActiveId() {
      const layout = ctxRef && ctxRef.layout;
      if (layout === undefined || layout === null) return null;
      try {
        const info = layout.panelInfo;
        const state = info && typeof info.get === "function" ? info.get() : (info && info.value);
        return state && state.activePanelId !== undefined ? state.activePanelId : null;
      } catch (error) {
        return null;
      }
    }

    function settingsBack() {
      const root = document.documentElement;
      if (root.classList.contains("dms-settings-section")) {
        root.classList.remove("dms-settings-section");
        root.classList.add("dms-settings-list");
        const title = $(".dms-settings-title-text");
        if (title !== null) title.textContent = "设置";
        return true;
      }
      const panel = settingsPanel();
      const close = panel === null ? null : panel.querySelector('[class*="_close"]');
      if (close !== null) { close.click(); return true; }
      return false;
    }

    function openSettingsSection(cell) {
      const root = document.documentElement;
      root.classList.remove("dms-settings-list");
      root.classList.add("dms-settings-section");
      const label = cell.querySelector('[class*="_navLabel"]');
      const title = $(".dms-settings-title-text");
      if (title !== null) title.textContent = label === null ? "设置" : label.textContent.trim();
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
        back.setAttribute("aria-label", "返回");
        back.innerHTML = CHEVRON_LEFT;
        back.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); settingsBack(); });
        const title = document.createElement("div");
        title.className = "dms-settings-title";
        title.innerHTML = GEAR_ICON + '<span class="dms-settings-title-text">设置</span>';
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
      const pluginPage = panel.querySelector('[class*="_market"], [data-dsh-market]') !== null || sectionText.indexOf("插件市场") >= 0;
      root.classList.toggle("dms-plugin-section", pluginPage);
      if (root.classList.contains("dms-settings-chrome-init") !== true) {
        root.classList.remove("dms-settings-section");
        root.classList.add("dms-settings-list");
        root.classList.add("dms-settings-chrome-init");
        const title = $(".dms-settings-title-text");
        if (title !== null) title.textContent = "设置";
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
      const apply = () => {
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
        if (title !== null) title.textContent = "设置";
        const options = panel.querySelector('[class*="_options"]');
        if (options !== null) options.scrollTop = 0;
      };
      new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
      apply();
    }

    function installBackStack() {
      const previous = window.__dshmBack;
      window.__dshmBack = function dshMobileShellBack() {
        if (settingsPanel() !== null) { if (settingsBack()) return true; }
        if (document.documentElement.classList.contains("dms-right-full")) { exitRightFullscreen(true); return true; }
        if (rightVisible) { closeRight(); return true; }
        if (leftOpen()) { toggleLeft(); return true; }
        const layout = ctxRef && ctxRef.layout;
        if (layout && typeof layout.selectPanel === "function" && $('[data-composer-card]') === null) {
          try { layout.selectPanel(null); return true; } catch (error) { /* fall through */ }
        }
        // Menus and dialogs close themselves through the host back handler.
        // Anything else on the main/conversation surface is handled by the
        // exit guard (first press shows a toast, second press backgrounds the app).
        if (typeof previous === "function" && document.querySelector('[role="dialog"], [role="menu"]') !== null) {
          return previous();
        }
        return false;
      };
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (rightVisible || leftOpen()) {
          e.preventDefault();
          window.__dshmBack();
        }
      }, true);
    }

    function installGestures() {
      let mode = null;
      let startX = 0, startY = 0, width = 0, locked = false;
      let lastX = 0, lastT = 0, velocity = 0, lastDx = 0;
      let samples = [];
      let activeEl = null, centerEl = null, springRaf = 0, drawerX = 0;
      const root = document.documentElement;
      const drawerWidth = () => Math.min(326, Math.round(window.innerWidth * 0.8));
      const sideOf = () => (mode === "open-left" || mode === "close-left" ? "left" : "right");
      const elFor = (side) => (side === "left" ? sidebarCol() : rightbarCol());
      const dragClassFor = (m) => m === "open-left" ? "dms-dragging-left" : m === "open-right" ? "dms-dragging-right" : m === "close-left" ? "dms-drag-close-left" : "dms-drag-close-right";
      const clearDragClasses = () => root.classList.remove("dms-dragging-left", "dms-dragging-right", "dms-drag-close-left", "dms-drag-close-right", "dms-gesture-arming", "dms-gesture-arming-right");
      let visualX = null;
      let lastFrameT = 0;
      const MAX_SPEED = 2300;
      const applyFrame = (side, targetX) => {
        const W = drawerWidth();
        const now = performance.now();
        const dt = Math.max(0.004, Math.min(0.05, lastFrameT === 0 ? 0.016 : (now - lastFrameT) / 1000));
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
          // Push the page in step with the drawer. HANDOVER §14 recorded a white
          // strip from pushing, but that was before the host sidebar was preloaded
          // (P0 fix): it is now painted under the page, so no blank area is exposed.
          const pageX = side === "left" ? Math.max(0, Math.min(W, W + x)) : Math.min(0, Math.max(-W, x - W));
          centerEl.style.setProperty("transition", "none", "important");
          centerEl.style.setProperty("transform", pageX === 0 ? "none" : "translate3d(" + Math.round(pageX) + "px,0,0)", "important");
          centerEl.style.setProperty("opacity", "1", "important");
        }
        drawerX = x;
      };
      const clearInline = () => {
        springAnimating = false;
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
        gestureBusy = true;
        springAnimating = true;
        if (activeEl === null) activeEl = elFor(side);
        let x = drawerX;
        let v = 0;
        const stiffness = 1500;
        const damping = 0.9;
        const dragC = 2 * damping * Math.sqrt(stiffness);
        let last = performance.now();
        const step = (now) => {
          const dt = Math.min(0.034, Math.max(0.001, (now - last) / 1000));
          last = now;
          const accel = -stiffness * (x - targetX) - dragC * v;
          v += accel * dt;
          x += v * dt;
          applyFrame(side, x);
          if (Math.abs(x - targetX) > 0.5 || Math.abs(v) > 8) {
            springRaf = requestAnimationFrame(step);
          } else {
            springRaf = 0;
            if (willClose) {
              root.classList.remove("dms-left-open", "dms-right-open");
              clearInline();
              gestureBusy = false;
              springAnimating = false;
              if (typeof done === "function") done();
            } else {
              clearInline();
              gestureBusy = false;
              springAnimating = false;
              if (typeof done === "function") done();
            }
          }
        };
        springRaf = requestAnimationFrame(step);
      };

      document.addEventListener("touchstart", (e) => {
        if (!isPhone() || e.touches.length !== 1) return;
        if (gestureBusy || springRaf !== 0) return;
        clearInline();
        visualX = null;
        lastFrameT = 0;
        mode = null; locked = false; velocity = 0;
        if (settingsPanel() !== null) return;
        if (root.classList.contains("dms-attach-open") || root.classList.contains("dms-right-full")) return;
        if ($('[data-composer-card]') === null && !leftOpen() && !rightVisible) return;
        const t = e.touches[0];
        startX = t.clientX; startY = t.clientY; lastX = startX; lastT = performance.now();
        samples = [{ x: startX, t: lastT }];
        width = window.innerWidth;
        const target = e.target instanceof Element ? e.target : document.elementFromPoint(t.clientX, t.clientY);
        // Plugin state, not the host's transient marker: the host can still report
        // data-sidebar-right-open for a frame after closeRight(), which used to
        // turn the next left-swipe into a no-op "close right" gesture.
        if (leftOpen()) {
          mode = "close-left";
        } else if (rightVisible) {
          mode = "close-right";
        } else {
          if (target && target.closest('[contenteditable], input, textarea, [role="textbox"], [role="dialog"], [data-composer-card] button')) return;
          if (target && inHorizontalScroller(target)) return;
          mode = "pending";
        }
      }, { passive: true, capture: true });

      document.addEventListener("touchmove", (e) => {
        if (mode === null || e.touches.length !== 1) return;
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        const now = performance.now();
        lastDx = dx;
        if (now - lastT > 0) velocity = velocity * 0.6 + ((t.clientX - lastX) / (now - lastT)) * 0.4;
        lastX = t.clientX; lastT = now;
        samples.push({ x: t.clientX, t: now });
        while (samples.length > 2 && now - samples[0].t > 110) samples.shift();
        if (!locked) {
          if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { mode = null; return; }
          if (Math.abs(dx) <= LOCK) return;
          if (mode === "pending" && Math.abs(dx) <= Math.abs(dy) * 1.1) return;
          if (mode === "pending") {
            mode = dx > 0 ? "open-left" : "open-right";
            root.classList.add(dragClassFor(mode));
            const openSide = mode === "open-left" ? "left" : "right";
            if (openSide === "left") {
              root.classList.add("dms-gesture-arming");
              openLeftVisual();
              applyFrame("left", -drawerWidth());
            } else {
              root.classList.add("dms-gesture-arming-right");
              if (!rightVisible) openRight();
              applyFrame("right", drawerWidth());
            }
            let armTries = 0;
            const armPaint = () => {
              if (mode === null) return;
              const side = mode === "open-left" ? "left" : "right";
              const W = drawerWidth();
              const x = side === "left" ? Math.min(0, lastDx - W) : Math.max(0, W + lastDx);
              const el = elFor(side);
              if (el !== null && el.isConnected) {
                activeEl = el;
                applyFrame(side, x);
                return;
              }
              if (armTries++ < 120) requestAnimationFrame(armPaint);
            };
            requestAnimationFrame(armPaint);
          }
          locked = true;
          gestureBusy = true;
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
      }, { passive: false, capture: true });

      const paint = (dx) => {
        const W = drawerWidth();
        const m = mode;
        if (m === "open-left") applyFrame("left", Math.min(0, dx - W));
        else if (m === "open-right") applyFrame("right", Math.max(0, W + dx));
        else if (m === "close-left") applyFrame("left", Math.min(0, dx));
        else if (m === "close-right") applyFrame("right", Math.max(0, dx));
      };

      const finish = (e) => {
        if (mode === null || !locked) { mode = null; locked = false; gestureBusy = false; clearInline(); return; }
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
        mode = null; locked = false;
        if (m === "open-left") {
          if (dx >= threshold || (fast && stableVelocity > 0)) { root.classList.add("dms-left-open", "dms-gesture-opened"); springTo("left", 0, false); }
          else springTo("left", -W, true, () => closeLeftVisual(false));
        } else if (m === "open-right") {
          if (-dx >= threshold || (fast && stableVelocity < 0)) { root.classList.add("dms-right-open"); springTo("right", 0, false); }
          else springTo("right", W, true, () => closeRight());
        } else if (m === "close-left") {
          if (-dx >= threshold || (fast && stableVelocity < 0)) springTo("left", -W, true, () => closeLeftVisual(false));
          else { root.classList.add("dms-left-open"); springTo("left", 0, false); }
        } else if (m === "close-right") {
          if (dx >= threshold || (fast && stableVelocity > 0)) springTo("right", W, true, () => closeRight());
          else { root.classList.add("dms-right-open"); springTo("right", 0, false); }
        } else {
          gestureBusy = false;
          clearInline();
        }
      };
      document.addEventListener("touchend", finish, { passive: true, capture: true });
      document.addEventListener("touchcancel", () => { mode = null; locked = false; gestureBusy = false; clearInline(); }, { passive: true, capture: true });
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

    function installExitGuard() {
      const base = window.__dshmBack;
      let lastAt = 0;
      window.__dshmBack = function dshMobileShellBackGuard() {
        const handled = typeof base === "function" ? base() : false;
        if (handled) return true;
        const now = Date.now();
        if (now - lastAt < 2000) { lastAt = 0; return false; }
        lastAt = now;
        showToast("再按一次退出");
        return true;
      };
    }

    function installKeyboard() {
      const vv = window.visualViewport;
      if (!vv) return;
      const apply = () => {
        const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        const shift = kb > 90 ? Math.round(kb) : 0;
        const root = document.documentElement;
        root.style.setProperty("--dms-kb", shift + "px");
        root.classList.toggle("dms-kb-open", shift > 0);
      };
      vv.addEventListener("resize", apply);
      vv.addEventListener("scroll", apply);
      window.addEventListener("orientationchange", () => setTimeout(apply, 260));
      setTimeout(apply, 400);
    }

    function normalizeSeparators(rootEl) {
      if (rootEl === null) return;
      try {
        const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
        let node = null;
        while ((node = walker.nextNode()) !== null) {
          const value = node.nodeValue;
          if (value && value.indexOf("·") >= 0) node.nodeValue = value.replace(/\s*·\s*/g, " ").trim();
        }
      } catch (error) { /* read-only DOM shims */ }
    }

    let autoWorkspaceTried = false;
    function maybeRestoreWorkspace() {
      if (!isPhone() || autoWorkspaceTried) return;
      const ui = ctxRef && ctxRef.uiWorkspace;
      const workspaces = ctxRef && ctxRef.workspaces;
      if (!ui || !workspaces || typeof workspaces.list?.getSnapshot !== "function") return;
      const snapshot = workspaces.list.getSnapshot();
      if (!snapshot || snapshot.phase !== "ready" || !Array.isArray(snapshot.items) || snapshot.items.length === 0) return;
      const placeholder = $("[data-composer-placeholder]");
      const text = placeholder === null ? "" : (placeholder.textContent || "").trim();
      const noWorkspace = text.indexOf("选择一个工作区开始") >= 0 || text.indexOf("Choose a workspace to start") >= 0;
      if (!noWorkspace) return;
      autoWorkspaceTried = true;
      const latest = snapshot.items.slice().sort((a, b) => Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || ""))[0];
      if (latest === undefined) return;
      setTimeout(() => {
        try {
          if (typeof ui.startSession === "function") ui.startSession(latest.workspaceId);
        } catch (error) { /* host may be busy; user can still pick manually */ }
      }, 350);
    }

    function sync() {
      const f = frame();
      if (f === null) return;
      f.setAttribute("data-dms-frame", "frame");
      maybeRestoreWorkspace();
      const root = document.documentElement;
      root.classList.toggle("dms-left-open", leftOpen());
      // The right drawer mirrors the left one: the host panel is preloaded and
      // stays mounted, so rightVisible is the single state source (no host-marker
      // reconciliation, no retry clicks).
      root.classList.toggle("dms-right-open", rightVisible);
      if (!rightVisible) preloadRight();
      else if (!rightPanelMounted()) preloadRight(true);
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
      // Fullscreen is plugin-state only (host chrome [全屏] toggles dms-right-full).
      syncRightChrome();
      if (isPhone() && !leftVisible && !rightVisible) forceMountSidebar();
    }

    function installDrawerAutoClose() {
      document.addEventListener("click", (e) => {
        if (!isPhone() || !leftOpen()) return;
        const target = e.target instanceof Element ? e.target : null;
        const col = sidebarCol();
        if (target === null || col === null || !col.contains(target)) return;
        const closeAfter = () => setTimeout(() => { if (leftOpen()) toggleLeft(); }, 60);
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
    }

    function installAttachSheet() {
      const root = document.documentElement;
      let sheet = null;
      let backdrop = null;
      let recentWrap = null;
      let recentStrip = null;
      let nativeSeq = 0;
      let nativeCaps = null;
      let nativeCapsPromise = null;
      const nativePending = new Map();
      let photoGesture = null;
      let photoPaint = null;
      let photoDragPoint = null;
      let photoAutoScrollRaf = 0;
      let photoLongPressTimer = 0;
      let suppressPhotoClick = false;
      let photoSuppressTimer = 0;
      const nativeBridge = () => {
        const api = window.DSHNative;
        return api && typeof api.request === "function" ? api : null;
      };

      function nativeCall(method, params, timeoutMs) {
        const api = nativeBridge();
        if (api === null) return Promise.reject(new Error("native bridge unavailable"));
        return new Promise((resolve, reject) => {
          const id = "dms_" + (++nativeSeq);
          const timer = setTimeout(() => {
            nativePending.delete(id);
            reject(new Error("native bridge timeout: " + method));
          }, timeoutMs || 1500);
          nativePending.set(id, { resolve, reject, timer });
          try { api.request(JSON.stringify({ id, method, params: params || {} })); }
          catch (error) { clearTimeout(timer); nativePending.delete(id); reject(error); }
        });
      }
      window.__dshNativeResult = (id, payload) => {
        const entry = nativePending.get(id);
        if (!entry) return;
        nativePending.delete(id);
        clearTimeout(entry.timer);
        try { entry.resolve(typeof payload === "string" ? JSON.parse(payload) : payload); }
        catch (error) { entry.reject(error); }
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
          sheet.setAttribute("aria-label", "添加附件");
          sheet.innerHTML =
            '<div class="dms-attach-recent" hidden><div class="dms-attach-recent-title">最近照片</div><div class="dms-attach-recent-strip"></div></div>' +
            '<div class="dms-attach-actions">' +
              '<button type="button" class="dms-attach-action" data-kind="camera"><span class="dms-attach-ico">' + ICONS.camera + '</span><span>拍照</span></button>' +
              '<button type="button" class="dms-attach-action" data-kind="gallery"><span class="dms-attach-ico">' + ICONS.image + '</span><span>相册</span></button>' +
              '<button type="button" class="dms-attach-action" data-kind="files"><span class="dms-attach-ico">' + ICONS.file + '</span><span>文件</span></button>' +
            '</div>';
          document.body.appendChild(sheet);
          recentWrap = sheet.querySelector(".dms-attach-recent");
          recentStrip = sheet.querySelector(".dms-attach-recent-strip");
          const PHOTO_LONG_PRESS_MS = 500;
          const PHOTO_MOVE_SLOP = 6;
          const cancelPhotoLongPress = () => {
            if (photoLongPressTimer !== 0) { clearTimeout(photoLongPressTimer); photoLongPressTimer = 0; }
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
              // The tap that ends a paint session must not toggle a second time.
              suppressPhotoClick = true;
              if (photoSuppressTimer !== 0) clearTimeout(photoSuppressTimer);
              photoSuppressTimer = setTimeout(() => { photoSuppressTimer = 0; suppressPhotoClick = false; }, 420);
            }
          };
          // Android long-press on an image would raise the native context menu and
          // cancel the touch stream; the sheet owns this gesture instead.
          recentStrip.addEventListener("contextmenu", (event) => { event.preventDefault(); }, { passive: false });
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
            // Native overflow scrolling stays untouched until the long press wins:
            // no preventDefault and no scrollLeft writes here (EXCELLENT-CASES 案例1).
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
                if (navigator !== undefined && typeof navigator.vibrate === "function") navigator.vibrate(10);
              } catch (error) { /* vibration is optional */ }
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
              // Finger moved before the long press matured: hand the gesture back to
              // the browser's native horizontal scroller (0.6.13 behaviour).
              cancelPhotoLongPress();
              gesture.mode = "native";
              return;
            }
            if (gesture.mode !== "paint") return;
            // Paint mode owns the gesture now: prevent native scroll, toggle cells and
            // auto-scroll at the strip edges.
            if (event.cancelable) event.preventDefault();
            photoDragPoint = { x: t.clientX, y: t.clientY };
            photoDragTo(photoCellAtPoint(t.clientX, t.clientY));
            startPhotoAutoScroll();
          }, { passive: false });
          recentStrip.addEventListener("touchend", endPhotoGesture, { passive: true });
          recentStrip.addEventListener("touchcancel", endPhotoGesture, { passive: true });
          // Single tap = toggle this photo. One delegated listener avoids duplicated
          // per-cell handlers after every re-render.
          recentStrip.addEventListener("click", (event) => {
            const cell = event.target instanceof Element ? event.target.closest(".dms-attach-photo") : null;
            if (cell === null) return;
            if (suppressPhotoClick) { suppressPhotoClick = false; return; }
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
        const reply = await nativeCall(method, params, 600000);
        const items = reply && Array.isArray(reply.files) ? reply.files : [];
        if (items.length === 0) {
          // 用户取消/没拍照：完全静默（用户 0.6.18 反馈）。真正失败由 pickFromDevice
          // 的 catch（调用失败/超时）提示。
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
              const label = kind === "camera" ? "相机" : kind === "gallery" ? "相册" : "文件选择器";
              showToast(label + "调用失败，改用系统选择器");
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
          if (file.size > MAX_FILE) { showToast("单个文件不能超过 1GB"); continue; }
          total += file.size;
          if (total > MAX_TOTAL) { showToast("单次附件总大小不能超过 5GB"); break; }
          accepted.push(file);
        }
        if (accepted.length === 0) return;
        const card = $('[data-composer-card]') || $('[data-composer-seat]') || $('[class*="_inputBar"]');
        if (card === null) { showToast("没有可用的输入框"); return; }
        const dt = new DataTransfer();
        for (const file of accepted) dt.items.add(file);
        const editor = card.querySelector('[contenteditable="true"], [role="textbox"], textarea') || card;
        let delivered = false;
        try {
          const paste = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt });
          editor.dispatchEvent(paste);
          delivered = paste.defaultPrevented;
        } catch (error) { /* fall through to drop */ }
        if (!delivered) {
          try {
            const drop = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt });
            card.dispatchEvent(drop);
            delivered = drop.defaultPrevented;
          } catch (error) { /* ignore */ }
        }
        if (!delivered) showToast("这块输入框暂不支持添加附件");
      }

      function composerAttachmentLabels() {
        const card = $('[data-composer-card]') || $('[data-composer-seat]') || $('[class*="_inputBar"]');
        if (card === null) return [];
        return $$('[class*="_remove"]', card).map((btn) => btn.getAttribute("aria-label") || "").filter((label) => label.length > 0);
      }
      function composerHasAttachment(name) {
        if (!name) return false;
        return composerAttachmentLabels().some((label) => label.indexOf(name) >= 0);
      }
      function composerRemoveByName(name) {
        if (!name) return false;
        const card = $('[data-composer-card]') || $('[data-composer-seat]') || $('[class*="_inputBar"]');
        if (card === null) return false;
        const matches = $$('[class*="_remove"]', card).filter((btn) => (btn.getAttribute("aria-label") || "").indexOf(name) >= 0);
        // Only remove when exactly one composer chip can be identified by file name;
        // otherwise keep the chip (removing the wrong attachment is worse).
        if (matches.length !== 1) return false;
        matches[0].click();
        return true;
      }
      function selectPhoto(cell) {
        if (cell.classList.contains("selected") || cell.dataset.dmsPending === "1") return;
        const name = cell.dataset.dmsName || "";
        if (name && composerHasAttachment(name)) {
          // Already an attachment in the composer (e.g. it survived a sheet close):
          // just show the check, never add a duplicate (用户 修正2).
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
          // Could not identify the matching chip safely: keep the attachment, only
          // uncheck the photo and tell the user (用户 修正2).
          showToast("未能在输入框找到该附件，请手动移除");
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
        // Each cell passed toggles its own current selection state (用户 0.6.15).
        togglePhoto(cell);
      }
      function stopPhotoAutoScroll() {
        if (photoAutoScrollRaf !== 0) { cancelAnimationFrame(photoAutoScrollRaf); photoAutoScrollRaf = 0; }
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
        if (api === null) { recentWrap.hidden = true; return; }
        recentWrap.hidden = false;
        recentStrip.innerHTML = '<div class="dms-attach-loading">正在读取最近照片…</div>';
        try {
          const reply = await nativeCall("recentPhotos", { limit: 20 }, 1800);
          const photos = reply && Array.isArray(reply.photos) ? reply.photos : [];
          recentStrip.innerHTML = "";
          if (photos.length === 0) { recentWrap.hidden = true; return; }
          for (const photo of photos) {
            if (!photo || typeof photo.thumbDataUrl !== "string") continue;
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "dms-attach-photo";
            const img = document.createElement("img");
            img.src = photo.thumbDataUrl;
            img.alt = photo.name || "照片";
            img.loading = "lazy";
            cell.appendChild(img);
            const check = document.createElement("span");
            check.className = "dms-photo-check";
            check.innerHTML = ICONS.check;
            cell.appendChild(check);
            cell.setAttribute("data-photo-id", photo.id === undefined || photo.id === null ? "" : String(photo.id));
            if (typeof photo.name === "string" && photo.name.length > 0) {
              cell.dataset.dmsName = photo.name;
              if (composerHasAttachment(photo.name)) cell.classList.add("selected");
            }
            recentStrip.appendChild(cell);
          }
          if (recentStrip.childElementCount === 0) recentWrap.hidden = true;
          requestAnimationFrame(measureSheet);
        } catch (error) {
          recentWrap.hidden = true;
          requestAnimationFrame(measureSheet);
        }
      }

      async function openRecent(id, cell) {
        if (id === undefined || id === null) return;
        try {
          const reply = await nativeCall("openRecent", { id }, 3000);
          if (!reply || typeof reply.url !== "string") throw new Error("missing url");
          if (cell !== undefined && cell !== null && !cell.classList.contains("selected")) return;
          const response = await fetch(reply.url);
          if (!response.ok) throw new Error("fetch failed");
          const blob = await response.blob();
          const file = new File([blob], reply.name || "photo.jpg", { type: reply.mime || blob.type || "image/jpeg" });
          if (cell !== undefined && cell !== null) {
            cell.dataset.dmsPending = "0";
            cell.dataset.dmsName = file.name;
          }
          intake([file]);
          requestAnimationFrame(measureSheet);
        } catch (error) {
          if (cell !== undefined && cell !== null) {
            cell.classList.remove("selected");
            cell.dataset.dmsPending = "0";
          }
          showToast("读取照片失败，请重试");
        }
      }

      function measureSheet() {
        if (sheet === null) return;
        if (!root.classList.contains("dms-attach-open")) {
          root.style.setProperty("--dms-sheet-h", "0px");
          return;
        }
        const height = sheet.getBoundingClientRect().height;
        const card = $('[data-composer-card]') || $('[data-composer-seat]');
        let shift = height;
        if (card !== null) {
          // --dms-sheet-h shifts the composer seat up; recover the un-shifted card
          // bottom and shift by exactly (sheet height - bottom inset) so the sheet's
          // top edge lands on the composer's bottom edge (用户 修正1 / 截图20).
          const current = parseFloat(window.getComputedStyle(root).getPropertyValue("--dms-sheet-h")) || 0;
          const naturalBottom = card.getBoundingClientRect().bottom + current;
          shift = height - Math.max(0, window.innerHeight - naturalBottom);
        }
        root.style.setProperty("--dms-sheet-h", Math.max(0, Math.round(shift)) + "px");
      }
      function openSheet() {
        ensureUi();
        const add = $('[data-composer-card] button[aria-haspopup="listbox"], [class*="_inputBar"] button[aria-haspopup="listbox"]');
        if (add !== null) add.setAttribute("data-dms-plus", "1");
        root.classList.add("dms-attach-open");
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
        // Keep the home greeter (logo + 探索未至之境) fully on screen: if the hero
        // area was scrolled, bring it back to the top before measuring (用户 图3).
        const hero = $('[class*="_centerCol"] [class*="_headline"]');
        if (hero !== null) {
          let scroller = hero.parentElement;
          for (let depth = 0; scroller !== null && depth < 6; depth++) {
            if (scroller.scrollHeight > scroller.clientHeight + 2) { scroller.scrollTop = 0; break; }
            scroller = scroller.parentElement;
          }
        }
        requestAnimationFrame(measureSheet);
        setTimeout(measureSheet, 60);
        setTimeout(measureSheet, 320);
        loadNativeCaps();
        renderRecent();
      }
      function closeSheet(instant) {
        photoGesture = null;
        photoPaint = null;
        photoDragPoint = null;
        if (photoLongPressTimer !== 0) { clearTimeout(photoLongPressTimer); photoLongPressTimer = 0; }
        stopPhotoAutoScroll();
        suppressPhotoClick = false;
        if (photoSuppressTimer !== 0) { clearTimeout(photoSuppressTimer); photoSuppressTimer = 0; }
        root.classList.remove("dms-attach-open");
        if (instant === true) {
          // Keyboard is about to open: drop the sheet and its composer offset in the
          // same frame so the two layouts cannot overlap (用户 图6).
          root.classList.add("dms-sheet-instant");
          root.style.setProperty("--dms-sheet-h", "0px");
          setTimeout(() => { root.classList.remove("dms-sheet-instant"); }, 90);
        } else {
          root.style.setProperty("--dms-sheet-h", "0px");
        }
      }
      closeAttachForSession = (instant) => {
        if (document.documentElement.classList.contains("dms-attach-open")) closeSheet(instant === true);
      };
      window.addEventListener("resize", measureSheet);
      function toggleSheet() {
        if (root.classList.contains("dms-attach-open")) closeSheet();
        else openSheet();
      }

      document.addEventListener("click", (event) => {
        if (!isPhone()) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target === null) return;
        const add = target.closest('button[aria-haspopup="listbox"]');
        if (add === null) return;
        if (add.closest('[data-composer-card], [data-composer-seat], [class*="_inputBar"]') === null) return;
        if (!/(^|[\s_-])add([\s_-]|$)/.test(add.className) && add.getAttribute("aria-label") !== "添加文件或调用指令") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleSheet();
      }, true);

      document.addEventListener("click", (event) => {
        if (!root.classList.contains("dms-attach-open")) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target === null) return;
        if (target.closest(".dms-attach-sheet") !== null) return;
        // Composer taps are handled by the mousedown guard: buttons keep the sheet
        // open (their host popovers render above it), the dialog area closes it.
        if (target.closest('[data-composer-card], [data-composer-seat], [class*="_inputBar"]') !== null) return;
        // A host popover opened from a composer control must not tear the sheet down.
        if (target.closest('[role="menu"], [role="listbox"], [role="dialog"]') !== null) return;
        closeSheet();
      }, true);

      document.addEventListener("mousedown", (event) => {
        if (!root.classList.contains("dms-attach-open")) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target === null) return;
        if (target.closest(".dms-attach-sheet") !== null) return;
        const composer = target.closest('[data-composer-card], [data-composer-seat], [class*="_inputBar"]');
        if (composer === null) return;
        if (target.closest('button[aria-haspopup="listbox"]') !== null) {
          // The "+" toggles on click (our handler); just stop the host keepFocus
          // handler from refocusing the editor, which would raise the keyboard.
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (target.closest('button, [role="button"], [aria-haspopup], a, input, select') !== null) {
          // Composer controls (shield / database / DSH / PTC / x) must stay usable
          // while the sheet is open (用户 修正3): only swallow the host keepFocus
          // handler, never close the sheet here. The "+" click handler toggles it.
          event.preventDefault();
          event.stopPropagation();
          return;
        } else {
          // Tapping the dialog/composer (0.6.15): close the sheet first, then focus
          // the input so the keyboard opens with no sheet layout left to overlap.
          closeSheet(true);
          const editor = composer.querySelector('[contenteditable="true"], [role="textbox"], textarea');
          if (editor !== null && typeof editor.focus === "function") {
            try { editor.focus(); } catch (error) { /* host busy */ }
          }
        }
      }, true);

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && root.classList.contains("dms-attach-open")) {
          event.preventDefault();
          closeSheet();
        }
      }, true);

      const originalBack = window.__dshmBack;
      window.__dshmBack = function dshMobileShellBack() {
        if (root.classList.contains("dms-attach-open")) { closeSheet(); return true; }
        return typeof originalBack === "function" ? originalBack() : false;
      };
    }

    function installLongPress() {
      let timer = 0;
      let startX = 0, startY = 0;
      let node = null;
      const cancel = () => { if (timer !== 0) { clearTimeout(timer); timer = 0; } };

      const activate = (target, cx, cy) => {
        if (!(target instanceof Element)) return;
        const session = target.closest('[class*="_sessionRow"]');
        if (session !== null) {
          const overflow = session.querySelector('[class*="_sessionOverflowButton"]') ||
            session.querySelector('[class*="_rowActions"] button');
          if (overflow !== null) { overflow.click(); return; }
        }
        const row = target.closest('li, [class*="_row"], [class*="_entry"], [class*="_card"]');
        if (row !== null) {
          const hidden = row.querySelector('[class*="_rowActions"] button, [class*="_actions"] button, [class*="_overflow"], button[aria-haspopup="menu"]');
          if (hidden !== null) { hidden.click(); return; }
        }
        const msg = target.closest('[class*="_message"]');
        if (msg !== null) {
          msg.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
        }
      };

      document.addEventListener("touchstart", (e) => {
        if (!isPhone() || e.touches.length !== 1) return;
        cancel();
        const t = e.touches[0];
        startX = t.clientX; startY = t.clientY;
        node = e.target instanceof Element ? e.target : null;
        if (node === null) return;
        timer = setTimeout(() => {
          timer = 0;
          activate(node, startX, startY);
        }, 500);
      }, { passive: true, capture: true });

      document.addEventListener("touchmove", (e) => {
        if (timer === 0 || e.touches.length !== 1) return;
        const t = e.touches[0];
        if (Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10) cancel();
      }, { passive: true, capture: true });

      document.addEventListener("touchend", cancel, { passive: true, capture: true });
      document.addEventListener("touchcancel", cancel, { passive: true, capture: true });
    }

    function conversationSessionKey() {
      const content = $("[data-conversation-content]");
      const id = content === null ? "" : (content.getAttribute("data-conversation-session") || "");
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
      // A blur we caused ourselves 80/320ms later must not steal a focus the user
      // just placed in the composer deliberately.
      if (!force && lastPointerInEditor && performance.now() - lastPointerAt < 900) return;
      try { active.blur(); } catch (error) { /* host busy */ }
    }
    function handleSessionSwitch() {
      // 任务29：切换会话后不聚焦 composer、不弹键盘；弹层立即关闭。
      if (typeof closeAttachForSession === "function") closeAttachForSession(true);
      blurHostEditor(true);
      setTimeout(() => blurHostEditor(false), 80);
      setTimeout(() => blurHostEditor(false), 320);
    }
    let sessionFastUntil = 0;
    let sessionFastRaf = 0;
    function fastSessionWatch() {
      sessionFastRaf = 0;
      const key = conversationSessionKey();
      if (key !== sessionKeyPrev) {
        sessionKeyPrev = key;
        sessionFastUntil = 0;
        handleSessionSwitch();
        return;
      }
      if (performance.now() > sessionFastUntil) return;
      sessionFastRaf = requestAnimationFrame(fastSessionWatch);
    }
    function installSessionWatcher() {
      sessionKeyPrev = conversationSessionKey();
      const startFastWatch = () => {
        sessionFastUntil = performance.now() + 1500;
        if (sessionFastRaf === 0) sessionFastRaf = requestAnimationFrame(fastSessionWatch);
      };
      const pointer = (event) => {
        const target = event.target instanceof Element ? event.target : null;
        lastPointerAt = performance.now();
        lastPointerInEditor = target !== null && target.closest('[contenteditable="true"], [role="textbox"], textarea, input, [data-composer-card], [data-composer-seat], [class*="_inputBar"]') !== null;
        if (target !== null && target.closest('[class*="_sessionRow"]') !== null) startFastWatch();
      };
      document.addEventListener("touchstart", pointer, { passive: true, capture: true });
      document.addEventListener("pointerdown", pointer, { passive: true, capture: true });
      const timer = setInterval(() => {
        if (DEBUG_OFF.has("session-watch")) return;
        const key = conversationSessionKey();
        if (key === sessionKeyPrev) return;
        sessionKeyPrev = key;
        handleSessionSwitch();
      }, 120);
      if (timer && typeof timer.unref === "function") timer.unref();
    }

    function installObserver() {
      // A low-frequency reconciler instead of a full-tree MutationObserver:
      // the host re-renders the frame on every layout transition, and a
      // mutation-driven sync fed those renders back into another round of
      // DOM work. 400 ms is invisible for chrome state and cannot loop.
      const timer = setInterval(() => { if (!DEBUG_OFF.has("observer-sync")) sync(); }, 400);
      if (timer && typeof timer.unref === "function") timer.unref();
      return { disconnect: () => clearInterval(timer) };
    }

    function installDebug() {
      const q = new URLSearchParams(location.search);
      if (!q.has("dms-debug")) return;
      const badge = document.createElement("div");
      badge.textContent = "dsh-mobile-shell";
      badge.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483647;background:#426efe;color:#fff;font:11px/1 monospace;padding:4px 6px;border-radius:6px;opacity:.85";
      document.body.appendChild(badge);
    }

    function apply(ctx) {
      ctxRef = ctx;
      const start = () => {
        const off = new Set((new URLSearchParams(location.search).get("dms-off") || "").split(","));
        DEBUG_OFF = off;
        if (!off.has("styles")) styleOnce();
        scrimOnce();
        ensureTopButtons();
        installBackStack();
        installExitGuard();
        installGestures();
        installRightInterceptors();
        installKeyboard();
        installSettingsWatcher();
        installAttachSheet();
        installSessionWatcher();
        if (!off.has("autoclose")) installDrawerAutoClose();
        if (!off.has("longpress")) installLongPress();
        if (!off.has("observer")) installObserver();
        installDebug();
        sync();
        const wanted = new URLSearchParams(location.search).get("dms");
        if (wanted === "left" && !leftOpen()) setTimeout(() => toggleLeft(), 600);
        if (wanted === "right" && !rightVisible) setTimeout(() => openRight(), 900);
      };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
      else start();
      ctx.effect(() => () => {
        for (const tag of $$('style[data-dsh-mobile-shell="styles"]')) tag.remove();
        for (const el of $$(".dms-scrim")) el.remove();
        for (const el of $$(".dms-attach-sheet, .dms-attach-backdrop")) el.remove();
      }, "dsh-mobile-shell: teardown");
    }

    exports.apply = apply;
    exports.inject = ["layout", "uiWorkspace", "workspaces"];
    return module.exports;
  }
});
