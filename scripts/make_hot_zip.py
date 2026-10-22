#!/usr/bin/env python3
"""Bundle the files that must be updatable without re-installing the sandbox.

The payload archive is versioned by content hash, so every tweak to the plugin
or to a guest script used to force the app to unpack ~400 MB again. Those files
are tiny and live at fixed paths, so they travel separately as assets/hot.zip and
are re-applied on every launch.

There are two modes, because two very different consumers read this archive:

  default (full overlay) — what `release_hot.sh` publishes and what
      `build_apk.sh --base` bakes into a *payload*. It carries everything the
      guest side may need to update in the field:

        opt/dsh/android/**                  guest-side service + entry script
        etc/**                              distro files we deliberately adjust
        usr/local/bin/**                    guest commands (ui, shiz, ball)
        @home/**                            guest home (skills, instructions)
        opt/dsh/dsh-plugin-android/**       the Android plugin, payload copy
        @home/.dsh/profiles/web/node_modules/<default plugin>/**
                                            the default plugins a fresh profile
                                            loads (@home is the profile path)

  --baked (minimal baked overlay) — what an *APK* bakes in as assets/hot.zip.
      The app re-applies it on every launch, so every byte is per-launch I/O;
      the payload it ships next to already carries the rest. It holds only what
      a new build must change on an already-installed device:

        opt/dsh/android/repair-profile.mjs  tops up the profile's bundle rows
        opt/dsh/android/start-dsh.sh        the entry script the app runs
        @home/.dsh/profiles/web/node_modules/<default plugin>/**
        hot.json

      A baked package always claims sp0 (`--base` semantics): it *is* the base
      of its line. The default mode keeps the sp sequence through the HOT
      tracker, because a published hot update has to rise above the base.

Only a *rootfs* change (a package, node, a patched dependency) still needs the
full payload. The file is deliberately small enough to keep in the APK verbatim.

Usage: make_hot_zip.py <repo-root> <out.zip> [--base] [--baked]

The version a user sees is `<app>-t<terminal>-sp<n>` (see scripts/version.py),
with sp0 meaning "this line has no hot update yet" — which is what an app build
bakes in, selected with `--base` or `--baked`.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import time
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import version  # noqa: E402  (sibling script, the one definition of the version model)

# Prefixes an external package may write to. Anything else is refused: a hot
# package is executable content, and "it came from the user" is not the same as
# "it may drop files anywhere in the guest".
ALLOWED_PREFIXES = (
    "opt/dsh/android/",
    "opt/dsh/dsh-plugin-android/",
    "etc/",
    "@home/",
    # guest commands: ui, shiz, ball. Kept in step with HOT_ALLOWED_PREFIXES in
    # app/java/dev/dsh/android/Payload.java — the app validates the same list.
    "usr/local/bin/",
)

# Where the last package this tree produced is recorded: `{app, sp, hash}`.
# Committed, because the sequence number has to survive across machines and
# sessions — recomputing it from the network would double-bump on a retry.
TRACKER = "HOT"

# Default plugins this build ships: vendored under plugin/, seeded into a fresh
# profile by profile/package.json, and handed to already-installed devices over
# the hot overlay (both modes below). Kept in step with
# payload/opt/dsh/android/repair-profile.mjs (the additive top-up) and
# THIRD_PARTY.md (provenance).
DEFAULT_PLUGINS = ("dsh-mobile-shell", "dsh-archived-chat-cleanup", "agnes-media")

# The files a baked overlay must carry, *besides* hot.json and DEFAULT_PLUGINS.
# Missing one is a build error rather than a smaller package: this overlay is the
# only channel that reaches an already-installed device without a payload
# re-extraction, so a silently skipped file is a feature that never ships.
BAKED_FILES = (
    "opt/dsh/android/repair-profile.mjs",
    "opt/dsh/android/start-dsh.sh",
)


def add_file(archive: zipfile.ZipFile, source: Path, arcname: str) -> int:
    if not source.is_file():
        return 0
    info = zipfile.ZipInfo(arcname, date_time=(2026, 1, 1, 0, 0, 0))
    info.external_attr = (0o755 if name_is_executable(source) else 0o644) << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    archive.writestr(info, source.read_bytes())
    return 1


def name_is_executable(path: Path) -> bool:
    # os.access answers for the *packing* tree; shiz/ui ship without a suffix and
    # the mode is applied again by the app on the way in (see Payload.executableEntry).
    return path.suffix == ".sh" or path.name in ("shiz", "ui", "ball") or os.access(path, os.X_OK)


# Payload-only runtime files: they belong in the rootfs (and therefore in the
# APK's payload), but not in every incremental hot package.
#
#   usr/local/bin/pnpm  the 41 MB self-contained pnpm binary that fulfils
#                       "预装 pnpm" (issue #4). Carrying it here would make every
#                       hot package 41 MB instead of ~300 KB, and pnpm is a
#                       versioned tool that travels with the runtime line
#                       (t<N>), not with a plugin fix. Guests get it from the
#                       payload; the hot overlay only ever updates the small,
#                       frequently-changed things.
HOT_EXCLUDED = ("usr/local/bin/pnpm",)


def add_tree(archive: zipfile.ZipFile, root: Path, prefix: str) -> int:
    count = 0
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        dirnames[:] = [d for d in dirnames if d != "node_modules" or dirpath != str(root)]
        for name in sorted(filenames):
            path = Path(dirpath) / name
            rel = path.relative_to(root).as_posix()
            arcname = f"{prefix}/{rel}"
            if arcname in HOT_EXCLUDED:
                continue
            count += add_file(archive, path, arcname)
    return count


def add_default_plugins(archive: zipfile.ZipFile, root: Path) -> int:
    """The default plugins, at the path the *profile* resolves them from."""
    count = 0
    for name in DEFAULT_PLUGINS:
        count += add_tree(archive, root / "plugin" / name,
                          f"@home/.dsh/profiles/web/node_modules/{name}")
    return count


def read_tracker(root: Path) -> dict:
    """The last hot package this tree produced, or an empty record."""
    path = root / TRACKER
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def next_sp(root: Path, app: str, terminal: str, digest: str, base: bool) -> int:
    """The sequence number for the package about to be written.

    The version a user reads is `<app>-t<terminal>-sp<n>`, so the number has to
    be stable for identical content (a rebuild must not bump it and re-prompt
    every device) and monotonic for changed content (a lower number would look
    like a downgrade and the app's "already applied" check would skip the
    update).

      base build               -> always 0. The package an APK bakes in *is* the
                                  base of its line — that is what sp0 means, and
                                  it stays true even when a re-release of the same
                                  app version carries newer content than the last
                                  published hot package.
      same line, same payload  -> keep the number it already has (a rebuild must
                                  not bump it and re-prompt every device)
      same line, new payload   -> the next number (it has to rise: the app's
                                  "already applied" check is version equality)
      new line                 -> 1; a new line is a new app version or a new
                                  terminal version, and a hot package only ever
                                  applies on top of the runtime it was built for.
    """
    if base:
        return 0
    tracker = read_tracker(root)
    same_line = tracker.get("app") == app and str(tracker.get("terminal", "")) == terminal
    if same_line and tracker.get("hash") == digest:
        return int(tracker.get("sp", 0))
    if not same_line:
        return 1
    return int(tracker.get("sp", 0)) + 1


def write_tracker(root: Path, app: str, terminal: str, sp: int, digest: str) -> None:
    (root / TRACKER).write_text(json.dumps({
        "app": app,
        "terminal": terminal,
        "sp": sp,
        "version": version.hot_version(app, terminal, sp),
        "hash": digest,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    args = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
    baked = "--baked" in sys.argv
    # A baked package *is* the base of its line; --base stays a separate switch
    # for the full overlay build_apk.sh bakes.
    base = "--base" in sys.argv or baked
    if len(args) != 2:
        sys.exit(__doc__)
    root = Path(args[0]).resolve()
    out = Path(args[1]).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    current = version.read(root)
    app, terminal = current["app"], current["terminal"]

    # The guest-side link()/chown() shim is a built artefact that must never be
    # stale or absent: without it apt/dpkg fail inside the sandbox. Build it
    # here so any path that can produce a package produces it correctly.
    build = root / "scripts" / "build_linkfix.sh"
    if build.is_file():
        subprocess.run(["sh", str(build)], check=True)

    # Fail closed on the inputs the default plugins and the baked mode depend on:
    # an absent plugin or baked file is a missing feature on the device, not a
    # slightly smaller package — and it is exactly the mistake that only shows up
    # after the app has already been installed.
    if baked:
        for rel in BAKED_FILES:
            if not (root / "payload" / rel).is_file():
                sys.exit(f"--baked: missing payload/{rel}")
    for name in DEFAULT_PLUGINS:
        if not (root / "plugin" / name / "package.json").is_file():
            sys.exit(f"missing default plugin: plugin/{name}/package.json")

    written = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        if baked:
            # Minimal baked overlay: only what a new build must change on a device
            # that already has the payload (see the module docstring).
            for rel in BAKED_FILES:
                written += add_file(archive, root / "payload" / rel, rel)
            written += add_default_plugins(archive, root)
        else:
            # The whole guest-side service directory: the entry script, the PTY
            # service, and the link()/chown() shim with its source. Listing files
            # one by one here is exactly how a new one ends up missing from a
            # package, so the directory travels as a unit.
            written += add_tree(archive, root / "payload" / "opt" / "dsh" / "android", "opt/dsh/android")
            # Distro files we deliberately adjust (see payload/etc/): applied on every
            # launch so a fix here does not force a 400 MB payload re-extraction.
            written += add_tree(archive, root / "payload" / "etc", "etc")
            # guest commands: small, agent-facing, and worth a hot fix
            written += add_tree(archive, root / "payload" / "usr" / "local" / "bin", "usr/local/bin")
            # guest home files (skills, instructions): "@home/" maps to the guest's
            # /root, which is a bind mount the rootfs cannot reach.
            written += add_tree(archive, root / "payload" / "home", "@home")
            # ...and the plugin a second time, at the path the *profile* resolves it
            # from. The app can write there directly (same filesystem, no PRoot), so
            # a plugin update no longer depends on the guest-side copy step.
            written += add_tree(archive, root / "plugin" / "dsh-plugin-android",
                                "@home/.dsh/profiles/web/node_modules/dsh-plugin-android")
            written += add_tree(archive, root / "plugin" / "dsh-plugin-android", "opt/dsh/dsh-plugin-android")
            # The default plugins ride the same @home path a fresh profile
            # resolves them from (profile/package.json's file: dependencies).
            written += add_default_plugins(archive, root)
    # Content identity for the tracker and for the app's own logging. Computed
    # before hot.json exists, so stamping the version cannot change it.
    digest = hashlib.sha256()
    with zipfile.ZipFile(out) as archive:
        for name in sorted(archive.namelist()):
            digest.update(name.encode("utf-8"))
            digest.update(archive.read(name))
    content = digest.hexdigest()[:16]
    sp = next_sp(root, app, terminal, content, base)
    hot = version.hot_version(app, terminal, sp)
    with zipfile.ZipFile(out, "a", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(zipfile.ZipInfo("hot.json", date_time=time.localtime()[:6]),
                         json.dumps({"version": hot, "app": app, "terminal": terminal, "sp": sp,
                                     "hash": content, "files": written,
                                     "built": time.strftime("%Y-%m-%dT%H:%M:%S")}, indent=2))
    write_tracker(root, app, terminal, sp, content)
    print(f"wrote {out} ({out.stat().st_size} bytes, {written} files, version {hot}, content {content})")


if __name__ == "__main__":
    main()
