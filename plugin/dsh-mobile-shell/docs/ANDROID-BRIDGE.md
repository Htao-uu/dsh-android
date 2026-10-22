# DSH Android ⇄ dsh-mobile-shell 原生桥接规范

版本：1.1（对应 dsh-mobile-shell 0.6.2 起）

插件在 WebView 中检测 `window.DSHNative`。**不存在或调用失败时，插件不显示「最近照片」区域，其余功能照常工作**；拍照/相册/文件按钮退回系统 `<input type=file>`。因此安卓端可以安全地分阶段实现。

---

## 1. 注入方式

```java
webView.getSettings().setJavaScriptEnabled(true);
webView.addJavascriptInterface(new DshNativeBridge(webView), "DSHNative");
```

只应注入到可信页面（DSH 自己的 origin / 本地页面）；不要在任意第三方页面暴露文件内容接口。

---

## 2. 调用协议

### Web → Android

插件调用：

```js
window.DSHNative.request(JSON.stringify({ id, method, params }));
```

- `id`：字符串，插件生成，响应时必须原样带回；
- `method`：见第 3 节；
- `params`：对象，无参数时为 `{}`；
- `request` 必须立即返回（不要同步做耗时工作）；结果异步回传。

### Android → Web

在 UI 线程执行：

```java
webView.evaluateJavascript(
  "window.__dshNativeResult(" + JSON.stringify(id) + "," + JSON.stringify(resultJson) + ");",
  null);
```

- `resultJson` 建议直接传 JSON 字符串；插件内部会 `JSON.parse`；
- 成功：`{"ok":true,"photos":[...]}` 或按方法定义的字段（见下）；
- 失败：`{"ok":false,"error":{"code":"...","message":"..."}}`；
- 超时：插件对 `recentPhotos` 等 1.8s，超时按失败处理并隐藏最近照片区域。

---

## 3. 方法定义

### 3.1 `capabilities`

可选；插件暂不强制调用，建议实现以便未来扩展。

```json
params: {}
result: { "ok": true, "version": 1, "recentPhotos": true, "pickers": true, "resumableUpload": false }
```

### 3.2 `recentPhotos`（必需，用于「最近照片」）

```json
params: { "limit": 20 }
result: {
  "ok": true,
  "photos": [
    {
      "id": "media:12345",
      "thumbDataUrl": "data:image/jpeg;base64,...",
      "width": 1080,
      "height": 1440,
      "takenAt": 1720000000,
      "mime": "image/jpeg",
      "name": "IMG_2026.jpg"
    }
  ]
}
```

要求：
- 按 `takenAt` 从新到旧返回，最多 `limit` 张；
- `thumbDataUrl` 必须是可直接放进 `<img src>` 的 data URL，建议 **长边 ≤ 240px、JPEG/WebP、单张 ≤ 40KB**，避免 WebView 内存/传输压力；
- 只返回图片（相册媒体），不要返回视频缩略图；
- 无权限或没有照片时返回 `{"ok":true,"photos":[]}`，插件会自动隐藏该区域。

### 3.3 `openRecent`（必需，用户点最近照片时）

```json
params: { "id": "media:12345" }
result: {
  "ok": true,
  "url": "http://127.0.0.1:47821/asset/7f3a...",
  "name": "IMG_2026.jpg",
  "mime": "image/jpeg",
  "size": 3456789
}
```

插件会用 `fetch(url)` 取回图片，然后作为图片附件交给 DSH 的输入框。

要求：
- `url` 指向 **127.0.0.1** 上的临时内容服务，带不可猜测的随机 token；
- 必须支持 CORS（至少允许 DSH 页面 origin；调试期可用 `Access-Control-Allow-Origin: *` + 仅本机绑定）；
- 支持 `Range` 请求更佳（大图/未来扩展）；
- token 有效期建议 5 分钟，单次使用后可失效；
- 只允许读取用户刚刚选择的媒体，禁止按任意路径提供文件（不要暴露 `file://`、`content://` 直接转发）。

### 3.4 `pickImages` / `pickFiles`（可选，推荐；用于拍照/相册/文件按钮）

插件打开附件弹层时会先调用 `capabilities`；只有返回 `"pickers": true` 时，三个按钮才走原生接口，否则退回 Web `<input type=file>`。

```json
method: "pickImages"
params: { "source": "camera" | "gallery", "multiple": true, "max": 20 }
result: { "ok": true, "files": [ { "url": "http://127.0.0.1:.../asset/...", "name": "IMG_2026.jpg", "mime": "image/jpeg", "size": 3456789 } ] }

method: "pickFiles"
params: { "multiple": true, "max": 20 }
result: { "ok": true, "files": [ { "url": "...", "name": "report.pdf", "mime": "application/pdf", "size": 123456 } ] }
```

- `source: "camera"` 时必须打开系统相机，拍完返回新照片；
- `source: "gallery"` 时必须打开系统相册/Photo Picker，而不是文件管理器；
- 返回的 `url` 仍指向本机临时内容服务，规则同 `openRecent`（CORS、Range、随机 token、只读）；
- 用户取消选择时返回 `{"ok":true,"files":[]}`；
- **不要在 `capabilities` 里声称 `pickers:true`，除非两个方法都已实现。**

### 3.5 可选扩展

- `releaseAsset`：插件用完照片后可调用 `{id}` 释放；
- `resumableUpload`：见第 6 节，当前宿主不支持，暂不实现。

---

## 4. 本地内容服务建议

- 绑定 `127.0.0.1`，随机端口；仅 Activity 存活期间运行；
- 每次选择生成随机 token 路径，映射到 `content://` 媒体或缓存文件；
- 响应头：
  - `Content-Type`：真实 MIME；
  - `Content-Length`：真实大小；
  - `Access-Control-Allow-Origin: <DSH origin 或 *>`；
  - `Cache-Control: no-store`；
- 只读，不接受写入；禁止目录遍历；
- Activity 销毁时关闭服务并清理临时文件。

---

## 5. 线程与生命周期

- `request()` 在 WebView 的 JS 线程被调用，必须立刻返回，耗时操作切到主线程/后台线程；
- 结果必须回 UI 线程 `evaluateJavascript`；
- WebView 页面重载后旧 id 全部失效，插件会重新请求；
- 不要持有 Activity 泄漏；桥对象建议弱引用 WebView。

---

## 6. 关于断点续传 / 大文件

当前 dsh-mobile-shell 走 DSH 宿主的单次流式上传（`POST /api/session/uploadFileBinary`），宿主协议没有断点续传。插件只能做：

- 单文件 ≤1GB、单次总计 ≤5GB 的前端校验；
- 失败后让用户重新选择/重试（当前从头上传）。

真正的断点续传需要 DSH 宿主服务端和 Web 上传层一起改（分片、uploadId、offset、合并），不属于本桥接文档的 1.0 范围。如果后续要加，建议新增：

```json
method: "resumableUpload"
params: { sessionId, fileToken, chunkSize, offset }
result: { uploadId, offset, completed, receiptId? }
```

---

## 7. 验收清单

1. 不注入 `DSHNative`：打开附件弹层只显示 拍照/相册/文件，不显示「最近照片」，DSH 正常；
2. 注入但 `recentPhotos` 超时/报错：最近照片区域隐藏，无控制台未捕获异常；
3. 正常返回 20 张缩略图：横向可滑，点击可把照片加入输入框待发送；
4. 照片权限被拒：返回空数组，不崩溃；
5. 旋转/后台/页面重载后再次打开：接口仍可用或优雅降级。


---

## 8. 如果暂不实现原生桥：修 WebView 的文件选择器

当前 DSH Android 的 `onShowFileChooser` 无论何种 input 都只发 `ACTION_OPEN_DOCUMENT` + `*/*`，所以：
- 拍照 / 相册 input 只会进文件管理器（不会进相机/相册）；
- 即使插件给「文件」按钮设置了 `*/*`，也会被系统文档 UI 接管。

只改插件无法解决，必须在 App 端按 `FileChooserParams` 分流。最小改法（`MainActivity.java`）：

```java
private static final int REQ_FILE = 0x1002;
private static final int REQ_CAMERA = 0x1007;
private Uri cameraOutput;

@Override
public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
    if (fileCallback != null) fileCallback.onReceiveValue(null);
    fileCallback = cb;

    String[] accepts = params == null ? null : params.getAcceptTypes();
    boolean imagesOnly = accepts != null && accepts.length > 0;
    if (imagesOnly) {
        for (String a : accepts) {
            if (a != null && !a.isEmpty() && !a.startsWith("image/")) { imagesOnly = false; break; }
        }
    }

    // 1) <input capture> → 系统相机
    if (params != null && params.isCaptureEnabled()) {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, "dsh_" + System.currentTimeMillis() + ".jpg");
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
        cameraOutput = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        intent.putExtra(MediaStore.EXTRA_OUTPUT, cameraOutput);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        startActivityForResult(intent, REQ_CAMERA);
        return true;
    }

    // 2) accept 只有 image/* → 系统相册 / Photo Picker（不要 ACTION_OPEN_DOCUMENT）
    if (imagesOnly) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= 33) {
            intent = new Intent(MediaStore.ACTION_PICK_IMAGES);
            intent.putExtra(MediaStore.EXTRA_PICK_IMAGES_MAX, 20);
        } else {
            intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.setType("image/*");
            intent.addCategory(Intent.CATEGORY_OPENABLE);
        }
        if (params != null && params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        }
        startActivityForResult(Intent.createChooser(intent, "选择图片"), REQ_FILE);
        return true;
    }

    // 3) 其余（accept="*/*" 或没有 accept）→ 任意文件
    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("*/*");
    if (params != null && params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
    }
    startActivityForResult(intent, REQ_FILE);
    return true;
}
```

`onActivityResult` 需要同时处理单张和多张，以及相机结果：

```java
@Override
protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode == REQ_CAMERA) {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(resultCode == RESULT_OK && cameraOutput != null
                    ? new Uri[]{cameraOutput} : null);
            fileCallback = null;
        }
        cameraOutput = null;
        return;
    }
    if (requestCode == REQ_FILE) {
        if (fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData clip = data.getClipData();
                if (clip != null) {
                    result = new Uri[clip.getItemCount()];
                    for (int i = 0; i < result.length; i++) result[i] = clip.getItemAt(i).getUri();
                } else if (data.getData() != null) {
                    result = new Uri[]{data.getData()};
                }
            }
            fileCallback.onReceiveValue(result);
            fileCallback = null;
        }
        return;
    }
    // ... existing REQ_MOUNT / REQ_IMPORT / REQ_HOT / REQ_BALL 分支
}
```

注意：
- 相机写 `MediaStore` 后不需要 FileProvider；WebView 需要能读该 content Uri，给 Intent 加 `FLAG_GRANT_READ_URI_PERMISSION` 并在回调前保留即可；
- 相册优先用 Android 13+ 的 `ACTION_PICK_IMAGES`，旧系统用 `ACTION_GET_CONTENT image/*`；不要用 `ACTION_OPEN_DOCUMENT`，否则会落到文件管理器；
- 文件分支显式 `*/*`，不要再从上一个 input 继承 `EXTRA_MIME_TYPES`；
- 若要支持 1GB 任意文件/断点续传，仍建议走第 3.4 节的原生桥，而不是 WebView 文件选择器。

插件侧从 0.6.3 起给「文件」按钮显式传 `accept="*/*"`，相机传 `capture="camera"`，相册传 `accept="image/*"`。
