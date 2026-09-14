#!/bin/sh
# Read-only checks for an installed ShutterOS kiosk. Run as an administrator.
set -eu

PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH

readonly KIOSK_USER=shutteros-kiosk
readonly STATIC_USER=shutteros-static
readonly KIOSK_ROOT=/opt/cyber-shutteros
readonly SITE_ROOT="$KIOSK_ROOT/site"
readonly HOME_ROOT="/home/$KIOSK_USER"
readonly LIB_ROOT=/usr/local/lib/shutteros-kiosk
readonly ENVIRONMENT_FILE="$LIB_ROOT/environment"
readonly POLICY_FILE=/etc/chromium-browser/policies/managed/shutteros.json
readonly STATIC_UNIT=/etc/systemd/system/shutteros-static.service
readonly KIOSK_UNIT=/etc/systemd/system/shutteros-kiosk.service
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
id "$STATIC_USER" >/dev/null 2>&1 || fail 'static-server account is missing'
kiosk_entry=$(getent passwd "$KIOSK_USER")
[ "$(printf '%s' "$kiosk_entry" | cut -d: -f6)" = "$HOME_ROOT" ] || fail 'kiosk account home is unexpected'
[ "$(printf '%s' "$kiosk_entry" | cut -d: -f7)" = "$LIB_ROOT/session" ] || fail 'kiosk account shell is unexpected'
[ "$(id -u "$KIOSK_USER")" -ne 0 ] || fail 'kiosk account is root'
[ "$(id -u "$STATIC_USER")" -ne 0 ] || fail 'static-server account is root'
[ "$(id -gn "$KIOSK_USER")" = "$KIOSK_USER" ] || fail 'kiosk primary group is unexpected'
[ "$(id -gn "$STATIC_USER")" = "$STATIC_USER" ] || fail 'static-server primary group is unexpected'
[ "$(id -G "$KIOSK_USER")" = "$(id -g "$KIOSK_USER")" ] || fail 'kiosk account has supplementary groups'
[ "$(id -G "$STATIC_USER")" = "$(id -g "$STATIC_USER")" ] || fail 'static-server account has supplementary groups'
[ "$(getent passwd "$STATIC_USER" | cut -d: -f6-7)" = /nonexistent:/usr/sbin/nologin ] || fail 'static-server account shape is unexpected'
if [ ! -d "$HOME_ROOT" ] || [ -L "$HOME_ROOT" ]; then
  fail 'kiosk home is missing or unsafe'
fi
[ "$(stat -c %u "$HOME_ROOT")" = "$(id -u "$KIOSK_USER")" ] || fail 'kiosk home has the wrong owner'
root_owned_directory "$KIOSK_ROOT" || fail 'kiosk root is not root-owned mode 0755'
root_owned_regular "$OWNER_MARKER" || fail 'ownership marker is missing or unsafe'
[ "$(stat -c %a "$OWNER_MARKER")" = 600 ] || fail 'ownership marker mode is not 0600'
[ "$(wc -l < "$OWNER_MARKER")" -eq 3 ] || fail 'ownership marker format is unexpected'
[ "$(marker_value version)" = "$OWNER_VERSION" ] || fail 'ownership marker version is invalid'
original_getty_enabled=$(marker_value getty_enabled)
original_getty_active=$(marker_value getty_active)
case "$original_getty_enabled" in enabled|disabled) expected_getty_enabled=disabled ;; masked) expected_getty_enabled=masked ;; *) fail 'ownership marker getty state is invalid' ;; esac
case "$original_getty_active" in active|inactive) ;; *) fail 'ownership marker getty activity is invalid' ;; esac
[ "$(systemctl is-enabled getty@tty1.service 2>/dev/null || true)" = "$expected_getty_enabled" ] || fail 'getty@tty1 enabled state differs from the installed state'
[ "$(systemctl is-active getty@tty1.service 2>/dev/null || true)" = inactive ] || fail 'getty@tty1 is active and competing with the kiosk'
root_owned_directory "$SITE_ROOT" || fail 'static site root is not root-owned mode 0755'
[ -f "$SITE_ROOT/index.html" ] || fail 'static site has no index.html'
[ -f "$SITE_ROOT/kiosk-config.json" ] || fail 'static site has no kiosk-config.json'
[ -z "$(find "$SITE_ROOT" -xdev \( -type l -o ! -user root -o -perm /022 -o \( ! -type d -a ! -type f \) \) -print -quit)" ] ||
  fail 'static site contains a symlink, non-root-owned, writable, or special file'
python3 "$SOURCE_DIR/validate-config.py" "$SITE_ROOT/kiosk-config.json" || fail 'deployed kiosk configuration is invalid'
for name in session launch-chromium; do
  source_file="$SOURCE_DIR/$name"
  installed_file="$LIB_ROOT/$name"
  root_owned_regular "$installed_file" || fail "installed launcher is missing or unsafe: $installed_file"
  [ "$(stat -c %a "$installed_file")" = 755 ] || fail "installed launcher mode is not 0755: $installed_file"
  cmp -s "$source_file" "$installed_file" || fail "installed launcher differs from reviewed file: $installed_file"
done
for pair in \
  "$SOURCE_DIR/shutteros-static.service:$STATIC_UNIT" \
  "$SOURCE_DIR/shutteros-kiosk.service:$KIOSK_UNIT"; do
  source_file=${pair%%:*}
  installed_file=${pair#*:}
  root_owned_regular "$installed_file" || fail "installed unit is missing or unsafe: $installed_file"
  [ "$(stat -c %a "$installed_file")" = 644 ] || fail "installed unit mode is not 0644: $installed_file"
  cmp -s "$source_file" "$installed_file" || fail "installed unit differs from reviewed unit: $installed_file"
done
root_owned_regular "$ENVIRONMENT_FILE" || fail 'session environment file is missing or unsafe'
[ "$(stat -c %a "$ENVIRONMENT_FILE")" = 644 ] || fail 'session environment file mode is not 0644'
[ "$(wc -l < "$ENVIRONMENT_FILE")" -eq 5 ] || fail 'session environment file format is unexpected'
awk -F= '
  $1 == "LANG" && $2 ~ /^[A-Za-z0-9_.@-]+$/ { lang = 1 }
  $1 == "XKB_DEFAULT_LAYOUT" && $2 ~ /^[A-Za-z0-9,_+-]+$/ { layout = 1 }
  $1 == "XKB_DEFAULT_MODEL" && $2 ~ /^[A-Za-z0-9,_+-]+$/ { model = 1 }
  $1 == "XKB_DEFAULT_VARIANT" && $2 ~ /^[A-Za-z0-9,_+-]*$/ { variant = 1 }
  $1 == "XKB_DEFAULT_OPTIONS" && $2 ~ /^[A-Za-z0-9_,:+-]*$/ { options = 1 }
  END { exit !(lang && layout && model && variant && options) }
' "$ENVIRONMENT_FILE" || fail 'session environment values are invalid'
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
  3. Before and after login, test Ctrl+W, Alt+F4, Ctrl+Shift+Q, Ctrl+N, Ctrl+T,
     Escape, Ctrl+wheel and pinch zoom. Verify keyboard navigation and the
     Ctrl+Alt+Home reset. Keyboard capture depends on Chromium and the OS; verify restart recovery.
  4. Follow docs/ubuntu-kiosk.md for GRUB, SysRq, Ctrl+Alt+Delete, emergency access,
     and shutdown/power-on acceptance. These host controls are administrator-managed.
EOF
