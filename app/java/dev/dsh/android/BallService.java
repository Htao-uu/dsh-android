package dev.dsh.android;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.PathInterpolator;
import android.view.inputmethod.InputMethodManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.Locale;

/**
 * The floating ball, as two overlay windows that never draw the same thing.
 *
 * The ball and the typing bar used to be two windows: a full-screen drawing
 * layer that morphed the ball into a capsule, and an opaque composer window
 * sitting on top of it with the input field. The composer appeared the instant
 * the ball was tapped, so it covered the whole morph — the user only ever saw
 * the finished bar ("你把他俩合在一起吧"). There is now one window for both:
 *
 *   visual  full screen, NOT touchable, NOT focusable, `ball.html`. It draws the
 *           status bubble and nothing else. Its size, position and flags are
 *           written once, when it is created, and never touched again.
 *   bar     `composer.html`. Collapsed it is exactly the ball (`size` x `size`,
 *           on the ball) and the page inside draws the whale. Expanding moves
 *           that same window — frame by frame, `updateViewLayout` — onto the
 *           bar's rect, so the surface the user watches grow IS the surface the
 *           input field ends up in. Nothing can cover the animation because
 *           there is nothing above it.
 *
 * What that costs, deliberately: the window is the ball, so the page may only
 * draw inside the ball's own square. The breathe and press scales therefore
 * shrink instead of growing (a scale > 1 would be clipped flat by the window
 * edge). The window is also the only thing that takes touches over the ball;
 * there is no separate hit window any more.
 *
 * Hard-won rules kept from the rewrite (see build/BALL-REWRITE-SPEC.md):
 *  * no window of ours is ever full screen AND touchable;
 *  * the visual layer is FLAG_NOT_TOUCHABLE|FLAG_NOT_FOCUSABLE for its whole
 *    life and is never resized or re-flagged;
 *  * the bar window always carries FLAG_NOT_TOUCH_MODAL: a focusable window
 *    without it swallows every touch outside its own bounds — including the
 *    keyboard's, which sits below an overlay;
 *  * no watchdog, no timeout, no auto-collapse. The ways out are ✕, send, the
 *    keyboard's back key and a tap on the whale itself;
 *  * the ball's position is persisted at the end of a drag and in onDestroy.
 *
 * Everything a page is told is in dp, which is also the page's CSS pixel: the
 * WebView's device pixel ratio equals the display density. Pages do not convert.
 */
public final class BallService extends Service {

    private static final String CHANNEL = "assistant";
    private static final int NOTIFICATION_ID = 4210;

    /** Whether the user wants the ball up; survives app updates and reboots. */
    static final String PREF_ENABLED = "ballEnabled";

    /** Appearance, set from the settings page through `/ball/config`. */
    static final String PREF_SIZE = "ballSizeDp";
    static final String PREF_IMAGE = "ballImagePath";
    static final int DEFAULT_SIZE_DP = 58;

    /** Where the ball lives, in raw pixels: the top-left of its padded box. */
    private static final String PREF_BALL_X = "ballX";
    private static final String PREF_BALL_Y = "ballY";

    /** Transparent room around the circle: the page draws its shadow there. */
    private static final int PAD_DP = 18;
    /** No refresh for this long and a "working" state is presumed dead. */
    private static final long STALE_MS = 25000;

    private static final int DRAG_SLOP_DP = 8;
    private static final long HOLD_MS = 260;

    /** The typing bar: 78% of the screen wide, the ball's height plus 16 dp. */
    private static final float BAR_WIDTH_FRACTION = 0.78f;
    private static final int BAR_EXTRA_DP = 16;
    /** One morph, both ways; the whale and the plane run inside it. */
    private static final long MORPH_MS = 400;

    /**
     * The bubble: the ball itself, stretched sideways to fit a line of status.
     *
     * It is the same window as the ball and the bar — what the user reads is the
     * ball they tapped, grown. Half the screen is the hard cap (the page measures
     * the text and reports the width it needs); the height is the ball's own
     * height unless the line needs three rows, and it never sits anywhere but on
     * the ball.
     */
    private static final float BUBBLE_WIDTH_FRACTION = 0.5f;
    private static final int BUBBLE_LINES = 3;
    private static final int BUBBLE_LINE_DP = 20;
    /** 6 dp above and below the text, same as the page's padding. */
    private static final int BUBBLE_VPAD_DP = 12;
    private static final long BUBBLE_IN_MS = 260;
    private static final long BUBBLE_OUT_MS = 220;
    private static final long BUBBLE_RESIZE_MS = 180;
    /** A plain line ("你：…", a delivery result) has a lifetime, not a phase. */
    private static final long SAY_MS = 5000;
    /** ✓ stays a moment, then the bubble folds back into the ball. */
    private static final long DONE_MS = 2600;

    private static final String WINDOW_VISUAL = "dsh-ball-visual";
    private static final String WINDOW_BAR = "dsh-ball-bar";

    /**
     * What every state of the bar window carries.
     *
     * FLAG_LAYOUT_IN_SCREEN: without it a TOP|START window is positioned inside
     * the app's content frame, which starts below the status bar — the page drew
     * the ball at screen y and the touch layer sat 90 px lower, so a tap on the
     * ball fell outside the window and onTouch was never called.
     * FLAG_NOT_TOUCH_MODAL: while the bar is focusable (the keyboard needs it),
     * a window without this flag swallows every touch outside its own bounds.
     */
    private static final int BAR_FLAGS =
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                    | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                    | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;

    private static volatile boolean running;
    /** The instance a delivery result is reported back to. */
    private static volatile BallService live;

    private WindowManager windowManager;

    /** The full-screen, never-touchable status layer. Draws the bubble only. */
    private WebView visual;
    private WindowManager.LayoutParams visualParams;
    private volatile boolean visualReady;

    /** The one ball/bar window. Its presence is the "am I shown" state. */
    private WebView bar;
    private WindowManager.LayoutParams barParams;
    private volatile boolean barReady;
    /** The listener that takes the ball's gestures while the bar is closed. */
    private final Hit touch = new Hit();

    private volatile boolean expanded;

    /**
     * The bubble state: the same window, stretched off the ball to show a line.
     * `bubbleShown` is the app's copy of what the page is drawing, so a status
     * that arrives while the bubble is already out only resizes it.
     */
    private volatile boolean bubbleShown;
    private int bubbleWidth;
    private int bubbleHeight;

    /** The frame-by-frame window morph, and the guard against stale callbacks. */
    private ValueAnimator morphAnimator;
    private int morphGeneration;

    /** The ball's box (ball plus shadow padding) top-left, in raw pixels. */
    private int ballX;
    private int ballY;

    private SpeechRecognizer recognizer;
    private boolean listening;
    private String heard;
    private final Handler handler = new Handler(Looper.getMainLooper());

    /** What the bubble should show; the page owns the frames and the labels. */
    private volatile String phase = "idle";
    private volatile String phaseText = "";
    private volatile long phaseAt;

    /**
     * The status has a lifetime, and only the status does.
     *
     * A "working" line that is never cleared spins forever, so a stale one is
     * dropped back to idle. This touches nothing but {@link #phase} /
     * {@link #phaseText}: it never hides a window, never collapses the bar and
     * never overrides a newer state (it is cancelled on every push).
     */
    private final Runnable stale = () -> {
        if (!"idle".equals(phase) && System.currentTimeMillis() - phaseAt > STALE_MS) {
            applyState("idle", "");
        }
    };

    public static boolean isRunning() {
        return running;
    }

    /** Keys for the ball's own display behaviour; defaults are today's behaviour. */
    /** The bar window's WebView, so the static settings push can reach it. */
    private static WebView barWebView;

    static final String PREF_SHOW_STATUS = "ballShowStatus";
    static final String PREF_SHOW_THINK = "ballShowThink";
    static final String PREF_SHOW_RING = "ballShowRing";
    static final String PREF_BUBBLE_LINES = "ballBubbleLines";

    /** Push the ball's settings into the bar page. Hot by construction: the page just
     *  re-reads them, so a change lands while the ball is up. If the page is not up yet
     *  the next load applies them (that is the documented fallback). */
    static void applySettings() {
        WebView target = barWebView;
        if (target == null) return;
        String json = settingsJson();
        target.post(() -> {
            try {
                target.evaluateJavascript(
                        "window.ComposerUI&&window.ComposerUI.settings&&window.ComposerUI.settings(" + json + ")",
                        null);
            } catch (Throwable ignored) {
            }
        });
    }

    /** The flat map the settings page and the ball page both read. */
    static String settingsJson() {
        android.content.SharedPreferences prefs = App.i().prefs;
        return "{"
                + "\"ballEnabled\":" + prefs.getBoolean(PREF_ENABLED, false) + ","
                + "\"ballSizeDp\":" + prefs.getInt(PREF_SIZE, DEFAULT_SIZE_DP) + ","
                + "\"ballImagePath\":\"" + prefs.getString(PREF_IMAGE, "") + "\","
                + "\"ballShowStatus\":" + prefs.getBoolean(PREF_SHOW_STATUS, true) + ","
                + "\"ballShowThink\":" + prefs.getBoolean(PREF_SHOW_THINK, true) + ","
                + "\"ballShowRing\":" + prefs.getBoolean(PREF_SHOW_RING, true) + ","
                + "\"ballBubbleLines\":" + prefs.getInt(PREF_BUBBLE_LINES, 3)
                + "}";
    }

    /** Put the ball back where it starts when the user never moved it. */
    static void resetPosition(Context ctx) {
        App.i().prefs.edit()
                .remove(PREF_BALL_X)
                .remove(PREF_BALL_Y)
                .apply();
        reload(ctx);
    }

    /** Start the overlay and remember that the user wants it (see {@link #restore}). */
    public static void start(Context ctx) {
        App.i().prefs.edit().putBoolean(PREF_ENABLED, true).apply();
        if (!Assist.canOverlay(ctx) || running) return;
        ctx.startForegroundService(new Intent(ctx, BallService.class));
    }

    /** Stop the overlay and remember that the user does not want it. */
    public static void stop(Context ctx) {
        App.i().prefs.edit().putBoolean(PREF_ENABLED, false).apply();
        ctx.stopService(new Intent(ctx, BallService.class));
    }

    /**
     * Bring the ball back after the process was replaced.
     *
     * An app update kills the service, and without this the ball silently
     * disappeared until the user went digging in the settings again.
     */
    public static void restore(Context ctx) {
        if (!App.i().prefs.getBoolean(PREF_ENABLED, false)) return;
        if (!Assist.canOverlay(ctx) || running) return;
        ctx.startForegroundService(new Intent(ctx, BallService.class));
    }

    /** Re-read the appearance settings by restarting the overlay. */
    public static void reload(Context ctx) {
        if (!running) return;
        ctx.stopService(new Intent(ctx, BallService.class));
        ctx.startForegroundService(new Intent(ctx, BallService.class));
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
        live = this;
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        SharedPreferences prefs = App.i().prefs;
        // A position saved on another screen (rotation, a different display) is
        // clamped back onto this one instead of parking the ball off-screen.
        ballX = clampX(prefs.getInt(PREF_BALL_X, dp(12)));
        ballY = clampY(prefs.getInt(PREF_BALL_Y, dp(220)));
        startForeground(NOTIFICATION_ID, notification());
        showVisual();
        showBar();
        App.log("floating ball shown: bar window + status layer, size=" + sizeDp()
                + "dp density=" + density());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        live = null;
        // /ball/config reloads this service, and onCreate() reads the position
        // back from prefs. The position used to be written only at the end of a
        // drag, so a reload teleported the ball to the default spot. Persist it
        // on the way out as well.
        remember();
        handler.removeCallbacksAndMessages(null);
        cancelMorph();
        stopListening();
        if (bar != null) {
            try {
                windowManager.removeViewImmediate(bar);
            } catch (Exception ignored) {
            }
            bar.destroy();
            bar = null;
            barReady = false;
        }
        if (visual != null) {
            try {
                windowManager.removeViewImmediate(visual);
            } catch (Exception ignored) {
            }
            visual.destroy();
            visual = null;
            visualReady = false;
        }
        expanded = false;
        App.log("floating ball hidden");
        super.onDestroy();
    }

    // ------------------------------------------------------------ notification

    private Notification notification() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL,
                    getString(R.string.ball_channel), NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            channel.enableVibration(false);
            channel.setDescription(getString(R.string.ball_channel_hint));
            manager.createNotificationChannel(channel);
        }
        PendingIntent open = PendingIntent.getActivity(this, 1,
                new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL)
                : new Notification.Builder(this);
        return builder
                .setSmallIcon(R.drawable.ic_whale_monochrome)
                .setContentTitle(getString(R.string.ball_running))
                .setContentText(getString(R.string.ball_running_hint))
                .setContentIntent(open)
                .setOngoing(true)
                .build();
    }

    // ----------------------------------------------------------------- geometry

    private float density() {
        return getResources().getDisplayMetrics().density;
    }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value,
                getResources().getDisplayMetrics());
    }

    private int sizeDp() {
        SharedPreferences prefs = App.i().prefs;
        int value = prefs.getInt(PREF_SIZE, DEFAULT_SIZE_DP);
        return value < 32 ? DEFAULT_SIZE_DP : Math.min(value, 140);
    }

    private int sizePx() {
        return dp(sizeDp());
    }

    /** The ball plus the transparent ring its shadow is drawn in. */
    private int boxPx() {
        return sizePx() + 2 * dp(PAD_DP);
    }

    private int screenWidth() {
        return getResources().getDisplayMetrics().widthPixels;
    }

    private int screenHeight() {
        return getResources().getDisplayMetrics().heightPixels;
    }

    /**
     * The screen the ball is actually drawn on.
     *
     * The visual window is top-aligned at screen y=0 but stops above the
     * navigation bar, so the display height is a little taller than the area the
     * page can draw in. Clamping the ball against the display height let it be
     * dragged into the last strip of screen, where the page clips it and the ball
     * looks like it disappeared. Use the visual window's own height once it has
     * been laid out.
     */
    private int screenBottom() {
        WebView web = visual;
        int height = web == null ? 0 : web.getHeight();
        return height > 0 ? height : screenHeight();
    }

    /** The ball's centre on screen, in raw pixels. */
    private int centreX() {
        return ballX + boxPx() / 2;
    }

    private int centreY() {
        return ballY + boxPx() / 2;
    }

    /**
     * Clamp the ball so the circle itself stays on screen: the box may hang off
     * the edge by exactly its padding, which is where the ball touches the edge.
     */
    private int clampX(float value) {
        int pad = dp(PAD_DP);
        int max = Math.max(-pad, screenWidth() - boxPx() + pad);
        return Math.round(Math.min(Math.max(value, -pad), max));
    }

    private int clampY(float value) {
        int pad = dp(PAD_DP);
        int max = Math.max(-pad, screenBottom() - boxPx() + pad);
        return Math.round(Math.min(Math.max(value, -pad), max));
    }

    /** The closed bar: exactly the ball's circle, where the ball is. */
    private int[] ballFrame() {
        return new int[]{ballX + dp(PAD_DP), ballY + dp(PAD_DP), sizePx(), sizePx()};
    }

    /**
     * The open bar. `left`/`top`/`width`/`height`, in raw pixels.
     *
     * The bar grows out of the ball rather than appearing next to it: its edge on
     * the ball's side stays on that same edge, so the capsule the page draws
     * inside this window is the ball still being there, just longer. Clamped to
     * the screen edges only — an earlier "keep the bar out of the keyboard's way"
     * clamp pulled it into the top 45% of the screen and left it floating far
     * from the ball, which is exactly what the user complained about.
     */
    private int[] barFrame() {
        int width = Math.min(screenWidth(), Math.round(screenWidth() * BAR_WIDTH_FRACTION));
        int height = sizePx() + dp(BAR_EXTRA_DP);
        int half = sizePx() / 2;
        int left = centreX() < screenWidth() / 2
                ? centreX() - half
                : centreX() + half - width;
        left = Math.max(0, Math.min(left, Math.max(0, screenWidth() - width)));
        int top = centreY() - half - dp(BAR_EXTRA_DP / 2);
        top = Math.max(0, Math.min(top, Math.max(0, screenBottom() - height)));
        return new int[]{left, top, width, height};
    }

    /** Where the window is right now, as laid out by the app. */
    private int[] currentFrame() {
        if (barParams == null) return ballFrame();
        return new int[]{barParams.x, barParams.y, barParams.width, barParams.height};
    }

    private String frameText(int[] frame) {
        return "px " + frame[0] + "," + frame[1] + " " + frame[2] + "x" + frame[3]
                + " / dp " + f2(frame[0] / density()) + "," + f2(frame[1] / density())
                + " " + f2(frame[2] / density()) + "x" + f2(frame[3] / density());
    }

    private static String f2(double value) {
        return String.format(Locale.US, "%.2f", value);
    }

    // ------------------------------------------------------------------ windows

    @SuppressLint("SetJavaScriptEnabled")
    private WebView webView(String page, Object bridge, String name, boolean imeBack, OnPage onPage) {
        WebView web = imeBack ? new BarWeb(this) : new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setDomStorageEnabled(true);
        web.setBackgroundColor(0x00000000);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.addJavascriptInterface(bridge, name);
        // A WebView has no console the app can see, and "the ball is invisible"
        // is not a diagnosis: everything the page says or fails to load lands in
        // the app log instead.
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                App.log("ball-web ready: " + page);
                if (onPage != null) onPage.ready(view);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                App.log("ball-web load error: " + request.getUrl() + " → " + error.getDescription());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                App.log("ball-web console: " + message.message() + "@" + message.lineNumber());
                return true;
            }
        });
        File file = new File(App.i().bundledHome(), "opt/dsh/android/ball-web/" + page);
        if (!file.isFile()) {
            App.log("ball-web: missing " + file);
        }
        web.loadUrl("file://" + file.getAbsolutePath());
        return web;
    }

    private interface OnPage {
        void ready(WebView web);
    }

    /**
     * The status layer: full screen, transparent, and NOT touchable for as long
     * as it exists. These flags are set once and never changed — an expand or a
     * collapse must not touch this window at all. It draws the bubble over the
     * ball and nothing else; the ball itself is the bar window's own page.
     */
    private void showVisual() {
        visual = webView("ball.html", new Bridge(), "DshBall", false, this::onVisualReady);
        visual.setFocusable(false);
        visual.setClickable(false);
        visualParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        visualParams.gravity = Gravity.TOP | Gravity.START;
        visualParams.setTitle(WINDOW_VISUAL);
        // On this ROM a full-screen translucent overlay comes up with alpha 0.8
        // on its own. Ask for 1.0 explicitly and re-apply it once after the
        // window is added, because the system stamps its own value while adding.
        // This is the only update this window ever gets.
        visualParams.alpha = 1f;
        try {
            windowManager.addView(visual, visualParams);
        } catch (Exception error) {
            App.log("ball status window: " + error);
            visual = null;
            return;
        }
        try {
            visualParams.alpha = 1f;
            windowManager.updateViewLayout(visual, visualParams);
        } catch (Exception error) {
            App.log("ball status window alpha: " + error);
        }
    }

    /**
     * The ball, and the bar it becomes: one window, one page.
     *
     * Closed, it is exactly the ball's square and the page draws the whale in
     * it; the window itself takes the gestures. Open, it is the bar's rect and
     * the very same page shows the input field. There is no second capsule
     * anywhere, which is the whole point of the merge.
     */
    private void showBar() {
        bar = webView("composer.html", new Composer(), "DshComposer", true, this::onBarReady);
        barWebView = bar;
        // The merged page drives the ball too — its gestures arrive as
        // `BallUI.pointer(...)` — so it gets the ball bridge as well.
        bar.addJavascriptInterface(new Bridge(), "DshBall");
        bar.setFocusable(true);
        bar.setFocusableInTouchMode(true);
        bar.setOnTouchListener(touch);
        barParams = new WindowManager.LayoutParams(
                sizePx(),
                sizePx(),
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                BAR_FLAGS | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT);
        barParams.gravity = Gravity.TOP | Gravity.START;
        barParams.setTitle(WINDOW_BAR);
        // The keyboard must not move or resize this window: the bar grows out of
        // the ball and its rect is the page's rect. ADJUST_NOTHING keeps the
        // frame the app set, so the two can never disagree while the IME is up,
        // and the IME cannot push our window around the screen. The STATE flag is
        // what actually raises the keyboard when the window gains focus — without
        // it the field was focusable and the keyboard never appeared.
        barParams.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING
                | WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE;
        barParams.alpha = 1f;
        applyClosedFrame();
        try {
            windowManager.addView(bar, barParams);
        } catch (Exception error) {
            App.log("ball bar window: " + error);
            bar = null;
            return;
        }
        // Separate from the add, like the status layer: if this re-apply fails
        // the ball must still be there.
        try {
            barParams.alpha = 1f;
            windowManager.updateViewLayout(bar, barParams);
        } catch (Exception error) {
            App.log("ball bar window alpha: " + error);
        }
        logGeometry("shown");
    }

    /**
     * The status layer has nothing left to draw.
     *
     * The bubble moved onto the ball itself (the ball/bar window's page), so this
     * full-screen, never-touchable window is kept only as the shell the previous
     * revisions were verified against; it is created, it stays empty, and no
     * status ever reaches it. Removing it entirely is a one-line change once the
     * ball has run a while without it.
     */
    private void onVisualReady(WebView web) {
        visualReady = true;
        App.log("ball status layer ready (draws nothing: the bubble is on the ball)");
    }

    private void onBarReady(WebView web) {
        barReady = true;
        eval(web, "BallUI.setSize(" + sizeDp() + ")");
        // The page can finish loading after the user has already opened the bar
        // (a slow first load). It boots closed, so it has to be told.
        if (expanded) eval(web, "ComposerUI.open()");
        pushBarOrigin();
        pushStatus();
        App.log("ball bar ready: " + frameText(currentFrame()));
    }

    private void pushBarFrame() {
        if (bar == null || barParams == null || bar.getParent() == null) return;
        try {
            windowManager.updateViewLayout(bar, barParams);
        } catch (Exception error) {
            App.log("ball bar update: " + error);
        }
    }

    /** Put the window back onto the ball. The page is told separately. */
    private void applyClosedFrame() {
        if (barParams == null) return;
        int[] frame = ballFrame();
        barParams.x = frame[0];
        barParams.y = frame[1];
        barParams.width = frame[2];
        barParams.height = frame[3];
        pushBarFrame();
    }

    private void setBarFocusable(boolean focusable) {
        if (barParams == null) return;
        barParams.flags = focusable
                ? BAR_FLAGS
                : BAR_FLAGS | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        pushBarFrame();
    }

    /**
     * The window's top-left, to the page, in dp.
     *
     * The page cannot see where its window is (`innerWidth` and friends describe
     * the window, not the screen), and the alignment check needs a page-reported
     * rect in screen coordinates to compare with `dumpsys`. This is that number,
     * and nothing else depends on it.
     */
    private void pushBarOrigin() {
        if (bar == null || barParams == null) return;
        double per = density();
        eval(bar, "ComposerUI.at(" + (barParams.x / per) + "," + (barParams.y / per) + ")");
    }

    // ------------------------------------------------------------------- morph

    /**
     * Move the window from where it is to `to`, one frame at a time.
     *
     * This is the morph the user watches. The page has already started the whale
     * and the plane inside it; the window stretching is the third, and the only
     * one that decides where the bar ends up. `MORPH_MS` matches the page's own
     * timings (whale out 160 ms, plane in 240 ms).
     */
    private void morph(final int[] to, final long duration, final Runnable done) {
        // Never call a null runnable from an animator callback: this is the main
        // thread, and Throwing from onAnimationEnd kills the whole app (the
        // bubble's resize path did exactly that). Every call site has a real
        // finishing step now, and this is the belt to that pair of braces.
        final Runnable finish = done == null ? () -> { } : done;
        final int[] from = currentFrame();
        cancelMorph();
        final int generation = morphGeneration;
        App.log("ball morph " + frameText(from) + " -> " + frameText(to));
        ValueAnimator value = ValueAnimator.ofFloat(0f, 1f);
        value.setDuration(duration);
        value.setInterpolator(new PathInterpolator(0.22f, 1f, 0.36f, 1f));
        value.addUpdateListener(animation -> {
            if (generation != morphGeneration) return;
            applyFrame(lerp(from, to, (Float) animation.getAnimatedValue()));
        });
        value.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator animation) {
                if (generation != morphGeneration) return;
                morphAnimator = null;
                applyFrame(to);
                finish.run();
            }
        });
        morphAnimator = value;
        value.start();
    }

    /** Drop a running morph; its callbacks are invalidated by the generation. */
    private void cancelMorph() {
        morphGeneration++;
        if (morphAnimator != null) {
            morphAnimator.cancel();
            morphAnimator = null;
        }
    }

    private static int[] lerp(int[] from, int[] to, float t) {
        int[] frame = new int[4];
        for (int i = 0; i < 4; i++) {
            frame[i] = Math.round(from[i] + (to[i] - from[i]) * t);
        }
        return frame;
    }

    private void applyFrame(int[] frame) {
        if (barParams == null) return;
        barParams.x = frame[0];
        barParams.y = frame[1];
        barParams.width = frame[2];
        barParams.height = frame[3];
        pushBarFrame();
    }

    // ------------------------------------------------------------------ typing

    /**
     * Open the bar: the window grows out of the ball, and only when it has
     * arrived does it become focusable and ask for the keyboard.
     *
     * Nothing is shown "instantly" any more. While the window morphs it is still
     * FLAG_NOT_FOCUSABLE, so the IME cannot pop over the animation, and the page
     * inside it reveals the field as the capsule passes the ball's width.
     */
    private void expand() {
        if (expanded) return;
        if (bar == null || bar.getParent() == null) return;
        expanded = true;
        // The window now hosts a text field: the ball's gesture listener has to
        // go, or the WebView would never see a tap.
        bar.setOnTouchListener(null);
        setBarFocusable(false);
        eval(bar, "BallUI.expand()");
        pushBarOrigin();
        App.log("ball expand: centre=" + f2(centreX() / density()) + ","
                + f2(centreY() / density()) + "dp ball=" + frameText(ballFrame())
                + " -> bar=" + frameText(barFrame()));
        morph(barFrame(), MORPH_MS, this::onExpanded);
    }

    /** The window is on the bar's rect: grant it focus and bring up the IME. */
    private void onExpanded() {
        if (!expanded) return;
        setBarFocusable(true);
        bar.requestFocus();
        eval(bar, "ComposerUI.open()");
        pushBarOrigin();
        WebView web = bar;
        if (web != null) {
            web.post(() -> showIme(web));
        }
        logGeometry("expanded");
    }

    private void showIme(WebView web) {
        showIme(web, 0);
    }

    /**
     * Ask for the keyboard, and ask again if the window was not ready yet.
     *
     * The device answered `showSoftInput=false` for the first two requests even
     * though the window was focusable, focused and had a token: the field inside
     * the WebView had only just been focused in JavaScript, and the input
     * connection is not there in the same frame. Three bounded retries ride that
     * out; every attempt is logged, because "the keyboard did not come up" is
     * otherwise indistinguishable from "it was never asked".
     */
    private void showIme(final WebView web, final int attempt) {
        InputMethodManager imm = getSystemService(InputMethodManager.class);
        if (imm == null || web == null || web.getParent() == null) {
            App.log("ball ime: no service or no window");
            return;
        }
        boolean shown = false;
        try {
            web.requestFocus();
            shown = imm.showSoftInput(web, 0);
        } catch (Exception error) {
            App.log("ball ime: " + error);
            return;
        }
        App.log("ball ime: showSoftInput=" + shown + " attempt=" + attempt
                + " focusable=" + web.isFocusable() + " focused=" + web.isFocused()
                + " token=" + (web.getWindowToken() != null));
        if (!shown && attempt < 2 && expanded) {
            handler.postDelayed(() -> {
                if (expanded) showIme(web, attempt + 1);
            }, 240);
        }
    }

    private void hideIme() {
        WebView web = bar;
        if (web == null) return;
        InputMethodManager imm = getSystemService(InputMethodManager.class);
        if (imm == null) return;
        try {
            imm.hideSoftInputFromWindow(web.getWindowToken(), 0);
        } catch (Exception error) {
            App.log("ball ime hide: " + error);
        }
    }

    /**
     * Put the bar away: keyboard first, then focus, then the window shrinks back
     * onto the ball. The end of the shrink re-reads the ball's position instead
     * of trusting the one the animation started with.
     */
    private void collapse() {
        if (!expanded) return;
        expanded = false;
        hideIme();
        setBarFocusable(false);
        if (bar != null) bar.clearFocus();
        eval(bar, "BallUI.collapse()");
        App.log("ball collapse: centre=" + f2(centreX() / density()) + ","
                + f2(centreY() / density()) + "dp bar=" + frameText(currentFrame())
                + " -> ball=" + frameText(ballFrame()));
        morph(ballFrame(), MORPH_MS, this::onCollapsed);
    }

    /** The window is on the ball again: hand the gestures back to the app. */
    private void onCollapsed() {
        // Re-read, do not reuse: the ball is wherever it is now, and the window
        // has to end exactly there.
        applyClosedFrame();
        setBarFocusable(false);
        if (bar != null) bar.setOnTouchListener(touch);
        eval(bar, "BallUI.collapseDone()");
        pushBarOrigin();
        logGeometry("collapsed");
        // A status that arrived while the user was typing was held back (the bar
        // and the bubble are the same window); now there is room for it again.
        pushStatus();
    }

    // ------------------------------------------------------------------ bubble

    /**
     * The bubble: this same window, stretched off the ball to fit one line.
     *
     * The page measures the text and reports the size it needs (`DshBall.bubbleSize`),
     * because only the page knows how wide a sentence is. The app then morphs the
     * ball's square onto that rect — anchored on the ball's own edge, clamped to
     * the screen — and shrinks it back when the status goes idle. Nothing floats
     * above the ball any more, so there is no second surface to keep in step.
     */
    private void showBubbleFrame(float widthDp, float heightDp) {
        if (expanded || bar == null || bar.getParent() == null) return;
        int[] to = bubbleFrame(widthDp, heightDp);
        if (bubbleShown && to[2] == bubbleWidth && to[3] == bubbleHeight
                && to[0] == currentFrame()[0] && to[1] == currentFrame()[1]) {
            return;   // the line did not change size: nothing to animate
        }
        boolean first = !bubbleShown;
        bubbleShown = true;
        bubbleWidth = to[2];
        bubbleHeight = to[3];
        setBarFocusable(false);
        if (bar != null) bar.setOnTouchListener(touch);
        App.log("ball bubble " + (first ? "show" : "resize") + " " + frameText(to)
                + " text=" + phaseText);
        morph(to, first ? BUBBLE_IN_MS : BUBBLE_RESIZE_MS, this::onBubbleShown);
    }

    /** Fold the bubble back into the ball. */
    private void hideBubble() {
        if (!bubbleShown) return;
        bubbleShown = false;
        bubbleWidth = 0;
        bubbleHeight = 0;
        eval(bar, "BallUI.bubbleDone()");
        App.log("ball bubble hide -> " + frameText(ballFrame()));
        morph(ballFrame(), BUBBLE_OUT_MS, this::onBubbleHidden);
    }

    /**
     * The same, without the animation: the tap that dismisses the bubble is also
     * the tap that opens the bar, and the two morphs must not fight over the
     * window. The page is told, the window snaps onto the ball, then the bar
     * expands from there.
     */
    private void hideBubbleNow() {
        if (!bubbleShown) return;
        bubbleShown = false;
        bubbleWidth = 0;
        bubbleHeight = 0;
        cancelMorph();
        applyClosedFrame();
        eval(bar, "BallUI.bubbleDone()");
        App.log("ball bubble dismissed by tap -> " + frameText(currentFrame()));
    }

    private void onBubbleShown() {
        logGeometry("bubble");
    }

    private void onBubbleHidden() {
        // Same rule as a collapse: the ball may have been dragged, so read it
        // again instead of reusing the rect the animation started from.
        applyClosedFrame();
        setBarFocusable(false);
        if (bar != null) bar.setOnTouchListener(touch);
        pushBarOrigin();
        logGeometry("ball");
    }

    /**
     * The bubble's rect: `width` is what the page measured, `height` its line
     * count. The window is the bubble itself here (no 8 dp inset like the bar):
     * the capsule fills it edge to edge.
     */
    private int[] bubbleFrame(float widthDp, float heightDp) {
        int maxWidth = Math.min(screenWidth(),
                Math.round(screenWidth() * BUBBLE_WIDTH_FRACTION));
        int maxHeight = Math.max(sizePx(),
                dp(BUBBLE_LINES * BUBBLE_LINE_DP + BUBBLE_VPAD_DP));
        int width = Math.round(widthDp * density());
        int height = Math.round(heightDp * density());
        width = Math.max(sizePx(), Math.min(width, maxWidth));
        height = Math.max(sizePx(), Math.min(height, maxHeight));
        int half = sizePx() / 2;
        int left = centreX() < screenWidth() / 2 ? centreX() - half : centreX() + half - width;
        left = Math.max(0, Math.min(left, Math.max(0, screenWidth() - width)));
        int top = centreY() - height / 2;
        top = Math.max(0, Math.min(top, Math.max(0, screenBottom() - height)));
        return new int[]{left, top, width, height};
    }

    private void logGeometry(String what) {
        App.log("ball " + what + ": centre=" + f2(centreX() / density()) + ","
                + f2(centreY() / density()) + "dp size=" + sizeDp()
                + "dp expanded=" + expanded
                + " bar=" + (bar != null && bar.getParent() != null)
                + " window=" + frameText(currentFrame()));
    }

    private void eval(WebView web, String script) {
        if (web == null) return;
        web.post(() -> {
            try {
                web.evaluateJavascript(script, null);
            } catch (Exception error) {
                App.log("ball-web eval: " + error);
            }
        });
    }

    private static String quote(String text) {
        return text == null ? "\"\"" : JSONObject.quote(text);
    }

    // -------------------------------------------------------------------- state

    /**
     * The status channel. `ball` in the sandbox (or the app) says what is
     * happening; the status page renders it, including the rotating frames and
     * labels.
     */
    static void setState(String nextPhase, String text) {
        BallService service = live;
        if (service == null) return;
        String value = text == null ? "" : text.trim();
        service.handler.post(() -> service.applyState(nextPhase, value));
    }

    /** The current state, for GET /ball/state — the page reads it to stay out of the way. */
    static JSONObject stateJson() {
        JSONObject answer = new JSONObject();
        BallService service = live;
        try {
            answer.put("running", running);
            answer.put("phase", service == null ? "idle" : service.phase);
            answer.put("text", service == null ? "" : service.phaseText);
            answer.put("age", service == null || service.phaseAt == 0
                    ? 0 : System.currentTimeMillis() - service.phaseAt);
            answer.put("expanded", service != null && service.expanded);
        } catch (Exception ignored) {
        }
        return answer;
    }

    /** A line from outside (the page, the agent's tools, a delivery result). */
    static void sayFromOutside(String text) {
        BallService service = live;
        if (service == null || text == null || text.trim().isEmpty()) return;
        String trimmed = text.trim();
        final String line = trimmed.length() > 180 ? trimmed.substring(0, 180) + "…" : trimmed;
        service.handler.post(() -> service.notice(line));
    }

    static void onDeliveryResult(String status) {
        BallService service = live;
        if (service == null) return;
        String text;
        if ("ball".equals(status)) text = service.getString(R.string.ball_to_session);
        else if ("pasted".equals(status)) text = service.getString(R.string.ball_sent);
        else if ("clipboard".equals(status)) text = service.getString(R.string.ball_copied);
        else if ("no-composer".equals(status)) text = service.getString(R.string.ball_no_composer);
        else if ("empty".equals(status)) text = service.getString(R.string.ball_empty);
        else text = service.getString(R.string.ball_failed) + "（" + status + "）";
        final String line = text;
        service.handler.post(() -> service.notice(line));
    }

    private void applyState(String nextPhase, String text) {
        phase = nextPhase == null || nextPhase.isEmpty() ? "idle" : nextPhase;
        phaseText = text == null ? "" : text;
        phaseAt = System.currentTimeMillis();
        handler.removeCallbacks(stale);
        handler.removeCallbacks(doneHide);
        if (!"idle".equals(phase)) handler.postDelayed(stale, STALE_MS + 500);
        if ("done".equals(phase)) handler.postDelayed(doneHide, DONE_MS);
        pushStatus();
    }

    /** A ✓ line is a look at the finished step, not a state that stays. */
    private final Runnable doneHide = () -> {
        if ("done".equals(phase)) applyState("idle", "");
    };

    /**
     * The phase, into the one window that can show it.
     *
     * The bubble IS the ball window now, so a status can only be shown while the
     * ball is itself: with the typing bar open the same window is busy holding an
     * input field, and the status waits (onCollapsed pushes it again). That is the
     * whole mutual exclusion — one window, one of {ball+bubble, typing bar}.
     */
    private void pushStatus() {
        if (bar == null || bar.getParent() == null) return;
        if (expanded) return;
        if ("idle".equals(phase)) {
            hideBubble();
            return;
        }
        eval(bar, "BallUI.bubble(" + quote(phase) + ", " + quote(phaseText) + ")");
    }

    /**
     * A short line that is not a phase: "你：…", a delivery result, an error.
     *
     * It goes through the same window and the same page as a phase ("say" renders
     * a plain line without the spinner), and it has a lifetime: after SAY_MS the
     * bubble folds back into the ball on its own.
     */
    private void notice(String text) {
        if (text == null || text.trim().isEmpty()) return;
        handler.removeCallbacks(sayHide);
        applyState("say", text.trim());
        handler.postDelayed(sayHide, SAY_MS);
    }

    private final Runnable sayHide = () -> {
        if ("say".equals(phase)) applyState("idle", "");
    };

    // -------------------------------------------------------------------- voice

    private void startListening() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            notice(getString(R.string.ball_no_voice));
            return;
        }
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            notice(getString(R.string.ball_no_mic));
            return;
        }
        if (recognizer == null) recognizer = SpeechRecognizer.createSpeechRecognizer(this);
        recognizer.setRecognitionListener(new Listener());
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toString());
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        listening = true;
        setListeningUi(true);
        try {
            recognizer.startListening(intent);
        } catch (Exception error) {
            listening = false;
            setListeningUi(false);
            notice(String.valueOf(error.getMessage()));
        }
    }

    private void stopListening() {
        stopListening(false);
    }

    private void stopListening(boolean deliver) {
        listening = false;
        setListeningUi(false);
        if (recognizer == null) return;
        try {
            if (deliver) recognizer.stopListening();
            else recognizer.cancel();
        } catch (Exception ignored) {
        }
    }

    /** The listening flag, to both pages: the bar's field and the bubble. */
    private void setListeningUi(boolean on) {
        eval(bar, "BallUI.setListening(" + on + ")");
    }

    /**
     * Words the recogniser produced, into the surface the user is looking at.
     *
     * Typing bar open: they belong in its input box. Otherwise they are a line on
     * the ball itself, with the same lifetime a notice has.
     */
    private void heardText(String text) {
        if (expanded) {
            eval(bar, "ComposerUI.heard(" + quote(text) + ")");
            return;
        }
        if (text != null && !text.trim().isEmpty()) notice(text.trim());
    }

    private final class Listener implements RecognitionListener {
        @Override
        public void onPartialResults(Bundle partial) {
            String text = first(partial);
            if (text != null) {
                heard = text;
                heardText(text);
            }
        }

        @Override
        public void onResults(Bundle results) {
            listening = false;
            setListeningUi(false);
            String text = first(results);
            if (text == null || text.trim().isEmpty()) {
                notice(getString(R.string.ball_heard_nothing));
                return;
            }
            String clean = text.trim();
            heardText(clean);
            // With the bar open the words belong in its input box; without it the
            // ball hands them straight to its own conversation.
            if (!expanded) {
                Assist.deliverToBall(clean);
            }
        }

        @Override
        public void onError(int code) {
            listening = false;
            setListeningUi(false);
            if (heard != null && !heard.trim().isEmpty()) {
                String text = heard.trim();
                heardText(text);
                if (!expanded) Assist.deliverToBall(text);
                return;
            }
            notice(code == SpeechRecognizer.ERROR_NO_MATCH
                            || code == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
                            ? getString(R.string.ball_heard_nothing)
                            : getString(R.string.ball_voice_failed) + " (" + code + ")");
        }

        private String first(Bundle bundle) {
            if (bundle == null) return null;
            ArrayList<String> values = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (values == null || values.isEmpty()) return null;
            return values.get(0);
        }

        @Override public void onReadyForSpeech(Bundle params) { }
        @Override public void onBeginningOfSpeech() { }
        @Override public void onRmsChanged(float rms) { }
        @Override public void onBufferReceived(byte[] buffer) { }
        @Override public void onEndOfSpeech() { }
        @Override public void onEvent(int type, Bundle params) { }
    }

    /**
     * The ball's gestures, taken by the bar window itself while it is closed.
     *
     * They are forwarded to the page, which owns how the ball looks while it is
     * pressed, dragged or held. The app owns where the ball is: the window
     * follows the finger and the ball's position follows the window.
     */
    private final class Hit implements View.OnTouchListener {
        private float startX;
        private float startY;
        /** The box origin when the finger went down; the page gets the delta. */
        private int originX;
        private int originY;
        private boolean moved;
        private boolean holding;
        private boolean touching;

        private final Runnable hold = () -> {
            if (!touching || moved) return;
            holding = true;
            pointer("hold", 0, 0);
            heard = null;
            startListening();
        };

        @Override
        public boolean onTouch(View view, MotionEvent event) {
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    startX = event.getRawX();
                    startY = event.getRawY();
                    originX = ballX;
                    originY = ballY;
                    moved = false;
                    holding = false;
                    touching = true;
                    pointer("down", 0, 0);
                    handler.postDelayed(hold, HOLD_MS);
                    return true;
                case MotionEvent.ACTION_MOVE: {
                    if (!touching) return true;
                    float dx = event.getRawX() - startX;
                    float dy = event.getRawY() - startY;
                    if (!moved && Math.hypot(dx, dy) > dp(DRAG_SLOP_DP)) {
                        moved = true;
                        handler.removeCallbacks(hold);
                        if (holding) {
                            holding = false;
                            stopListening(true);
                        }
                        pointer("lift", 0, 0);
                    }
                    if (moved) {
                        dragTo(originX + dx, originY + dy);
                        pointer("move", dx / density(), dy / density());
                    }
                    return true;
                }
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    touching = false;
                    handler.removeCallbacks(hold);
                    if (moved) {
                        remember();
                        pointer("drop", 0, 0);
                    } else if (holding) {
                        holding = false;
                        stopListening(true);
                    } else {
                        // A tap on the ball opens the bar — and a tap on the bubble
                        // (the same window, stretched) does the same thing, just
                        // folding the bubble away first so the morph has one
                        // starting point instead of two.
                        if (bubbleShown) hideBubbleNow();
                        expand();
                    }
                    return true;
            }
            return false;
        }
    }

    /** Move the ball (box origin) to a raw position, clamped, and redraw. */
    private void dragTo(float x, float y) {
        ballX = clampX(x);
        ballY = clampY(y);
        applyClosedFrame();
    }

    private void remember() {
        App.i().prefs.edit()
                .putInt(PREF_BALL_X, ballX)
                .putInt(PREF_BALL_Y, ballY)
                .apply();
    }

    private void pointer(String kind, float dx, float dy) {
        eval(bar, "BallUI.pointer(" + quote(kind) + "," + dx + "," + dy + ")");
    }

    // ------------------------------------------------------------------- bridge

    /**
     * What `ball.html` (the status layer) and `composer.html` (the ball/bar
     * window) may ask the app for. Every number is dp — which is also the page's
     * CSS pixel, because the device pixel ratio is the density.
     */
    private final class Bridge {

        @JavascriptInterface
        public float size() {
            return sizeDp();
        }

        @JavascriptInterface
        public float pad() {
            return PAD_DP;
        }

        /**
         * The screen width in dp.
         *
         * The page's own `vw` is the WINDOW, not the display — the ball/bar window
         * is a small overlay — so a "half the screen" cap needs this number.
         */
        @JavascriptInterface
        public float screen() {
            return screenWidth() / BallService.this.density();
        }

        /**
         * What the page measured: the bubble it wants, in dp.
         *
         * Two arguments on purpose — the Android bridge drops a call whose count
         * does not match the signature.
         */
        @JavascriptInterface
        public void bubbleSize(final float widthDp, final float heightDp) {
            handler.post(() -> showBubbleFrame(widthDp, heightDp));
        }

        /** The device pixel ratio, for a page that really needs a raw pixel. */
        @JavascriptInterface
        public float density() {
            return BallService.this.density();
        }

        /** The ball's centre on screen, in dp. */
        @JavascriptInterface
        public float x() {
            return centreX() / BallService.this.density();
        }

        @JavascriptInterface
        public float y() {
            return centreY() / BallService.this.density();
        }

        /** The mark the user picked in the settings page, or "" for the built-in. */
        @JavascriptInterface
        public String image() {
            return App.i().prefs.getString(PREF_IMAGE, "");
        }

        @JavascriptInterface
        public String side() {
            return centreX() < screenWidth() / 2 ? "left" : "right";
        }

        /** Move by a drag delta in dp, and remember where it lands. */
        @JavascriptInterface
        public void move(final float dx, final float dy) {
            handler.post(() -> {
                if (expanded) return;
                float per = density();
                dragTo(ballX + dx * per, ballY + dy * per);
                remember();
            });
        }

        @JavascriptInterface
        public void expandRequest() {
            handler.post(BallService.this::expand);
        }

        @JavascriptInterface
        public void collapse() {
            handler.post(BallService.this::collapse);
        }

        @JavascriptInterface
        public void hold(final boolean down) {
            handler.post(() -> {
                if (down) {
                    heard = null;
                    startListening();
                } else {
                    stopListening(true);
                }
            });
        }

        /** The page handed over a sentence: its own conversation, see Assist. */
        @JavascriptInterface
        public void deliver(final String text) {
            handler.post(() -> BallService.this.deliver(text));
        }

        @JavascriptInterface
        public void log(final String message) {
            App.log("ball-web: " + message);
        }

        // ---------------------------------------------------- additive helpers
        // Not part of the frozen page API; harmless to a page that ignores them.

        @JavascriptInterface
        public String state() {
            return stateJson().toString();
        }

        @JavascriptInterface
        public void ready() {
            handler.post(BallService.this::pushStatus);
        }

        @JavascriptInterface
        public boolean expanded() {
            return expanded;
        }

        @JavascriptInterface
        public void toast(final String message) {
            handler.post(() -> Toast.makeText(BallService.this, message, Toast.LENGTH_SHORT).show());
        }
    }

    /**
     * What the ball/bar page may ask the app for: the frozen `send` and `close`
     * of the old composer page, plus `ime` — the page's way of saying "the input
     * has focus now, raise the keyboard" once the window is focusable.
     */
    private final class Composer {

        @JavascriptInterface
        public void send(final String text) {
            handler.post(() -> {
                if (text == null || text.trim().isEmpty()) {
                    notice(getString(R.string.ball_empty));
                    return;
                }
                String line = text.trim();
                collapse();
                notice(getString(R.string.ball_you) + line);
                Assist.deliverToBall(line);
            });
        }

        @JavascriptInterface
        public void close() {
            handler.post(BallService.this::collapse);
        }

        /** The field has focus: raise the IME if we are the focusable window. */
        @JavascriptInterface
        public void ime() {
            handler.post(() -> {
                if (expanded) showIme(bar);
            });
        }

        @JavascriptInterface
        public void log(final String message) {
            App.log("composer-web: " + message);
        }
    }

    /**
     * The window's own WebView, with the keyboard's back key handled.
     *
     * The bar is the only focusable window of ours, so this is the only place a
     * BACK press can arrive while the user is typing. Without it the IME hides
     * and the bar stays open, with the keyboard gone and no obvious way back to
     * the ball.
     */
    private final class BarWeb extends WebView {
        BarWeb(Context context) {
            super(context);
        }

        @Override
        public boolean onKeyPreIme(int keyCode, KeyEvent event) {
            if (keyCode == KeyEvent.KEYCODE_BACK && expanded) {
                if (event.getAction() == KeyEvent.ACTION_DOWN) collapse();
                return true;
            }
            return super.onKeyPreIme(keyCode, event);
        }
    }

    /** One place for "the page handed over a sentence". */
    private void deliver(String text) {
        if (text == null || text.trim().isEmpty()) {
            notice(getString(R.string.ball_empty));
            return;
        }
        String line = text.trim();
        notice(getString(R.string.ball_you) + line);
        Assist.deliverToBall(line);
    }
}
