/**
 * repair-profile.mjs — top up the seeded profile on a guest that already has one.
 *
 * `start-dsh.sh` copies the whole seed only when `profiles/web/package.json` is
 * missing, because that file is *user data*: the bundle list in it is whatever
 * the user has made of their profile. Two consequences, both seen in the wild:
 *
 *   1. A build that adds a bundle row (the two `@local` plugins here) can never
 *      reach a device that already installed an earlier build — the seed is not
 *      copied again, so the packages sit on disk unloaded.
 *   2. The 1.1.5 fresh-install bug (issue #3) left profiles without the
 *      `android-sandbox` patch row, which is what registers the app's plugin —
 *      and both of the ways to fix that live inside the plugin that never
 *      loaded, so the user cannot dig themselves out.
 *
 * So this repairs per file, additively: missing files are copied from the seed,
 * missing rows are appended, and *nothing that already exists is rewritten*.
 * Every failure is logged and swallowed — a profile repair must never be the
 * reason a sandbox does not boot.
 *
 * Usage: node repair-profile.mjs [seed-dir] [home-dir]
 *        defaults: /opt/dsh/dsh-home-seed and $DSH_HOME (then $HOME, then /root)
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const seed = process.argv[2] ?? "/opt/dsh/dsh-home-seed";
const home = process.argv[3] ?? process.env.DSH_HOME ?? process.env.HOME ?? "/root";
const profile = join(home, ".dsh", "profiles", "web");
const seedProfile = join(seed, "profiles", "web");

/**
 * Bundle rows this build promises, `name -> file: specifier`. Kept in step with
 * `profile/package.json` (the seed) and with
 * `payload/home/.dsh/profiles/web/node_modules/@local/`.
 */
const BUNDLES = {
	"dshmarket": "file:./node_modules/dshmarket",
	"@local/agent-browser-viewer": "file:./node_modules/@local/agent-browser-viewer",
	"@local/dsh-ball-summarizer": "file:./node_modules/@local/dsh-ball-summarizer"
};

/**
 * Rows that used to ship and no longer do: `retired -> replacement`.
 *
 * Only the *bundle* row is dropped — the dependency row and the directory stay, so
 * the change is reversible by hand (put the name back into `dsh.profile.bundles`) and
 * nothing the user might have edited is deleted. The self-built market was replaced
 * by the public npm package `dshmarket` (see THIRD_PARTY.md), and we only drop the
 * old row once the replacement is actually in place: if `dshmarket` cannot be added
 * (missing files, unparsable profile), the old row is left exactly as it was — a
 * device with a working market beats a tidy bundle list.
 */
const RETIRED = {
	"@local/dsh-market": "dshmarket"
};

/** The patch row the app's settings page and terminal button live behind. */
const PATCH_MARKER = "android-sandbox";

/**
 * Telemetry is opt-out for this app, and the OTel row is the single biggest
 * module-resolution cost at boot (\~195 modules, measured on-device). DSH's
 * DSH_TELEMETRY_DISABLED switch only disables session-telemetry-otel, so the
 * provider row itself needs this profile patch. Appended additively for
 * existing profiles; fresh installs get it from the seed patch.
 */
const TELEMETRY_ROW_ID = "otel";
const TELEMETRY_PATCH = "- id: otel\n  disabled: true";

let changed = 0;

function log(line) {
	console.log(`repair-profile: ${line}`);
}

/**
 * Is this bundle's package actually on disk?
 *
 * A row without files is worse than a missing row: the loader fails on the whole
 * bundle and the user loses the feature (the market tab, say) with no way to tell
 * why. The hot overlay writes these packages, so the check also makes the repair
 * self-healing - the row lands on the next boot after the files arrive.
 */
function installed(name) {
	return existsSync(join(profile, "node_modules", name, "package.json"));
}

/** Copy a seed file in place when the guest has none. */
function seedFile(name) {
	const target = join(profile, name);
	if (existsSync(target)) return false;
	const source = join(seedProfile, name);
	if (!existsSync(source)) return false;
	mkdirSync(profile, { recursive: true });
	copyFileSync(source, target);
	changed += 1;
	log(`seeded ${name}`);
	return true;
}

/** package.json: append the missing dependency and bundle rows, keep the rest. */
function repairPackageJson() {
	if (seedFile("package.json")) return;
	const target = join(profile, "package.json");
	let document;
	try {
		document = JSON.parse(readFileSync(target, "utf8"));
	} catch (error) {
		log(`package.json is not JSON (${error.message}); left as it is`);
		return;
	}
	if (document === null || typeof document !== "object" || Array.isArray(document)) return;
	const dependencies = document.dependencies ?? (document.dependencies = {});
	if (dependencies === null || typeof dependencies !== "object") return;
	const dsh = document.dsh ?? (document.dsh = {});
	const profileSection = dsh !== null && typeof dsh === "object"
		? (dsh.profile ?? (dsh.profile = {}))
		: null;
	if (profileSection === null || typeof profileSection !== "object") return;
	const bundles = Array.isArray(profileSection.bundles) ? profileSection.bundles : (profileSection.bundles = []);
	let touched = false;
	for (const [name, specifier] of Object.entries(BUNDLES)) {
		if (dependencies[name] === undefined) {
			dependencies[name] = specifier;
			touched = true;
			log(`added dependency ${name}`);
		}
		if (!bundles.includes(name)) {
			if (!installed(name)) {
				log(`skipped bundle ${name}: package not on disk yet`);
				continue;
			}
			bundles.push(name);
			touched = true;
			log(`added bundle ${name}`);
		}
	}
	// Retire rows that no longer ship — but only when the replacement is present,
	// and only the bundle row (the dependency row and the directory stay, so the
	// user can undo this by hand; see RETIRED).
	for (const [old, replacement] of Object.entries(RETIRED)) {
		if (!bundles.includes(old)) continue;
		if (!bundles.includes(replacement) || !installed(replacement)) {
			log(`kept retired ${old}: replacement ${replacement} is not ready`
				+ (installed(replacement) ? "" : " (package not on disk)"));
			continue;
		}
		profileSection.bundles = bundles.filter((row) => row !== old);
		touched = true;
		log(`retired bundle row ${old} (replaced by ${replacement}; dependency row and files kept)`);
	}
	if (!touched) return;
	// Re-serialising keeps every existing key and value; only the missing rows
	// are new. Two-space indent matches what the harness writes.
	writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
	changed += 1;
}

/** cordis.patch.yml: the app's plugin row, appended verbatim from the seed. */
function repairPatchFile() {
	if (seedFile("cordis.patch.yml")) return;
	const target = join(profile, "cordis.patch.yml");
	let text;
	try {
		text = readFileSync(target, "utf8");
	} catch {
		return;
	}
	if (text.includes(PATCH_MARKER)) return;
	const block = seedPatchBlock();
	if (block === null) {
		log("the seed has no android-sandbox row to copy");
		return;
	}
	const separator = text === "" || text.endsWith("\n") ? "" : "\n";
	writeFileSync(target, `${text}${separator}\n${block}\n`);
	changed += 1;
	log(`appended the ${PATCH_MARKER} row`);
}

/** The seed's entry that mentions the marker, taken whole (its `- ` line to the next). */
function seedPatchBlock() {
	const source = join(seedProfile, "cordis.patch.yml");
	if (!existsSync(source)) return null;
	let text;
	try {
		text = readFileSync(source, "utf8");
	} catch {
		return null;
	}
	if (!text.includes(PATCH_MARKER)) return null;
	const lines = text.split("\n");
	const marker = lines.findIndex((line) => line.includes(PATCH_MARKER));
	if (marker < 0) return null;
	let start = marker;
	while (start > 0 && !/^- /.test(lines[start])) start -= 1;
	if (!/^- /.test(lines[start])) return null;
	let end = start + 1;
	while (end < lines.length && !/^- /.test(lines[end])) end += 1;
	return lines.slice(start, end).join("\n").replace(/\s+$/u, "");
}

/**
 * Add `- id: otel / disabled: true` to the profile patch, once.
 *
 * The profile patch is user data, so this is additive and idempotent: an
 * existing `id: otel` row (enabled or disabled) is left alone. The empty
 * `[]` placeholder the harness writes is replaced rather than appended to.
 * A backup is kept next to the file for manual recovery.
 */
function repairTelemetryRow() {
	const target = join(profile, "cordis.patch.yml");
	let text;
	try {
		text = readFileSync(target, "utf8");
	} catch {
		return;
	}
	if (/(^|\n)[ \t]*-[ \t]*id:[ \t]*otel\b/u.test(text)) return;
	try {
		copyFileSync(target, `${target}.bak-otel`);
	} catch {
		// A failed backup must not block the (additive) patch.
	}
	const withoutPlaceholder = text.replace(/^[ \t]*\[\][ \t]*\r?\n?/mu, "");
	const base = withoutPlaceholder === "" || withoutPlaceholder.endsWith("\n")
		? withoutPlaceholder
		: `${withoutPlaceholder}\n`;
	writeFileSync(target, `${base}${TELEMETRY_PATCH}\n`);
	changed += 1;
	log(`appended the ${TELEMETRY_ROW_ID} disable row`);
}

try {
	repairPackageJson();
	repairPatchFile();
	repairTelemetryRow();
} catch (error) {
	log(`skipped (${error.message})`);
}
log(changed === 0 ? "nothing to repair" : `${changed} file(s) topped up`);
