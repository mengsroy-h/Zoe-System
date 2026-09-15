#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

STATE_BASE="${XDG_STATE_HOME:-$HOME/.local/state}"
STATE_ROOT="$STATE_BASE/Zoe-System/ZTO-Cookie-Sync"

if [ ! -f "node_modules/playwright-core/package.json" ]; then
  echo "ERROR: Setup is not complete. Run ./setup-termux.sh first." >&2
  exit 1
fi
if [ ! -f "$STATE_ROOT/config.json" ]; then
  echo "ERROR: Netlify configuration is missing. Run ./setup-termux.sh first." >&2
  exit 1
fi
if [ ! -f "$STATE_ROOT/netlify-token.secret" ]; then
  echo "ERROR: Netlify token is missing. Run ./setup-termux.sh first." >&2
  exit 1
fi

# --check, --verify-setup and --auto-ready never open Chrome, so they must not
# need ADB. --auto is different: when the cookie is stale it falls through to
# the capture, which DOES need ADB. Connecting for --auto is therefore
# best-effort: try, but never abort the run, so a healthy cookie still reports
# "No browser needed" instead of dying on a disconnected phone. When a capture
# really is needed, sync-zto-cookie.js reports ANDROID_ADB_NOT_CONNECTED itself.
needs_adb=1
adb_optional=0
for arg in "$@"; do
  case "$arg" in
    --check|--verify-setup|--auto-ready) needs_adb=0 ;;
    --auto) adb_optional=1 ;;
  esac
done
if [ "$needs_adb" -eq 1 ]; then
  if [ "$adb_optional" -eq 1 ]; then
    bash ./ensure-adb-connected.sh || true
  else
    bash ./ensure-adb-connected.sh
  fi
fi

exec node sync-zto-cookie.js "$@"
