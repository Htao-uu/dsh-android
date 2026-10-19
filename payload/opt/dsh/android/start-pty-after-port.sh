#!/bin/bash
# Start the guest PTY endpoint only once the harness is actually listening.
#
# pty-server.mjs is another Node process. Starting it before "dsh web" makes it
# race the harness for the same CPU during the expensive module-load phase; the
# terminal is not reachable before the Web UI is up anyway. This waits for the
# harness port (bash's /dev/tcp), then starts the PTY endpoint at low priority.
#
# Environment (exported by start-dsh.sh): NODE, DSH_INSTALL, GUEST_HOME,
# DSH_PORT, DSH_PTY_PORT, DSH_PTY_TOKEN, DSH_PTY_SHELL.
set -u
port="${DSH_PORT:-3080}"
waited=0
while [ "$waited" -lt 240 ]; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    exec 3>&- 2>/dev/null || true
    break
  fi
  sleep 0.5
  waited=$((waited + 1))
done

if command -v nice >/dev/null 2>&1; then
  exec nice -n 19 "$NODE" "$DSH_INSTALL/android/pty-server.mjs" >>"$GUEST_HOME/.dsh-pty.log" 2>&1
fi
exec "$NODE" "$DSH_INSTALL/android/pty-server.mjs" >>"$GUEST_HOME/.dsh-pty.log" 2>&1
