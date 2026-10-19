#!/usr/bin/env python3
"""Bake the runtime hot overlay into the payload that ships inside the APK.

Why
---
Up to 1.2.1 the APK carried two archives: `assets/payload.zip` (the rootfs)
and `assets/hot.zip` (a few hundred small files: guest scripts, the Android
plugin, the profile's console packages and skills).  `Payload.applyHot()`
unpacked hot.zip into app storage on *every* launch.  That is ~5 MiB / 300
files of pointless writes per start and it invalidates every page-cache entry
of the very modules the harness is about to load.

This script folds hot.zip into payload.zip once, at build time:

  opt/... etc/... usr/...     -> the same path in the payload
  @home/...                   -> opt/dsh/dsh-home-seed/...  (guest /root is a
                                 bind mount; the seed is what a fresh install
                                 copies into it)
  hot.json                    -> dropped (it only describes the overlay)

Existing entries are replaced, new ones appended, and the payload manifest
gets the missing exec bits.  Unchanged entries are copied as *raw compressed
bytes*: re-deflating a 1 GB rootfs only to make the build slower is not a
feature.

Usage
-----
    python3 bake_hot_into_payload.py \
        --payload  build/payload-assets/payload.zip \
        --manifest build/payload-assets/payload.manifest \
        --hot      build/hot-assets/hot.zip \
        --out-payload  build/payload-assets/payload.baked.zip \
        --out-manifest build/payload-assets/payload.baked.manifest

The output payload has a different sha256, so a build that uses it must pin
BuildInfo.PAYLOAD_VERSION to the previous payload's version token (see
scripts/build_apk.sh: PAYLOAD_VERSION_OVERRIDE) or existing installs will
re-extract 1 GB on their next launch.
"""
from __future__ import annotations

import argparse
import struct
import sys
import time
import zipfile
import zlib
from pathlib import Path

STORE = 0
DEFLATE = 8
UTF8_FLAG = 0x0800


def deflate(data: bytes) -> bytes:
    c = zlib.compressobj(9, zlib.DEFLATED, -15)
    return c.compress(data) + c.flush()


def dos_time(when: float) -> tuple[int, int]:
    t = time.localtime(when)
    return ((t.tm_hour << 11) | (t.tm_min << 5) | (t.tm_sec // 2),
            ((t.tm_year - 1980) << 9) | (t.tm_mon << 5) | t.tm_mday)


class Writer:
    def __init__(self, path: Path):
        self.fp = open(path, "wb")
        self.central = bytearray()
        self.count = 0
        self.clock, self.date = dos_time(time.time())

    def add_raw(self, name: bytes, payload: bytes, method: int, crc: int,
                usize: int, flags: int = UTF8_FLAG, extra: bytes = b""):
        offset = self.fp.tell()
        version = 20 if method == DEFLATE else 10
        self.fp.write(struct.pack("<IHHHHHIIIHH", 0x04034B50, version,
                                  flags & ~0x08, method, self.clock, self.date,
                                  crc, len(payload), usize, len(name), len(extra)))
        self.fp.write(name)
        self.fp.write(extra)
        self.fp.write(payload)
        self.central += struct.pack("<IHHHHHHIIIHHHHHII", 0x02014B50,
                                    (3 << 8) | 20, version, flags & ~0x08,
                                    method, self.clock, self.date, crc,
                                    len(payload), usize, len(name), len(extra),
                                    0, 0, 0, (0o100644 << 16), offset)
        self.central += name + extra
        self.count += 1

    def add_data(self, name: str, data: bytes, mode: int):
        raw = name.encode("utf-8")
        self.add_raw(raw, deflate(data), DEFLATE,
                     zlib.crc32(data) & 0xFFFFFFFF, len(data))

    def close(self):
        central_offset = self.fp.tell()
        self.fp.write(self.central)
        self.fp.write(struct.pack("<IHHHHIIH", 0x06054B50, 0, 0, self.count,
                                  self.count, len(self.central), central_offset, 0))
        self.fp.close()


def read_existing(src: zipfile.ZipFile, info: zipfile.ZipInfo) -> bytes:
    """Return the entry's compressed bytes exactly as stored."""
    src.fp.seek(info.header_offset)
    header = src.fp.read(30)
    sig, _ver, flags, method, _t, _d, crc, csize, usize, nlen, elen = struct.unpack(
        "<IHHHHHIIIHH", header)
    if sig != 0x04034B50:
        raise SystemExit(f"bad local header for {info.filename}")
    name = src.fp.read(nlen)
    extra = src.fp.read(elen)
    data = src.fp.read(csize)
    return data, method, crc, usize, flags, name, extra


def bake(payload: Path, manifest: Path, hot: Path, out_payload: Path,
         out_manifest: Path) -> None:
    replacements: dict[str, tuple[bytes, int]] = {}
    with zipfile.ZipFile(hot) as hz:
        for info in hz.infolist():
            if info.is_dir() or info.filename == "hot.json":
                continue
            name = info.filename
            if name.startswith("@home/.dsh/"):
                # The seed directory *is* the guest's ~/.dsh: its children are
                # profiles/, skills/, ... — not another .dsh/ level.
                target = "opt/dsh/dsh-home-seed/" + name[len("@home/.dsh/"):]
            elif name.startswith("@home/"):
                target = "opt/dsh/dsh-home-seed/" + name[len("@home/"):]
            else:
                target = name
            mode = 0o755 if (name.endswith(".sh") or name.startswith("usr/local/bin/")) else 0o644
            replacements[target] = (hz.read(info), mode)

    out_payload.parent.mkdir(parents=True, exist_ok=True)
    writer = Writer(out_payload)
    replaced = added = 0
    with zipfile.ZipFile(payload) as pz:
        for info in pz.infolist():
            # Older builds left a duplicated .dsh/ level under the seed; the
            # seed directory is already the guest's ~/.dsh. Drop it.
            if info.filename.startswith("opt/dsh/dsh-home-seed/.dsh/"):
                continue
            if info.filename in replacements:
                data, mode = replacements.pop(info.filename)
                writer.add_data(info.filename, data, mode)
                replaced += 1
                continue
            data, method, crc, usize, flags, name, extra = read_existing(pz, info)
            writer.add_raw(name, data, method, crc, usize,
                           flags if flags & UTF8_FLAG else 0, extra)
    for target, (data, mode) in replacements.items():
        writer.add_data(target, data, mode)
        added += 1
    writer.close()

    # Make sure every executable we just added has its mode in the manifest.
    lines = manifest.read_text("utf-8").splitlines()
    seen = set()
    for line in lines:
        parts = line.split("\t")
        if len(parts) >= 2:
            seen.add(parts[1])
    extra_lines = []
    for target, (_data, mode) in replacements.items():
        if mode & 0o111 and target not in seen:
            extra_lines.append(f"{mode:o}\t{target}")
    out_manifest.write_text("\n".join(lines + extra_lines) + "\n", "utf-8")

    print(f"bake: {replaced} replaced, {added} added, {len(extra_lines)} manifest exec rows")
    print(f"bake: wrote {out_payload} ({out_payload.stat().st_size} bytes)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--payload", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--hot", required=True)
    ap.add_argument("--out-payload", required=True)
    ap.add_argument("--out-manifest", required=True)
    args = ap.parse_args()
    bake(Path(args.payload), Path(args.manifest), Path(args.hot),
         Path(args.out_payload), Path(args.out_manifest))


if __name__ == "__main__":
    main()
