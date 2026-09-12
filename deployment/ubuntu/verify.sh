#!/bin/sh
# Read-only checks for an installed ShutterOS kiosk. Run as an administrator.
set -eu

readonly KIOSK_USER=shutteros-kiosk
readonly KIOSK_ROOT=/opt/cyber-shutteros
readonly SITE_ROOT="$KIOSK_ROOT/site"
readonly POLICY_FILE=/etc/chromium-browser/policies/managed/shutteros.json
readonly OWNER_MARKER="$KIOSK_ROOT/.shutteros-kiosk-owner"
readonly OWNER_VERSION=shutteros-kiosk-install-v1
SOURCE_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
readonly SOURCE_DIR

fail() {
  printf '%s\n' "verification failed: $*" >&2
  exit 1
}

root_owned_regular() {
  [ -f "$1" ] && [ ! -L "$1" ] && [ "$(stat -c %u "$1")" = 0 ] &&
    [ "$(stat -c %g "$1")" = 0 ]
}

root_owned_directory() {
  [ -d "$1" ] && [ ! -L "$1" ] && [ "$(stat -c %u "$1")" = 0 ] &&
    [ "$(stat -c %g "$1")" = 0 ] && [ "$(stat -c %a "$1")" = 755 ]
}

marker_value() {
  key=$1
  sed -n "s/^$key=//p" "$OWNER_MARKER"
}

[ "$(id -u)" -eq 0 ] || fail 'run this read-only verification as root'
id "$KIOSK_USER" >/dev/null 2>&1 || fail 'kiosk account is missing'
root_owned_directory "$KIOSK_ROOT" || fail 'kiosk root is not root-owned mode 0755'
root_owned_regular "$OWNER_MARKER" || fail 'ownership marker is missing or unsafe'
[ "$(stat -c %a "$OWNER_MARKER")" = 600 ] || fail 'ownership marker mode is not 0600'
[ "$(wc -l < "$OWNER_MARKER")" -eq 3 ] || fail 'ownership marker format is unexpected'
[ "$(marker_value version)" = "$OWNER_VERSION" ] || fail 'ownership marker version is invalid'
root_owned_directory "$SITE_ROOT" || fail 'static site root is not root-owned mode 0755'
[ -f "$SITE_ROOT/index.html" ] || fail 'static site has no index.html'
[ -f "$SITE_ROOT/kiosk-config.json" ] || fail 'static site has no kiosk-config.json'
[ -z "$(find "$SITE_ROOT" -xdev \( -type l -o ! -user root -o -perm /022 -o \( ! -type d -a ! -type f \) \) -print -quit)" ] ||
  fail 'static site contains a symlink, non-root-owned, writable, or special file'
root_owned_regular "$POLICY_FILE" || fail 'policy file is missing or unsafe'
[ "$(stat -c %a "$POLICY_FILE")" = 644 ] || fail 'policy file mode is not 0644'
cmp -s "$SOURCE_DIR/chromium-policy.json" "$POLICY_FILE" || fail 'installed policy differs from reviewed policy'

snap connections chromium |
  awk '$2 == "chromium:etc-chromium-browser-policies" && $3 != "-" { found = 1 } END { exit !found }' ||
  fail 'Chromium policy interface is disconnected'
systemctl --quiet is-active shutteros-static.service || fail 'static service is not active'
systemctl --quiet is-active shutteros-kiosk.service || fail 'kiosk service is not active'
python3 -c 'from urllib.request import urlopen; urlopen("http://127.0.0.1:8080/", timeout=3).read(1)'

listeners=$(ss -ltnH '( sport = :8080 )')
[ -n "$listeners" ] || fail 'nothing listens on TCP port 8080'
printf '%s\n' "$listeners" | awk '$4 != "127.0.0.1:8080" { exit 1 }' ||
  fail 'TCP port 8080 is not bound only to 127.0.0.1'

printf '%s\n' 'Automated checks passed.'
cat <<'EOF'

Manual acceptance is still required for the target hardware and the kiosk account:
  1. Use the documented temporary SHUTTEROS_INSPECT_POLICY systemd override to visit
     chrome://policy in the real kiosk Wayland session, then remove the override.
  2. Test boot, touch/mouse, Ctrl+Alt+Fn, Ctrl+Alt+T, F12/Ctrl+Shift+I, print,
     download, right-click, crash recovery, firmware controls, and SSH recovery.
EOF
