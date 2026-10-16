#!/bin/sh
# Build the Ubuntu rootfs the app ships: base system + official Node + harness.
#
# Produces build/rootfs-ubuntu/, which assemble_payload.sh then finishes off.
# One-time job, roughly:
#   ubuntu-base  30 MB   https://cdimage.ubuntu.com/ubuntu-base/
#   guest tools  ~120 MB the payload's own apt packages (git, sshd, tmux, …)
#   node tarball 30 MB   https://nodejs.org/dist/
#   npm install  ~500 MB unpacked, trimmed to ~150 MB later
#
# Note on --libc: this script is usually run on a musl host (Alpine), and npm
# otherwise picks optional dependencies for the *host* libc. The guest is glibc,
# so the target platform has to be stated explicitly or sharp/require-builtin
# land in their musl variants and fail at runtime.
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
BUILD="$ROOT/build"
ROOTFS="$BUILD/rootfs-ubuntu"
UBUNTU_VERSION="${UBUNTU_VERSION:-24.04.5}"
NODE_VERSION="${NODE_VERSION:-22.23.2}"

mkdir -p "$BUILD"

echo "== ubuntu-base $UBUNTU_VERSION =="
if [ ! -d "$ROOTFS" ]; then
  curl -fL --retry 5 -o "$BUILD/ubuntu-base.tar.gz" \
    "https://cdimage.ubuntu.com/ubuntu-base/releases/24.04/release/ubuntu-base-${UBUNTU_VERSION}-base-arm64.tar.gz"
  mkdir -p "$ROOTFS"
  tar xzf "$BUILD/ubuntu-base.tar.gz" -C "$ROOTFS"
fi
echo "   $(du -sh "$ROOTFS" | cut -f1)"

echo "== official node $NODE_VERSION =="
if [ ! -x "$ROOTFS/usr/local/bin/node" ]; then
  curl -fL --retry 5 -o "$BUILD/node-arm64.tar.xz" \
    "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-arm64.tar.xz"
  xz -t "$BUILD/node-arm64.tar.xz"          # a truncated download is otherwise silent
  tar xJf "$BUILD/node-arm64.tar.xz" -C "$ROOTFS/usr/local" --strip-components=1
fi
# Ship without the 64 MB of C headers: node-gyp fetches its own when needed.
rm -rf "$ROOTFS/usr/local/include"

# Guest packages the payload promises: the agent's own tools (git/curl/python3/tmux/htop)
# plus openssh-server, which recovery mode needs (see docs/RECOVERY.md).
#
# This step used to be missing from the repository — it was done by hand once, so the
# t2 payload has these tools while a fresh `prepare_rootfs.sh` produces a rootfs
# without them. That is invisible until something needs sshd… which is exactly what
# recovery mode is. It is checked, not assumed: after the install the binaries must
# exist, or the build fails here instead of shipping a payload that cannot be
# recovered.
echo "== guest tools =="
GUEST_PACKAGES="git curl ca-certificates python3 tmux htop openssh-server iproute2 less vim-tiny procps"
# PRoot 只翻译系统调用和路径，**不模拟指令集**：rootfs 里是 arm64 二进制，
# 所以这一步只能在 arm64 主机上跑（也就是本机/手机），x86_64 的 CI runner 上
# 必须先挂 binfmt+qemu-aarch64-static 才能执行。与其在那边神秘地失败，这里直接说清楚。
HOST_ARCH=$(uname -m)
if [ -x "$ROOT/build/proot/libproot.so" ] && [ "$HOST_ARCH" = "aarch64" -o "$HOST_ARCH" = "arm64" ]; then
  echo "   apt-get install（在 rootfs 里，经 proot）"
  PROOT_TMP_DIR="${TMPDIR:-/tmp}/proot-build" \
  "$ROOT/build/proot/libproot.so" -0 -r "$ROOTFS" \
    -b /dev -b /proc -b /sys -b /etc/resolv.conf \
    -w /root /usr/bin/env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
      DEBIAN_FRONTEND=noninteractive HOME=/root \
      apt-get update -qq \; apt-get install -y --no-install-recommends $GUEST_PACKAGES \
    2>&1 | tail -5 || echo "   ! apt 这一步失败了（下面按结果判断）"
else
  if [ ! -x "$ROOT/build/proot/libproot.so" ]; then
    echo "   ! 没有 build/proot/libproot.so（先跑 sh scripts/fetch-proot.sh）"
  else
    echo "   ! 主机是 $HOST_ARCH，跑不了 rootfs 里的 arm64 apt。"
    echo "     要么在 arm64 机器上构建载荷，要么给 x86_64 挂 qemu-aarch64-static + binfmt 后重跑。"
  fi
  echo "     已有 rootfs 里带着这些工具时，这步可以跳过（校验仍然会跑）。"
fi
for tool in usr/bin/git usr/bin/curl usr/bin/python3 usr/bin/tmux usr/sbin/sshd; do
  if [ ! -e "$ROOTFS/$tool" ]; then
    echo "error: 载荷缺 $tool —— guest 工具没装上（apt 那步失败？）" >&2
    echo "       recovery mode 需要 sshd；git/curl/python3 是 agent 的常用工具。" >&2
    echo "       手工装：proot -0 -r $ROOTFS -b /dev -b /proc -b /sys \\" >&2
    echo "                 /usr/bin/env -i PATH=/usr/bin:/bin apt-get install -y $GUEST_PACKAGES" >&2
    exit 1
  fi
done
echo "   ✓ git / curl / python3 / tmux / sshd 都在"

echo "== harness =="
mkdir -p "$ROOTFS/opt/dsh"
[ -f "$ROOTFS/opt/dsh/package.json" ] || cat > "$ROOTFS/opt/dsh/package.json" <<'EOF'
{ "name": "dsh-sandbox", "private": true, "version": "1.0.0" }
EOF
cd "$ROOTFS/opt/dsh"
HOME="${TMPDIR:-/tmp}/npmhome" npm i --no-audit --no-fund \
  --os=linux --cpu=arm64 --libc=glibc \
  "@deepseek-ai/dsh@${DSH_VERSION:-0.2.0-rc.2}" \
  @xterm/xterm@5.5.0 @xterm/addon-fit@0.10.0 @xterm/addon-canvas@0.7.0

# The stock node binary carries debug sections; stripping is worth ~18 MB and
# changes nothing at runtime.
strip --strip-all "$ROOTFS/usr/local/bin/node" 2>/dev/null || true

echo "== done =="
du -sh "$ROOTFS" "$ROOTFS/opt/dsh/node_modules"
echo "next: sh scripts/assemble_payload.sh"
