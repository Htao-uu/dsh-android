#!/bin/sh
# Fetch the PRoot runtime library the APK embeds (lib/arm64-v8a/libproot.so).
#
# The binary is built from https://github.com/Htao-uu/proot-write-policy
# (GPL-2.0-or-later), a fork of termux/proot that adds the write-path policy
# extension used by the Android sandbox integration.  Source, build helper and
# provenance are in that repository; the release asset below is built from its
# tagged source and pinned by sha256.
#
# Usage: fetch-proot.sh [output-path]   (default build/proot/libproot.so)
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/build/proot/libproot.so}"

PROOT_SHA256="a31e889dcfde97546cdbdd96cbbe1ade7ac4431e7c0b72f38b4f963b8cae78f4"
PROOT_URL="https://github.com/Htao-uu/proot-write-policy/releases/download/v1.0.0/libproot.so"

if [ -f "$OUT" ] && [ "$(sha256sum "$OUT" | cut -d' ' -f1)" = "$PROOT_SHA256" ]; then
	echo "proot: $OUT is up to date ($(wc -c < "$OUT") bytes)"
	exit 0
fi

command -v curl >/dev/null || { echo "proot: need curl" >&2; exit 1; }

mkdir -p "$(dirname "$OUT")"
echo "proot: downloading libproot.so"
curl -fsSL "$PROOT_URL" -o "$OUT.tmp"
GOT="$(sha256sum "$OUT.tmp" | cut -d' ' -f1)"
[ "$GOT" = "$PROOT_SHA256" ] || { echo "proot: sha256 mismatch (got $GOT)" >&2; rm -f "$OUT.tmp"; exit 1; }
mv "$OUT.tmp" "$OUT"
echo "proot: installed $OUT ($(wc -c < "$OUT") bytes, sha256 verified)"
