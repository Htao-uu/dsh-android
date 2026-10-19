import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "..", "payload", "opt", "dsh", "android", "repair-profile.mjs");
const base = mkdtempSync(join(tmpdir(), "dsh-repair-profile-"));
let failed = 0;
let seq = 0;

function check(label, condition, detail = "") {
  console.log((condition ? "ok   " : "FAIL ") + label + (condition ? "" : " :: " + detail));
  if (!condition) failed += 1;
}

function setup(name, patchText) {
  const root = join(base, name);
  const seed = join(root, "seed");
  const home = join(root, "home");
  const profile = join(home, ".dsh", "profiles", "web");
  mkdirSync(join(seed, "profiles", "web"), { recursive: true });
  mkdirSync(profile, { recursive: true });
  writeFileSync(join(seed, "profiles", "web", "cordis.patch.yml"), "- insert:\n    - id: android-sandbox\n      name: 'dsh-plugin-android'\n");
  writeFileSync(join(seed, "profiles", "web", "package.json"), JSON.stringify({ dependencies: {}, dsh: { profile: { bundles: [] } } }, null, 2) + "\n");
  if (patchText !== undefined) writeFileSync(join(profile, "cordis.patch.yml"), patchText);
  return { root, seed, home, profile, patch: join(profile, "cordis.patch.yml") };
}

// Run repair-profile in-process (the sandbox forbids spawning a child with pipes).
async function run(seed, home) {
  const oldArgv = process.argv;
  process.argv = [process.execPath, script, seed, home];
  try {
    await import(pathToFileURL(script).href + "?repair-test=" + (++seq));
  } finally {
    process.argv = oldArgv;
  }
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

async function main() {
  // 1. the [] placeholder is replaced, once
  {
    const t = setup("empty-array", "[]\n");
    await run(t.seed, t.home);
    const first = readFileSync(t.patch, "utf8");
    check("[] placeholder replaced", count(first, "- id: otel") === 1, JSON.stringify(first));
    check("[] is gone", !/^\s*\[\]\s*$/m.test(first), JSON.stringify(first));
    check("backup exists", existsSync(t.patch + ".bak-otel"));
    await run(t.seed, t.home);
    const second = readFileSync(t.patch, "utf8");
    check("idempotent on second run", first === second, JSON.stringify(second));
    check("no duplicate row", count(second, "- id: otel") === 1, JSON.stringify(second));
  }

  // 2. a normal list keeps its rows and gains ours at the end
  {
    const t = setup("normal-list", "- id: dsh-whale-widget\n  disabled: false\n");
    await run(t.seed, t.home);
    const text = readFileSync(t.patch, "utf8");
    check("existing row kept", text.includes("- id: dsh-whale-widget"));
    check("telemetry row appended", text.trimEnd().endsWith("- id: otel\n  disabled: true"), JSON.stringify(text));
  }

  // 3. already-present row is left untouched (no backup, no second row)
  {
    const original = "- id: otel\n  disabled: true\n";
    const t = setup("already-present", original);
    await run(t.seed, t.home);
    const text = readFileSync(t.patch, "utf8");
    check("existing otel row not duplicated", count(text, "- id: otel") === 1, JSON.stringify(text));
    check("no backup when telemetry row already present", !existsSync(t.patch + ".bak-otel"));
  }

  // 4. a fresh profile copies the seed patch (which already has the row)
  {
    const t = setup("fresh", undefined);
    await run(t.seed, t.home);
    const text = readFileSync(t.patch, "utf8");
    check("seed patch copied", text.includes("android-sandbox"));
    check("seed telemetry row preserved", count(text, "- id: otel") === 1, JSON.stringify(text));
  }
}

await main();
rmSync(base, { recursive: true, force: true });
if (failed) {
  console.error("\nrepair-profile tests FAILED: " + failed);
  process.exit(1);
}
console.log("\nrepair-profile tests passed");
