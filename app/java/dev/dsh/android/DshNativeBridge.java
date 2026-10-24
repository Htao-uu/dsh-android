package dev.dsh.android;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
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
import java.io.InputStream;
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
    /** How long a capture stays on disk when the page never fetches it. */
    private static final long CAPTURE_TTL_MS = 10 * 60 * 1000L;

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
        // A camera that never answered leaves its private target behind; delete
        // it now instead of waiting for the next start.
        discardCapture(activityRef.get(), cameraOutput);
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
        App.log("native pick start id=" + id + " method=" + method + " params=" + params);
        try {
            if ("pickImages".equals(method)) {
                String source = params.optString("source", "gallery");
                boolean multiple = params.optBoolean("multiple", true);
                int max = Math.max(1, Math.min(params.optInt("max", 20), 20));
                if ("camera".equals(source)) {
                    startCamera(activity);
                    return;
                }
                Intent pick;
                if (Build.VERSION.SDK_INT >= 33) {
                    pick = new Intent(MediaStore.ACTION_PICK_IMAGES);
                    if (multiple) {
                        pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                        pick.putExtra(MediaStore.EXTRA_PICK_IMAGES_MAX, max);
                    }
                } else {
                    // No system Photo Picker before API 33: open the ROM gallery
                    // itself. The old fallback (GET_CONTENT image/*) is answered by
                    // DocumentsUI on many ROMs — the "最近/图片/下载内容/图库/文件管理"
                    // file browser — which is not the album the button promises.
                    pick = galleryPickIntent(activity, multiple);
                    if (pick == null) {
                        App.log("gallery: no ACTION_PICK handler, reporting picker failure");
                        toast(activity, "没有可用的系统图库");
                        finishPick(error("gallery_unavailable", "没有可用的系统图库"));
                        return;
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
            App.log("camera: no target, camera unavailable");
            finishPick(error("camera_unavailable", "相机存储不可用"));
            return;
        }
        cameraOutput = target;
        Intent capture = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        capture.putExtra(MediaStore.EXTRA_OUTPUT, target);
        // EXTRA_OUTPUT is a stream extra: Android migrates it into ClipData so the
        // URI grant applies. Setting the ClipData explicitly keeps the grant valid
        // on ROMs whose camera resolves permissions from the clip data alone.
        capture.setClipData(ClipData.newRawUri("", target));
        capture.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        App.log("camera: launch target=" + target
                + " handlesIntent=" + (capture.resolveActivity(activity.getPackageManager()) != null));
        try {
            activity.startActivityForResult(capture, REQ_CAMERA);
        } catch (Throwable error) {
            App.log("camera: launch failed target=" + target + " error=" + error);
            cameraOutput = null;
            discardCapture(activity, target);
            finishPick(error("camera_unavailable", "无法打开系统相机"));
        }
    }

    /**
     * The ROM gallery's own image picker, for releases without the system Photo
     * Picker (API < 33).
     *
     * {@code ACTION_GET_CONTENT image/*} is answered by DocumentsUI on many ROMs
     * — exactly the "最近/图片/下载内容/图库/文件管理" browser the user saw — while
     * {@code ACTION_PICK} over the MediaStore images collection is the classic
     * gallery intent: the gallery app answers it and shows albums/photos. The
     * result handling is shared with the other pickers (ClipData for a gallery that
     * can multi-select, single data otherwise), so single and multiple selections
     * both come back through {@link #onActivityResult}.
     *
     * @return the intent, or null when no installed app handles ACTION_PICK (the
     *         caller reports an error instead of silently opening a file browser).
     */
    static Intent galleryPickIntent(Activity activity, boolean multiple) {
        PackageManager manager = activity.getPackageManager();
        // Galleries differ in how they declare ACTION_PICK: data + image/* type,
        // only the MediaStore collection as data, or only image/* as the type.
        // Try the richest form first and fall back to the others, so the button
        // still reaches a gallery on a ROM that registered just one of them.
        Intent typed = new Intent(Intent.ACTION_PICK);
        typed.setDataAndType(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, "image/*");
        Intent[] variants = {
                typed,
                new Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI),
                new Intent(Intent.ACTION_PICK).setType("image/*")
        };
        for (Intent candidate : variants) {
            if (multiple) candidate.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            candidate.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }
        for (int index = 0; index < variants.length; index++) {
            ResolveInfo resolved = manager.resolveActivity(
                    variants[index], PackageManager.MATCH_DEFAULT_ONLY);
            if (resolved == null || resolved.activityInfo == null) continue;
            App.log("gallery: ACTION_PICK variant " + index + " resolves to "
                    + resolved.activityInfo.packageName + "/" + resolved.activityInfo.name);
            return variants[index];
        }
        App.log("gallery: no ACTION_PICK handler for any variant");
        return null;
    }

    /**
     * A content:// URI the camera writes into, backed by a private cache file.
     *
     * MediaStore is deliberately not involved. An {@code IS_PENDING=1} row keeps
     * a capture out of the gallery, but Android 12's MediaProvider refuses another
     * app's {@code openOutputStream()} on a pending item ("Only owner is able to
     * interact with pending item"). Huawei's camera writes {@code EXTRA_OUTPUT}
     * exactly that way (ReviewPage → ActivityUtil.writeDataToUri), so it crashed
     * and the capture never arrived. {@link CaptureProvider} hands the camera the
     * very file the loopback content service later serves: the camera writes it
     * with a normal per-URI grant, nothing reaches the shared volume or the
     * gallery, and the file is deleted after the page fetched it.
     */
    static Uri createCameraTarget(Activity activity) {
        if (activity == null) return null;
        File dir = CaptureProvider.directory(activity);
        if (dir == null) return null;
        File file = new File(dir, "capture_" + System.currentTimeMillis() + ".jpg");
        try {
            if (!file.createNewFile() && !file.isFile()) {
                App.log("camera: target file unavailable " + file);
                return null;
            }
        } catch (Throwable error) {
            App.log("camera: target file failed " + file + " error=" + error);
            return null;
        }
        return CaptureProvider.uriFor(activity, file);
    }

    /** True only once the camera has actually put bytes behind the capture URI. */
    static boolean captureReady(Activity activity, Uri uri) {
        return captureSize(activity, uri) > 0;
    }

    /** Size of a capture: the private file behind a provider URI, or a legacy row. */
    static long captureSize(Activity activity, Uri uri) {
        if (activity == null || uri == null) return -1;
        File file = CaptureProvider.resolve(uri);
        if (file != null) return file.length();
        // A capture target from a build that used MediaStore still cleans up
        // through the resolver; measuring it keeps that fallback honest.
        try (Cursor cursor = activity.getContentResolver().query(uri,
                new String[]{OpenableColumns.SIZE}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int at = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (at >= 0 && !cursor.isNull(at)) return cursor.getLong(at);
            }
        } catch (Throwable ignored) {
        }
        return sizeOf(activity, uri);
    }

    /** Delete a capture (private file, or a legacy MediaStore row) and forget it. */
    static void discardCapture(Activity activity, Uri uri) {
        if (activity == null || uri == null) return;
        File file = CaptureProvider.resolve(uri);
        long size = file == null ? -1 : file.length();
        CaptureProvider.forget(uri);
        if (file != null) {
            boolean deleted = false;
            try {
                deleted = file.delete();
            } catch (Throwable error) {
                App.log("camera: discard failed file=" + file + " error=" + error);
            }
            App.log("camera: discarded name=" + file.getName() + " size=" + size
                    + " deleted=" + deleted);
            return;
        }
        // Legacy cleanup: rows created by builds before the provider existed.
        try {
            activity.getContentResolver().delete(uri, null, null);
            App.log("camera: legacy capture row deleted " + uri);
        } catch (Throwable error) {
            App.log("camera: legacy capture row cleanup failed " + uri + " error=" + error);
        }
    }

    /** The private capture is only needed until the page fetched it; drop it later. */
    private void scheduleCaptureCleanup(File file) {
        if (file == null) return;
        main.postDelayed(() -> {
            try {
                file.delete();
                App.log("camera: ttl cleanup name=" + file.getName()
                        + " stillThere=" + file.exists());
            } catch (Throwable error) {
                App.log("camera: ttl cleanup failed file=" + file + " error=" + error);
            }
        }, CAPTURE_TTL_MS);
    }

    /**
     * Remove captures a previous process left behind: private capture files under
     * {@code cache/dsh-captures}, and pending MediaStore rows an older build
     * created before {@link CaptureProvider} replaced them (invisible to the
     * gallery, but still occupying the volume).
     */
    static void cleanupStaleCaptures(Activity activity) {
        if (activity == null) return;
        int files = 0;
        try {
            File dir = CaptureProvider.directory(activity);
            File[] children = dir == null ? null : dir.listFiles();
            if (children != null) {
                for (File file : children) {
                    try {
                        if (file.delete()) files += 1;
                    } catch (Throwable ignored) {
                    }
                }
            }
        } catch (Throwable error) {
            App.log("camera: stale file cleanup failed: " + error);
        }
        int rows = 0;
        if (Build.VERSION.SDK_INT >= 29) {
            Cursor cursor = null;
            try {
                cursor = activity.getContentResolver().query(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                        new String[]{MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME},
                        MediaStore.MediaColumns.IS_PENDING + "=1", null, null);
                if (cursor != null) {
                    int idAt = cursor.getColumnIndex(MediaStore.MediaColumns._ID);
                    int nameAt = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME);
                    while (cursor.moveToNext()) {
                        long id = idAt < 0 ? -1 : cursor.getLong(idAt);
                        String name = nameAt < 0 || cursor.isNull(nameAt) ? null : cursor.getString(nameAt);
                        if (id < 0 || name == null || !name.startsWith("dsh_")) continue;
                        try {
                            activity.getContentResolver().delete(ContentUris.withAppendedId(
                                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id), null, null);
                            rows += 1;
                        } catch (Throwable ignored) {
                        }
                    }
                }
            } catch (Throwable error) {
                App.log("camera: stale row cleanup failed: " + error);
            } finally {
                if (cursor != null) {
                    try {
                        cursor.close();
                    } catch (Throwable ignored) {
                    }
                }
            }
        }
        if (files > 0 || rows > 0) {
            App.log("camera: stale captures removed files=" + files + " rows=" + rows);
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
            if (activity == null) {
                respond(id, error("unavailable", "应用已关闭"));
                return true;
            }
            File file = CaptureProvider.resolve(captured);
            long size = file == null ? -1 : file.length();
            App.log("camera: result result=" + resultCode
                    + (resultCode == Activity.RESULT_OK ? "(OK)" : "(not-ok)")
                    + " uri=" + captured
                    + " file=" + (file == null ? "null" : file.getName()) + " size=" + size);
            if (resultCode != Activity.RESULT_OK) {
                // Cancelled (or the camera crashed): drop the empty target so a
                // cancel never leaves a stray file behind.
                discardCapture(activity, captured);
                respond(id, files(new JSONArray()));
                return true;
            }
            if (file == null || size <= 0) {
                discardCapture(activity, captured);
                toast(activity, "拍照失败：没有生成照片");
                respond(id, error("capture_empty", "拍照失败：没有生成照片文件"));
                return true;
            }
            io.execute(() -> {
                JSONObject described = describeFile(file, file.getName());
                if (described == null) {
                    App.log("camera: publish failed file=" + file.getAbsolutePath());
                    toast(activity, "拍照失败：无法读取照片");
                    respond(id, error("capture_unreadable", "拍照失败：无法读取照片"));
                    return;
                }
                App.log("camera: publishing size=" + size + " url=" + described.optString("url"));
                JSONArray files = new JSONArray();
                files.put(described);
                // The loopback service deletes the file once the page fetched it;
                // this timer is the safety net for a page that never asks for it.
                scheduleCaptureCleanup(file);
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