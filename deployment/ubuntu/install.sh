#!/bin/sh
# Review this local script before running it as root on a dedicated Ubuntu 24.04 kiosk host.
set -eu

readonly KIOSK_USER=shutteros-kiosk
readonly KIOSK_ROOT=/opt/cyber-shutteros
readonly SITE_ROOT="$KIOSK_ROOT/site"
readonly HOME_ROOT="/home/$KIOSK_USER"
readonly LIB_ROOT=/usr/local/lib/shutteros-kiosk
readonly POLICY_ROOT=/etc/chromium-browser/policies/managed
readonly POLICY_FILE="$POLICY_ROOT/shutteros.json"
readonly STATIC_UNIT=/etc/systemd/system/shutteros-static.service
readonly KIOSK_UNIT=/etc/systemd/system/shutteros-kiosk.service
readonly OWNER_MARKER="$KIOSK_ROOT/.shutteros-kiosk-owner"
readonly OWNER_VERSION=shutteros-kiosk-install-v1

die() {
  printf '%s\n' "error: $*" >&2
  exit 1
}

SOURCE_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd) || die 'cannot resolve script directory'
readonly SOURCE_DIR

usage() {
  cat <<'EOF'
Usage: install.sh --site-dir /absolute/path/to/dist

Copies a reviewed ShutterOS static build into /opt/cyber-shutteros/site, creates
the non-administrative shutteros-kiosk account, and enables local Python,
Cage, and Chromium services on tty1.
EOF
}

exists_or_link() {
  [ -e "$1" ] || [ -L "$1" ]
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

validate_marker() {
  root_owned_directory "$KIOSK_ROOT" || die 'the existing kiosk root is not a root-owned 0755 directory'
  root_owned_regular "$OWNER_MARKER" || die 'the ownership marker is not a root-owned regular file'
  [ "$(stat -c %a "$OWNER_MARKER")" = 600 ] || die 'the ownership marker must have mode 0600'
  [ "$(wc -l < "$OWNER_MARKER")" -eq 3 ] || die 'the ownership marker has an unexpected format'
  [ "$(marker_value version)" = "$OWNER_VERSION" ] || die 'the ownership marker version is invalid'
  case "$(marker_value getty_enabled)" in enabled|disabled|masked) ;; *) die 'the marker has an unsupported getty state' ;; esac
  case "$(marker_value getty_active)" in active|inactive) ;; *) die 'the marker has an unsupported getty activity state' ;; esac
}

assert_fresh_target() {
  for path in "$KIOSK_ROOT" "$LIB_ROOT" "$HOME_ROOT" "$STATIC_UNIT" "$KIOSK_UNIT" "$POLICY_FILE"; do
    exists_or_link "$path" && die "refusing to replace existing path: $path"
  done
  if id "$KIOSK_USER" >/dev/null 2>&1; then
    die "refusing to repurpose existing account: $KIOSK_USER"
  fi
}

validate_account() {
  entry=$(getent passwd "$KIOSK_USER" || true)
  [ -n "$entry" ] || die 'the marker exists but the kiosk account does not'
  [ "$(printf '%s' "$entry" | cut -d: -f6)" = "$HOME_ROOT" ] || die 'the kiosk account home is unexpected'
  [ "$(printf '%s' "$entry" | cut -d: -f7)" = "$LIB_ROOT/session" ] || die 'the kiosk account shell is unexpected'
  [ "$(id -u "$KIOSK_USER")" -ne 0 ] || die 'the kiosk account must not be root'
  [ "$(id -G "$KIOSK_USER")" = "$(id -g "$KIOSK_USER")" ] || die 'the kiosk account has unexpected supplementary groups'
  if [ ! -d "$HOME_ROOT" ] || [ -L "$HOME_ROOT" ]; then
    die 'the kiosk account home is invalid'
  fi
  [ "$(stat -c %u "$HOME_ROOT")" = "$(id -u "$KIOSK_USER")" ] || die 'the kiosk home owner is unexpected'
}

read_getty_state() {
  getty_enabled=$(systemctl is-enabled getty@tty1.service 2>/dev/null || true)
  getty_active=$(systemctl is-active getty@tty1.service 2>/dev/null || true)
  case "$getty_enabled" in enabled|disabled|masked) ;; *) die "unsupported getty@tty1 enabled state: ${getty_enabled:-unknown}" ;; esac
  case "$getty_active" in active|inactive) ;; *) die "unsupported getty@tty1 active state: ${getty_active:-unknown}" ;; esac
  [ "$getty_enabled" != masked ] || [ "$getty_active" = inactive ] || die 'masked getty@tty1 cannot be active'
}

assert_installed_getty_state() {
  current_enabled=$(systemctl is-enabled getty@tty1.service 2>/dev/null || true)
  current_active=$(systemctl is-active getty@tty1.service 2>/dev/null || true)
  original_enabled=$(marker_value getty_enabled)
  expected_enabled=disabled
  [ "$original_enabled" = masked ] && expected_enabled=masked
  [ "$current_enabled" = "$expected_enabled" ] || die 'getty@tty1 changed outside this kit; refuse to overwrite it'
  [ "$current_active" = inactive ] || die 'getty@tty1 is active; refuse to compete with an existing console'
}

assert_no_graphical_display_manager() {
  if systemctl --quiet is-active display-manager.service; then
    die 'an active display manager was found; this kit supports a dedicated Ubuntu Server host only'
  fi
}

write_marker() {
  umask 077
  cat > "$OWNER_MARKER" <<EOF
version=$OWNER_VERSION
getty_enabled=$getty_enabled
getty_active=$getty_active
EOF
  chown root:root "$OWNER_MARKER"
  chmod 600 "$OWNER_MARKER"
}

prepare_stage() {
  stage_site=$(mktemp -d /opt/.shutteros-kiosk-site.XXXXXX)
  cp -a --no-preserve=ownership "$site_dir/." "$stage_site/"
  [ -z "$(find "$stage_site" -xdev ! -type d ! -type f -print -quit)" ] ||
    die 'the copied build contains a symlink or special file; source may have changed while copying'
  chown -R root:root "$stage_site"
  chmod -R u=rwX,go=rX "$stage_site"
}

stage_site=
cleanup_stage() {
  [ -z "$stage_site" ] || rm -rf "$stage_site"
}
trap cleanup_stage EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

site_dir=
if [ "$#" -eq 2 ] && [ "$1" = '--site-dir' ]; then
  site_dir=$2
else
  usage >&2
  exit 2
fi

[ "$(id -u)" -eq 0 ] || die 'run this reviewed local script as root'
case "$site_dir" in
  /*) ;;
  *) die '--site-dir must be an absolute path' ;;
esac
[ -f "$site_dir/index.html" ] || die '--site-dir must contain index.html'
[ -f "$site_dir/kiosk-config.json" ] || die '--site-dir must contain kiosk-config.json'
[ ! -L "$site_dir" ] || die '--site-dir must not be a symlink'
[ -z "$(find "$site_dir" -type l -print -quit)" ] || die '--site-dir must not contain symlinks'
[ -z "$(find "$site_dir" -xdev ! -type d ! -type f -print -quit)" ] ||
  die '--site-dir may contain regular files and directories only'
canonical_site=$(realpath -e -- "$site_dir")
canonical_root=$(realpath -m -- "$KIOSK_ROOT")
case "$canonical_site/" in "$canonical_root"/*) die '--site-dir must not be inside the kiosk root' ;; esac

if exists_or_link "$OWNER_MARKER"; then
  installation_mode=reinstall
  validate_marker
  validate_account
  assert_installed_getty_state
else
  installation_mode=fresh
  assert_fresh_target
  read_getty_state
fi
assert_no_graphical_display_manager

# shellcheck disable=SC1091
. /etc/os-release
if [ "${ID:-}" != ubuntu ] || [ "${VERSION_ID:-}" != 24.04 ]; then
  die 'this kit supports Ubuntu 24.04 LTS only; do not apply it to another release'
fi

prepare_stage

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y cage python3 snapd
if ! snap list chromium >/dev/null 2>&1; then
  snap install chromium
fi
[ -x /snap/bin/chromium ] || die 'the Chromium snap command is unavailable after installation'
snap connections chromium |
  awk '$2 == "chromium:etc-chromium-browser-policies" && $3 != "-" { found = 1 } END { exit !found }' ||
  die 'the Chromium snap does not expose a connected etc-chromium-browser-policies interface'

if [ "$installation_mode" = fresh ]; then
  install -d -o root -g root -m 0755 "$KIOSK_ROOT"
  useradd --create-home --user-group --shell "$LIB_ROOT/session" "$KIOSK_USER"
  write_marker
else
  root_owned_directory "$KIOSK_ROOT" || die 'the kiosk root changed during staging'
fi

install -d -o root -g root -m 0755 "$LIB_ROOT"
install -o root -g root -m 0755 "$SOURCE_DIR/session" "$LIB_ROOT/session"
install -o root -g root -m 0755 "$SOURCE_DIR/launch-chromium" "$LIB_ROOT/launch-chromium"
install -o root -g root -m 0644 "$SOURCE_DIR/shutteros-static.service" "$STATIC_UNIT"
install -o root -g root -m 0644 "$SOURCE_DIR/shutteros-kiosk.service" "$KIOSK_UNIT"
install -d -o root -g root -m 0755 "$POLICY_ROOT"
install -o root -g root -m 0644 "$SOURCE_DIR/chromium-policy.json" "$POLICY_FILE"
passwd -l "$KIOSK_USER" >/dev/null
if [ "$installation_mode" = fresh ]; then
  install -d -o "$KIOSK_USER" -g "$KIOSK_USER" -m 0700 "$HOME_ROOT/snap/chromium/common"
fi

systemctl daemon-reload
if [ "$installation_mode" = fresh ]; then
  case "$getty_enabled" in
    enabled|disabled) systemctl disable --now getty@tty1.service ;;
    masked) : ;;
  esac
fi

rollback_site=
if [ -d "$SITE_ROOT" ]; then
  rollback_site="$KIOSK_ROOT/.site-rollback"
  if [ -e "$rollback_site" ] || [ -L "$rollback_site" ]; then
    die 'a prior site rollback directory exists'
  fi
fi
systemctl stop shutteros-kiosk.service shutteros-static.service 2>/dev/null || true
if [ -n "$rollback_site" ]; then
  mv "$SITE_ROOT" "$rollback_site"
fi
mv "$stage_site" "$SITE_ROOT"
stage_site=
if ! systemctl restart shutteros-static.service || ! systemctl restart shutteros-kiosk.service; then
  systemctl stop shutteros-kiosk.service shutteros-static.service 2>/dev/null || true
  if [ -n "$rollback_site" ]; then
    rm -rf "$SITE_ROOT"
    mv "$rollback_site" "$SITE_ROOT"
    systemctl restart shutteros-static.service 2>/dev/null || true
    systemctl restart shutteros-kiosk.service 2>/dev/null || true
  fi
  die 'the new kiosk services did not start; the previous static site was restored when available'
fi
[ -z "$rollback_site" ] || rm -rf "$rollback_site"
systemctl enable shutteros-static.service shutteros-kiosk.service

printf '%s\n' 'Installed ShutterOS kiosk services. Run deployment/ubuntu/verify.sh next.'
