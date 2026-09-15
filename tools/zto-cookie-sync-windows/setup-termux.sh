#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
export LC_ALL=C

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# Android shared storage (/storage/emulated/0, ~/storage/...) is noexec and
# does not provide normal Unix symlink semantics. npm projects belong in
# Termux private storage. If setup was started from Downloads, install a
# working copy under $HOME and continue there.
case "$SCRIPT_DIR" in
  /storage/*|/sdcard/*|"$HOME"/storage/*|/data/data/com.termux/files/home/storage/*)
    TARGET_DIR="$HOME/ZTO-Cookie-Sync"
    printf '%s\n' "Copying the tool from shared storage to: $TARGET_DIR"
    mkdir -p "$TARGET_DIR"
    cp -R "$SCRIPT_DIR"/. "$TARGET_DIR"/
    chmod +x "$TARGET_DIR"/*.sh 2>/dev/null || true
    exec bash "$TARGET_DIR/setup-termux.sh"
    ;;
esac

cd "$SCRIPT_DIR"
umask 077

# Unzipping on Android usually drops the executable bit, so ./foo.sh would die
# with "Permission denied" under `set -e`. Restore it once, here, for every
# helper this tool ships - not only on the shared-storage copy path.
chmod +x ./*.sh 2>/dev/null || true

STATE_BASE="${XDG_STATE_HOME:-$HOME/.local/state}"
STATE_ROOT="$STATE_BASE/Zoe-System/ZTO-Cookie-Sync"
CONFIG_PATH="$STATE_ROOT/config.json"
TOKEN_PATH="$STATE_ROOT/netlify-token.secret"
PROXY_PATH="$STATE_ROOT/proxy-key.secret"

say() { printf '%s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

if ! command -v pkg >/dev/null 2>&1; then
  fail "This setup is for Termux. Open this folder from Termux and run ./setup-termux.sh"
fi

say "Installing/updating required Termux packages (Node.js + ADB)..."
pkg install -y nodejs android-tools

if ! command -v node >/dev/null 2>&1; then fail "Node.js installation failed."; fi
if ! command -v npm >/dev/null 2>&1; then fail "npm is missing. Run: pkg install nodejs npm"; fi
if ! command -v adb >/dev/null 2>&1; then fail "ADB is missing. Run: pkg install android-tools"; fi

node -e "const [M,m]=process.versions.node.split('.').map(Number);process.exit(M>22||(M===22&&m>=17)?0:1)" \
  || fail "Node.js 22.17.0 or newer is required. Current: $(node --version)"

say "Installing pinned Node dependency..."
npm install --ignore-scripts --no-audit --no-fund

mkdir -p "$STATE_ROOT"
chmod 700 "$STATE_ROOT"

existing_site_id=""
existing_site_url=""
if [ -f "$CONFIG_PATH" ]; then
  existing_site_id="$(node -e 'try{const c=require(process.argv[1]);process.stdout.write(String(c.siteId||""))}catch{}' "$CONFIG_PATH")"
  existing_site_url="$(node -e 'try{const c=require(process.argv[1]);process.stdout.write(String(c.siteUrl||""))}catch{}' "$CONFIG_PATH")"
fi

say ""
say "Find the Netlify Site ID under Project configuration > General > Project details."
if [ -n "$existing_site_id" ]; then say "Saved: $existing_site_id - press Enter to keep it."; fi
while :; do
  IFS= read -r -p "Enter the ZoeW Netlify Site ID: " answer
  if [ -z "$answer" ] && [ -n "$existing_site_id" ]; then site_id="$existing_site_id"; break; fi
  if [[ "$answer" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]]; then site_id="$answer"; break; fi
  say "That Site ID has a bad shape. Copy the Site ID, not the URL."
done

say ""
say "The ZoeW Site URL (for example https://zoew.netlify.app)."
say "It is needed for --check and --auto mode."
if [ -n "$existing_site_url" ]; then
  say "Saved: $existing_site_url - press Enter to keep it. Type - to remove it."
else
  say "Press Enter to skip."
fi
while :; do
  IFS= read -r -p "Enter the ZoeW Site URL: " answer
  if [ "$answer" = "-" ]; then site_url=""; break; fi
  if [ -z "$answer" ]; then site_url="$existing_site_url"; break; fi
  if node -e 'try{const u=new URL(process.argv[1]);process.exit(u.protocol==="https:"&&u.hostname&&!u.username&&!u.password&&u.pathname==="/"?0:1)}catch{process.exit(1)}' "$answer"; then
    site_url="${answer%/}"
    break
  fi
  say "The Site URL must be an https:// origin with no path."
done

say ""
say "Create a Personal Access Token at Netlify > User settings > Applications."
if [ -f "$TOKEN_PATH" ]; then
  say "A token is already saved in Termux private storage - press Enter to keep it."
fi
while :; do
  IFS= read -r -s -p "Enter the Netlify Personal Access Token: " token
  printf '\n'
  if [ -z "$token" ] && [ -f "$TOKEN_PATH" ]; then break; fi
  if [ ${#token} -ge 16 ] && [ ${#token} -le 4096 ] && [[ "$token" != *$'\n'* ]] && [[ "$token" != *$'\r'* ]]; then
    printf '%s' "$token" > "$TOKEN_PATH"
    chmod 600 "$TOKEN_PATH"
    token=""
    break
  fi
  token=""
  say "That Netlify token has a bad shape (at least 16 characters)."
done

if [ -n "$site_url" ]; then
  say ""
  say "Enter ZTO_PROXY_KEY (the same value as in Netlify)."
  if [ -f "$PROXY_PATH" ]; then say "A proxy key is already saved - press Enter to keep it."; fi
  while :; do
    IFS= read -r -s -p "Enter ZTO_PROXY_KEY: " proxy_key
    printf '\n'
    if [ -z "$proxy_key" ] && [ -f "$PROXY_PATH" ]; then break; fi
    if [ -z "$proxy_key" ]; then
      IFS= read -r -p "Skip it? Type y to skip, or press Enter to type the key: " skip
      if [[ "$skip" =~ ^[Yy]([Ee][Ss])?$ ]]; then rm -f "$PROXY_PATH"; break; fi
      continue
    fi
    if [ ${#proxy_key} -ge 16 ] && [ ${#proxy_key} -le 4096 ]; then
      printf '%s' "$proxy_key" > "$PROXY_PATH"
      chmod 600 "$PROXY_PATH"
      proxy_key=""
      break
    fi
    proxy_key=""
    say "The proxy key is too short. Copy the complete ZTO_PROXY_KEY value."
  done
else
  rm -f "$PROXY_PATH"
fi

node - "$CONFIG_PATH" "$site_id" "$site_url" <<'NODE'
const fs = require('fs');
const [file, siteId, siteUrl] = process.argv.slice(2);
fs.writeFileSync(file, JSON.stringify({ version: 2, platform: 'android-termux', siteId, siteUrl }), { mode: 0o600 });
NODE
chmod 600 "$CONFIG_PATH"

say ""
say "Saved configuration under: $STATE_ROOT"
say "Secrets are NOT stored in Downloads; they are kept in Termux private app storage with mode 600."

say "Checking Netlify Site ID and token..."
node sync-zto-cookie.js --verify-setup

say ""
say "Android prerequisite (one time / when the debug port changes):"
say "  1. Enable Android Developer options > Wireless debugging"
say "  2. Run: ./connect-android.sh"
say "  Chrome needs no special flag; capture uses ADB + Chrome DevTools Protocol."
say ""
say "After ADB is connected, run: ./sync-zto-cookie-termux.sh"
say ""
say "Installing the Android Home Screen shortcut..."
bash ./install-home-button.sh "$SCRIPT_DIR" || say "WARNING: Home Screen shortcut setup did not finish. You can run ./install-home-button.sh later."
