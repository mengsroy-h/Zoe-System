#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
export LC_ALL=C

STATE_BASE="${XDG_STATE_HOME:-$HOME/.local/state}"
STATE_ROOT="$STATE_BASE/Zoe-System/ZTO-Cookie-Sync"
ADB_ADDR_PATH="$STATE_ROOT/adb-connect-address.txt"

if ! command -v adb >/dev/null 2>&1; then
  echo "ERROR: adb is missing. Run ./setup-termux.sh first." >&2
  exit 1
fi

mkdir -p "$STATE_ROOT"
chmod 700 "$STATE_ROOT" 2>/dev/null || true

connected_devices() {
  adb devices 2>/dev/null | awk 'NR>1 && $2=="device" {print $1}'
}

save_addr() {
  local addr="${1:-}"
  [ -n "$addr" ] || return 0
  printf '%s' "$addr" > "$ADB_ADDR_PATH"
  chmod 600 "$ADB_ADDR_PATH" 2>/dev/null || true
}

finish_if_connected() {
  local serial
  serial="$(connected_devices | head -n1)"
  [ -n "$serial" ] || return 1
  case "$serial" in
    *:*) save_addr "$serial" ;;
  esac
  return 0
}

try_connect() {
  local addr="${1:-}"
  [ -n "$addr" ] || return 1
  adb connect "$addr" >/dev/null 2>&1 || true
  if finish_if_connected; then
    save_addr "$addr"
    return 0
  fi
  return 1
}

# Starting the ADB server also starts mDNS discovery. A previously paired
# Android device may auto-connect as soon as _adb-tls-connect is discovered.
adb start-server >/dev/null 2>&1 || true
if finish_if_connected; then
  exit 0
fi
sleep 1
if finish_if_connected; then
  exit 0
fi

# Best same-phone fast path: Android publishes the current Wireless-debugging
# TLS port in service.adb.tls.port. On devices that allow apps to read this
# property, this avoids mDNS entirely and survives the random port changing.
read_local_tls_port() {
  local p=""
  if [ -x /system/bin/getprop ]; then
    p="$(/system/bin/getprop service.adb.tls.port 2>/dev/null | tr -d '\r\n' || true)"
  elif command -v getprop >/dev/null 2>&1; then
    p="$(getprop service.adb.tls.port 2>/dev/null | tr -d '\r\n' || true)"
  fi
  if [[ "$p" =~ ^[0-9]{1,5}$ ]] && [ "$p" -ge 1 ] && [ "$p" -le 65535 ]; then
    printf '%s\n' "$p"
  fi
}

local_tls_port="$(read_local_tls_port)"
if [ -n "$local_tls_port" ]; then
  if try_connect "127.0.0.1:$local_tls_port"; then
    echo "OK: ADB detected the current Wireless debugging port and reconnected."
    exit 0
  fi
fi

# First try the last successful address (fast path).
if [ -f "$ADB_ADDR_PATH" ]; then
  saved_addr="$(tr -d '\r\n' < "$ADB_ADDR_PATH")"
  if [ -n "$saved_addr" ]; then
    echo "ADB is disconnected. Trying the saved Wireless debugging address..."
    if try_connect "$saved_addr"; then
      echo "OK: ADB reconnected automatically."
      exit 0
    fi

    # Same-phone connection: the Wi-Fi address may change, while localhost
    # with the current port often remains the cleanest route.
    saved_port="${saved_addr##*:}"
    if [[ "$saved_port" =~ ^[0-9]{1,5}$ ]]; then
      if try_connect "127.0.0.1:$saved_port"; then
        echo "OK: ADB reconnected automatically through localhost."
        exit 0
      fi
    fi
  fi
fi

# Android 11+ advertises the current Wireless-debugging endpoint through
# _adb-tls-connect._tcp. The port is intentionally dynamic, so discover it
# instead of forcing the user to type the new port every time.
for pass in 1 2 3; do
  mdns_output="$(adb mdns services 2>/dev/null || true)"
  mdns_addrs="$(printf '%s\n' "$mdns_output" | awk '$2 ~ /^_adb-tls-connect\._tcp\.?$/ {print $3}')"

  if [ -n "$mdns_addrs" ]; then
    while IFS= read -r addr; do
      [ -n "$addr" ] || continue

      # On the same phone, try localhost with the discovered port first.
      port="${addr##*:}"
      if [[ "$port" =~ ^[0-9]{1,5}$ ]]; then
        if try_connect "127.0.0.1:$port"; then
          echo "OK: ADB found the current Wireless debugging port and reconnected."
          exit 0
        fi
      fi

      if try_connect "$addr"; then
        echo "OK: ADB found the current Wireless debugging address and reconnected."
        exit 0
      fi
    done <<< "$mdns_addrs"
  fi

  # Give Android/mDNS a moment after Wireless debugging has just been enabled.
  [ "$pass" -lt 3 ] && sleep 1
  if finish_if_connected; then
    echo "OK: ADB reconnected automatically."
    exit 0
  fi
done

# Last-resort interactive fallback for launchers where mDNS/property discovery is
# blocked by the Android vendor build. The normal debugging port is shown on the
# main Wireless debugging screen; it is NOT the temporary pairing port.
if [ -t 0 ]; then
  echo "Automatic ADB discovery did not work on this Android build." >&2
  echo "Open Settings > Developer options > Wireless debugging." >&2
  echo "Look at IP address & Port, then type only the port number below." >&2
  IFS= read -r -p "Wireless debugging port (for example 44917), or Enter to cancel: " manual_port
  if [[ "$manual_port" =~ ^[0-9]{1,5}$ ]] && [ "$manual_port" -ge 1 ] && [ "$manual_port" -le 65535 ]; then
    if try_connect "127.0.0.1:$manual_port"; then
      echo "OK: ADB connected through localhost and saved the new port."
      exit 0
    fi
    echo "Could not connect through localhost. Trying the phone Wi-Fi address is still possible with connect-android.sh." >&2
  fi
fi

echo "ERROR: Android is not connected/authorized in ADB." >&2
echo "Turn ON Settings > Developer options > Wireless debugging, then tap ZTO Cookie Sync again." >&2
echo "Pairing should only be needed once. If Android forgot the pairing, run:" >&2
echo "  $HOME/ZTO-Cookie-Sync/connect-android.sh" >&2
exit 1
