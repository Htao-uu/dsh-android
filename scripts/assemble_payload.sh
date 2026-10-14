#!/bin/sh
# Assemble the payload that ships inside the APK as assets/payload.tar.gz.
#
# Inputs:
#   build/rootfs-ubuntu/     Ubuntu + official Node + (trimmed) dsh, prepared
#                            by the earlier steps of the payload build
#   payload/                 this repo's overlay: PTY service, entry script,
#                            shiz CLI, plugin
#   plugin/dsh-plugin-android/
#   profile/                 the pre-seeded dsh profile (plugin preinstalled)
# Output:
#   build/payload-assets/payload.tar.gz
#
# The app unpacks this itself with java.util.zip, so the archive is a plain zip
# plus a manifest carrying modes and symlink targets.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/build"
# prepare_rootfs.sh produces build/rootfs-ubuntu/ (docs/BUILD.md calls this script
# with no environment set), so that is the default. It used to say build/rootfs,
# a tree nothing produces any more: the sanity check below would fail on a stale
# or half-built rootfs with "MISSING: usr/local/bin/node" and no explanation.
ROOTFS="${DSH_ROOTFS:-$BUILD/rootfs-ubuntu}"
ASSETS="$BUILD/payload-assets"

[ -d "$ROOTFS" ] || { echo "no $ROOTFS — build the rootfs first" >&2; exit 1; }

echo "== link shim =="
# Android denies link() to app processes, which is what makes apt/dpkg fail
# inside the guest; the shim is built here so the payload never ships a stale or
# missing copy. See payload/opt/dsh/android/linkfix.c.
sh "$ROOT/scripts/build_linkfix.sh"

echo "== pnpm (fetched, not committed) =="
# The payload ships a preinstalled pnpm (issue #4). The binary is 41 MB, so it is
# fetched here with a pinned version and verified hashes instead of living in git
# — the same step CI runs.
sh "$ROOT/scripts/fetch-pnpm.sh"

echo "== overlay / =="
cp -a "$ROOT/payload/." "$ROOTFS/"
chmod +x "$ROOTFS/opt/dsh/android/start-dsh.sh" "$ROOTFS/usr/local/bin/shiz" "$ROOTFS/usr/local/bin/ui"
chmod 755 "$ROOTFS/opt/dsh/android"

echo "== guest home (skills, instructions) =="
[ -d "$ROOT/payload/home" ] && cp -a "$ROOT/payload/home/." "$ROOTFS/opt/dsh/dsh-home-seed/"

echo "== profile (no plugin code) =="
# The profile's *configuration* ships in the payload; the plugin's *code* does
# not. It arrives through the hot overlay instead, which the app applies on every
# launch (including the first one) — that way a plugin fix is a ~90 KB hot
# package, and the 190 MB runtime stays untouched.
#
# The profile ships under /opt (immutable payload), NOT under /root: the app
# bind-mounts app storage onto /root, which would hide anything staged there.
SEED="$ROOTFS/opt/dsh/dsh-home-seed"
mkdir -p "$SEED/profiles/web/node_modules"
cp -a "$ROOT/profile/." "$SEED/profiles/web/"
# Remove anything a previous build left behind: a stale copy here would shadow
# the hot overlay's, and make the payload depend on the plugin again.
rm -rf "$ROOTFS/opt/dsh/dsh-plugin-android" "$SEED/profiles/web/node_modules/dsh-plugin-android"
# The self-built market was replaced by the public npm package `dshmarket`; the
# overlay above only *merges*, so a copy left by an earlier build would still be
# shipped (and its cordis.patch.yml registers the same loader row id `dsh-market`
# as the public package, which collides). Drop it here, the same way the plugin is
# dropped, and assert below that nothing brought it back.
rm -rf "$ROOTFS/opt/dsh/dsh-home-seed/.dsh/profiles/web/node_modules/@local/dsh-market" \
       "$SEED/profiles/web/node_modules/@local/dsh-market"

echo "== dsh source patches =="
python3 "$ROOT/patches/apply-hardlink-patch.py" "$ROOTFS/opt/dsh/node_modules"

echo "== sanity =="
# Retired bundle names must not ship (see the rm above), and the replacements must.
for gone in "@local/dsh-market"; do
  if [ -e "$SEED/.dsh/profiles/web/node_modules/$gone" ] || [ -e "$SEED/profiles/web/node_modules/$gone" ]; then
    echo "RETIRED PACKAGE STILL IN PAYLOAD: $gone" >&2
    exit 1
  fi
done
if [ ! -f "$SEED/.dsh/profiles/web/node_modules/dshmarket/package.json" ]; then
  echo "MISSING payload package: dshmarket" >&2
  exit 1
fi
for f in opt/dsh/android/pty-server.mjs \
         opt/dsh/android/start-dsh.sh \
         opt/dsh/node_modules/node-pty/prebuilds/linux-arm64/pty.node \
         opt/dsh/node_modules/@xterm/xterm/lib/xterm.js \
         opt/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/android-mobile.css \
         opt/dsh/node_modules/node-addon-require-builtin/lib/index.js \
         usr/local/bin/node bin/bash \
         usr/local/bin/pnpm \
         usr/local/bin/node \
         opt/dsh/dsh-home-seed/profiles/web/cordis.patch.yml \
         opt/dsh/dsh-home-seed/profiles/web/cordis.patch.yml \
         opt/dsh/android/liblinkfix.so etc/ld.so.preload \
         usr/local/bin/shiz bin/bash; do
  [ -e "$ROOTFS/$f" ] || { echo "MISSING: $f" >&2; exit 1; }
done
echo "   all expected files present"

mkdir -p "$ASSETS"
