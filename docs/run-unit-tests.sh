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

failed=0
for test in HotVersionTest PayloadMarkerTest UnpackPlanTest RecoveryPlanTest; do
  if ! java -cp "$OUT" "dev.dsh.android.$test"; then
    failed=1
  fi
done

[ "$failed" = "0" ] || { echo "unit tests FAILED" >&2; exit 1; }
echo "all unit tests passed"
