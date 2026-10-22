package dev.dsh.android;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Size;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The native half of ANDROID-BRIDGE.md: {@code window.DSHNative}.
 *
 * The mobile shell's attach sheet looks for a JS object with a single
 * {@code request(json)} method on every page load. When it is there, the sheet
 * shows the "最近照片" strip and the camera / gallery / files buttons go through
 * {@code pickImages} / {@code pickFiles}; when it is missing (or any call fails or
 * times out) the plugin hides the strip and falls back to {@code <input type=file>},
 * which the WebView turns into {@link MainActivity}'s file chooser. Both paths
 * exist on purpose — this class is the first one, the file chooser stays the
 * safety net.
 *
 * Contract (ANDROID-BRIDGE.md §2/§3):
 *   * {@code request} is called on the WebView's JavaBridge thread and must
 *     return at once; parsing is quick, all real work is dispatched;
 *   * every answer goes back on the UI thread as
 *     {@code window.__dshNativeResult(id, jsonString)};
 *   * ids are opaque to Android and echoed verbatim;
 *   * picked files are handed over as a loopback URL from {@link AssetServer},
 *     never as a content:// URI.
 */
public final class DshNativeBridge {

    private static final int REQ_PICK_IMAGES = 0x2001;
    private static final int REQ_PICK_FILES = 0x2002;
    private static final int REQ_CAMERA = 0x2003;

    /** The plugin asks for 20; the bridge clamps so a slow device never hangs. */
    private static final int MAX_RECENT = 20;
    /** Long edge of the base64 thumbnails the plugin drops into an <img src>. */
    private static final int THUMB_EDGE = 240;
    private static final int THUMB_MAX_BYTES = 40 * 1024;
    /** The plugin gives recentPhotos 1.8 s; spend less than that and answer. */
    private static final long RECENT_BUDGET_MS = 1200L;
    /** Where a finished capture is copied before its MediaStore row is deleted. */
    private static final String CAPTURE_DIR = "dsh-captures";
    /** How long the private copy stays on disk for the page to fetch. */
    private static final long CAPTURE_TTL_MS = 10 * 60 * 1000L;
    /** Preferences file for the one capture fallback flag this class keeps. */
    private static final String CAPTURE_PREFS = "dsh_captures";
    /**
     * Set after a camera that answered OK but wrote nothing: some ROM cameras
     * cannot write a pending row, so the next capture asks for a plain one.
     */
    private static final String PREF_PENDING_REFUSED = "pending_refused";

    private final WeakReference<Activity> activityRef;
    private final WeakReference<WebView> webRef;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "dsh-native-bridge");
        thread.setDaemon(true);
        return thread;
    });
    private final AssetServer server;
    private final Map<String, Recent> recent =
            new LinkedHashMap<String, Recent>(64, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Recent> eldest) {
                    return size() > 100;
                }
            };

    private Uri cameraOutput;
    private String pendingId;
    private String pendingMethod;
    private JSONObject pendingParams;

    private static final class Recent {
        final Uri uri;
        final String name;
        final String mime;

        Recent(Uri uri, String name, String mime) {
            this.uri = uri;
            this.name = name;
            this.mime = mime;
        }
    }

    DshNativeBridge(Activity activity, WebView web) {
        this.activityRef = new WeakReference<>(activity);
        this.webRef = new WeakReference<>(web);
        this.server = new AssetServer(activity);
        // A previous process may have died between a capture and its cleanup;
        // those rows and private copies are unreachable now, so drop them.
        io.execute(() -> cleanupStaleCaptures(activityRef.get()));
    }

    /** Close the content server and stop the worker; the activity is going away. */
    void destroy() {
        server.stop();
        io.shutdownNow();
        main.removeCallbacksAndMessages(null);
        // A camera that never answered leaves a pending row behind; it is ours
        // and invisible, so delete it now instead of waiting for the next start.
        deleteCaptureRow(activityRef.get(), cameraOutput);
        cameraOutput = null;
        pendingId = null;
        pendingMethod = null;
        pendingParams = null;
    }

    // --------------------------------------------------------------- JS entry

    /**
     * One call in, one result out. Runs on the JavaBridge thread: no IO here,
     * no waiting, no dialog spawning (that is posted to the UI thread).
     */
    @JavascriptInterface
    public void request(String raw) {
        try {
            JSONObject request = new JSONObject(raw);
            String id = request.optString("id", "");
            String method = request.optString("method", "");
            JSONObject params = request.optJSONObject("params");
            dispatch(id, method, params == null ? new JSONObject() : params);
        } catch (Throwable error) {
            App.log("native bridge request rejected: " + error);
        }
    }

    private void dispatch(String id, String method, JSONObject params) {
        if (id == null || id.isEmpty() || method == null || method.isEmpty()) return;
        switch (method) {
            case "capabilities":
                respond(id, capabilities());
                return;
            case "recentPhotos":
                io.execute(() -> respond(id, recentPhotos(params)));
                return;
            case "openRecent":
                io.execute(() -> respond(id, openRecent(params)));
                return;
            case "pickImages":
            case "pickFiles":
                main.post(() -> startPick(id, method, params));
                return;
            default:
                respond(id, error("unsupported", "不支持的方法：" + method));
        }
    }

    // ------------------------------------------------------------ capabilities

    private JSONObject capabilities() {
        JSONObject answer = ok();
        try {
            answer.put("version", 1);
            answer.put("recentPhotos", true);
            // Both pickers are implemented below; the plugin only routes the
            // buttons through native when this flag is true.
            answer.put("pickers", true);
            answer.put("resumableUpload", false);
        } catch (Throwable ignored) {
        }
        return answer;
    }

    // ------------------------------------------------------------- recentPhotos

    private JSONObject recentPhotos(JSONObject params) {
        JSONArray photos = new JSONArray();
        Activity activity = activityRef.get();
        if (activity == null) return photos(photos);
        int limit = Math.max(1, Math.min(params.optInt("limit", MAX_RECENT), MAX_RECENT));
        long deadline = SystemClock.elapsedRealtime() + RECENT_BUDGET_MS;
        ContentResolver resolver = activity.getContentResolver();
        String[] projection = {
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.MIME_TYPE,
                MediaStore.Images.Media.WIDTH,
                MediaStore.Images.Media.HEIGHT,
                MediaStore.Images.Media.DATE_TAKEN,
                MediaStore.Images.Media.DATE_ADDED,
        };
        String order = MediaStore.Images.Media.DATE_TAKEN + " DESC, "
                + MediaStore.Images.Media.DATE_ADDED + " DESC";
        Cursor cursor = null;
        try {
            cursor = resolver.query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    projection, null, null, order);
            if (cursor == null) return photos(photos);
            int idAt = cursor.getColumnIndex(MediaStore.Images.Media._ID);
            int nameAt = cursor.getColumnIndex(MediaStore.Images.Media.DISPLAY_NAME);
            int mimeAt = cursor.getColumnIndex(MediaStore.Images.Media.MIME_TYPE);
            int widthAt = cursor.getColumnIndex(MediaStore.Images.Media.WIDTH);
            int heightAt = cursor.getColumnIndex(MediaStore.Images.Media.HEIGHT);
            int takenAt = cursor.getColumnIndex(MediaStore.Images.Media.DATE_TAKEN);
            int addedAt = cursor.getColumnIndex(MediaStore.Images.Media.DATE_ADDED);
            while (cursor.moveToNext() && photos.length() < limit) {
                // Answer before the plugin's 1.8 s timeout, even when the album
                // is huge and decoding every thumbnail would not finish in time.
                if (photos.length() > 0 && SystemClock.elapsedRealtime() > deadline) break;
                long id = idAt < 0 ? -1 : cursor.getLong(idAt);
                if (id < 0) continue;
                Uri uri = ContentUris.withAppendedId(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
                String name = nameAt < 0 || cursor.isNull(nameAt) ? null : cursor.getString(nameAt);
                String mime = mimeAt < 0 || cursor.isNull(mimeAt) ? null : cursor.getString(mimeAt);
                long taken = takenAt < 0 || cursor.isNull(takenAt) ? 0 : cursor.getLong(takenAt);
                if (taken <= 0 && addedAt >= 0 && !cursor.isNull(addedAt)) {
                    taken = cursor.getLong(addedAt) * 1000L;
                }
                String thumb = thumbnail(uri);
                if (thumb == null) continue;
                String key = "media:" + id;
                recent.put(key, new Recent(uri, name, mime));
                JSONObject photo = new JSONObject();
                photo.put("id", key);
                photo.put("thumbDataUrl", thumb);
                photo.put("width", widthAt < 0 ? 0 : cursor.getInt(widthAt));
                photo.put("height", heightAt < 0 ? 0 : cursor.getInt(heightAt));
                photo.put("takenAt", taken / 1000L);
                photo.put("mime", mime == null ? "image/jpeg" : mime);
                photo.put("name", name == null ? "IMG_" + id + ".jpg" : name);
                photos.put(photo);
            }
        } catch (Throwable error) {
            // No gallery permission (or no gallery): an empty list is the
            // documented answer, and the plugin hides the strip.
            App.log("recentPhotos failed: " + error);
        } finally {
            if (cursor != null) {
                try {
                    cursor.close();
                } catch (Throwable ignored) {
                }
            }
        }
        return photos(photos);
    }

    private JSONObject photos(JSONArray photos) {
        JSONObject answer = ok();
        try {
            answer.put("photos", photos);
        } catch (Throwable ignored) {
        }
        return answer;
    }

    /** A 240 px JPEG data URL, or null when the item cannot be decoded. */
    private String thumbnail(Uri uri) {
        Activity activity = activityRef.get();
        if (activity == null) return null;
        Bitmap bitmap = null;
        try {
            ContentResolver resolver = activity.getContentResolver();
            if (Build.VERSION.SDK_INT >= 29) {
                bitmap = resolver.loadThumbnail(uri, new Size(THUMB_EDGE, THUMB_EDGE), null);
            } else {
                long id = ContentUris.parseId(uri);
                bitmap = MediaStore.Images.Thumbnails.getThumbnail(resolver, id,
                        MediaStore.Images.Thumbnails.MINI_KIND, null);
            }
        } catch (Throwable error) {
            return null;
        }
        if (bitmap == null) return null;
        try {
            Bitmap scaled = scaleDown(bitmap);
            byte[] jpeg = encodeJpeg(scaled);
            if (jpeg == null) return null;
            return "data:image/jpeg;base64," + Base64.encodeToString(jpeg, Base64.NO_WRAP);
        } finally {
            if (!bitmap.isRecycled()) bitmap.recycle();
        }
    }

    private static Bitmap scaleDown(Bitmap source) {
        int width = source.getWidth();
        int height = source.getHeight();
        int longer = Math.max(width, height);
        if (longer <= THUMB_EDGE) return source;
        float scale = (float) THUMB_EDGE / longer;
        int targetWidth = Math.max(1, Math.round(width * scale));
        int targetHeight = Math.max(1, Math.round(height * scale));
        Bitmap scaled = Bitmap.createScaledBitmap(source, targetWidth, targetHeight, true);
        if (scaled != source) source.recycle();
        return scaled;
    }

    private static byte[] encodeJpeg(Bitmap bitmap) {
        int[] qualities = {82, 72, 62, 50};
        for (int quality : qualities) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out);
            byte[] bytes = out.toByteArray();
            if (bytes.length <= THUMB_MAX_BYTES) return bytes;
        }
        return null;
    }

    // ---------------------------------------------------------------- openRecent

    private JSONObject openRecent(JSONObject params) {
        Activity activity = activityRef.get();
        if (activity == null) return error("unavailable", "应用已关闭");
        String id = params.optString("id", "");
        if (id.isEmpty()) return error("bad_request", "缺少照片 id");
        Uri uri = null;
        String name = null;
        String mime = null;
        Recent cached = recent.get(id);
        if (cached != null) {
            uri = cached.uri;
            name = cached.name;
            mime = cached.mime;
        } else if (id.startsWith("media:")) {
            try {
                long mediaId = Long.parseLong(id.substring("media:".length()));
                uri = ContentUris.withAppendedId(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI, mediaId);
            } catch (NumberFormatException ignored) {
            }
        }
        if (uri == null) return error("not_found", "找不到这张照片");
        try {
            String[] projection = {OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
            try (Cursor cursor = activity.getContentResolver()
                    .query(uri, projection, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int nameAt = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (nameAt >= 0 && !cursor.isNull(nameAt)) name = cursor.getString(nameAt);
                }
            }
        } catch (Throwable ignored) {
        }
        if (mime == null || mime.isEmpty()) {
            try {
                mime = activity.getContentResolver().getType(uri);
            } catch (Throwable ignored) {
            }
        }
        if (mime == null || mime.isEmpty()) mime = "image/jpeg";
        if (name == null || name.isEmpty()) name = "photo.jpg";
        long size = sizeOf(activity, uri);
        String url = server.publish(uri, name, mime, size);
        if (url == null) return error("server_unavailable", "本机内容服务启动失败");
        JSONObject answer = ok();
        try {
            answer.put("url", url);
            answer.put("name", name);
            answer.put("mime", mime);
            answer.put("size", size);
        } catch (Throwable ignored) {
        }
        return answer;
    }

    // ------------------------------------------------------------------- pickers

    private void startPick(String id, String method, JSONObject params) {
        Activity activity = activityRef.get();
        if (activity == null) {
            respond(id, error("unavailable", "应用已关闭"));
            return;
        }
        if (pendingId != null) {
            respond(id, error("busy", "已有选择器正在打开"));
            return;
        }
        pendingId = id;
        pendingMethod = method;
        pendingParams = params;
        try {
            if ("pickImages".equals(method)) {
                String source = params.optString("source", "gallery");
                boolean multiple = params.optBoolean("multiple", true);
                int max = Math.max(1, Math.min(params.optInt("max", 20), 20));
                if ("camera".equals(source)) {
                    startCamera(activity);
                    return;
                }
                Intent pick = new Intent();
                if (Build.VERSION.SDK_INT >= 33) {
                    pick.setAction(MediaStore.ACTION_PICK_IMAGES);
                    if (multiple) {
                        pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                        pick.putExtra(MediaStore.EXTRA_PICK_IMAGES_MAX, max);
                    }
                } else {
                    pick.setAction(Intent.ACTION_GET_CONTENT);
                    pick.addCategory(Intent.CATEGORY_OPENABLE);
                    pick.setType("image/*");
                    if (multiple) {
                        pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    }
                }
                activity.startActivityForResult(pick, REQ_PICK_IMAGES);
                return;
            }
            boolean multiple = params.optBoolean("multiple", true);
            Intent documents = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            documents.addCategory(Intent.CATEGORY_OPENABLE);
            documents.setType("*/*");
            if (multiple) {
                documents.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            }
            activity.startActivityForResult(documents, REQ_PICK_FILES);
        } catch (Throwable error) {
            App.log("native pick failed: " + error);
            finishPick(error("picker_failed", "无法打开系统选择器"));
        }
    }

    private void startCamera(Activity activity) {
        Uri target = createCameraTarget(activity);
        if (target == null) {
            finishPick(error("camera_unavailable", "相机存储不可用"));
            return;
        }
        cameraOutput = target;
        Intent capture = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        capture.putExtra(MediaStore.EXTRA_OUTPUT, target);
        capture.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            activity.startActivityForResult(capture, REQ_CAMERA);
        } catch (Throwable error) {
            App.log("native camera intent failed: " + error);
            cameraOutput = null;
            deleteCaptureRow(activity, target);
            finishPick(error("camera_unavailable", "无法打开系统相机"));
        }
    }

    /**
     * A MediaStore row the camera writes into, invisible to the gallery while it
     * exists.
     *
     * A photo taken for a chat message is an attachment, not something the user
     * asked to keep, so it must not show up in the phone's album. Android 10+
     * hides an inserted row while {@code IS_PENDING=1}: it is not visible to the
     * gallery or to other apps, but this app (and the camera, through the URI
     * grant) can still write and read it. This class never clears the flag: once
     * the camera answers, the bytes are copied into the app's private cache and
     * the row is deleted together with the file behind it. Releases before
     * Android 10 have no pending flag, so the row lives in the shared volume for
     * the second between the capture and that cleanup.
     */
    static Uri createCameraTarget(Activity activity) {
        if (activity == null) return null;
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME,
                "dsh_" + System.currentTimeMillis() + ".jpg");
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
        if (Build.VERSION.SDK_INT >= 29 && !pendingRowsRefused(activity)) {
            ContentValues pending = new ContentValues(values);
            pending.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri target = insertCapture(activity, pending);
            if (target != null) return target;
            // The app targets 28, so this row goes through the provider's legacy
            // path; if that path refuses the pending flag the camera still needs
            // somewhere to write. The capture is deleted right after it is read,
            // so the fallback costs at most a moment in the shared volume.
            App.log("native camera pending row refused; using a plain row");
        }
        return insertCapture(activity, values);
    }

    private static Uri insertCapture(Activity activity, ContentValues values) {
        try {
            return activity.getContentResolver().insert(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        } catch (Throwable error) {
            App.log("native camera target failed: " + error);
            return null;
        }
    }

    /** Has this device shown that its camera cannot write a pending row? */
    private static boolean pendingRowsRefused(Activity activity) {
        try {
            return activity.getSharedPreferences(CAPTURE_PREFS, Activity.MODE_PRIVATE)
                    .getBoolean(PREF_PENDING_REFUSED, false);
        } catch (Throwable ignored) {
            return false;
        }
    }

    /**
     * Remember that the camera answered OK without writing anything.
     *
     * The likely cause is a ROM camera that refuses the pending row, so the next
     * capture asks for a plain (briefly visible) one instead of failing forever.
     */
    static void noteCaptureFailure(Activity activity) {
        if (activity == null) return;
        try {
            activity.getSharedPreferences(CAPTURE_PREFS, Activity.MODE_PRIVATE)
                    .edit().putBoolean(PREF_PENDING_REFUSED, true).apply();
        } catch (Throwable ignored) {
        }
    }

    /** True only once the camera has actually put bytes behind the capture row. */
    static boolean captureReady(Activity activity, Uri uri) {
        return captureSize(activity, uri) > 0;
    }

    /** Size of a capture row: MediaStore first, the stream itself as the fallback. */
    static long captureSize(Activity activity, Uri uri) {
        if (activity == null || uri == null) return -1;
        try (Cursor cursor = activity.getContentResolver().query(uri,
                new String[]{OpenableColumns.SIZE}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int at = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (at >= 0 && !cursor.isNull(at) && cursor.getLong(at) > 0) {
                    return cursor.getLong(at);
                }
            }
        } catch (Throwable ignored) {
        }
        return sizeOf(activity, uri);
    }

    /** Delete a capture row; MediaStore removes the file behind it as well. */
    static void deleteCaptureRow(Activity activity, Uri uri) {
        if (activity == null || uri == null) return;
        try {
            activity.getContentResolver().delete(uri, null, null);
        } catch (Throwable error) {
            App.log("native camera cleanup failed: " + error);
        }
    }

    /** Copy a finished capture into the private cache; null when nothing usable came back. */
    private File copyCaptureToCache(Activity activity, Uri source, String name) {
        File dir = new File(activity.getCacheDir(), CAPTURE_DIR);
        if (!dir.isDirectory() && !dir.mkdirs()) return null;
        File target = new File(dir, name);
        try (InputStream in = activity.getContentResolver().openInputStream(source);
             OutputStream out = new FileOutputStream(target)) {
            if (in == null) throw new IOException("capture stream unavailable");
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) > 0) out.write(buffer, 0, read);
        } catch (Throwable error) {
            App.log("native camera copy failed: " + error);
            try {
                target.delete();
            } catch (Throwable ignored) {
            }
            return null;
        }
        if (target.length() <= 0) {
            try {
                target.delete();
            } catch (Throwable ignored) {
            }
            return null;
        }
        return target;
    }

    /** The private copy is only needed until the page fetched it; drop it later. */
    private void scheduleCaptureCleanup(File file) {
        if (file == null) return;
        main.postDelayed(() -> {
            try {
                file.delete();
            } catch (Throwable ignored) {
            }
        }, CAPTURE_TTL_MS);
    }

    /**
     * Remove captures a previous process left behind: private copies under
     * {@code cache/dsh-captures} and pending MediaStore rows this app still owns.
     * Pending rows are invisible to the gallery, but they still occupy the volume.
     */
    static void cleanupStaleCaptures(Activity activity) {
        if (activity == null) return;
        try {
            File dir = new File(activity.getCacheDir(), CAPTURE_DIR);
            File[] files = dir.listFiles();
            if (files != null) {
                for (File file : files) {
                    try {
                        file.delete();
                    } catch (Throwable ignored) {
                    }
                }
            }
        } catch (Throwable ignored) {
        }
        if (Build.VERSION.SDK_INT < 29) return;
        Cursor cursor = null;
        try {
            cursor = activity.getContentResolver().query(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    new String[]{MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME},
                    MediaStore.MediaColumns.IS_PENDING + "=1", null, null);
            if (cursor == null) return;
            int idAt = cursor.getColumnIndex(MediaStore.MediaColumns._ID);
            int nameAt = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME);
            while (cursor.moveToNext()) {
                long id = idAt < 0 ? -1 : cursor.getLong(idAt);
                String name = nameAt < 0 || cursor.isNull(nameAt) ? null : cursor.getString(nameAt);
                if (id < 0 || name == null || !name.startsWith("dsh_")) continue;
                deleteCaptureRow(activity, ContentUris.withAppendedId(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id));
            }
        } catch (Throwable error) {
            App.log("stale capture cleanup failed: " + error);
        } finally {
            if (cursor != null) {
                try {
                    cursor.close();
                } catch (Throwable ignored) {
                }
            }
        }
    }

    /** One private capture file as {url, name, mime, size} for the page to fetch. */
    private JSONObject describeFile(File file, String name) {
        if (file == null) return null;
        long size = file.length();
        String url = server.publishFile(file, name, "image/jpeg", size);
        if (url == null) return null;
        JSONObject result = new JSONObject();
        try {
            result.put("url", url);
            result.put("name", name);
            result.put("mime", "image/jpeg");
            result.put("size", size);
        } catch (Throwable ignored) {
            return null;
        }
        return result;
    }

    private void toast(Activity activity, String text) {
        if (activity == null) return;
        try {
            Toast.makeText(activity, text, Toast.LENGTH_SHORT).show();
        } catch (Throwable ignored) {
        }
    }

    /** MainActivity delegates here before its own result handling. */
    boolean onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQ_PICK_IMAGES && requestCode != REQ_PICK_FILES
                && requestCode != REQ_CAMERA) {
            return false;
        }
        String id = pendingId;
        String method = pendingMethod;
        pendingId = null;
        pendingMethod = null;
        pendingParams = null;
        if (id == null) return true;
        if (requestCode == REQ_CAMERA) {
            Uri captured = cameraOutput;
            cameraOutput = null;
            Activity activity = activityRef.get();
            if (resultCode != Activity.RESULT_OK || captured == null) {
                // Cancelled (or the camera never answered): drop the row, so a
                // cancel cannot grow into a 0-byte photo on the shared volume.
                deleteCaptureRow(activity, captured);
                respond(id, files(new JSONArray()));
                return true;
            }
            if (activity == null) {
                respond(id, error("unavailable", "应用已关闭"));
                return true;
            }
            String name = "capture_" + System.currentTimeMillis() + ".jpg";
            io.execute(() -> {
                // Copy first, then delete: the page is served from private
                // storage, and a capture never survives the session in an album.
                File copy = copyCaptureToCache(activity, captured, name);
                deleteCaptureRow(activity, captured);
                if (copy == null) {
                    noteCaptureFailure(activity);
                    toast(activity, "拍照失败：没有生成照片");
                    respond(id, error("capture_empty", "拍照失败：没有生成照片文件"));
                    return;
                }
                scheduleCaptureCleanup(copy);
                JSONArray files = new JSONArray();
                JSONObject file = describeFile(copy, name);
                if (file != null) files.put(file);
                respond(id, files(files));
            });
            return true;
        }
        List<Uri> picked = new ArrayList<>();
        if (resultCode == Activity.RESULT_OK && data != null) {
            ClipData clip = data.getClipData();
            if (clip != null) {
                for (int index = 0; index < clip.getItemCount(); index++) {
                    Uri item = clip.getItemAt(index).getUri();
                    if (item != null) picked.add(item);
                }
            } else if (data.getData() != null) {
                picked.add(data.getData());
            }
        }
        App.log("native " + method + " picked " + picked.size() + " item(s)");
        io.execute(() -> respond(id, describeAll(picked)));
        return true;
    }

    private JSONObject describeAll(List<Uri> picks) {
        JSONArray files = new JSONArray();
        for (Uri uri : picks) {
            JSONObject file = describe(uri);
            if (file != null) files.put(file);
        }
        return files(files);
    }

    /** One picked URI as {url, name, mime, size} for the plugin to fetch. */
    private JSONObject describe(Uri uri) {
        Activity activity = activityRef.get();
        if (activity == null) return null;
        String name = null;
        String mime = null;
        long size = -1;
        try {
            ContentResolver resolver = activity.getContentResolver();
            try (Cursor cursor = resolver.query(uri,
                    new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE},
                    null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int nameAt = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (nameAt >= 0 && !cursor.isNull(nameAt)) name = cursor.getString(nameAt);
                    int sizeAt = cursor.getColumnIndex(OpenableColumns.SIZE);
                    if (sizeAt >= 0 && !cursor.isNull(sizeAt)) size = cursor.getLong(sizeAt);
                }
            }
            mime = resolver.getType(uri);
        } catch (Throwable ignored) {
        }
        if (name == null || name.isEmpty()) {
            name = uri.getLastPathSegment();
        }
        if (name == null || name.isEmpty()) name = "file";
        if (mime == null || mime.isEmpty()) mime = guessMime(name);
        if (size <= 0) size = sizeOf(activity, uri);
        String url = server.publish(uri, name, mime, size);
        if (url == null) return null;
        JSONObject file = new JSONObject();
        try {
            file.put("url", url);
            file.put("name", name);
            file.put("mime", mime);
            file.put("size", size);
        } catch (Throwable ignored) {
            return null;
        }
        return file;
    }

    private static long sizeOf(Activity activity, Uri uri) {
        try (AssetFileDescriptor descriptor =
                     activity.getContentResolver().openAssetFileDescriptor(uri, "r")) {
            if (descriptor != null && descriptor.getLength() > 0) {
                return descriptor.getLength();
            }
        } catch (Throwable ignored) {
        }
        try (InputStream stream = activity.getContentResolver().openInputStream(uri)) {
            if (stream == null) return -1;
            byte[] buffer = new byte[64 * 1024];
            long total = 0;
            int read;
            while ((read = stream.read(buffer)) > 0) total += read;
            return total;
        } catch (Throwable ignored) {
            return -1;
        }
    }

    private static String guessMime(String name) {
        String lower = name.toLowerCase(Locale.US);
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".txt")) return "text/plain";
        if (lower.endsWith(".zip")) return "application/zip";
        return "application/octet-stream";
    }

    // -------------------------------------------------------------- result path

    private void finishPick(JSONObject result) {
        String id = pendingId;
        pendingId = null;
        pendingMethod = null;
        pendingParams = null;
        if (id != null) respond(id, result);
    }

    private JSONObject files(JSONArray files) {
        JSONObject answer = ok();
        try {
            answer.put("files", files);
        } catch (Throwable ignored) {
        }
        return answer;
    }

    private static JSONObject ok() {
        JSONObject answer = new JSONObject();
        try {
            answer.put("ok", true);
        } catch (Throwable ignored) {
        }
        return answer;
    }

    private static JSONObject error(String code, String message) {
        JSONObject answer = new JSONObject();
        try {
            answer.put("ok", false);
            JSONObject detail = new JSONObject();
            detail.put("code", code);
            detail.put("message", message);
            answer.put("error", detail);
        } catch (Throwable ignored) {
        }
        return answer;
    }

    /**
     * Answer on the UI thread, as the bridge spec requires: the page's handler
     * was installed by the plugin and needs the JSON string, not an object.
     */
    private void respond(String id, JSONObject result) {
        if (id == null || id.isEmpty() || result == null) return;
        String text = result.toString();
        main.post(() -> {
            WebView web = webRef.get();
            if (web == null) return;
            String script = "window.__dshNativeResult(" + JSONObject.quote(id) + ","
                    + JSONObject.quote(text) + ");";
            try {
                web.evaluateJavascript(script, null);
            } catch (Throwable error) {
                App.log("native bridge reply failed: " + error);
            }
        });
    }
}