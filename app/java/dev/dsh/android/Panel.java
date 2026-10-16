package dev.dsh.android;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Space;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.util.List;

/**
 * The app's only native surface: a control panel for the sandbox.
 *
 * It is a slide-in drawer rather than a screen with a title bar, because the
 * harness Web UI is the application; this exists for the things a Web UI
 * cannot do for itself (install/import rootfs, start/stop the PRoot process,
 * read the server log, set the API key).
 */
public final class Panel {

    public interface Host {
        /* Deliberately not named onStart/onStop/onRestart: those are Activity
         * lifecycle methods, and a same-named interface method would silently
         * become an override that skips super — which is exactly what crashed
         * the first build. */
        void startServer();

        void stopServer();

        void restartServer();

        void onOpenInBrowser();

        void onImport();

        void onSelectDistro(String id);

        void onDeleteDistro(String id);

        void onSaveSettings();

        void onClose();

        /**
         * One of the grants the phone-assistant feature needs. The activity owns
         * the dialogs and the settings pages; the bridge only names what is
         * missing (`/a11y/request`, `/overlay/request`, `/mic/request`).
         *
         * @param which one of {@link Assist#PERMISSION_ACCESSIBILITY},
         *              {@link Assist#PERMISSION_OVERLAY},
         *              {@link Assist#PERMISSION_MICROPHONE}
         */
        void onAssistPermission(int which);

        /** Open the file picker so the user can apply a hot package by hand. */
        void onHotPickRequested();

        /** Open the file picker for the floating ball's picture. */
        void onBallImageRequested();

        /**
         * Recovery mode: the way in when the harness itself is what broke.
         *
         * Four calls instead of one, because each does something different to the
         * sandbox (start it as a shell host, go back to the harness, mint a new
         * secret, or just show the console) and the panel should own nothing but
         * the labels.
         */
        void enterRecovery();

        void exitRecovery();

        void rotateRecoveryToken();

        void openRecoveryConsole();
    }

    // Resolved from resources, so values-night/ decides light vs dark. The app
    // follows the system theme rather than forcing one of its own.
    private final int BG;
    private final int CARD;
    private final int TEXT;
    private final int MUTED;
    private final int ACCENT;
    private final int DANGER;
    private final int OK;

    public final View view;

    private final Context ctx;
    private final Host host;
    private final LinearLayout body;
    private final TextView status;
    private final TextView address;
    private final LinearLayout distroList;
    private final EditText command;
    private final EditText port;
    private final EditText apiKey;
    private final TextView logView;
    private final TextView progress;
    private final TextView recoveryStatus;
    private final TextView recoveryCommand;
    private final Button recoveryEnter;
    private final Button recoveryExit;
    private final Button recoveryConsole;

    private String editingDistro = App.BUNDLED_ID;

    public Panel(Context ctx, Host host) {
        this.ctx = ctx;
        this.host = host;
        this.BG = ctx.getResources().getColor(R.color.console_background);
        this.CARD = ctx.getResources().getColor(R.color.console_card);
        this.TEXT = ctx.getResources().getColor(R.color.console_text);
        this.MUTED = ctx.getResources().getColor(R.color.console_muted);
        this.ACCENT = ctx.getResources().getColor(R.color.console_accent);
        this.DANGER = ctx.getResources().getColor(R.color.console_danger);
        this.OK = ctx.getResources().getColor(R.color.console_ok);

        LinearLayout column = new LinearLayout(ctx);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setBackgroundColor(BG);

        // --- header: status + close, no app title -------------------------
        LinearLayout header = new LinearLayout(ctx);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(16), dp(14), dp(8), dp(10));
        status = new TextView(ctx);
        status.setTextSize(15);
        status.setTypeface(Typeface.DEFAULT_BOLD);
        status.setTextColor(TEXT);
        header.addView(status, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        Button close = ghost("✕");
        close.setOnClickListener(v -> host.onClose());
        header.addView(close);
        column.addView(header);

        address = new TextView(ctx);
        address.setTextSize(12);
        address.setTextColor(MUTED);
        address.setPadding(dp(16), 0, dp(16), dp(10));
        column.addView(address);

        ScrollView scroll = new ScrollView(ctx);
        body = new LinearLayout(ctx);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(16), 0, dp(16), dp(24));
        scroll.addView(body);
        column.addView(scroll, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        // --- server controls ---------------------------------------------
        LinearLayout row = row();
        row.addView(action("启动", () -> host.startServer()), weight());
        row.addView(action("停止", () -> host.stopServer()), weight());
        row.addView(action("重启", () -> host.restartServer()), weight());
        body.addView(row);
        LinearLayout row2 = row();
        row2.addView(action("在浏览器打开", () -> host.onOpenInBrowser()), weight());
        row2.addView(action("导入 rootfs", () -> host.onImport()), weight());
        body.addView(row2);

        // --- recovery -------------------------------------------------------
        // First thing under the server buttons, because the states that need it
        // are the states where nothing else on this screen can help.
        body.addView(section("恢复模式（harness 起不来时用）"));
        recoveryStatus = hint("");
        recoveryStatus.setTextSize(12);
        body.addView(recoveryStatus);

        LinearLayout recoveryRow = row();
        recoveryEnter = action("进入恢复模式", () -> host.enterRecovery());
        recoveryExit = action("退出恢复模式", () -> host.exitRecovery());
        recoveryConsole = action("手机内控制台", () -> host.openRecoveryConsole());
        recoveryRow.addView(recoveryEnter, weight());
        recoveryRow.addView(recoveryExit, weight());
        recoveryRow.addView(recoveryConsole, weight());
        body.addView(recoveryRow);

        recoveryCommand = new TextView(ctx);
        recoveryCommand.setTextSize(11);
        recoveryCommand.setTextColor(MUTED);
        recoveryCommand.setTypeface(Typeface.MONOSPACE);
        recoveryCommand.setTextIsSelectable(true);
        recoveryCommand.setPadding(dp(10), dp(10), dp(10), dp(10));
        recoveryCommand.setBackground(rounded(CARD, 8));
        body.addView(recoveryCommand);

        LinearLayout recoveryRow2 = row();
        recoveryRow2.addView(action("复制 SSH 信息", () -> copyRecovery()), weight());
        recoveryRow2.addView(action("换新令牌", () -> host.rotateRecoveryToken()), weight());
        body.addView(recoveryRow2);
        body.addView(toggle("harness 连续失败后自动进入恢复模式", "recoveryAuto"));
        body.addView(hint("恢复模式不加载 harness：沙箱里只有 sshd 和一个 shell，"
                + "用来把 profile、依赖或磁盘修回来。令牌只在本次会话有效，退出即失效。"));

        progress = new TextView(ctx);
        progress.setTextSize(12);
        progress.setTextColor(ACCENT);
        progress.setPadding(0, dp(8), 0, 0);
        body.addView(progress);

        // --- distros -------------------------------------------------------
        body.addView(section("发行版"));
        distroList = new LinearLayout(ctx);
        distroList.setOrientation(LinearLayout.VERTICAL);
        body.addView(distroList);

        body.addView(section("启动命令"));
        command = field("", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        command.setMinLines(2);
        body.addView(command);
        body.addView(action("保存并应用", () -> {
            Distros.setCommand(editingDistro, command.getText().toString());
            host.onSaveSettings();
        }));

        // --- settings ------------------------------------------------------
        body.addView(section("设置"));
        body.addView(hint("端口（dsh Web UI 监听端口）"));
        port = field("3080", InputType.TYPE_CLASS_NUMBER);
        body.addView(port);
        body.addView(hint("DeepSeek API Key（以环境变量 DEEPSEEK_API_KEY 注入沙箱，可留空）"));
        apiKey = field("", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        body.addView(apiKey);
        body.addView(toggle("共享手机存储到 /sdcard", "shareStorage"));
        body.addView(toggle("后台保活（前台服务 + WakeLock）", "keepAwake"));
        body.addView(toggle("异常退出后自动重启服务", "autoRestart"));
        body.addView(action("保存设置", () -> {
            saveSettings();
            host.onSaveSettings();
        }));

        // --- log -----------------------------------------------------------
        body.addView(section("日志"));
        logView = new TextView(ctx);
        logView.setTextSize(10);
        logView.setTextColor(MUTED);
        logView.setTypeface(Typeface.MONOSPACE);
        logView.setTextIsSelectable(true);
        logView.setPadding(dp(10), dp(10), dp(10), dp(10));
        logView.setBackground(rounded(CARD, 8));
        body.addView(logView);
        body.addView(action("清空日志", () -> {
            App.i().clearServerLog();
            refresh();
        }));

        view = column;
    }

    // ---------------------------------------------------------------- actions

    private void saveSettings() {
        int value = 3080;
        try {
            value = Integer.parseInt(port.getText().toString().trim());
        } catch (NumberFormatException ignored) {
        }
        App.i().prefs.edit()
                .putInt("port", value < 1 || value > 65535 ? 3080 : value)
                .putString("apiKey", apiKey.getText().toString().trim())
                .apply();
    }

    // ------------------------------------------------------------------- view

    public void refresh() {
        ServerBus.State state = ServerBus.state();
        String label;
        switch (state) {
            case RUNNING:
                label = "运行中";
                break;
            case STARTING:
                label = "启动中…";
                break;
            case ERROR:
                label = "启动失败";
                break;
            default:
                label = "已停止";
        }
        status.setText(label);
        status.setTextColor(state == ServerBus.State.ERROR ? DANGER
                : state == ServerBus.State.RUNNING ? OK : TEXT);
        address.setText(ServerBus.url() == null
                ? (ServerBus.error() == null ? "尚未就绪" : ServerBus.error())
                : ServerBus.url());

        App app = App.i();
        if (port.getText().length() == 0) port.setText(String.valueOf(app.port()));
        apiKey.setText(app.prefs.getString("apiKey", ""));

        distroList.removeAllViews();
        for (Distros.Distro distro : Distros.list(ctx)) {
            LinearLayout card = new LinearLayout(ctx);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(dp(12), dp(10), dp(12), dp(10));
            card.setBackground(rounded(CARD, 10));

            TextView name = new TextView(ctx);
            name.setTextSize(14);
            name.setTextColor(TEXT);
            name.setText((distro.id.equals(app.activeDistroId()) ? "● " : "○ ") + distro.name
                    + (distro.isUsable() ? "" : "（rootfs 不完整）"));
            card.addView(name);

            TextView meta = new TextView(ctx);
            meta.setTextSize(11);
            meta.setTextColor(MUTED);
            meta.setText(distro.id + " · " + distro.root.getAbsolutePath());
            card.addView(meta);

            LinearLayout actions = row();
            actions.setPadding(0, dp(8), 0, 0);
            actions.addView(action("选中", () -> host.onSelectDistro(distro.id)), weight());
            if (!distro.bundled) {
                actions.addView(action("删除", () -> host.onDeleteDistro(distro.id)), weight());
            }
            card.addView(actions);

            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            lp.bottomMargin = dp(8);
            distroList.addView(card, lp);

            if (distro.id.equals(editingDistro)) {
                command.setText(distro.command);
            }
        }

        StringBuilder log = new StringBuilder();
        List<String> lines = ServerBus.log();
        int from = Math.max(0, lines.size() - 120);
        for (int i = from; i < lines.size(); i++) {
            log.append(lines.get(i)).append('\n');
        }
        logView.setText(log.length() == 0 ? "（无输出）" : log.toString());

        Switch share = view.findViewWithTag("shareStorage");
        if (share != null) share.setChecked(app.prefs.getBoolean("shareStorage", true));
        Switch awake = view.findViewWithTag("keepAwake");
        if (awake != null) awake.setChecked(app.prefs.getBoolean("keepAwake", true));
        Switch restart = view.findViewWithTag("autoRestart");
        if (restart != null) restart.setChecked(app.prefs.getBoolean("autoRestart", true));

        // Recovery.
        boolean recovery = Recovery.active();
        recoveryStatus.setText(Recovery.describe());
        recoveryStatus.setTextColor(recovery ? (Recovery.sshReady() ? OK : ACCENT) : MUTED);
        recoveryEnter.setVisibility(recovery ? View.GONE : View.VISIBLE);
        recoveryExit.setVisibility(recovery ? View.VISIBLE : View.GONE);
        recoveryConsole.setVisibility(recovery ? View.VISIBLE : View.GONE);
        recoveryCommand.setVisibility(recovery ? View.VISIBLE : View.GONE);
        recoveryCommand.setText(recovery ? recoveryText(app) : "");
        Switch autoRecovery = view.findViewWithTag("recoveryAuto");
        if (autoRecovery != null) autoRecovery.setChecked(Recovery.auto());
    }

    /**
     * The block the user reads off the screen — or copies — to get in.
     *
     * Three routes, in the order they are worth trying: the same Wi-Fi (no cable,
     * no computer-side setup), USB through adb (works when the phone is on
     * mobile data), and the on-phone console for when the phone is all there is.
     * The tunnel line is included because restarting the harness from the shell
     * and then reaching it in a *computer's* browser is the faster repair when
     * the phone's own WebView is the thing misbehaving.
     */
    private String recoveryText(App app) {
        String lan = Recovery.lanAddress();
        int port = Recovery.port();
        StringBuilder text = new StringBuilder();
        text.append("密码（本次会话有效）\n  ").append(Recovery.token()).append('\n');
        text.append("用户 root · 端口 ").append(port).append('\n');
        text.append("\n同一 Wi-Fi（在电脑上）\n  ")
                .append(lan == null ? "（没有局域网地址，用下面的 USB 方式）"
                        : RecoveryPlan.sshCommand(lan, port, "root")).append('\n');
        text.append("\nUSB（在电脑上）\n  ").append(RecoveryPlan.adbForward(port)).append('\n');
        text.append("  ").append(RecoveryPlan.sshCommand("127.0.0.1", port, "root")).append('\n');
        if (lan != null) {
            text.append("\n修好 harness 后，从电脑浏览器打开它（端口转发）\n  ")
                    .append(RecoveryPlan.forwardCommand(lan, port, "root", app.activePort()))
                    .append('\n');
        }
        text.append("\n或者直接点「手机内控制台」，在这台手机上开一个 shell。");
        return text.toString();
    }

    private void copyRecovery() {
        try {
            ClipboardManager clipboard =
                    (ClipboardManager) ctx.getSystemService(Context.CLIPBOARD_SERVICE);
            if (clipboard == null) return;
            clipboard.setPrimaryClip(ClipData.newPlainText("dsh recovery", recoveryText(App.i())));
            Toast.makeText(ctx, "已复制", Toast.LENGTH_SHORT).show();
        } catch (Throwable error) {
            Toast.makeText(ctx, "复制失败：" + error, Toast.LENGTH_SHORT).show();
        }
    }

    public void setEditing(String id) {
        editingDistro = id;
        refresh();
    }

    public void setProgress(String text) {
        progress.setText(text == null ? "" : text);
    }

    // ------------------------------------------------------------------ widgets

    private LinearLayout row() {
        LinearLayout layout = new LinearLayout(ctx);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        return layout;
    }

    private LinearLayout.LayoutParams weight() {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        lp.rightMargin = dp(6);
        return lp;
    }

    private TextView section(String text) {
        TextView view = new TextView(ctx);
        view.setText(text);
        view.setTextSize(12);
        view.setTextColor(MUTED);
        view.setPadding(0, dp(18), 0, dp(6));
        return view;
    }

    private TextView hint(String text) {
        TextView view = new TextView(ctx);
        view.setText(text);
        view.setTextSize(11);
        view.setTextColor(MUTED);
        view.setPadding(0, dp(6), 0, dp(2));
        return view;
    }

    private Button action(String label, Runnable run) {
        Button button = new Button(ctx);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(13);
        button.setBackground(rounded(CARD, 8));
        button.setTextColor(TEXT);
        button.setPadding(dp(8), dp(6), dp(8), dp(6));
        button.setOnClickListener(v -> run.run());
        return button;
    }

    private Button ghost(String label) {
        Button button = action(label, () -> {
        });
        button.setBackgroundColor(Color.TRANSPARENT);
        button.setMinWidth(dp(40));
        return button;
    }

    private EditText field(String value, int inputType) {
        EditText edit = new EditText(ctx);
        edit.setText(value);
        edit.setTextSize(13);
        edit.setInputType(inputType);
        edit.setTextColor(TEXT);
        edit.setHintTextColor(MUTED);
        edit.setBackground(rounded(CARD, 8));
        edit.setPadding(dp(10), dp(8), dp(10), dp(8));
        return edit;
    }

    private View toggle(String label, String key) {
        Switch toggle = new Switch(ctx);
        toggle.setText(label);
        toggle.setTextSize(13);
        toggle.setTextColor(TEXT);
        toggle.setTag(key);
        toggle.setPadding(0, dp(6), 0, dp(6));
        toggle.setChecked(App.i().prefs.getBoolean(key, true));
        toggle.setOnCheckedChangeListener((v, checked) ->
                App.i().prefs.edit().putBoolean(key, checked).apply());
        return toggle;
    }

    private GradientDrawable rounded(int color, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        return drawable;
    }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value,
                ctx.getResources().getDisplayMetrics());
    }

    public static View spacer(Context ctx, int heightDp) {
        Space space = new Space(ctx);
        space.setLayoutParams(new LinearLayout.LayoutParams(1, heightDp));
        return space;
    }
}
