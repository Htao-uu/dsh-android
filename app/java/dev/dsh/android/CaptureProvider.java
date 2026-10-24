package dev.dsh.android;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.security.SecureRandom;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * A minimal FileProvider: the camera writes into a content:// URI this app owns
 * and the bytes land in the app's private cache, never in MediaStore.
 *
 * The previous MediaStore design inserted an {@code IS_PENDING=1} row so the
 * capture could not show up in the gallery. Android 12's MediaProvider then
 * refuses an {@code openOutputStream()} from any app that is not the row owner
 * ("Only owner is able to interact with pending item"), which is exactly how
 * Huawei's camera writes its {@code EXTRA_OUTPUT}
 * (com.huawei.camera2.ui.element.ReviewPage → ActivityUtil.writeDataToUri): the
 * camera crashed on the review screen and the capture never reached the page, so
 * no attachment chip appeared. A provider we own has no such rule — the camera
 * opens the very file registered here, this app serves the same file to the page
 * through the loopback content service, and the file is deleted afterwards.
 * Nothing reaches the shared volume or the gallery at any point, and the camera
 * only needs the per-URI grant every camera already knows how to use.
 */
public final class CaptureProvider extends ContentProvider {

    /** Must match the android:authorities of this provider in AndroidManifest.xml. */
    static final String AUTHORITY = "dev.dsh.android.captures";
    /** Private cache directory a capture is written to. */
    static final String CAPTURE_DIR = "dsh-captures";

    private static final char[] HEX = "0123456789abcdef".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();
    /** token -> private file; these are the only URIs this provider hands out. */
    private static final Map<String, File> FILES = new ConcurrentHashMap<>();

    /** The capture directory, created on first use. */
    static File directory(Context context) {
        File dir = new File(context.getCacheDir(), CAPTURE_DIR);
        if (!dir.isDirectory() && !dir.mkdirs()) {
            App.log("camera: cannot create capture dir " + dir);
            return null;
        }
        return dir;
    }

    /** Register a new private file and return the content:// URI the camera writes. */
    static Uri uriFor(Context context, File file) {
        byte[] raw = new byte[16];
        RANDOM.nextBytes(raw);
        StringBuilder token = new StringBuilder(raw.length * 2);
        for (byte value : raw) {
            token.append(HEX[(value >> 4) & 0xF]).append(HEX[value & 0xF]);
        }
        FILES.put(token.toString(), file);
        Uri uri = new Uri.Builder().scheme("content").authority(AUTHORITY)
                .appendPath(token.toString()).build();
        App.log("camera: target uri=" + uri + " file=" + file.getAbsolutePath());
        return uri;
    }

    /** The file behind a capture URI, or null when this provider never handed it out. */
    static File resolve(Uri uri) {
        if (uri == null || !AUTHORITY.equals(uri.getAuthority())) return null;
        String token = uri.getLastPathSegment();
        return token == null ? null : FILES.get(token);
    }

    /** Drop the registration of a capture URI after the file was deleted or given up. */
    static void forget(Uri uri) {
        if (uri == null || !AUTHORITY.equals(uri.getAuthority())) return;
        String token = uri.getLastPathSegment();
        if (token != null) FILES.remove(token);
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File file = resolve(uri);
        if (file == null) {
            App.log("camera: provider openFile missed uri=" + uri);
            throw new FileNotFoundException("unknown capture " + uri);
        }
        try {
            ParcelFileDescriptor descriptor =
                    ParcelFileDescriptor.open(file, ParcelFileDescriptor.parseMode(mode));
            App.log("camera: provider openFile name=" + file.getName()
                    + " mode=" + mode + " size=" + file.length());
            return descriptor;
        } catch (Throwable error) {
            App.log("camera: provider openFile failed file=" + file + " mode=" + mode
                    + " error=" + error);
            throw new FileNotFoundException("cannot open " + file + ": " + error);
        }
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection,
                        String[] selectionArgs, String sortOrder) {
        File file = resolve(uri);
        if (file == null) {
            App.log("camera: provider query missed uri=" + uri);
            return null;
        }
        String[] columns = projection == null || projection.length == 0
                ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}
                : projection;
        MatrixCursor cursor = new MatrixCursor(columns, 1);
        Object[] row = new Object[columns.length];
        for (int index = 0; index < columns.length; index++) {
            if (OpenableColumns.DISPLAY_NAME.equals(columns[index])) {
                row[index] = file.getName();
            } else if (OpenableColumns.SIZE.equals(columns[index])) {
                row[index] = file.length();
            } else {
                row[index] = null;
            }
        }
        cursor.addRow(row);
        return cursor;
    }

    @Override
    public String getType(Uri uri) {
        return "image/jpeg";
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("captures are created by the app, not inserted");
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        File file = resolve(uri);
        if (file == null) return 0;
        forget(uri);
        return file.delete() ? 1 : 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
