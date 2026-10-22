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

    const CSS = ":root {\r\n  --dms-blue: #426efe;\r\n  --dms-bg: #ffffff;\r\n  --dms-bg-soft: #f5f7fb;\r\n  --dms-surface: #ffffff;\r\n  --dms-surface-2: #f2f4f8;\r\n  --dms-text: #0f0f0f;\r\n  --dms-text-2: #6b7280;\r\n  --dms-line: rgba(15, 15, 15, 0.07);\r\n  --dms-scrim: rgba(16, 19, 26, 0.32);\r\n  --dms-radius-lg: 28px;\r\n  --dms-radius: 14px;\r\n  --dms-topbar: 52px;\r\n  --dms-shadow-card: 0 2px 14px rgba(15, 23, 42, 0.06), 0 0 0 0.5px rgba(15, 23, 42, 0.04);\r\n  --dms-shadow-drawer: 0 0 48px rgba(15, 23, 42, 0.22);\r\n  color-scheme: light;\r\n}\r\nhtml[data-ds-dark-theme], body[data-ds-dark-theme], [data-ds-dark-theme] {\r\n  --dms-bg: #10131a;\r\n  --dms-bg-soft: #0b0e13;\r\n  --dms-surface: #191b23;\r\n  --dms-surface-2: #23262f;\r\n  --dms-text: #f5f5f5;\r\n  --dms-text-2: #9aa0aa;\r\n  --dms-line: rgba(255, 255, 255, 0.08);\r\n  --dms-scrim: rgba(0, 0, 0, 0.52);\r\n  --dms-shadow-card: 0 2px 16px rgba(0, 0, 0, 0.4);\r\n  color-scheme: dark;\r\n}\r\n\r\n@media (max-width: 1023px) {\r\n  html, body { background: var(--dms-bg); }\r\n  body { -webkit-tap-highlight-color: transparent; overscroll-behavior: none; }\r\n\r\n  /* ---------- frame: one viewport, status bar clear ------------------------ */\r\n  html body [class*=\"_frame\"] {\r\n    grid-template-columns: 0 minmax(0, 1fr) 0 !important;\r\n    background: var(--dms-bg) !important;\r\n    box-sizing: border-box !important;\r\n    padding-top: env(safe-area-inset-top, 0px) !important;\r\n  }\r\n  [class*=\"_centerCol\"] { grid-column: 2 !important; background: var(--dms-bg) !important; }\r\n  [class*=\"_frame\"] > [class*=\"_sidebarCol\"] { background: var(--dms-bg) !important; }\r\n  [class*=\"_rightbarCol\"] { grid-column: 3 !important; }\r\n  [class*=\"_bottomRow\"],\r\n  [class*=\"_composerStack\"], [class*=\"_composerHero\"],\r\n  [class*=\"_heroWorkspaceRow\"], [class*=\"_heroOptions\"] { background: transparent !important; }\r\n  [class*=\"_handle\"] { display: none !important; }\r\n\r\n  /* ---------- left drawer ------------------------------------------------- */\r\n  [class*=\"_frame\"][data-sidebar-collapsed] > [class*=\"_sidebarCol\"] { display: none !important; }\r\n  [class*=\"_frame\"]:not([data-sidebar-collapsed]) > [class*=\"_sidebarCol\"] {\r\n    display: block !important;\r\n    position: fixed !important;\r\n    left: 0 !important;\r\n    top: 0 !important;\r\n    bottom: 0 !important;\r\n    width: min(326px, 80vw) !important;\r\n    max-width: min(326px, 80vw) !important;\r\n    height: 100% !important;\r\n    z-index: 90 !important;\r\n    background: var(--dms-bg-soft) !important;\r\n    border-right: none !important;\r\n    border-radius: 0 !important;\r\n    box-shadow: 10px 0 28px rgba(15, 23, 42, 0.18) !important;\r\n    /* The sidebar is preloaded and already painted under the page, so opening it\r\n       must not replay a slide-in animation (that was the source of the white\r\n       frame on fast drawer switches). Only the page push animates. */\r\n    animation: none !important;\r\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\r\n    box-sizing: border-box !important;\r\n    padding-top: env(safe-area-inset-top, 0px) !important;\r\n    padding-bottom: env(safe-area-inset-bottom, 0px) !important;\r\n    overflow: hidden !important;\r\n  }\r\n  [class*=\"_frame\"]:not([data-sidebar-collapsed]) > [class*=\"_sidebarCol\"] > *,\r\n  [class*=\"_frame\"]:not([data-sidebar-collapsed]) > [class*=\"_sidebarCol\"] [class*=\"_root\"] {\r\n    width: 100% !important;\r\n    max-width: none !important;\r\n  }\r\n  [class*=\"_sidebarCol\"] [class*=\"_root\"] { background: transparent !important; width: 100% !important; }\r\n  [class*=\"_sidebarCol\"] [class*=\"_logoRow\"] { padding: 6px 10px 2px !important; }\r\n  [class*=\"_sidebarCol\"] [class*=\"_regionArea\"],\r\n  [class*=\"_sidebarCol\"] [class*=\"_panelList\"] { overflow-x: hidden !important; }\r\n  [class*=\"_sidebarCol\"] [class*=\"_regionArea\"] { padding-left: 8px !important; padding-right: 8px !important; }\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"],\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceRow\"],\r\n  [class*=\"_sidebarCol\"] [class*=\"_regionHeader\"] {\r\n    width: 100% !important; min-width: 0 !important;\r\n    padding-left: 2px !important; padding-right: 2px !important;\r\n    display: flex !important; align-items: center !important; gap: 2px !important;\r\n    overflow: visible !important;\r\n  }\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] > *:first-child,\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceRow\"] > *:first-child {\r\n    min-width: 0 !important; flex: 0 1 auto !important;\r\n    overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;\r\n  }\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] button,\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceRow\"] button { margin-left: 0 !important; margin-right: 0 !important; }\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] > *:last-child,\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceRow\"] > *:last-child { margin-right: 2px !important; }\r\n  [class*=\"_sidebarCol\"] [class*=\"_sectionHeader\"],\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] {\r\n    width: 100% !important; min-width: 0 !important;\r\n    padding-left: 2px !important; padding-right: 2px !important;\r\n    gap: 2px !important; overflow: visible !important;\r\n    display: flex !important; align-items: center !important;\r\n  }\r\n  [class*=\"_sidebarCol\"] [class*=\"_sectionHeader\"] > *:first-child {\r\n    min-width: 40px !important; flex: 0 0 auto !important;\r\n    overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;\r\n  }\r\n  [class*=\"_sidebarCol\"] [class*=\"_sectionHeader\"] [class*=\"_searchSlot\"] {\r\n    flex: 1 1 auto !important; width: auto !important; min-width: 24px !important;\r\n  }\r\n  [class*=\"_sidebarCol\"] [class*=\"_sectionHeader\"] button {\r\n    width: 24px !important; height: 24px !important; min-width: 24px !important;\r\n    margin-left: 0 !important; margin-right: 2px !important;\r\n  }\r\n  [class*=\"_sidebarCol\"] [class*=\"_sectionHeader\"] [class*=\"_searchSlot\"] + * { margin-left: auto !important; }\r\n  [class*=\"_sidebarCol\"] [class*=\"_sectionHeader\"] svg { width: 16px !important; height: 16px !important; }\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] { font-size: 11px !important; }\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] button {\r\n    width: 24px !important; height: 24px !important; min-width: 24px !important;\r\n  }\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] svg { width: 16px !important; height: 16px !important; }\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] [class*=\"_search\"] {\r\n    width: 24px !important; min-width: 24px !important;\r\n  }\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] > *,\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceRow\"] > * { min-width: 0 !important; }\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceHeader\"] button,\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceRow\"] button { flex: 0 0 auto !important; }\r\n  /* the host hides these at narrow widths; a phone drawer still has room */\r\n  [class*=\"_sidebarCol\"] [class*=\"_search\"],\r\n  [class*=\"_sidebarCol\"] [class*=\"_searchButton\"] {\r\n    width: auto !important; min-width: 28px !important; max-width: none !important;\r\n    overflow: visible !important; flex: 0 0 auto !important;\r\n  }\r\n  [class*=\"_sidebarCol\"] [class*=\"_search\"] svg,\r\n  [class*=\"_sidebarCol\"] [class*=\"_searchButton\"] svg {\r\n    display: block !important; width: 20px !important; height: 20px !important; opacity: 1 !important;\r\n  }\r\n  [class*=\"_sidebarCol\"] button[aria-label=\"搜索会话\"],\r\n  [class*=\"_sidebarCol\"] button[aria-label=\"视图选项\"],\r\n  [class*=\"_sidebarCol\"] button[aria-label=\"添加工作区\"],\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceActions\"] button,\r\n  [class*=\"_sidebarCol\"] [class*=\"_searchButton\"],\r\n  [class*=\"_sidebarCol\"] [class*=\"_workspaceSearch\"] {\r\n    display: inline-flex !important;\r\n    visibility: visible !important;\r\n    opacity: 1 !important;\r\n  }\r\n  [class*=\"_sidebarCol\"] [class*=\"_newSession\"] {\r\n    justify-content: center !important;\r\n    gap: 8px !important;\r\n    text-align: center !important;\r\n  }\r\n  [class*=\"_sidebarCol\"] [class*=\"_toggle\"] { display: none !important; }\r\n  [class*=\"_sidebarCol\"] [class*=\"_rowActions\"] { display: none !important; }\r\n  .dshm-scrim { display: none !important; }\r\n  [data-sidebar-right-expand] { display: none !important; }\r\n\r\n  /* ---------- right drawer ------------------------------------------------ */\r\n  [class*=\"_frame\"] > [class*=\"_rightbarCol\"] {\r\n    --dsh-sidebar-width: min(326px, 80vw) !important;\r\n    display: block !important;\r\n    position: fixed !important;\r\n    top: 0 !important;\r\n    right: 0 !important;\r\n    bottom: 0 !important;\r\n    width: min(326px, 80vw) !important;\r\n    max-width: min(326px, 80vw) !important;\r\n    height: 100% !important;\r\n    z-index: 90 !important;\r\n    background: var(--dms-bg) !important;\r\n    border-radius: 0 !important;\r\n    box-shadow: -10px 0 28px rgba(15, 23, 42, 0.18) !important;\r\n    transform: translateX(100%) !important;\r\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\r\n    box-sizing: border-box !important;\r\n    padding-top: env(safe-area-inset-top, 0px) !important;\r\n    padding-bottom: env(safe-area-inset-bottom, 0px) !important;\r\n    overflow: hidden !important;\r\n  }\r\n  html.dms-right-open [class*=\"_frame\"] > [class*=\"_rightbarCol\"] { transform: translateX(0) !important; }\r\n  [class*=\"_rightbarCol\"] > * { width: 100% !important; height: 100% !important; }\r\n  [class*=\"_rightbarCol\"] [class*=\"_panel\"],\r\n  [class*=\"_rightbarCol\"] [class*=\"_session\"] {\r\n    width: 100% !important;\r\n    max-width: none !important;\r\n    left: 0 !important;\r\n    right: auto !important;\r\n    transform: none !important;\r\n    background: var(--dms-bg) !important;\r\n  }\r\n  [class*=\"_rightbarCol\"] [class*=\"_tabBody\"] { width: 100% !important; }\r\n\r\n  /* The host panel chrome has two icon buttons (fullscreen toggle + collapse) in\r\n     the tab strip; the user asked to hide both (图4) and use our own fullscreen\r\n     control at the same corner instead. Selectors are stable data-* hooks, not\r\n     CSS-module hashes. */\r\n  [class*=\"_rightbarCol\"] [data-sidebar-right-mode],\r\n  [class*=\"_rightbarCol\"] [data-sidebar-right-toggle] { display: none !important; }\r\n\r\n  /* our own fullscreen toggle: same corner as the hidden host icons */\r\n  .dms-right-fullbtn {\r\n    position: fixed !important;\r\n    top: calc(6px + env(safe-area-inset-top, 0px)) !important;\r\n    right: 8px !important;\r\n    z-index: 96 !important;\r\n    display: none;\r\n    width: 38px !important; height: 38px !important; flex: 0 0 38px !important;\r\n    border-radius: 50% !important;\r\n    background: var(--dms-bg-soft) !important;\r\n    color: var(--dms-text) !important;\r\n    border: 0 !important;\r\n    box-shadow: none !important;\r\n  }\r\n  .dms-right-fullbtn svg { width: 19px !important; height: 19px !important; }\r\n  html.dms-right-open .dms-right-fullbtn,\r\n  html.dms-right-full .dms-right-fullbtn { display: inline-flex !important; }\r\n\r\n  /* fullscreen right panel: host state is data-sidebar-right-panel=\"fullscreen\";\r\n     sync() mirrors it to html.dms-right-full. The drawer covers the page and the\r\n     edge gestures are disabled in JS while this class is present. */\r\n  html.dms-right-full [class*=\"_frame\"] > [class*=\"_rightbarCol\"] {\r\n    width: 100vw !important;\r\n    max-width: 100vw !important;\r\n    z-index: 95 !important;\r\n    box-shadow: none !important;\r\n    transform: translateX(0) !important;\r\n  }\r\n  html.dms-right-full [class*=\"_centerCol\"],\r\n  html.dms-right-full.dms-right-open [class*=\"_centerCol\"] { transform: none !important; }\r\n  html.dms-right-full .dms-scrim { display: none !important; }\r\n\r\n  /* ---------- scrim ------------------------------------------------------- */\r\n  .dms-scrim {\r\n    position: fixed; inset: 0; z-index: 80;\r\n    background: transparent !important;\r\n    opacity: 0; pointer-events: none;\r\n    transition: opacity 0.2s ease;\r\n  }\r\n  html.dms-left-open .dms-scrim,\r\n  html.dms-right-open .dms-scrim { opacity: 1; pointer-events: auto; }\r\n\r\n  /* App-style push: the page moves with the drawer. This deliberately revisits\r\n     the \"never push\" rule in HANDOVER §14 — the blank strip seen then came from\r\n     the host sidebar not being mounted yet; with the P0 preload fix it is always\r\n     painted under the page, so pushing exposes the drawer, not a white gap.\r\n     Duration/easing match the drawer transition (0.24s) for a single motion. */\r\n  html.dms-left-open [class*=\"_centerCol\"] {\r\n    transform: translate3d(min(326px, 80vw), 0, 0) !important;\r\n    opacity: 1 !important;\r\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\r\n  }\r\n  html.dms-right-open [class*=\"_centerCol\"] {\r\n    transform: translate3d(calc(-1 * min(326px, 80vw)), 0, 0) !important;\r\n    opacity: 1 !important;\r\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\r\n  }\r\n  html:not(.dms-left-open):not(.dms-right-open) [class*=\"_centerCol\"] {\r\n    transform: none !important;\r\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\r\n  }\r\n\r\n  /* ---------- top bar (host header, restyled) ----------------------------- */\r\n  [class*=\"_centerCol\"] header.dms-topbar {\r\n    height: var(--dms-topbar) !important;\r\n    min-height: var(--dms-topbar) !important;\r\n    padding: 0 12px !important;\r\n    background: var(--dms-bg) !important;\r\n    border-bottom: none !important;\r\n    box-sizing: border-box !important;\r\n    align-items: center !important;\r\n    position: relative !important;\r\n    z-index: 30 !important;\r\n  }\r\n  [class*=\"_centerCol\"] header.dms-topbar [class*=\"_headerLeading\"] {\r\n    display: flex !important; align-items: center !important;\r\n    min-width: 44px; height: 100%;\r\n  }\r\n  [class*=\"_centerCol\"] header.dms-topbar [class*=\"_headerCorner\"] {\r\n    display: flex !important; align-items: center !important; gap: 2px;\r\n    position: relative !important; right: auto !important; top: auto !important;\r\n    height: 100%;\r\n  }\r\n  [class*=\"_centerCol\"] header.dms-topbar [class*=\"_titleRow\"] { align-items: center !important; min-height: 100%; }\r\n  [class*=\"_centerCol\"] header.dms-topbar [data-conversation-tabs],\r\n  [class*=\"_centerCol\"] header.dms-topbar [class*=\"_tabs\"] { display: none !important; }\r\n  [class*=\"_centerCol\"] header.dms-topbar[class*=\"headerBlank\"] .dms-plus { display: none !important; }\r\n\r\n  .dms-menu { position: relative !important; z-index: 6 !important; }\r\n  .dms-iconbtn {\r\n    width: 40px; height: 40px; flex: 0 0 40px;\r\n    display: inline-flex; align-items: center; justify-content: center;\r\n    border: 0; border-radius: 50%; padding: 0; margin: 0;\r\n    background: transparent; color: var(--dms-text);\r\n    -webkit-tap-highlight-color: transparent;\r\n    cursor: pointer;\r\n  }\r\n  .dms-iconbtn:active { background: var(--dms-surface-2); }\r\n  .dms-iconbtn svg { display: block; width: 20px !important; height: 20px !important; }\r\n  [class*=\"_centerCol\"] header.dms-topbar [class*=\"_button_\"], [class*=\"_centerCol\"] header.dms-topbar [class*=\"_iconButton\"] {\r\n    width: 40px !important; height: 40px !important; min-width: 40px !important;\r\n    border-radius: 50% !important; color: var(--dms-text) !important;\r\n  }\r\n  [class*=\"_centerCol\"] header.dms-topbar [class*=\"_button_\"] svg,\r\n  [class*=\"_centerCol\"] header.dms-topbar [class*=\"_iconButton\"] svg { width: 20px !important; height: 20px !important; }\r\n\r\n  /* ---------- hero -------------------------------------------------------- */\r\n  [class*=\"_centerCol\"] [class*=\"_headline\"] {\r\n    flex-direction: column !important;\r\n    align-items: center !important;\r\n    justify-content: center !important;\r\n    gap: 14px !important;\r\n  }\r\n  [class*=\"_centerCol\"] [class*=\"_fishHitbox\"] svg { width: 64px !important; height: 48px !important; }\r\n  [class*=\"_centerCol\"] [class*=\"_titleGroup\"] { gap: 0 !important; }\r\n  [class*=\"_centerCol\"] [class*=\"_titleGroup\"] > span:first-child {\r\n    font-size: 21px !important; font-weight: 600 !important; letter-spacing: 0.2px !important;\r\n  }\r\n  [class*=\"_previewBadge\"] { display: none !important; }\r\n\r\n  /* hero page: keep the greeter centred but pin the composer to the bottom */\r\n  html.dms-hero-home [class*=\"_scrollBody\"] { justify-content: flex-start !important; }\r\n  html.dms-hero-home [data-composer-seat] {\r\n    flex: 1 1 auto !important; min-height: 0 !important;\r\n    display: flex !important; flex-direction: column !important;\r\n  }\r\n  html.dms-hero-home [class*=\"_composerHero\"] {\r\n    flex: 1 1 auto !important; min-height: 0 !important;\r\n    display: flex !important; flex-direction: column !important;\r\n    justify-content: flex-end !important;\r\n  }\r\n  html.dms-hero-home [class*=\"_composerHero\"] > [class*=\"_root\"] {\r\n    margin-top: auto !important; margin-bottom: auto !important;\r\n  }\r\n  /* hero page with the attach sheet open: compact the logo/title so the page\r\n     behind the sheet keeps its greeter visible (用户 图6). */\r\n  html.dms-attach-open.dms-hero-home [class*=\"_centerCol\"] [class*=\"_headline\"] { gap: 4px !important; }\r\n  html.dms-attach-open.dms-hero-home [class*=\"_centerCol\"] [class*=\"_fishHitbox\"] svg { width: 46px !important; height: 34px !important; }\r\n  html.dms-attach-open.dms-hero-home [class*=\"_centerCol\"] [class*=\"_titleGroup\"] > span:first-child { font-size: 17px !important; }\r\n\r\n  /* conversation messages align with the composer card width */\r\n  [class*=\"_centerCol\"] [class*=\"_scroll\"]:has(> [class*=\"_column\"]) {\r\n    padding-left: 12px !important;\r\n    padding-right: 12px !important;\r\n  }\r\n\r\n  /* ---------- composer ---------------------------------------------------- */\r\n  [data-composer-seat] { background: var(--dms-bg) !important; }\r\n  [data-composer-card] {\r\n    border-radius: var(--dms-radius-lg) !important;\r\n    background: var(--dms-surface) !important;\r\n    border: 0 !important;\r\n    box-shadow: var(--dms-shadow-card) !important;\r\n    padding: 12px 12px 10px !important;\r\n    margin: 0 12px calc(8px + env(safe-area-inset-bottom, 0px)) !important;\r\n  }\r\n  [data-composer-input] { font-size: 16px !important; line-height: 1.45 !important; color: var(--dms-text) !important; }\r\n  [data-composer-placeholder] { font-size: 16px !important; color: var(--dms-text-2) !important; }\r\n  [data-composer-card] [class*=\"_row\"] { gap: 6px !important; }\r\n  [data-composer-card] [class*=\"_add\"] {\r\n    width: 36px !important; height: 36px !important; min-width: 36px !important;\r\n    border-radius: 50% !important; background: var(--dms-surface-2) !important;\r\n    color: var(--dms-text) !important; border: 0 !important;\r\n  }\r\n  [data-composer-card] [class*=\"_add\"] svg { width: 18px !important; height: 18px !important; }\r\n  [data-composer-card] [class*=\"_primary\"] {\r\n    width: 38px !important; height: 38px !important; min-width: 38px !important;\r\n    border-radius: 50% !important;\r\n    background: var(--dms-blue) !important;\r\n    color: #fff !important;\r\n    border: 0 !important;\r\n    box-shadow: 0 4px 12px rgba(66, 110, 254, 0.32) !important;\r\n    transition: background 0.16s ease, transform 0.12s ease !important;\r\n  }\r\n  [data-composer-card] [class*=\"_primary\"]:disabled,\r\n  [data-composer-card] [class*=\"_primary\"][aria-disabled=\"true\"] {\r\n    background: var(--dms-surface-2) !important;\r\n    color: var(--dms-text-2) !important;\r\n    box-shadow: none !important;\r\n  }\r\n  [data-composer-card] [class*=\"_primary\"] svg { width: 19px !important; height: 19px !important; }\r\n  [data-composer-card] [class*=\"_primary\"]:active { transform: scale(0.94); }\r\n\r\n  /* DSH-style round icon controls: permission + model, no labels/chevrons */\r\n  [class*=\"_modes\"] button, [class*=\"_standardControls\"] button {\r\n    width: 36px !important; height: 36px !important; min-width: 36px !important;\r\n    padding: 0 !important;\r\n    border-radius: 50% !important;\r\n    background: var(--dms-surface-2) !important;\r\n    border: 0 !important;\r\n    color: var(--dms-text) !important;\r\n    font-size: 0 !important;\r\n    display: inline-flex !important; align-items: center !important; justify-content: center !important;\r\n    overflow: hidden !important;\r\n  }\r\n  [class*=\"_modes\"] button [class*=\"_triggerLabel\"],\r\n  [class*=\"_modes\"] button [class*=\"_chevron\"],\r\n  [class*=\"_standardControls\"] button [class*=\"_triggerLabel\"],\r\n  [class*=\"_standardControls\"] button [class*=\"_chevron\"] { display: none !important; }\r\n  [class*=\"_modes\"] button svg, [class*=\"_standardControls\"] button svg {\r\n    display: block !important;\r\n    width: 18px !important; height: 18px !important; color: var(--dms-text) !important;\r\n  }\r\n  [class*=\"_standardControls\"] button svg:last-child { display: none !important; }\r\n  .dms-menu svg { transform: scaleX(-1); }\r\n  [class*=\"_notice\"] { color: var(--dms-text-2) !important; background: transparent !important; }\r\n\r\n  /* conversation footer stats: keep the three parts on one compact line */\r\n  [class*=\"_composerDock\"], [data-composer-dock] {\r\n    padding: 0 8px calc(3px + env(safe-area-inset-bottom, 0px)) !important;\r\n    min-height: 16px !important;\r\n    font-size: 10.5px !important;\r\n    color: var(--dms-text-2) !important;\r\n    display: flex !important; align-items: center !important;\r\n    gap: 4px !important;\r\n    overflow: hidden !important;\r\n  }\r\n  [class*=\"_composerDock\"] > *, [data-composer-dock] > * {\r\n    min-width: 0 !important;\r\n    overflow: hidden !important;\r\n    text-overflow: ellipsis !important;\r\n    white-space: nowrap !important;\r\n    font-size: 10.5px !important;\r\n    line-height: 1.25 !important;\r\n    gap: 3px !important;\r\n  }\r\n  [class*=\"_composerDock\"] svg, [data-composer-dock] svg { width: 12px !important; height: 12px !important; }\r\n  [class*=\"_composerDock\"] button, [data-composer-dock] button { font-size: 10.5px !important; height: auto !important; padding: 0 1px !important; }\r\n  [data-composer-stats] {\r\n    gap: 0 !important;\r\n    justify-content: space-between !important;\r\n    width: 100% !important;\r\n    max-width: 100% !important;\r\n    padding: 0 6px !important;\r\n    font-size: 10px !important;\r\n    line-height: 1.25 !important;\r\n    overflow: visible !important;\r\n  }\r\n  [data-composer-stats] > * {\r\n    flex: 0 0 auto !important;\r\n    max-width: none !important;\r\n    min-width: 0 !important;\r\n    overflow: visible !important;\r\n  }\r\n  [data-composer-stats] [class*=\"_pill\"] {\r\n    max-width: none !important;\r\n    padding: 0 1px !important;\r\n    gap: 2px !important;\r\n    font-size: 10px !important;\r\n    white-space: nowrap !important;\r\n  }\r\n  [data-composer-stats] [class*=\"_label\"] {\r\n    min-width: 0 !important;\r\n    overflow: visible !important;\r\n    text-overflow: clip !important;\r\n    white-space: nowrap !important;\r\n  }\r\n  [data-composer-stats] [class*=\"_sep\"] {\r\n    display: inline-block !important;\r\n    width: 5px !important;\r\n    height: 1px !important;\r\n    margin: 0 2px !important;\r\n    overflow: hidden !important;\r\n    color: transparent !important;\r\n    font-size: 0 !important;\r\n    vertical-align: middle !important;\r\n  }\r\n  [data-composer-stats] { gap: 6px !important; }\r\n  [data-composer-stats] [class*=\"_label\"] { display: inline-flex !important; align-items: center !important; gap: 2px !important; }\r\n  [data-composer-stats] svg { width: 10px !important; height: 10px !important; }\r\n  [class*=\"_statusBar\"], [class*=\"_statusLine\"], [class*=\"_sessionStats\"], [class*=\"_statsLine\"], [class*=\"_usageBar\"] {\r\n    font-size: 11px !important;\r\n    gap: 6px !important;\r\n    padding-left: 12px !important; padding-right: 12px !important;\r\n    overflow: hidden !important;\r\n  }\r\n  [class*=\"_statusBar\"] > *, [class*=\"_statusLine\"] > *, [class*=\"_sessionStats\"] > *, [class*=\"_statsLine\"] > * {\r\n    min-width: 0 !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;\r\n  }\r\n\r\n  /* ---------- settings ---------------------------------------------------- */\r\n  [data-shortcut-modal=\"settings\"], [data-shortcut-modal=\"settings\"] * { box-sizing: border-box !important; }\r\n  [data-shortcut-modal=\"settings\"] {\r\n    position: fixed !important;\r\n    inset: 0 !important;\r\n    width: 100vw !important;\r\n    max-width: none !important;\r\n    height: 100% !important;\r\n    max-height: none !important;\r\n    margin: 0 !important;\r\n    border-radius: 0 !important;\r\n    background: var(--dms-bg-soft) !important;\r\n    display: flex !important;\r\n    flex-direction: column !important;\r\n    padding: calc(52px + env(safe-area-inset-top, 0px)) 0 0 !important;\r\n    overflow: hidden !important;\r\n  }\r\n  .dms-settings-chrome {\r\n    display: none;\r\n    position: fixed;\r\n    left: 0; right: 0; top: 0;\r\n    height: calc(52px + env(safe-area-inset-top, 0px));\r\n    padding-top: env(safe-area-inset-top, 0px);\r\n    box-sizing: border-box;\r\n    align-items: center;\r\n    justify-content: center;\r\n    background: var(--dms-bg);\r\n    border-bottom: 1px solid var(--dms-line);\r\n    z-index: 2147483000;\r\n  }\r\n  html.dms-settings-open .dms-settings-chrome { display: flex; }\r\n  .dms-settings-chrome .dms-settings-back {\r\n    position: absolute; left: 4px; top: 50%; transform: translateY(-50%);\r\n    width: 44px; height: 44px; border: 0; border-radius: 50%;\r\n    background: transparent; color: var(--dms-text);\r\n    display: inline-flex; align-items: center; justify-content: center;\r\n  }\r\n  .dms-settings-chrome .dms-settings-back:active { background: var(--dms-surface-2); }\r\n  .dms-settings-chrome .dms-settings-back svg { width: 22px; height: 22px; }\r\n  .dms-settings-chrome .dms-settings-title {\r\n    display: flex; align-items: center; gap: 7px;\r\n    font-size: 17px; font-weight: 600; color: var(--dms-text); line-height: 1;\r\n  }\r\n  .dms-settings-chrome .dms-settings-title svg { width: 19px; height: 19px; }\r\n\r\n  /* settings list page */\r\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] {\r\n    display: flex !important; flex-direction: column !important;\r\n    width: 100% !important;\r\n    padding: 8px 12px calc(16px + env(safe-area-inset-bottom, 0px)) !important;\r\n    background: transparent !important;\r\n    border-bottom: 0 !important;\r\n    overflow: auto !important;\r\n  }\r\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] [class*=\"_navTitle\"] { display: none !important; }\r\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] [class*=\"_navList\"] {\r\n    display: flex !important; flex-direction: column !important;\r\n    width: 100% !important; gap: 0 !important;\r\n    overflow: hidden !important; padding: 0 !important;\r\n    background: var(--dms-surface) !important;\r\n    border-radius: 12px !important;\r\n  }\r\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] [class*=\"_navCell\"] {\r\n    width: 100% !important; height: 46px !important;\r\n    flex: 0 0 auto !important;\r\n    display: flex !important; flex-direction: row !important;\r\n    align-items: center !important; justify-content: flex-start !important;\r\n    gap: 10px !important;\r\n    padding: 0 12px !important;\r\n    border-radius: 0 !important;\r\n    background: transparent !important;\r\n    border-bottom: 1px solid var(--dms-line) !important;\r\n    color: var(--dms-text) !important;\r\n    font-size: 15px !important; font-weight: 400 !important;\r\n    border: 0 !important;\r\n    position: relative !important;\r\n    white-space: nowrap !important;\r\n  }\r\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] [class*=\"_navCell\"] svg {\r\n    width: 20px !important; height: 20px !important;\r\n    flex: 0 0 20px !important; color: var(--dms-text) !important;\r\n  }\r\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] [class*=\"_navCell\"]::after {\r\n    content: \"\\203A\"; position: absolute; right: 12px;\r\n    font-size: 20px; line-height: 1; color: var(--dms-text-2);\r\n  }\r\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] [class*=\"_navCell\"][class*=\"_active\"] {\r\n    background: transparent !important; color: var(--dms-text) !important; font-weight: 400 !important;\r\n  }\r\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] [class*=\"_navCell\"]:last-child { border-bottom: 0 !important; }\r\n\r\n  /* mode switches only touch direct children so nested dialogs stay usable */\r\n  html.dms-settings-list [data-shortcut-modal=\"settings\"] > [class*=\"_content\"] { display: none !important; }\r\n  html.dms-settings-section [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"] { display: none !important; }\r\n  html.dms-settings-section [data-shortcut-modal=\"settings\"] > [class*=\"_content\"] {\r\n    display: flex !important; flex-direction: column !important;\r\n    flex: 1 1 auto !important; min-height: 0 !important; overflow: hidden !important;\r\n  }\r\n  html.dms-settings-section [data-shortcut-modal=\"settings\"] > [class*=\"_content\"] > [class*=\"_header\"] { display: none !important; }\r\n  [data-shortcut-modal=\"settings\"] > [class*=\"_content\"] > [class*=\"_options\"] {\r\n    flex: 1 1 auto !important;\r\n    overflow-y: auto !important;\r\n    overflow-x: hidden !important;\r\n    padding: 8px 12px calc(20px + env(safe-area-inset-bottom, 0px)) !important;\r\n  }\r\n  [data-shortcut-modal=\"settings\"] > [class*=\"_content\"] > [class*=\"_options\"]::-webkit-scrollbar,\r\n  [data-shortcut-modal=\"settings\"] > [class*=\"_nav\"]::-webkit-scrollbar { width: 0 !important; height: 0 !important; }\r\n  [data-shortcut-modal=\"settings\"] > [class*=\"_content\"] > [class*=\"_options\"] { scrollbar-width: none !important; }\r\n\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_section\"] {\r\n    width: 100% !important;\r\n    background: var(--dms-surface) !important;\r\n    border-radius: 12px !important;\r\n    margin: 0 0 6px !important;\r\n    padding: 0 12px !important;\r\n    overflow: hidden !important;\r\n  }\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_section\"] > * {\r\n    border-bottom: 1px solid var(--dms-line) !important;\r\n    padding: 10px 0 !important;\r\n  }\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_section\"] > *:last-child { border-bottom: 0 !important; }\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_group\"] { padding: 10px 0 !important; }\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_group\"] [class*=\"_title\"] {\r\n    font-size: 12.5px !important; color: var(--dms-text-2) !important; font-weight: 500 !important;\r\n    margin-bottom: 6px !important;\r\n  }\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_row\"] {\r\n    display: flex !important; align-items: center !important; gap: 10px !important;\r\n    width: 100% !important; max-width: 100% !important; min-width: 0 !important;\r\n  }\r\n  [class*=\"_rowText\"] { flex: 1 1 auto !important; min-width: 0 !important; align-items: flex-start !important; padding-right: 0 !important; }\r\n  [class*=\"_rowText\"] [class*=\"_title\"], [class*=\"_rowText\"] [class*=\"_desc\"] {\r\n    text-align: left !important; margin-left: 0 !important;\r\n    width: auto !important; max-width: 100% !important;\r\n  }\r\n  [class*=\"_rowText\"] [class*=\"_desc\"] { flex: 1 1 auto !important; align-self: stretch !important; width: 100% !important; }\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_title\"] {\r\n    font-size: 14.5px !important; color: var(--dms-text) !important; font-weight: 500 !important;\r\n    text-align: left !important; white-space: normal !important;\r\n  }\r\n  body [data-shortcut-modal=\"settings\"] [class*=\"_rowText\"] { align-items: flex-start !important; }\r\n  body [data-shortcut-modal=\"settings\"] [class*=\"_title\"] { text-align: left !important; width: 100% !important; }\r\n  [class*=\"_desc\"], [class*=\"_description\"] {\r\n    font-size: 12px !important; color: var(--dms-text-2) !important;\r\n    margin-top: 2px !important; line-height: 1.4 !important;\r\n  }\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_selector\"] {\r\n    flex: 0 0 auto !important;\r\n    width: auto !important;\r\n    max-width: 62% !important;\r\n    min-width: 0 !important;\r\n    height: 30px !important;\r\n    padding: 0 9px !important;\r\n    font-size: 12px !important;\r\n    display: inline-flex !important; align-items: center !important;\r\n    color: var(--dms-text-2) !important;\r\n    white-space: nowrap !important;\r\n  }\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_cubeRow\"] { display: flex !important; flex-direction: row !important; gap: 8px !important; }\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_themeCube\"] {\r\n    flex: 1 1 0 !important; min-width: 0 !important; width: auto !important;\r\n    white-space: nowrap !important;\r\n  }\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_themeCube\"]:not([class*=\"_selected\"]) {\r\n    background: transparent !important;\r\n  }\r\n\r\n  /* provider/model editor page */\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_editorActions\"] {\r\n    display: flex !important; flex-wrap: wrap !important; gap: 8px !important;\r\n  }\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_modelRow\"] {\r\n    display: flex !important; flex-wrap: wrap !important; gap: 8px !important;\r\n    width: 100% !important;\r\n  }\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_modelRow\"] input {\r\n    flex: 1 1 110px !important; min-width: 0 !important;\r\n    font-size: 12px !important; padding: 0 6px !important;\r\n  }\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_modelRow\"] [class*=\"_iconButton\"] {\r\n    width: 24px !important; height: 24px !important; min-width: 24px !important; padding: 0 !important;\r\n  }\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_modelEntry\"] { width: 100% !important; }\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_addModelButton\"],\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_addButton\"] {\r\n    width: auto !important; height: auto !important; min-width: 0 !important;\r\n    white-space: nowrap !important;\r\n  }\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_modelList\"],\r\n  [data-shortcut-modal=\"settings\"] [class*=\"_customizedBody\"] { width: 100% !important; }\r\n\r\n  /* long model names wrap instead of clipping */\r\n  [role=menu] [role=menuitem], [class*=\"_modelItem\"], [class*=\"_optionItem\"] { white-space: normal !important; height: auto !important; min-height: 40px !important; }\r\n  [role=menu] [role=menuitem] [class*=\"_label\"], [class*=\"_modelItem\"] [class*=\"_label\"] { white-space: normal !important; line-height: 1.35 !important; }\r\n\r\n  /* the host sidebar is kept mounted (preloaded) and pinned off-screen; opening slides it in */\r\n  html.dms-preload-left [class*=\"_frame\"] > [class*=\"_sidebarCol\"] {\r\n    /* Keep the host sidebar expanded and *under* the opaque page. It is fully\r\n       visible to the renderer (so plugins/sidebar content paint before the\r\n       first touch) but covered by centerCol; opening only raises its z-index.\r\n       Off-screen/opacity-0 preloads skipped paint and produced a white first frame. */\r\n    transform: none !important;\r\n    opacity: 1 !important;\r\n    z-index: 0 !important;\r\n    animation: none !important;\r\n    transition: none !important;\r\n    pointer-events: none !important;\r\n  }\r\n  html.dms-preload-left [class*=\"_centerCol\"] {\r\n    position: relative !important;\r\n    z-index: 1 !important;\r\n    background: var(--dms-bg) !important;\r\n  }\r\n  html.dms-left-hide [class*=\"_frame\"] > [class*=\"_sidebarCol\"] {\r\n    transform: translateX(-100%) !important;\r\n    animation: none !important;\r\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\r\n  }\r\n  /* while a gesture mounts a drawer, pin it off-screen until our compositor frame lands */\r\n  html.dms-gesture-arming [class*=\"_frame\"] > [class*=\"_sidebarCol\"] {\r\n    animation: none !important;\r\n    transition: none !important;\r\n    transform: translateX(-100%) !important;\r\n    will-change: transform !important;\r\n  }\r\n  html.dms-gesture-arming-right [class*=\"_frame\"] > [class*=\"_rightbarCol\"] {\r\n    animation: none !important;\r\n    transition: none !important;\r\n    transform: translateX(100%) !important;\r\n    will-change: transform !important;\r\n  }\r\n  /* The preload rules keep the host sidebar under the page; while the drawer is\r\n     open it must come back above the pushed page. Overriding the combined state\r\n     (instead of removing dms-preload-left on open) avoids a class churn that\r\n     re-ran the host animation and flashed white on fast drawer switches. */\r\n  html.dms-preload-left.dms-left-open [class*=\"_frame\"] > [class*=\"_sidebarCol\"],\r\n  html.dms-left-open [class*=\"_frame\"]:not([data-sidebar-collapsed]) > [class*=\"_sidebarCol\"] {\r\n    z-index: 90 !important;\r\n    pointer-events: auto !important;\r\n    animation: none !important;\r\n    transition: none !important;\r\n    transform: none !important;\r\n  }\r\n\r\n  /* ---------- toast ------------------------------------------------------- */\r\n  .dms-toast {\r\n    position: fixed; left: 50%;\r\n    bottom: calc(190px + env(safe-area-inset-bottom, 0px));\r\n    transform: translateX(-50%) translateY(8px);\r\n    max-width: 76vw;\r\n    padding: 9px 16px;\r\n    border-radius: 999px;\r\n    background: rgba(22, 24, 30, 0.86);\r\n    color: #fff;\r\n    font-size: 13px;\r\n    line-height: 1.2;\r\n    white-space: nowrap;\r\n    z-index: 2147483600;\r\n    opacity: 0; pointer-events: none;\r\n    transition: opacity 0.16s ease, transform 0.16s ease;\r\n  }\r\n  .dms-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }\r\n\r\n  html.dms-gesture-opened [class*=\"_frame\"]:not([data-sidebar-collapsed]) > [class*=\"_sidebarCol\"] { animation: none !important; }\r\n\r\n  /* ---------- drawer drag (direct compositor transforms) ------------------ */\r\n  html.dms-dragging-left [class*=\"_centerCol\"],\r\n  html.dms-dragging-right [class*=\"_centerCol\"],\r\n  html.dms-drag-close-left [class*=\"_centerCol\"],\r\n  html.dms-drag-close-right [class*=\"_centerCol\"] { transition: none !important; }\r\n  html.dms-dragging-left [class*=\"_frame\"]:not([data-sidebar-collapsed]) > [class*=\"_sidebarCol\"],\r\n  html.dms-drag-close-left [class*=\"_frame\"]:not([data-sidebar-collapsed]) > [class*=\"_sidebarCol\"],\r\n  html.dms-dragging-right [class*=\"_frame\"] > [class*=\"_rightbarCol\"],\r\n  html.dms-drag-close-right [class*=\"_frame\"] > [class*=\"_rightbarCol\"] {\r\n    animation: none !important;\r\n    transition: none !important;\r\n    will-change: transform !important;\r\n    backface-visibility: hidden !important;\r\n  }\r\n\r\n  /* hover-only message actions stay reachable on touch; sidebar rows open theirs on long-press */\r\n  [class*=\"_message\"] [class*=\"_actions\"],\r\n  [class*=\"_message\"] [class*=\"_actionBar\"] {\r\n    opacity: 1 !important;\r\n    visibility: visible !important;\r\n  }\r\n\r\n  /* ---------- composer attach sheet --------------------------------------- */\r\n  .dms-attach-backdrop {\r\n    display: block;\r\n    position: fixed; inset: 0; z-index: 1040;\r\n    background: transparent;\r\n    opacity: 0; pointer-events: none;\r\n    transition: opacity 0.2s ease-out;\r\n  }\r\n  html.dms-attach-open .dms-attach-backdrop { opacity: 1; }\r\n  .dms-attach-sheet {\r\n    display: flex;\r\n    position: fixed; left: 0; right: 0; bottom: 0; z-index: 1049;\r\n    transform: translateY(105%); opacity: 1; pointer-events: none;\r\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);\r\n    background: var(--dms-bg);\r\n    border-radius: 18px 18px 0 0;\r\n    padding: 6px 14px calc(12px + env(safe-area-inset-bottom, 0px));\r\n    /* No upward shadow: on white it renders as the dark line above the sheet\r\n       that the user flagged (图1). Host menus (z-index 1100) must stay above. */\r\n    box-shadow: none;\r\n    border: 0;\r\n    flex-direction: column; gap: 10px;\r\n    max-height: 50vh;\r\n  }\r\n  html.dms-attach-open .dms-attach-sheet { transform: translateY(0); pointer-events: auto; }\r\n  .dms-attach-handle {\r\n    width: 34px; height: 4px; border-radius: 2px;\r\n    background: var(--dms-line); align-self: center; margin: 2px 0 4px;\r\n  }\r\n  .dms-attach-recent { display: flex; flex-direction: column; gap: 7px; }\r\n  .dms-attach-recent[hidden] { display: none !important; }\r\n  .dms-attach-recent-title { font-size: 12px; color: var(--dms-text-2); padding: 0 2px; }\r\n  .dms-attach-recent-strip {\r\n    display: flex; gap: 8px; overflow-x: auto; overflow-y: hidden;\r\n    padding: 2px 2px 4px; min-height: 64px; scrollbar-width: none;\r\n    scroll-behavior: auto;\r\n  }\r\n  .dms-attach-recent-strip::-webkit-scrollbar { display: none; }\r\n  .dms-attach-loading { font-size: 12px; color: var(--dms-text-2); align-self: center; }\r\n  .dms-attach-photo {\r\n    position: relative;\r\n    flex: 0 0 64px; width: 64px; height: 64px; padding: 0;\r\n    border: 0; border-radius: 10px; overflow: hidden; background: var(--dms-surface-2);\r\n  }\r\n  .dms-photo-check {\r\n    position: absolute; top: 4px; right: 4px;\r\n    width: 17px; height: 17px; border-radius: 50%;\r\n    background: rgba(0, 0, 0, 0.34); border: 1.5px solid rgba(255, 255, 255, 0.95);\r\n    color: transparent; display: flex; align-items: center; justify-content: center;\r\n    box-sizing: border-box;\r\n  }\r\n  .dms-attach-photo.selected .dms-photo-check { background: var(--dms-blue); color: #fff; border-color: #fff; }\r\n  .dms-attach-photo.selected img { opacity: 0.86; }\r\n  /* host attachment remove control: keep it the official compact size */\r\n  [class*=\"_remove\"] {\r\n    width: 18px !important; height: 18px !important;\r\n    min-width: 18px !important; min-height: 18px !important;\r\n    font-size: 11px !important; line-height: 1 !important;\r\n  }\r\n  [class*=\"_remove\"] svg { width: 10px !important; height: 10px !important; }\r\n  .dms-attach-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }\r\n  .dms-attach-actions { display: flex; gap: 8px; }\r\n  .dms-attach-action {\r\n    flex: 1 1 0; min-width: 0;\r\n    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;\r\n    height: 72px; border: 0; border-radius: 14px;\r\n    background: var(--dms-surface-2); color: var(--dms-text);\r\n    font-size: 13px; font-weight: 500;\r\n  }\r\n  .dms-attach-action:active { background: var(--dms-line); }\r\n  .dms-attach-ico { display: inline-flex; color: var(--dms-text); }\r\n  .dms-attach-ico svg { width: 22px; height: 22px; }\r\n\r\n  /* the host \"+\" rotates into an \"x\" in step with the sheet (same 0.24s curve) */\r\n  button[data-dms-plus=\"1\"] svg {\r\n    transform: rotate(0deg) !important;\r\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\r\n  }\r\n  html.dms-attach-open button[data-dms-plus=\"1\"] svg { transform: rotate(45deg) !important; }\r\n\r\n  /* keyboard-inset fallback (only when the host did not resize the layout) */\r\n  html.dms-kb-open [data-composer-seat] {\r\n    transform: translateY(calc(-1 * var(--dms-kb, 0px))) !important;\r\n    transition: transform 0.16s ease-out !important;\r\n  }\r\n  html.dms-attach-open [data-composer-seat] {\r\n    transform: translateY(calc(-1 * var(--dms-sheet-h, 0px))) !important;\r\n    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) !important;\r\n  }\r\n  /* The composer's shield/context popovers live inside centerCol and use host\r\n     layer z-index 1100. While the sheet is open drop centerCol's own stacking\r\n     context so those popovers can paint above the sheet instead of being\r\n     clipped behind it (下方界面不消失、按钮 GUI 可见). */\r\n  html.dms-attach-open [class*=\"_centerCol\"] { z-index: auto !important; }\r\n  @keyframes dms-drawer-in {\r\n    from { transform: translateX(-100%); }\r\n    to { transform: translateX(0); }\r\n  }\r\n}\r\n@media (min-width: 1024px) {\r\n  .dms-iconbtn, .dms-scrim { display: none !important; }\r\n}\r\n";
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
    const rightToggle = () => $("[data-sidebar-right-toggle]");
    const rightExpand = () => $("[data-sidebar-right-expand]");

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
          if (rightOpen()) closeRight();
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
      if (kind === "menu") return cloneIcon("[data-sidebar-right-expand]") || ICONS.menu;
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
      if (rightOpen() || document.documentElement.classList.contains("dms-right-open")) return;
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
      if (!isPhone() || leftVisible || rightVisible || rightOpen()) return;
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
      if (!isPhone() || leftVisible || rightOpen() || settingsPanel() !== null) return;
      if (hostLeftOpen() || sidebarExpandBusy) return;
      const root = document.documentElement;
      root.classList.add("dms-preload-left");
      ensureSidebarMounted();
    }

    function repairLeftHost() {
      if (leftRepairTimer !== 0) { clearTimeout(leftRepairTimer); leftRepairTimer = 0; }
      if (!leftVisible) return;
      const root = document.documentElement;
      root.classList.remove("dms-left-hide");
      if (!hostLeftOpen()) {
        if (!rightOpen() && !root.classList.contains("dms-right-open")) {
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
      document.documentElement.classList.add("dms-right-open");
      const btn = rightExpand();
      if (btn) btn.click();
    }
    function closeRight() {
      // Keep the host's own fullscreen mode in sync: leaving it here avoids the
      // next open unexpectedly restoring a 100vw panel (the host chrome that
      // would show this state is hidden in the drawer).
      if (rightFullscreen() && performance.now() - rightFullExitAt > 700) exitRightFullscreen(false);
      rightVisible = false;
      rightActivityAt = performance.now();
      document.documentElement.classList.remove("dms-right-open");
      const btn = rightToggle();
      if (btn) btn.click();
    }
    let rightFullExitAt = 0;
    let rightFullBtn = null;
    const rightFullscreen = () => $('[data-sidebar-right-panel="fullscreen"]') !== null;
    function exitRightFullscreen(closeDrawer) {
      // The host owns fullscreen layout; its panel-chrome button is hidden by CSS
      // but can still be dispatched, so we flip the host state instead of writing
      // layout state ourselves (single source of truth for back key and button).
      rightFullExitAt = performance.now();
      const modeBtn = $("[data-sidebar-right-mode]");
      if (modeBtn !== null) modeBtn.click();
      document.documentElement.classList.remove("dms-right-full");
      if (closeDrawer === true) closeRight();
    }
    function ensureRightFullButton() {
      if (rightFullBtn === null) {
        rightFullBtn = document.createElement("button");
        rightFullBtn.type = "button";
        rightFullBtn.className = "dms-iconbtn dms-right-fullbtn";
        rightFullBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (document.documentElement.classList.contains("dms-right-full")) exitRightFullscreen(false);
          else {
            const modeBtn = $("[data-sidebar-right-mode]");
            if (modeBtn !== null) modeBtn.click();
          }
        });
        document.body.appendChild(rightFullBtn);
      }
      const root = document.documentElement;
      const full = root.classList.contains("dms-right-full");
      rightFullBtn.style.display = "";
      rightFullBtn.innerHTML = full ? ICONS.exitFull : ICONS.full;
      rightFullBtn.setAttribute("aria-label", full ? "退出全屏" : "全屏");
    }
    function newSession() {
      const btn = $('[class*="_newSession"]');
      if (btn) btn.click();
    }

    function ensureTopButtons() {
      if (!isPhone()) return;
      const header = $('[class*="_centerCol"] header');
      if (header === null) return;
      const leading = header.querySelector("[data-conversation-header-leading]");
      if (leading !== null && leading.querySelector(".dms-menu") === null) {
        leading.appendChild(makeButton("menu", "打开侧边栏", () => toggleLeft()));
      }
      const corner = header.querySelector("[data-conversation-header-corner]");
      if (corner !== null) {
        if (corner.querySelector(".dms-panel") === null) {
          corner.insertBefore(makeButton("panel", "打开右侧边栏", () => {
            if (rightOpen()) closeRight(); else openRight();
          }), corner.firstChild);
        }
        if (corner.querySelector(".dms-plus") === null) {
          corner.appendChild(makeButton("plus", "新建会话", () => newSession()));
        }
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
        if (rightOpen()) { closeRight(); return true; }
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
        if (rightOpen() || leftOpen()) {
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
              if (!rightOpen()) openRight();
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
      // The host can keep data-sidebar-right-open for a frame after closeRight();
      // don't let the 400ms reconciler flash the right drawer back open right
      // after a close (it would also block an immediate left-swipe).
      const rightClosing = !rightVisible && performance.now() - rightActivityAt < 320;
      root.classList.toggle("dms-right-open", rightVisible || (rightOpen() && !rightClosing));
      // Minimal drift correction: if the host closed the right panel on its own
      // (e.g. its own close button), drop our stale plugin state after the
      // open/close grace window so the left preload path is not blocked.
      if (rightVisible && !rightOpen() && performance.now() - rightActivityAt > 600) rightVisible = false;
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
      // Fullscreen is host-owned ([data-sidebar-right-panel]); mirror it to a class
      // so the mobile CSS can expand the drawer and the back key can exit it.
      const full = isPhone() && rightOpen() && $('[data-sidebar-right-panel="fullscreen"]') !== null;
      root.classList.toggle("dms-right-full", full);
      if (isPhone()) ensureRightFullButton();
      else if (rightFullBtn !== null) rightFullBtn.style.display = "none";
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
      let photoDrag = null;
      let photoDragPoint = null;
      let photoAutoScrollRaf = 0;
      let suppressPhotoClick = false;

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
            '<div class="dms-attach-handle"></div>' +
            '<div class="dms-attach-recent" hidden><div class="dms-attach-recent-title">最近照片</div><div class="dms-attach-recent-strip"></div></div>' +
            '<div class="dms-attach-actions">' +
              '<button type="button" class="dms-attach-action" data-kind="camera"><span class="dms-attach-ico">' + ICONS.camera + '</span><span>拍照</span></button>' +
              '<button type="button" class="dms-attach-action" data-kind="gallery"><span class="dms-attach-ico">' + ICONS.image + '</span><span>相册</span></button>' +
              '<button type="button" class="dms-attach-action" data-kind="files"><span class="dms-attach-ico">' + ICONS.file + '</span><span>文件</span></button>' +
            '</div>';
          document.body.appendChild(sheet);
          recentWrap = sheet.querySelector(".dms-attach-recent");
          recentStrip = sheet.querySelector(".dms-attach-recent-strip");
          recentStrip.addEventListener("touchstart", (event) => {
            const cell = event.target instanceof Element ? event.target.closest(".dms-attach-photo") : null;
            if (cell === null) return;
            const t = event.touches[0];
            suppressPhotoClick = false;
            photoDrag = { mode: cell.classList.contains("selected") ? "deselect" : "select", last: null };
            photoDragPoint = { x: t.clientX, y: t.clientY };
            photoDragTo(cell);
            startPhotoAutoScroll();
            if (event.cancelable) event.preventDefault();
          }, { passive: false });
          recentStrip.addEventListener("touchmove", (event) => {
            if (photoDrag === null) return;
            const t = event.touches[0];
            photoDragPoint = { x: t.clientX, y: t.clientY };
            photoDragTo(photoCellAtPoint(t.clientX, t.clientY));
            startPhotoAutoScroll();
            if (event.cancelable) event.preventDefault();
          }, { passive: false });
          const endPhotoDrag = () => {
            if (photoDrag !== null) {
              suppressPhotoClick = true;
              setTimeout(() => { suppressPhotoClick = false; }, 400);
            }
            photoDrag = null;
            photoDragPoint = null;
            stopPhotoAutoScroll();
          };
          recentStrip.addEventListener("touchend", endPhotoDrag, { passive: true });
          recentStrip.addEventListener("touchcancel", endPhotoDrag, { passive: true });
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
        if (items.length === 0) return true;
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
            pickNative(kind).catch(() => { fallbackPick(kind); });
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
        cell.dataset.dmsPending = "1";
        cell.classList.add("selected");
        void openRecent(cell.getAttribute("data-photo-id"), cell);
      }
      function deselectPhoto(cell) {
        if (!cell.classList.contains("selected")) return;
        cell.classList.remove("selected");
        composerRemoveByName(cell.dataset.dmsName || "");
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
        if (photoDrag === null || cell === null || cell === photoDrag.last) return;
        photoDrag.last = cell;
        if (photoDrag.mode === "select") selectPhoto(cell);
        else deselectPhoto(cell);
      }
      function stopPhotoAutoScroll() {
        if (photoAutoScrollRaf !== 0) { cancelAnimationFrame(photoAutoScrollRaf); photoAutoScrollRaf = 0; }
      }
      function startPhotoAutoScroll() {
        stopPhotoAutoScroll();
        if (photoDrag === null || photoDragPoint === null || recentStrip === null) return;
        const step = () => {
          photoAutoScrollRaf = 0;
          if (photoDrag === null || photoDragPoint === null || recentStrip === null) return;
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
            cell.addEventListener("click", () => {
              if (suppressPhotoClick) { suppressPhotoClick = false; return; }
              togglePhoto(cell);
            });
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
        const height = root.classList.contains("dms-attach-open") ? sheet.getBoundingClientRect().height : 0;
        root.style.setProperty("--dms-sheet-h", height + "px");
      }
      function openSheet() {
        ensureUi();
        const add = $('[data-composer-card] button[aria-haspopup="listbox"], [class*="_inputBar"] button[aria-haspopup="listbox"]');
        if (add !== null) add.setAttribute("data-dms-plus", "1");
        root.classList.add("dms-attach-open");
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
        requestAnimationFrame(measureSheet);
        loadNativeCaps();
        renderRecent();
      }
      function closeSheet() {
        photoDrag = null;
        photoDragPoint = null;
        stopPhotoAutoScroll();
        root.classList.remove("dms-attach-open");
        root.style.setProperty("--dms-sheet-h", "0px");
      }
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
        // Keep the sheet alive for the composer's own controls (shield / context /
        // workspace / mode pickers). Their popovers render on host layer 1100,
        // above this sheet (z-index 1049), so the controls and their menus work
        // and the UI below the sheet is not torn down.
        if (target.closest('[data-composer-card], [data-composer-seat], [class*="_inputBar"]') !== null) return;
        closeSheet();
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
        installKeyboard();
        installSettingsWatcher();
        installAttachSheet();
        if (!off.has("autoclose")) installDrawerAutoClose();
        if (!off.has("longpress")) installLongPress();
        if (!off.has("observer")) installObserver();
        installDebug();
        sync();
        const wanted = new URLSearchParams(location.search).get("dms");
        if (wanted === "left" && !leftOpen()) setTimeout(() => toggleLeft(), 600);
        if (wanted === "right" && !rightOpen()) setTimeout(() => openRight(), 900);
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
