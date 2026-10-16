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
# PRoot 只翻译系统调用和路径，**不模拟指令集**：rootfs 里是 arm64 二进制。
# 三条路，按"能不能真的执行 rootfs 里的东西"来选，都不行就交给下面的硬校验去失败：
#
#   1) chroot —— 沙箱里（fake-root）和 CI 上（sudo chroot + binfmt）都能用，首选
#   2) proot CLI —— 需要一个**能在本机执行**的 proot；注意仓库里那份
#      build/proot/libproot.so 是给 Android 用的 bionic 二进制（App 当 native library 打包），
#      在这里执行会 "required file not found"，所以默认不用它，要用就设 PROOT_CLI=<路径>
#   3) 都不行 —— 不装，让校验失败并打印手工命令
#
# 另外：仓库若放在 /sdcard 这类 FUSE 挂载上，文件**没有可执行位**（chmod 也改不了），
# 构建必须落在 app 私有存储 —— 否则上面两条路都不会成立。
HOST_ARCH=$(uname -m)
GUEST_MISSING=""
for t in usr/bin/git usr/bin/curl usr/bin/python3 usr/bin/tmux usr/sbin/sshd; do
  [ -e "$ROOTFS/$t" ] || GUEST_MISSING="$GUEST_MISSING $(basename "$t")"
done
GUEST_PACKAGES="git curl ca-certificates python3 tmux htop openssh-server iproute2 less vim-tiny procps"
APT_CMD="apt-get update -qq && apt-get install -y --no-install-recommends $GUEST_PACKAGES"
PROOT_CLI="${PROOT_CLI:-}"

if [ -z "$GUEST_MISSING" ]; then
  echo "   已经都在（git/curl/python3/tmux/sshd），跳过安装"
elif chroot "$ROOTFS" /bin/true 2>/dev/null; then
  echo "   经 chroot 安装：$GUEST_PACKAGES"
  [ -s "$ROOTFS/etc/resolv.conf" ] || cp /etc/resolv.conf "$ROOTFS/etc/resolv.conf" 2>/dev/null || true
  chroot "$ROOTFS" /usr/bin/env -i \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    DEBIAN_FRONTEND=noninteractive HOME=/root \
    /bin/sh -c "$APT_CMD" 2>&1 | tail -5 || echo "   ! apt 失败（下面按结果判断）"
elif [ -n "$PROOT_CLI" ] && [ -x "$PROOT_CLI" ]; then
  echo "   经 proot 安装（$PROOT_CLI）：$GUEST_PACKAGES"
  PROOT_TMP_DIR="${TMPDIR:-/tmp}/proot-build" "$PROOT_CLI" -0 -r "$ROOTFS" \
    -b /dev -b /proc -b /sys -b /etc/resolv.conf -w /root \
    /usr/bin/env -i \
      PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
      DEBIAN_FRONTEND=noninteractive HOME=/root \
      /bin/sh -c "$APT_CMD" 2>&1 | tail -5 || echo "   ! apt 失败（下面按结果判断）"
else
  echo "   ! 装不了 guest 工具（缺：$GUEST_MISSING）—— chroot 不可用，也没设 PROOT_CLI。"
  echo "     原因通常是：rootfs 在 /sdcard 这类 FUSE 上（没有可执行位），"
  echo "     或主机是 $HOST_ARCH 且没注册 binfmt（CI 见 docker/setup-qemu-action）。"
  echo "     手工装（在 app 私有存储里）："
  echo "       chroot $ROOTFS /bin/sh -c \"$APT_CMD\""
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
