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
import { readFileSync, writeFileSync, appendFileSync, existsSync, statSync } from "node:fs";
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

function patchFrontendIndex() {
  let html;
  try {
    html = readFileSync(FRONTEND_INDEX, "utf8");
  } catch {
    return;
  }
  if (html.includes(POLYFILL_MARK)) return;
  const head = html.indexOf("<head>");
  const at = head >= 0 ? head + 6 : 0;
  writeFileSync(FRONTEND_INDEX, html.slice(0, at) + "\n    " + POLYFILL_SCRIPT + html.slice(at), "utf8");
  console.log("repair-dsh: injected AbortSignal.any polyfill into dsh-web-frontend index.html");
}

patchFrontendIndex();


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
