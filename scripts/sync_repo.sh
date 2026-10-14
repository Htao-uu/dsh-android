#!/bin/sh
# Mirror the working tree into the git checkout, commit, push.
#
# The working tree is where the app is actually built (it also holds build/,
# out/, lab/ and keystore/); the checkout only ever contains source. This keeps
# the two from drifting: whatever the build uses is what gets committed.
#
# Usage: sync_repo.sh ["commit message"]
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${DSH_SRC_DIR:-$ROOT}"
REPO="${DSH_REPO_DIR:-$(dirname "$ROOT")/dsh-android-repo}"
MESSAGE="${1:-更新}"

[ -d "$REPO/.git" ] || { echo "no git checkout at $REPO" >&2; exit 1; }

for dir in .github app assets patches payload plugin profile scripts docs; do
  rm -rf "$REPO/$dir"
  cp -a "$SRC/$dir" "$REPO/$dir"
done
cp "$SRC/README.md" "$SRC/THIRD_PARTY.md" "$SRC/.gitignore" "$SRC/CHANGELOG.md" "$SRC/HANDOFF.md" "$REPO/"
# The three version files travel together: VERSION (shell), ROOTFS_VERSION
# (terminal) and HOT (the last hot package built here). VERSION and update.json
# are what the app reads to decide whether a hot package or a new APK is waiting.
# ROOTFS_VERSION was missing from this list, which is how the t2 runtime got
# published while the repository still had no record of a terminal version at
# all — version.py in the checkout then falls back to t1.
cp "$SRC/VERSION" "$SRC/ROOTFS_VERSION" "$SRC/update.json" "$SRC/HOT" "$REPO/" 2>/dev/null || true

cd "$REPO"
# Generated artefacts (icons, BuildInfo, payloads) are ignored on purpose; drop
# them so the checkout stays exactly what the repository says it is. Uppercase
# -X is the point: lowercase -x would also delete untracked *source* files —
# which is exactly what a newly added script is, right up until `git add`.
git clean -qXfd

# This sandbox is itself inside PRoot with --link2symlink, which turns link()
# into a symlink into a temporary file: git writes loose objects that way for
# atomicity, so the object survives the command but dangles afterwards
# ("bad object HEAD"). rename() is monotonic in exactly the way link() is not.
git config core.createObject rename

# Push over SSH: the sandbox has a deploy key, and an HTTPS remote would prompt
# for a username it can never read.
git remote set-url origin git@github.com:itiswdwa/dsh-android.git

git add -A
if git diff --cached --quiet; then
  echo "无改动，无需提交"
  exit 0
fi
git -c user.name=itiswdwa -c user.email=itiswdwa@users.noreply.github.com commit -q -m "$MESSAGE"
git push -q origin main
echo "已推送：$(git log -1 --format='%h %s')"
git show --stat --oneline HEAD | tail -n +2 | head -20
