package dev.dsh.android;

import android.content.ContentResolver;
import android.content.Context;
import android.net.Uri;
import android.os.SystemClock;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * The loopback content service behind the {@code DSHNative} pickers.
 *
 * The page runs on http://127.0.0.1:3080; a picked file cannot be handed to it as a
 * content:// URI (the page is a browser context, not an Android one), so the bridge
 * publishes each picked item as an unguessable one-shot URL on a second loopback
 * port and the page fetches it. That is what ANDROID-BRIDGE.md asks for:
 *
 *   * bind 127.0.0.1 on a random port, only while the activity is alive;
 *   * a random path token per selection, 5 minute TTL, GET/HEAD only;
 *   * CORS for the page's own origin (star + loopback-only bind), Range support;
 *   * only URIs the bridge itself registered — never an arbitrary path;
 *   * no-store so a picked photo is not cached anywhere.
 *
 * Streaming, not buffering: a picked 1 GB file is served without being read into
 * memory, and an unknown Content-Length simply means "read until the socket closes".
 */
final class AssetServer {

    private static final long TTL_MS = 5 * 60 * 1000L;
    private static final int MAX_HEADER_BYTES = 16 * 1024;
    private static final char[] HEX = "0123456789abcdef".toCharArray();

    private final Context context;
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Asset> assets = new HashMap<>();

    private ServerSocket socket;
    private Thread thread;
    private volatile boolean running;

    private static final class Asset {
        final Uri uri;
        final String name;
        final String mime;
        final long size;
        final long expiresAt;
        /** True for an app-private capture copy: deleted as soon as it was served. */
        final boolean oneShot;

        Asset(Uri uri, String name, String mime, long size, long expiresAt, boolean oneShot) {
            this.uri = uri;
            this.name = name;
            this.mime = mime;
            this.size = size;
            this.expiresAt = expiresAt;
            this.oneShot = oneShot;
        }
    }

    AssetServer(Context context) {
        this.context = context.getApplicationContext();
    }

    /**
     * Publish one picked URI and return the URL the page can fetch, or null when
     * the loopback socket could not be opened.
     */
    synchronized String publish(Uri uri, String name, String mime, long size) {
        int port = startLocked();
        if (port < 0) return null;
        String token = token();
        assets.put(token, new Asset(uri, name, mime, size,
                SystemClock.elapsedRealtime() + TTL_MS, false));
        return "http://127.0.0.1:" + port + "/asset/" + token;
    }

    /**
     * Publish a private capture file and forget it after the page fetched it.
     *
     * A capture is copied into the app's own cache before the MediaStore row is
     * deleted, so there is no provider URI left to hand out; a plain
     * {@code file://} URI is enough here. The copy is removed once its bytes have
     * been sent (with the 10 minute bridge TTL as the safety net), so a photo the
     * user only attached to a message never stays on the phone.
     */
    synchronized String publishFile(File file, String name, String mime, long size) {
        if (file == null) return null;
        int port = startLocked();
        if (port < 0) return null;
        String token = token();
        assets.put(token, new Asset(Uri.fromFile(file), name, mime, size,
                SystemClock.elapsedRealtime() + TTL_MS, true));
        return "http://127.0.0.1:" + port + "/asset/" + token;
    }

    /** Bind the loopback socket on first use; returns its port or -1. */
    private int startLocked() {
        if (running && socket != null) return socket.getLocalPort();
        try {
            ServerSocket created = new ServerSocket();
            created.setReuseAddress(true);
            created.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), 0), 8);
            socket = created;
            running = true;
            thread = new Thread(this::acceptLoop, "dsh-asset-server");
            thread.setDaemon(true);
            thread.start();
            App.log("asset server listening on 127.0.0.1:" + created.getLocalPort());
            return created.getLocalPort();
        } catch (IOException error) {
            App.log("asset server could not start: " + error);
            running = false;
            return -1;
        }
    }

    /** Close the socket and forget every token; called when the activity dies. */
    synchronized void stop() {
        running = false;
        assets.clear();
        if (socket != null) {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
            socket = null;
        }
    }

    private String token() {
        byte[] raw = new byte[16];
        random.nextBytes(raw);
        StringBuilder text = new StringBuilder(raw.length * 2);
        for (byte value : raw) {
            text.append(HEX[(value >> 4) & 0xF]).append(HEX[value & 0xF]);
        }
        return text.toString();
    }

    private synchronized Asset find(String token) {
        Asset asset = assets.get(token);
        if (asset == null) return null;
        if (SystemClock.elapsedRealtime() > asset.expiresAt) {
            assets.remove(token);
            return null;
        }
        return asset;
    }

    private void acceptLoop() {
        while (running) {
            Socket client;
            try {
                client = socket.accept();
            } catch (IOException error) {
                if (!running) return;
                App.log("asset server accept: " + error);
                continue;
            }
            try (Socket open = client) {
                open.setSoTimeout(15000);
                handle(open);
            } catch (Throwable error) {
                App.log("asset server request failed: " + error);
            }
        }
    }

    private void handle(Socket client) {
        try {
            BufferedInputStream in = new BufferedInputStream(client.getInputStream());
            String header = readHeader(in);
            if (header == null) return;
            String[] lines = header.split("\r\n");
            if (lines.length == 0) return;
            String[] request = lines[0].split(" ");
            if (request.length < 2) return;
            String method = request[0];
            String path = request[1];
            Map<String, String> headers = new HashMap<>();
            for (int index = 1; index < lines.length; index++) {
                int colon = lines[index].indexOf(':');
                if (colon > 0) {
                    headers.put(lines[index].substring(0, colon).trim().toLowerCase(Locale.US),
                            lines[index].substring(colon + 1).trim());
                }
            }
            OutputStream out = new BufferedOutputStream(client.getOutputStream());
            try {
                serve(out, method, path, headers);
            } finally {
                try {
                    out.flush();
                    out.close();
                } catch (IOException ignored) {
                }
            }
        } catch (Throwable error) {
            App.log("asset server response failed: " + error);
        }
    }

    private String readHeader(InputStream in) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        int matched = 0;
        while (buffer.size() < MAX_HEADER_BYTES) {
            int value = in.read();
            if (value < 0) return null;
            buffer.write(value);
            if ((value == '\r' && (matched == 0 || matched == 2))
                    || (value == '\n' && (matched == 1 || matched == 3))) {
                matched += 1;
                if (matched == 4) break;
            } else {
                matched = value == '\r' ? 1 : 0;
            }
        }
        return new String(buffer.toByteArray(), StandardCharsets.ISO_8859_1);
    }

    private void serve(OutputStream out, String method, String path, Map<String, String> headers)
            throws IOException {
        if ("OPTIONS".equals(method)) {
            writeStatus(out, "204 No Content", headersFor("text/plain", 0, null, false));
            return;
        }
        if (!"GET".equals(method) && !"HEAD".equals(method)) {
            writeStatus(out, "405 Method Not Allowed", headersFor("text/plain", 0, null, false));
            return;
        }
        if (!path.startsWith("/asset/")) {
            writeStatus(out, "404 Not Found", headersFor("text/plain", 0, null, false));
            return;
        }
        String token = path.substring("/asset/".length());
        int query = token.indexOf('?');
        if (query >= 0) token = token.substring(0, query);
        Asset asset = find(token);
        if (asset == null) {
            writeStatus(out, "404 Not Found", headersFor("text/plain", 0, null, false));
            return;
        }
        String mime = asset.mime == null || asset.mime.isEmpty()
                ? "application/octet-stream" : asset.mime;
        long start = 0;
        long end = asset.size > 0 ? asset.size - 1 : -1;
        boolean partial = false;
        String range = headers.get("range");
        if (range != null && asset.size > 0 && range.startsWith("bytes=")) {
            String spec = range.substring("bytes=".length()).trim();
            int dash = spec.indexOf('-');
            if (dash >= 0) {
                try {
                    String first = spec.substring(0, dash).trim();
                    String second = spec.substring(dash + 1).trim();
                    if (first.isEmpty()) {
                        long suffix = Long.parseLong(second);
                        if (suffix > 0) {
                            start = Math.max(0, asset.size - suffix);
                            end = asset.size - 1;
                            partial = true;
                        }
                    } else {
                        start = Long.parseLong(first);
                        end = second.isEmpty() ? asset.size - 1
                                : Math.min(Long.parseLong(second), asset.size - 1);
                        partial = start < asset.size && start <= end;
                    }
                } catch (NumberFormatException ignored) {
                    partial = false;
                }
            }
        }
        if (partial && (start < 0 || end < start)) {
            writeStatus(out, "416 Range Not Satisfiable", headersFor(mime, 0, null, false));
            return;
        }
        InputStream source = null;
        try {
            source = open(asset);
        } catch (Throwable error) {
            App.log("asset server could not open its URI: " + error);
        }
        if (source == null) {
            writeStatus(out, "404 Not Found", headersFor("text/plain", 0, null, false));
            return;
        }
        boolean served = false;
        try {
            long length = asset.size > 0 ? end - start + 1 : -1;
            StringBuilder head = new StringBuilder();
            head.append("HTTP/1.1 ").append(partial ? "206 Partial Content" : "200 OK").append("\r\n");
            head.append("Content-Type: ").append(mime).append("\r\n");
            head.append("Access-Control-Allow-Origin: *\r\n");
            head.append("Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n");
            head.append("Access-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges\r\n");
            head.append("Accept-Ranges: bytes\r\n");
            head.append("Cache-Control: no-store\r\n");
            head.append("Connection: close\r\n");
            if (length >= 0) head.append("Content-Length: ").append(length).append("\r\n");
            if (partial) {
                head.append("Content-Range: bytes ").append(start).append('-').append(end)
                        .append('/').append(asset.size).append("\r\n");
            }
            head.append("\r\n");
            out.write(head.toString().getBytes(StandardCharsets.ISO_8859_1));
            if (!"HEAD".equals(method)) {
                skipFully(source, start);
                copy(source, out, length < 0 ? Long.MAX_VALUE : length);
                out.flush();
                served = true;
            }
        } finally {
            try {
                source.close();
            } catch (IOException ignored) {
            }
            if (served && asset.oneShot) {
                // The page has the bytes now; the private copy has no further use.
                try {
                    new File(asset.uri.getPath()).delete();
                } catch (Throwable ignored) {
                }
                synchronized (this) {
                    assets.remove(token);
                }
            }
        }
    }

    /** Open an asset: a provider URI, or the private file a capture was copied to. */
    private InputStream open(Asset asset) throws IOException {
        if ("file".equals(asset.uri.getScheme())) {
            return new FileInputStream(new File(asset.uri.getPath()));
        }
        InputStream stream = context.getContentResolver().openInputStream(asset.uri);
        if (stream == null) throw new IOException("no stream for " + asset.uri);
        return stream;
    }

    private void writeStatus(OutputStream out, String status, String headers) throws IOException {
        String text = "HTTP/1.1 " + status + "\r\n" + headers + "Content-Length: 0\r\nConnection: close\r\n\r\n";
        out.write(text.getBytes(StandardCharsets.ISO_8859_1));
    }

    private String headersFor(String mime, long length, String range, boolean partial) {
        StringBuilder head = new StringBuilder();
        head.append("Content-Type: ").append(mime).append("\r\n");
        head.append("Access-Control-Allow-Origin: *\r\n");
        head.append("Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n");
        head.append("Cache-Control: no-store\r\n");
        head.append("Accept-Ranges: bytes\r\n");
        if (range != null) head.append("Content-Range: ").append(range).append("\r\n");
        return head.toString();
    }

    private static void skipFully(InputStream source, long bytes) throws IOException {
        long left = bytes;
        while (left > 0) {
            long skipped = source.skip(left);
            if (skipped <= 0) {
                if (source.read() < 0) return;
                skipped = 1;
            }
            left -= skipped;
        }
    }

    private static void copy(InputStream source, OutputStream target, long limit) throws IOException {
        byte[] buffer = new byte[64 * 1024];
        long left = limit;
        while (left > 0) {
            int want = (int) Math.min(buffer.length, left);
            int read = source.read(buffer, 0, want);
            if (read < 0) return;
            target.write(buffer, 0, read);
            left -= read;
        }
    }
}