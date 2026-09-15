#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
export LC_ALL=C

STATE_BASE="${XDG_STATE_HOME:-$HOME/.local/state}"
STATE_ROOT="$STATE_BASE/Zoe-System/ZTO-Cookie-Sync"
ADB_ADDR_PATH="$STATE_ROOT/adb-connect-address.txt"
mkdir -p "$STATE_ROOT"
chmod 700 "$STATE_ROOT" 2>/dev/null || true

if ! command -v adb >/dev/null 2>&1; then
  echo "ERROR: adb is missing. Run ./setup-termux.sh first." >&2
  exit 1
fi

adb start-server >/dev/null

connected_devices() {
  adb devices | awk 'NR>1 && $2=="device" {print $1}'
}

save_connected_address() {
  local addr="${1:-}"
  [ -n "$addr" ] || return 0
  printf '%s' "$addr" > "$ADB_ADDR_PATH"
  chmod 600 "$ADB_ADDR_PATH"
}

connected_now="$(connected_devices)"
connected_count="$(printf '%s\n' "$connected_now" | sed '/^$/d' | wc -l | tr -d ' ')"
if [ "$connected_count" -gt 1 ] && [ -z "${ANDROID_SERIAL:-}" ]; then
  echo "ERROR: More than one Android device is connected." >&2
  echo "Set ANDROID_SERIAL=IP:PORT or disconnect the other device." >&2
  adb devices >&2
  exit 1
fi
if [ "$connected_count" -eq 1 ]; then
  serial="$(printf '%s\n' "$connected_now" | head -n1)"
  case "$serial" in
    *:*) save_connected_address "$serial" ;;
  esac
  echo "OK: ADB is already connected:"
  adb devices
  exit 0
fi

# A paired Android 11+ device advertises its current, dynamic debugging
# endpoint as _adb-tls-connect._tcp. Try discovery before asking for ports.
for pass in 1 2 3; do
  mdns_output="$(adb mdns services 2>/dev/null || true)"
  mdns_addrs="$(printf '%s\n' "$mdns_output" | awk '$2 ~ /^_adb-tls-connect\._tcp\.?$/ {print $3}')"
  if [ -n "$mdns_addrs" ]; then
    while IFS= read -r addr; do
      [ -n "$addr" ] || continue
      port="${addr##*:}"
      if [[ "$port" =~ ^[0-9]{1,5}$ ]]; then
        local_addr="127.0.0.1:$port"
        adb connect "$local_addr" >/dev/null 2>&1 || true
        if [ -n "$(connected_devices)" ]; then
          save_connected_address "$local_addr"
          echo "OK: Android found and connected automatically through mDNS."
          adb devices
          exit 0
        fi
      fi
      adb connect "$addr" >/dev/null 2>&1 || true
      if [ -n "$(connected_devices)" ]; then
        save_connected_address "$addr"
        echo "OK: Android found and connected automatically through mDNS."
        adb devices
        exit 0
      fi
    done <<< "$mdns_addrs"
  fi
  [ "$pass" -lt 3 ] && sleep 1
done

# Try the last successful debugging address before asking the user again.
if [ -f "$ADB_ADDR_PATH" ]; then
  saved_addr="$(tr -d '\r\n' < "$ADB_ADDR_PATH")"
  if [ -n "$saved_addr" ]; then
    echo "Trying saved Wireless debugging address: $saved_addr"
    adb connect "$saved_addr" >/dev/null 2>&1 || true
    if [ -n "$(connected_devices)" ]; then
      echo "OK: Android reconnected automatically."
      adb devices
      exit 0
    fi
  fi
fi

echo "On this Android phone:"
echo "  Settings > Developer options > Wireless debugging"
echo "Keep that screen open while pairing/connecting."
echo ""

read -r -p "Pairing address (IP:PAIR_PORT), or Enter if already paired: " pair_addr
if [ -n "$pair_addr" ]; then
  echo "ADB will ask for the 6-digit pairing code shown by Android."
  adb pair "$pair_addr"
fi

read -r -p "Wireless debugging address (IP:DEBUG_PORT): " connect_addr
if [ -z "$connect_addr" ]; then
  echo "ERROR: The debugging address is required." >&2
  exit 1
fi

adb connect "$connect_addr"
echo ""
adb devices

if [ -z "$(connected_devices)" ]; then
  echo "ERROR: No authorized Android device is connected." >&2
  echo "Check Wireless debugging, then run this script again." >&2
  exit 1
fi

save_connected_address "$connect_addr"
echo "OK: Android is connected. The debugging address was saved for automatic reconnect."
