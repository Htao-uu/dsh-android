#!/bin/sh
# run-unit-tests.sh — the JVM-side tests: no device, no APK, no Android SDK.
#
# Everything under test is deliberately Android-free (HotVersion, PayloadMarker,
# UnpackPlan), so plain javac/java on any machine runs the same checks CI would:
#
#   * HotVersion     — hot-replay decision table (apply sp2 → restart → still sp2)
#   * PayloadMarker  — "is the runtime on disk the one this shell should use"
#   * UnpackPlan     — install-progress phases, 5 Hz pacing and the wording
#   * RecoveryPlan   — recovery mode: token rules, port range, when to auto-enter
#
# Usage: sh docs/run-unit-tests.sh [workdir]      (default: build/unit-tests)
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/build/unit-tests}"

command -v javac >/dev/null || { echo "need javac (apt-get install -y openjdk-21-jdk-headless)" >&2; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT"

javac -nowarn -d "$OUT" \
  "$ROOT/app/java/dev/dsh/android/HotVersion.java" \
  "$ROOT/app/java/dev/dsh/android/PayloadMarker.java" \
  "$ROOT/app/java/dev/dsh/android/UnpackPlan.java" \
  "$ROOT/app/java/dev/dsh/android/RecoveryPlan.java" \
  "$ROOT/docs/unit/dev/dsh/android/HotVersionTest.java" \
  "$ROOT/docs/unit/dev/dsh/android/PayloadMarkerTest.java" \
  "$ROOT/docs/unit/dev/dsh/android/UnpackPlanTest.java" \
  "$ROOT/docs/unit/dev/dsh/android/RecoveryPlanTest.java"

# --- boot script environment guard ----------------------------------------
# DSH_HOME is the harness's own home (~/.dsh). Exporting the guest user home
# under that name made dsh create a fresh empty home: every session and the API
# key looked gone. Keep the shell variable named GUEST_HOME and require the
# explicit unset before exec.
BOOT="$ROOT/payload/opt/dsh/android/start-dsh.sh"
PTY_HELPER="$ROOT/payload/opt/dsh/android/start-pty-after-port.sh"
if grep -qE '(^|[[:space:]])export[^#]*DSH_HOME' "$BOOT"; then
  echo "start-dsh.sh must not export DSH_HOME (it is the harness home)" >&2
  exit 1
fi
grep -q 'unset DSH_HOME' "$BOOT" || {
  echo "start-dsh.sh must unset DSH_HOME before exec" >&2
  exit 1
}
grep -q 'GUEST_HOME' "$BOOT" || {
  echo "start-dsh.sh should carry the guest home as GUEST_HOME" >&2
  exit 1
}
if grep -q 'DSH_HOME' "$PTY_HELPER"; then
  echo "start-pty-after-port.sh must not reference DSH_HOME" >&2
  exit 1
fi

echo "boot environment guard passed"

# --- repair-profile migration tests --------------------------------------
# Covers the additive otel-row migration (empty [] placeholder, existing list,
# already-present row, fresh seed copy). Skipped when node is unavailable.
if command -v node >/dev/null 2>&1; then
  node "$ROOT/scripts/test_repair_profile.mjs"
else
  echo "skip repair-profile tests (node not found)"
fi

failed=0
for test in HotVersionTest PayloadMarkerTest UnpackPlanTest RecoveryPlanTest; do
  if ! java -cp "$OUT" "dev.dsh.android.$test"; then
    failed=1
  fi
done

[ "$failed" = "0" ] || { echo "unit tests FAILED" >&2; exit 1; }
echo "all unit tests passed"
