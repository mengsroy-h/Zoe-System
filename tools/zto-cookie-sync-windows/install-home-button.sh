#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
export LC_ALL=C

# The project directory is wherever this script lives, unless the caller names
# one. Hard-coding $HOME/ZTO-Cookie-Sync made setup fail for anyone who
# unpacked the tool under a different name, with a message telling them to run
# the very setup that was calling this script.
PROJECT="${1:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)}"
SHORTCUT_DIR="$HOME/.shortcuts"
SHORTCUT_NAME="ZTO Cookie Sync"
SHORTCUT_PATH="$SHORTCUT_DIR/$SHORTCUT_NAME"

if [ ! -f "$PROJECT/sync-zto-cookie-termux.sh" ]; then
  echo "ERROR: $PROJECT is not ready. Run setup-termux.sh first." >&2
  exit 1
fi
# Unzipping drops the exec bit; the shortcut runs the script directly.
chmod +x "$PROJECT/sync-zto-cookie-termux.sh" 2>/dev/null || true

mkdir -p "$SHORTCUT_DIR"
chmod 700 "$SHORTCUT_DIR"

cat > "$SHORTCUT_PATH" <<SCRIPT
#!/data/data/com.termux/files/usr/bin/bash
set -u
PROJECT="$PROJECT"
cd "\$PROJECT" || exit 1
clear 2>/dev/null || true
printf '%s\n' 'ZTO Cookie Sync' '---------------'
if bash "\$PROJECT/sync-zto-cookie-termux.sh"; then
  printf '\n%s\n' 'OK: Cookie sync completed.'
  sleep 2
  exit 0
else
  status=\$?
  printf '\nERROR: Cookie sync failed (exit %s).\n' "\$status" >&2
  printf '%s\n' 'If ADB is disconnected, enable Wireless debugging and run connect-android.sh.' >&2
  printf '\nPress Enter to close...'
  read -r _ || true
  exit "\$status"
fi
SCRIPT
chmod 700 "$SHORTCUT_PATH"

# Also provide a short terminal command.
if [ -n "${PREFIX:-}" ] && [ -d "$PREFIX/bin" ] && [ -w "$PREFIX/bin" ]; then
  cat > "$PREFIX/bin/zto-sync" <<SCRIPT
#!/data/data/com.termux/files/usr/bin/bash
exec bash "$PROJECT/sync-zto-cookie-termux.sh" "\$@"
SCRIPT
  chmod 700 "$PREFIX/bin/zto-sync"
fi

# Refresh existing Termux:Widget widgets if the add-on is installed.
if command -v pm >/dev/null 2>&1 && pm path com.termux.widget >/dev/null 2>&1; then
  am broadcast -n com.termux.widget/.TermuxWidgetProvider \
    -a com.termux.widget.ACTION_REFRESH_WIDGET --ei appWidgetId 0 >/dev/null 2>&1 || true
  echo "OK: Home-screen script installed: $SHORTCUT_PATH"
  echo "Opening Termux:Widget shortcut picker..."
  am start -n com.termux.widget/.TermuxCreateShortcutActivity >/dev/null 2>&1 || true
  echo "Choose: ZTO Cookie Sync"
else
  echo "OK: Home-screen script installed: $SHORTCUT_PATH"
  echo "Termux:Widget is not installed (or Android cannot see it yet)."
  echo "Install the Termux:Widget add-on from the SAME source as your Termux app."
  echo "Then add a Termux:Widget/Shortcut to the Home Screen and choose: ZTO Cookie Sync"
fi

echo "Terminal shortcut is also available: zto-sync"
