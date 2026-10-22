#!/bin/sh
# Build the DSH Android APK without Gradle.
#
# Pipeline: aapt2 compile+link (resources/manifest) -> javac -> d8 -> hand-rolled
# zip packing (alignment for resources.arsc and .so) -> apksig v2+v3.
# Everything here runs in the Linux build sandbox; aapt2 is an x86_64 glibc binary
# executed through qemu with the staged Debian loader prefix.
set -eu

# Every external tool and key path is overridable, because a CI runner has none of
# this machine's layout: it brings its own Android SDK (aapt2 / android.jar / d8),
# its own apksig jar, its own libproot.so and its own keystore. Unset, each default
# is exactly what this device uses — local builds do not change.
#
# The tree this script lives in, so a clone builds wherever it is checked out.
# Override with DSH_SRC_DIR when driving it from a separate build directory.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_VERSION="${APP_VERSION:-$(cat "$ROOT/VERSION" 2>/dev/null || echo 1.0.0)}"
# The code is derived from the version name, but a revision that keeps the same
# name (assets replaced in place, "1.2.0" build 10201) needs to say so explicitly:
# devices compare versionCode, so without a bump they see no update at all.
# Default comes from scripts/version.py, which reads VERSION_CODE — the formula
# (maj*10000+min*100+patch) is only its fallback. A version re-released in place
# has a code ahead of the formula, and a build that used the formula would ship
# an APK older than what devices already run.
APP_CODE="${APP_CODE:-$(python3 "$ROOT/scripts/version.py" --field code)}"
# The sandbox runtime's own number, independent of the app version on purpose: a
# shell release that does not touch the runtime keeps the same terminal line.
TERMINAL_VERSION="${TERMINAL_VERSION:-$(cat "$ROOT/ROOTFS_VERSION" 2>/dev/null || echo 1)}"
# 1.2.1+: fold assets/hot.zip into the payload at build time instead of
# rewriting ~300 files into app storage on every launch. The baked payload has
# different bytes, so its version token is pinned to the pre-bake payload: an
# existing install already has those files on disk and must not re-extract 1 GB.
HOT_IN_PAYLOAD="${HOT_IN_PAYLOAD:-1}"  # no assets/hot.zip by default (user requirement)
PAYLOAD_VERSION_OVERRIDE="${PAYLOAD_VERSION_OVERRIDE:-}"
APP="$ROOT/app"
BUILD="$ROOT/build"
OUT="$ROOT/out"
ANDROID_JAR="${ANDROID_JAR:-/tmp/platform/android-36/android.jar}"
AAPT2="${AAPT2:-/tmp/aapt2dir/aapt2}"
D8="${D8:-/tmp/r8.jar}"
APKSIG="${APKSIG:-/tmp/apksig.jar}"
PROOT="${PROOT:-/var/minis/mounts/Download/libproot.so}"

SRC_JAVA="$APP/java"
LIBS="$APP/libs"
DEX_DIR="$BUILD/dex"
CLASSES="$BUILD/classes"
RES_FLAT="$BUILD/res-flat"
KEYSTORE="$ROOT/keystore/dsh.p12"
KS_PASS="${KS_PASS:-dshandroid}"   # override when building your own release
KS_ALIAS="${KS_ALIAS:-dsh}"

mkdir -p "$OUT" "$BUILD" "$DEX_DIR" "$CLASSES/shizuku" "$RES_FLAT"

echo "== 0/7 icons =="
command -v rsvg-convert >/dev/null || { echo "need rsvg-convert (librsvg) for the icon" >&2; exit 1; }
python3 "$ROOT/scripts/render_icon.py"

# aapt2 is an x86_64 glibc binary. This device is arm64, so it runs it through
# qemu with a staged Debian loader tree; a GitHub runner is x86_64 and runs it
# natively. Deciding by the host architecture (AAPT2_RUNNER overrides) is what
# makes one script work in both places — it used to hardcode qemu, so CI died
# with "qemu-x86_64: not found" at the first resource step.
if [ "${AAPT2_RUNNER+set}" != "set" ]; then
  if [ "$(uname -m)" = "x86_64" ]; then AAPT2_RUNNER=""; else AAPT2_RUNNER="qemu-x86_64"; fi
fi
aapt2_run() {
  if [ -n "$AAPT2_RUNNER" ]; then
    QEMU_LD_PREFIX="${QEMU_LD_PREFIX:-/opt/android/root64}" "$AAPT2_RUNNER" "$AAPT2" "$@"
  else
    "$AAPT2" "$@"
  fi
}

echo "== 1/7 resources =="
aapt2_run compile --dir "$APP/res" -o "$RES_FLAT/res.zip"

echo "== 2/7 link =="
rm -rf "$BUILD/r" && mkdir -p "$BUILD/r"
aapt2_run link \
  -I "$ANDROID_JAR" \
  --manifest "$APP/AndroidManifest.xml" \
  --min-sdk-version 26 --target-sdk-version 28 \
  --version-code "$APP_CODE" \
  --version-name "$APP_VERSION" \
  --java "$BUILD/r" \
  -o "$BUILD/base.apk" \
  "$RES_FLAT/res.zip"

echo "== hot overlay =="
# --base: an app build bakes in the base package of its own version, which
# is published as plain <app> until the first hot update of that line.
python3 "$ROOT/scripts/make_hot_zip.py" "$ROOT" "$BUILD/hot-assets/hot.zip" --base
HOT_VERSION="$(python3 - "$BUILD/hot-assets/hot.zip" <<'PY'
import json, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
    print(json.loads(archive.read("hot.json"))["version"])
PY
)"

if [ "$HOT_IN_PAYLOAD" = "1" ]; then
  # Pin the pre-bake token by default: the installed tree already contains the
  # overlay's files, so re-extracting a 1 GB payload buys nothing.
  if [ -z "$PAYLOAD_VERSION_OVERRIDE" ]; then
    PAYLOAD_VERSION_OVERRIDE="$(python3 - "$BUILD/payload-assets/payload.zip" <<'PY'
import hashlib, sys
print(hashlib.sha256(open(sys.argv[1], "rb").read()).hexdigest()[:16])
PY
)"
    echo "   baking hot overlay into payload (version token stays $PAYLOAD_VERSION_OVERRIDE)"
  fi
  python3 "$ROOT/scripts/bake_hot_into_payload.py" \
    --payload "$BUILD/payload-assets/payload.zip" \
    --manifest "$BUILD/payload-assets/payload.manifest" \
    --hot "$BUILD/hot-assets/hot.zip" \
    --out-payload "$BUILD/payload-assets/payload.baked.zip" \
    --out-manifest "$BUILD/payload-assets/payload.baked.manifest"
  mv "$BUILD/payload-assets/payload.baked.zip" "$BUILD/payload-assets/payload.zip"
  mv "$BUILD/payload-assets/payload.baked.manifest" "$BUILD/payload-assets/payload.manifest"
fi

echo "== update manifest =="
python3 "$ROOT/scripts/make_update_manifest.py" "$ROOT"

echo "== 3/7 javac =="
python3 - "$BUILD/payload-assets/payload.zip" "$SRC_JAVA/dev/dsh/android/BuildInfo.java" "$APP_VERSION" "$TERMINAL_VERSION" "$APP_CODE" "$PAYLOAD_VERSION_OVERRIDE" "$HOT_IN_PAYLOAD" "$HOT_VERSION" <<'GEN'
import hashlib, pathlib, sys
archive = pathlib.Path(sys.argv[1])
digest = sys.argv[6].strip() or hashlib.sha256(archive.read_bytes()).hexdigest()[:16]
version = sys.argv[3].strip()   # version string, not a path
terminal = sys.argv[4].strip()
code = int(sys.argv[5])         # APP_CODE: a revision keeps the name, bumps the code
hot_in_payload = sys.argv[7].strip() == "1"
hot_version = sys.argv[8].strip()
target = pathlib.Path(sys.argv[2])
target.write_text(
    "package dev.dsh.android;\n\n"
    "/** Generated by scripts/build_apk.sh — payload content hash. Do not edit. */\n"
    "final class BuildInfo {\n"
    f'    static final String PAYLOAD_VERSION = "{digest}";\n'
    f'    static final String APP_VERSION = "{version}";\n'
    f"    static final int APP_VERSION_CODE = {code};\n"
    f'    static final String ROOTFS_VERSION = "{terminal}";\n'
    f"    static final boolean HOT_IN_PAYLOAD = {'true' if hot_in_payload else 'false'};\n"
    f'    static final String HOT_VERSION = "{hot_version}";\n'
    "}\n",
    encoding="utf-8",
)
print(f"   app {version}, terminal t{terminal}, payload token {digest}, hot-in-payload={hot_in_payload} ({hot_version})")
GEN
find "$SRC_JAVA" -name '*.java' > "$BUILD/sources.txt"
# aapt2 --java wrote R.java in step 2; javac must compile it too, and the append
# has to come after the redirect that creates the list.
if [ -d "$BUILD/r" ]; then
  find "$BUILD/r" -name '*.java' >> "$BUILD/sources.txt"
fi
javac -encoding UTF-8 -source 8 -target 8 -nowarn \
  -classpath "$ANDROID_JAR:$(ls "$LIBS"/*.jar | tr '\n' ':')" \
  -d "$CLASSES" @"$BUILD/sources.txt"

echo "== 4/7 d8 =="
mkdir -p "$DEX_DIR"
java -cp "$D8" com.android.tools.r8.D8 --release --min-api 26 \
  --lib "$ANDROID_JAR" \
  --output "$DEX_DIR" \
  $(find "$CLASSES" -name '*.class') "$LIBS"/*.jar

echo "== 5/7 pack =="
# Two shells out of one build. The full one carries the runtime; the slim one
# leaves it out, because the rootfs is 190 MB that only changes when the terminal
# version does — it is published separately (release tag t<N>) and downloaded by
# whoever needs it. Everything else in the APK is identical.
ASSETS=""
if [ "${SLIM:-0}" != "1" ]; then
  ASSETS="assets/payload.zip:$BUILD/payload-assets/payload.zip
assets/payload.manifest:$BUILD/payload-assets/payload.manifest"
fi
APK_NAME="dsh-android.apk"
[ "${SLIM:-0}" = "1" ] && APK_NAME="dsh-android-slim.apk"
# `if`, not `&&`: a false test in an `&&` list is the pipeline's exit status, and
# under `set -e` that kills the build silently right before the pack.
echo "$ASSETS" | while read -r line; do
  if [ -n "$line" ] && [ ! -f "${line#*:}" ]; then
    echo "缺少载荷：${line#*:}（先跑 make_payload_zip.py）" >&2
    exit 1
  fi
done
# The overlay is inside the payload when HOT_IN_PAYLOAD=1; packing the
# separate archive would only reintroduce the per-launch rewrite.
HOT_ASSET="assets/hot.zip:$BUILD/hot-assets/hot.zip"
if [ "$HOT_IN_PAYLOAD" = "1" ]; then
  HOT_ASSET=""
fi
# shellcheck disable=SC2086
python3 "$ROOT/scripts/pack_apk.py" "$BUILD/base.apk" "$BUILD/unsigned.apk" \
  "classes.dex:$DEX_DIR/classes.dex" \
  "lib/arm64-v8a/libproot.so:$PROOT" \
  $ASSETS \
  $HOT_ASSET

echo "== 6/7 keystore =="
if [ ! -f "$KEYSTORE" ]; then
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -keystore "$KEYSTORE" -storetype PKCS12 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -alias "$KS_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=DSH Android, OU=minis, O=minis, L=, S=, C=CN" >/dev/null 2>&1
  echo "   generated $KEYSTORE"
fi

echo "== 7/7 sign =="
javac -encoding UTF-8 -nowarn -classpath "$APKSIG" -d "$BUILD/sign" "$ROOT/scripts/Sign.java"
java -cp "$APKSIG:$BUILD/sign" Sign \
  "$BUILD/unsigned.apk" "$OUT/$APK_NAME" "$KEYSTORE" "$KS_PASS" "$KS_ALIAS" "$KS_PASS"

ls -la "$OUT/$APK_NAME"
