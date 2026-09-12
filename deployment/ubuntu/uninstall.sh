#!/bin/sh
# Remove only an installation proven to be owned by deployment/ubuntu/install.sh.
set -eu

PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH

readonly KIOSK_USER=shutteros-kiosk
readonly STATIC_USER=shutteros-static
readonly KIOSK_ROOT=/opt/cyber-shutteros
readonly HOME_ROOT="/home/$KIOSK_USER"
readonly LIB_ROOT=/usr/local/lib/shutteros-kiosk
readonly POLICY_FILE=/etc/chromium-browser/policies/managed/shutteros.json
readonly STATIC_UNIT=/etc/systemd/system/shutteros-static.service
readonly KIOSK_UNIT=/etc/systemd/system/shutteros-kiosk.service
readonly OWNER_MARKER="$KIOSK_ROOT/.shutteros-kiosk-owner"
readonly OWNER_VERSION=shutteros-kiosk-install-v1

die() {
  printf '%s\n' "error: $*" >&2
  exit 1
}

root_owned_regular() {
  [ -f "$1" ] && [ ! -L "$1" ] && [ "$(stat -c %u "$1")" = 0 ] &&
    [ "$(stat -c %g "$1")" = 0 ]
}

root_owned_directory() {
  [ -d "$1" ] && [ ! -L "$1" ] && [ "$(stat -c %u "$1")" = 0 ] &&
    [ "$(stat -c %g "$1")" = 0 ] || return 1
  # A more restrictive administrator mode must not prevent recovery of the console.
  case "$(stat -c %a "$1")" in 700|750|755) return 0 ;; *) return 1 ;; esac
}

marker_value() {
  key=$1
  sed -n "s/^$key=//p" "$OWNER_MARKER"
}

validate_marker() {
  root_owned_directory "$KIOSK_ROOT" || die 'the kiosk root is not a root-owned 0700, 0750 or 0755 directory'
  root_owned_regular "$OWNER_MARKER" || die 'no valid root-owned ownership marker is present'
  [ "$(stat -c %a "$OWNER_MARKER")" = 600 ] || die 'the ownership marker must have mode 0600'
  [ "$(wc -l < "$OWNER_MARKER")" -eq 3 ] || die 'the ownership marker has an unexpected format'
  [ "$(marker_value version)" = "$OWNER_VERSION" ] || die 'the ownership marker version is invalid'
  case "$(marker_value getty_enabled)" in enabled|disabled|masked) ;; *) die 'the marker has an unsupported getty state' ;; esac
  case "$(marker_value getty_active)" in active|inactive) ;; *) die 'the marker has an unsupported getty activity state' ;; esac
}

validate_account() {
  entry=$(getent passwd "$KIOSK_USER" || true)
  if [ -z "$entry" ]; then
    account_present=false
    return
  fi
  account_present=true
  [ "$(printf '%s' "$entry" | cut -d: -f6)" = "$HOME_ROOT" ] || die 'the kiosk account home is unexpected'
  [ "$(printf '%s' "$entry" | cut -d: -f7)" = "$LIB_ROOT/session" ] || die 'the kiosk account shell is unexpected'
  [ "$(id -u "$KIOSK_USER")" -ne 0 ] || die 'the kiosk account must not be root'
  [ "$(id -gn "$KIOSK_USER")" = "$KIOSK_USER" ] || die 'the kiosk primary group is unexpected'
  if [ ! -d "$HOME_ROOT" ] || [ -L "$HOME_ROOT" ]; then
    die 'the kiosk account home is invalid'
  fi
  [ "$(stat -c %u "$HOME_ROOT")" = "$(id -u "$KIOSK_USER")" ] || die 'the kiosk home owner is unexpected'
}

validate_static_account() {
  entry=$(getent passwd "$STATIC_USER" || true)
  if [ -z "$entry" ]; then
    static_account_present=false
    return
  fi
  static_account_present=true
  [ "$(printf '%s' "$entry" | cut -d: -f6)" = /nonexistent ] || die 'the static account home is unexpected'
  [ "$(printf '%s' "$entry" | cut -d: -f7)" = /usr/sbin/nologin ] || die 'the static account shell is unexpected'
  [ "$(id -u "$STATIC_USER")" -ne 0 ] || die 'the static account must not be root'
  [ "$(id -gn "$STATIC_USER")" = "$STATIC_USER" ] || die 'the static primary group is unexpected'
  [ "$(id -G "$STATIC_USER")" = "$(id -g "$STATIC_USER")" ] || die 'the static account has unexpected supplementary groups'
}

read_original_getty_state() {
  getty_enabled=$(marker_value getty_enabled)
  getty_active=$(marker_value getty_active)
  case "$getty_enabled" in enabled|disabled|masked) ;; *) die 'the marker has an unsupported getty state' ;; esac
  case "$getty_active" in active|inactive) ;; *) die 'the marker has an unsupported getty activity state' ;; esac
  [ "$getty_enabled" != masked ] || [ "$getty_active" = inactive ] || die 'the marker has an impossible masked active state'
}

assert_installed_getty_state() {
  expected_enabled=disabled
  [ "$getty_enabled" = masked ] && expected_enabled=masked
  current_enabled=$(systemctl is-enabled getty@tty1.service 2>/dev/null || true)
  current_active=$(systemctl is-active getty@tty1.service 2>/dev/null || true)
  if [ "$current_enabled" = "$expected_enabled" ] && [ "$current_active" = inactive ]; then
    return 0
  fi
  # A prior interrupted uninstall may already have restored the exact recorded state.
  if [ "$current_enabled" = "$getty_enabled" ] && [ "$current_active" = "$getty_active" ]; then
    return 0
  fi
  die 'getty@tty1 changed outside this kit; refuse to overwrite its administrator-managed state'
}

restore_getty() {
  restore_failed=false
  case "$getty_enabled" in
    enabled) systemctl enable getty@tty1.service || restore_failed=true ;;
    disabled) systemctl disable getty@tty1.service || restore_failed=true ;;
    masked) systemctl mask getty@tty1.service || restore_failed=true ;;
  esac
  case "$getty_active" in
    active) systemctl start getty@tty1.service || restore_failed=true ;;
    inactive) systemctl stop getty@tty1.service || restore_failed=true ;;
  esac
  [ "$restore_failed" = false ]
}

getty_restore_needed=false
cleanup() {
  status=$?
  trap - EXIT
  if [ "$getty_restore_needed" = true ]; then
    restore_getty || printf '%s\n' 'error: failed to restore getty@tty1; administrator recovery is required' >&2
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

[ "$(id -u)" -eq 0 ] || die 'run this reviewed local script as root'
validate_marker
validate_account
validate_static_account
read_original_getty_state
assert_installed_getty_state

[ -z "$(find "$KIOSK_ROOT" -mindepth 1 -maxdepth 1 ! -name site ! -name .site-rollback ! -name .shutteros-kiosk-owner -print -quit)" ] ||
  die 'unexpected files exist in the kiosk root; move them aside before uninstalling'
if [ -e "$LIB_ROOT" ] || [ -L "$LIB_ROOT" ]; then
  root_owned_directory "$LIB_ROOT" || die 'the launcher directory is unexpected'
  [ -z "$(find "$LIB_ROOT" -mindepth 1 -maxdepth 1 ! -name session ! -name launch-chromium ! -name environment -print -quit)" ] ||
    die 'unexpected files exist in the launcher directory; move them aside before uninstalling'
fi

for path in "$LIB_ROOT/session" "$LIB_ROOT/launch-chromium" "$LIB_ROOT/environment" "$STATIC_UNIT" "$KIOSK_UNIT" "$POLICY_FILE"; do
  if [ -e "$path" ] || [ -L "$path" ]; then
    root_owned_regular "$path" || die "refusing to remove unexpected path: $path"
  fi
done

getty_restore_needed=true
systemctl disable --now shutteros-kiosk.service shutteros-static.service
if [ "$account_present" = true ]; then
  kiosk_uid=$(id -u "$KIOSK_USER")
  # Wait for Snap/PAM children outside Cage's cgroup. If stopping their slice
  # fails, let userdel check whether processes actually prevent removal.
  loginctl terminate-user "$KIOSK_USER" 2>/dev/null || true
  systemctl stop "user@${kiosk_uid}.service" "user-${kiosk_uid}.slice" || true
fi
if [ "$account_present" = true ]; then
  userdel --remove "$KIOSK_USER"
fi
if [ "$static_account_present" = true ]; then
  userdel "$STATIC_USER"
fi
# Keep service definitions with the installation until both accounts are gone.
rm -f "$STATIC_UNIT" "$KIOSK_UNIT" "$POLICY_FILE"
rm -rf "$KIOSK_ROOT" "$LIB_ROOT"
systemctl daemon-reload
restore_getty
getty_restore_needed=false

printf '%s\n' 'ShutterOS kiosk units and account removed. Chromium and Cage packages remain installed.'
