/**
 * repair-dsh.mjs — undo a publish-path bug in an already-installed sandbox.
 *
 * An earlier revision of patches/apply-hardlink-patch.py injected a
 * `linkOrCopy()` helper and then let one of its call-site rewrites match the
 * helper's own body, so the helper called itself:
 *
 *     async function linkOrCopy(source, target) {
 *         try { await linkOrCopy(source, target); }   // stack overflow
 *         catch (error) { ... }
 *     }
 *
 * Every path that publishes an immutable file goes through it — attachments
 * (images), the session log, the filesystem writer — so the visible symptom was
 * `Unable to persist attachment` and images that could not be read at all.
 *
 * The payload builds correctly now, but a sandbox that was unpacked from the
 * broken build keeps the file until something rewrites it; the rootfs is not
 * writable by a hot package, and re-sending 190 MB for a two-line fix is the
 * thing the terminal/hot split exists to avoid. So the repair happens here, at
 * boot, from the hot-overlaid start script: idempotent, logged, and a no-op on
 * a sandbox that never had the bug.
 *
 * Usage: node repair-dsh.mjs [node_modules-root]   (default /opt/dsh/node_modules)
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, statSync, readdirSync, mkdirSync, copyFileSync, chmodSync, symlinkSync, rmSync } from "node:fs";
import { join } from "node:path";

const FILES = [
  ["@deepseek-ai/dsh-attachment-local", "lib/index.js", false],
  ["@deepseek-ai/dsh-session-persistence-jsonl", "lib/index.js", false],
  ["@deepseek-ai/dsh-session-persistence-jsonl", "lib/worker.cjs", true],
  ["@deepseek-ai/dsh-fs-local", "lib/index.js", false],
];

const root = process.argv[2] ?? "/opt/dsh/node_modules";
let repaired = 0;
let checked = 0;

for (const [pkg, relative, cjs] of FILES) {
  const path = join(root, pkg, relative);
  let source;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  checked++;
  const start = source.indexOf("async function linkOrCopy(source, target) {");
  if (start < 0) continue;
  const end = source.indexOf("\n}", start);
  if (end < 0) continue;
  const body = source.slice(start, end);
  if (!body.includes("await linkOrCopy(source, target);")) continue;
  const call = cjs ? "await node_fs_promises.link(source, target);" : "await link(source, target);";
  writeFileSync(path, source.slice(0, start) + body.replace("await linkOrCopy(source, target);", call) + source.slice(end), "utf8");
  repaired++;
  console.log(`repair-dsh: fixed self-recursive linkOrCopy in ${pkg}/${relative}`);
}

if (repaired === 0) {
  console.log(`repair-dsh: nothing to fix (${checked} files checked)`);
}


// --- AbortSignal.any hot fix -------------------------------------------------
// Old Android WebViews (Huawei WebView 114 = Chromium 114) predate
// AbortSignal.any(), which landed in Chromium 116. The browser client
// (@deepseek-ai/dsh-api-gateway/lib/client.js) calls it for every RPC that
// carries a caller signal, so the directory picker died with
// "AbortSignal.any is not a function". The rootfs is not writable by a hot
// package, so the polyfill is injected into the served index.html here, at
// boot, before node starts the web server. Idempotent.
const FRONTEND_INDEX = join(root, "@deepseek-ai/dsh-web-frontend/dist/index.html");
const POLYFILL_MARK = "__dsh_abortsignal_any_polyfill__";
const POLYFILL_SCRIPT = "<script>/* " + POLYFILL_MARK + " */" + "(function(){\n  if (typeof AbortSignal !== \"undefined\" && typeof AbortSignal.any !== \"function\") {\n    AbortSignal.any = function(signals){\n      var c = new AbortController();\n      var list = [];\n      try {\n        var it = signals[Symbol.iterator]();\n        for (var r = it.next(); !r.done; r = it.next()) list.push(r.value);\n      } catch (e) { list = Array.prototype.slice.call(signals); }\n      for (var i = 0; i < list.length; i++) {\n        var s = list[i];\n        if (s && s.aborted) { c.abort(s.reason); return c.signal; }\n      }\n      for (var j = 0; j < list.length; j++) (function(sig){\n        if (!sig) return;\n        sig.addEventListener(\"abort\", function(){ c.abort(sig.reason); }, { once: true });\n      })(list[j]);\n      return c.signal;\n    };\n  }\n  if (typeof Promise !== \"undefined\" && typeof Promise.withResolvers !== \"function\") {\n    Promise.withResolvers = function(){\n      var resolve, reject;\n      var promise = new Promise(function(res, rej){ resolve = res; reject = rej; });\n      return { promise: promise, resolve: resolve, reject: reject };\n    };\n  }\n})();" + "</scr" + "ipt>";

const ITERATOR_MARK = "__dsh_iterator_shim__";
const ITERATOR_SCRIPT = "<script>/* " + ITERATOR_MARK + " */" +
  "if (typeof window.Iterator === 'undefined') { window.Iterator = function Iterator() {}; }" +
  "</scr" + "ipt>";

function patchFrontendIndex() {
  let html;
  try {
    html = readFileSync(FRONTEND_INDEX, "utf8");
  } catch {
    return;
  }
  let changed = false;
  if (!html.includes(POLYFILL_MARK)) {
    const head = html.indexOf("<head>");
    const at = head >= 0 ? head + 6 : 0;
    html = html.slice(0, at) + "\n    " + POLYFILL_SCRIPT + html.slice(at);
    changed = true;
    console.log("repair-dsh: injected AbortSignal.any polyfill into dsh-web-frontend index.html");
  }
  if (!html.includes(ITERATOR_MARK)) {
    const head = html.indexOf("<head>");
    const at = head >= 0 ? head + 6 : 0;
    html = html.slice(0, at) + "\n    " + ITERATOR_SCRIPT + html.slice(at);
    changed = true;
    console.log("repair-dsh: injected Iterator shim for ArkWeb");
  }
  if (changed) writeFileSync(FRONTEND_INDEX, html, "utf8");
}

patchFrontendIndex();


// --- dsh-resource URL parsing on Huawei ArkWeb ------------------------------
// ArkWeb reports an empty hostname for a non-special scheme:
//   new URL("dsh-resource://file/session/x").hostname === ""
// Upstream dsh-client-resources uses that hostname as the provider protocol key
// and dsh-client-ui-sidebar-right uses URL.pathname for tab matching, so every
// file preview renders "文件资源服务不可用". Patch the served client bundles at
// boot, after an APK/DSH update, instead of baking a one-off payload edit.
const RESOURCE_CLIENT = join(root, "@deepseek-ai/dsh-client-resources/lib/client.js");
const SIDEBAR_RIGHT_CLIENT = join(root, "@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js");

const RESOURCE_PROTOCOL_REPLACEMENT = [
  "function protocolOf(address) {",
  "\t\t\tif (typeof address !== \"string\" || !address.toLowerCase().startsWith(\"dsh-resource://\")) return void 0;",
  "\t\t\tconst rest = address.slice(\"dsh-resource://\".length);",
  "\t\t\tlet stop = rest.length;",
  "\t\t\tfor (const ch of [\"/\", \"?\", \"#\"]) { const i = rest.indexOf(ch); if (i >= 0 && i < stop) stop = i; }",
  "\t\t\tconst authority = rest.slice(0, stop);",
  "\t\t\treturn authority === \"\" ? void 0 : authority.toLowerCase();",
  "\t\t}",
].join("\n");

const RESOURCE_PATH_REPLACEMENT = [
  "function pathOf(address) {",
  "\t\t\ttry {",
  "\t\t\t\tconst marker = \"://\";",
  "\t\t\t\tconst at = address.indexOf(marker);",
  "\t\t\t\tif (at < 0) return new URL(address).pathname;",
  "\t\t\t\tconst rest = address.slice(at + marker.length);",
  "\t\t\t\tlet stop = rest.length;",
  "\t\t\t\tfor (const ch of [\"/\", \"?\", \"#\"]) { const i = rest.indexOf(ch); if (i >= 0 && i < stop) stop = i; }",
  "\t\t\t\tlet path = rest.slice(stop);",
  "\t\t\t\tconst q = path.indexOf(\"?\"); if (q >= 0) path = path.slice(0, q);",
  "\t\t\t\tconst h = path.indexOf(\"#\"); if (h >= 0) path = path.slice(0, h);",
  "\t\t\t\treturn path;",
  "\t\t\t} catch {",
  "\t\t\t\treturn;",
  "\t\t\t}",
  "\t\t}",
].join("\n");

function patchResourceClients() {
  let resource;
  try {
    resource = readFileSync(RESOURCE_CLIENT, "utf8");
  } catch {
    return;
  }
  if (!resource.includes("address.toLowerCase().startsWith(\"dsh-resource://\")")) {
    const match = /function protocolOf\(address\) \{[\s\S]*?\n\t\t\}/.exec(resource);
    if (match === null) {
      console.log("repair-dsh: dsh-resource protocolOf not found; skipped");
    } else {
      writeFileSync(RESOURCE_CLIENT, resource.slice(0, match.index) + RESOURCE_PROTOCOL_REPLACEMENT + resource.slice(match.index + match[0].length), "utf8");
      console.log("repair-dsh: patched dsh-resource protocolOf");
    }
  }

  let sidebar;
  try {
    sidebar = readFileSync(SIDEBAR_RIGHT_CLIENT, "utf8");
  } catch {
    return;
  }
  if (sidebar.includes("const marker = \"://\";")) return;
  const match = /function pathOf\(address\) \{[\s\S]*?\n\t\t\}/.exec(sidebar);
  if (match === null) {
    console.log("repair-dsh: dsh-resource pathOf not found; skipped");
    return;
  }
  writeFileSync(SIDEBAR_RIGHT_CLIENT, sidebar.slice(0, match.index) + RESOURCE_PATH_REPLACEMENT + sidebar.slice(match.index + match[0].length), "utf8");
  console.log("repair-dsh: patched dsh-resource pathOf");
}

patchResourceClients();


// --- fonts for the WASM Office converter ------------------------------------
// The Android payload ships no system fonts. LibreOffice refuses to render with
// "No usable fonts were found", which the Web UI surfaces as "Office 预览不可用".
// Android's own /system/fonts is bind-mounted here; when that works the bundled
// open-source font set is removed. Only phones without usable CJK fonts fall
// back to opt/dsh/android/fonts, which is packaged inside the APK.
const FONT_SOURCE = join(root, "..", "android", "fonts");
const FONT_TARGET = "/usr/share/fonts/truetype/dsh";
const SYSTEM_FONT_SOURCE = "/opt/dsh/android/system-fonts";
const SYSTEM_FONT_TARGET = "/usr/share/fonts/truetype/system";
const SYSTEM_FONT_NAMES = [
  "NotoSerifCJK-Regular.ttc",
  "NotoSansCJK-Regular.ttc",
  "NotoSerif-Regular.ttf",
  "NotoSans-Regular.ttf",
  "DroidSansFallback.ttf",
];

// Prefer the phone's own fonts. The app bind-mounts Android /system/fonts at
// /opt/dsh/android/system-fonts; linking them keeps the APK free of font data.
// Returns true when at least one system font was linked.
function linkSystemFonts() {
  if (!existsSync(SYSTEM_FONT_SOURCE)) return false;
  try {
    mkdirSync(SYSTEM_FONT_TARGET, { recursive: true });
  } catch {
    return false;
  }
  let linked = 0;
  for (const name of SYSTEM_FONT_NAMES) {
    const source = join(SYSTEM_FONT_SOURCE, name);
    if (!existsSync(source)) continue;
    const target = join(SYSTEM_FONT_TARGET, name);
    try {
      if (!existsSync(target)) symlinkSync(source, target);
      linked++;
    } catch (error) {
      console.log("repair-dsh: system font link failed for " + name + ": " + error);
    }
  }
  if (linked > 0) console.log("repair-dsh: linked " + linked + " system font(s) from " + SYSTEM_FONT_SOURCE);
  return linked > 0;
}

// Android fonts win; only a phone without usable CJK fonts installs the
// bundled fallback set.
if (linkSystemFonts()) {
  try { rmSync(FONT_TARGET, { recursive: true, force: true }); } catch {}
} else {
  installFonts();
}

function installFonts() {
  let files;
  try {
    files = readdirSync(FONT_SOURCE);
  } catch {
    return;
  }
  try {
    mkdirSync(FONT_TARGET, { recursive: true });
  } catch {
    return;
  }
  let installed = 0;
  for (const name of files) {
    if (!/\.(ttf|otf|ttc)$/i.test(name)) continue;
    const source = join(FONT_SOURCE, name);
    const target = join(FONT_TARGET, name);
    try {
      if (existsSync(target) && statSync(target).size === statSync(source).size) continue;
      copyFileSync(source, target);
      chmodSync(target, 0o644);
      installed++;
    } catch (error) {
      console.log("repair-dsh: font install failed for " + name + ": " + error);
    }
  }
  if (installed > 0) console.log("repair-dsh: installed " + installed + " office font(s) into " + FONT_TARGET);
}


// --- normalize CRLF in guest configuration ----------------------------------
// The bundled rootfs was assembled on Windows and a few text files arrived with
// CRLF endings. ld.so then treats the trailing \r as part of the preload path,
// and bash parses $'\r' as commands. Normalize the files that affect startup.
function normalizeTextFile(path) {
  try {
    const text = readFileSync(path, "utf8");
    if (!text.includes("\r")) return;
    writeFileSync(path, text.replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8");
    console.log("repair-dsh: normalized CRLF in " + path);
  } catch {
    /* file may not exist in an imported distro */
  }
}

normalizeTextFile("/etc/ld.so.preload");
normalizeTextFile("/etc/bash.bashrc");


// --- don't report a missing font family when a fallback can render ----------
// LibreOffice uses the configured fallback family, but the kit still reports
// the document's original family as missing. That turns a perfectly rendered
// preview into a red warning. With at least one usable fallback font, silence
// the warning and keep the fallback rendering.
const KIT_WORKER = join(root, "@deepseek-ai/libreoffice-kit/lib/worker.js");

function patchMissingFontWarning() {
  let source;
  try {
    source = readFileSync(KIT_WORKER, "utf8");
  } catch {
    return;
  }
  if (source.includes("missingFamily = void 0;")) return;
  if (!source.includes("missingFamily = primary;")) return;
  writeFileSync(KIT_WORKER, source.replace("missingFamily = primary;", "missingFamily = void 0;"), "utf8");
  console.log("repair-dsh: suppressed false missing-font warnings");
}

patchMissingFontWarning();


// --- ArcWeb has no Iterator global ------------------------------------------
// pdf.js calls Iterator.prototype.join at module initialization. Huawei's
// ArkWeb throws ReferenceError before the PDF slot can mount, which shows as a
// blank preview even though the PDF was generated correctly.
const PDF_CLIENT = join(root, "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/lib/client.pdf.js");

function patchPdfIterator() {
  let source;
  try {
    source = readFileSync(PDF_CLIENT, "utf8");
  } catch {
    return;
  }
  const oldLine = 'if (typeof Iterator.prototype.join !== "function") Iterator.prototype.join = function(separator) {';
  if (!source.includes(oldLine)) return;
  source = source.replace(oldLine, 'if (typeof Iterator !== "undefined" && typeof Iterator.prototype.join !== "function") Iterator.prototype.join = function(separator) {');
  writeFileSync(PDF_CLIENT, source, "utf8");
  console.log("repair-dsh: guarded pdf.js Iterator prototype access");
}

patchPdfIterator();


// --- sandbox runner (write-path policy) -------------------------------------
// Route workspace-write / read-only commands through the policy runner that
// ships in usr/local/bin.  The runner only exports the DSH_SANDBOX_* markers;
// the proot sandbox_policy extension enforces them.
const SANDBOX_LOCAL = join(root, "@deepseek-ai/dsh-sandbox-local/lib/index.js");
const POLICY_RUNNER = "/usr/local/bin/sandbox-run";

function patchSandboxRunner() {
  let source;
  try {
    source = readFileSync(SANDBOX_LOCAL, "utf8");
  } catch {
    return;
  }
  if (source.includes(POLICY_RUNNER)) return;
  const patched = source
    .replace(
      /runnerCommand: z\.array\(z\.string\(\)\)\.default\(\[\]\)/,
      'runnerCommand: z.array(z.string()).default(["' + POLICY_RUNNER + '"])'
    )
    .replace(
      /runnerFailureSignatures: z\.array\(z\.string\(\)\)\.default\(\[\]\)/,
      'runnerFailureSignatures: z.array(z.string()).default(["sandbox-run: "])'
    );
  if (patched === source) {
    console.log("repair-dsh: sandbox-local runner config not found");
    return;
  }
  writeFileSync(SANDBOX_LOCAL, patched, "utf8");
  console.log("repair-dsh: sandbox-local runner configured (" + POLICY_RUNNER + ")");
}

patchSandboxRunner();


// --- diagnostics: leave a trace in shared storage ---------------------------
const POLICY_LOG = "/sdcard/dsh-policy.log";

function policyLog(line) {
  try {
    appendFileSync(POLICY_LOG, line + "\n");
  } catch {
    /* shared storage may be unavailable; diagnostics are best effort */
  }
}

function reportPolicyState() {
  policyLog("--- boot " + new Date().toISOString());
  let sandbox = null;
  try {
    sandbox = readFileSync(SANDBOX_LOCAL, "utf8");
  } catch {
    policyLog("sandbox-local: missing");
  }
  if (sandbox !== null) {
    policyLog("sandbox-local: runnerCommand patched=" + sandbox.includes(POLICY_RUNNER));
  }
  try {
    const st = statSync("/usr/local/bin/sandbox-run");
    policyLog("runner: present mode=" + (st.mode & 0o777).toString(8));
  } catch {
    policyLog("runner: missing");
  }
  try {
    const html = readFileSync(FRONTEND_INDEX, "utf8");
    policyLog("polyfill: present=" + html.includes(POLYFILL_MARK));
  } catch {
    policyLog("polyfill: index missing");
  }
}

reportPolicyState();
