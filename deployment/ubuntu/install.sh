#!/bin/sh
# Review this local script before running it as root on a dedicated Ubuntu 24.04 kiosk host.
set -eu

PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH

readonly KIOSK_USER=shutteros-kiosk
readonly STATIC_USER=shutteros-static
readonly KIOSK_ROOT=/opt/cyber-shutteros
readonly STAGE_ROOT=/opt
readonly SITE_ROOT="$KIOSK_ROOT/site"
readonly HOME_ROOT="/home/$KIOSK_USER"
readonly LIB_ROOT=/usr/local/lib/shutteros-kiosk
readonly ENVIRONMENT_FILE="$LIB_ROOT/environment"
readonly POLICY_ROOT=/etc/chromium-browser/policies/managed
readonly POLICY_FILE="$POLICY_ROOT/shutteros.json"
readonly STATIC_UNIT=/etc/systemd/system/shutteros-static.service
readonly KIOSK_UNIT=/etc/systemd/system/shutteros-kiosk.service
readonly OWNER_MARKER="$KIOSK_ROOT/.shutteros-kiosk-owner"
readonly OWNER_VERSION=shutteros-kiosk-install-v1
readonly OS_RELEASE_FILE=/etc/os-release
readonly KEYBOARD_DEFAULTS_FILE=/etc/default/keyboard
readonly LOCALE_DEFAULTS_FILE=/etc/default/locale
readonly CAGE_COMMAND=/usr/bin/cage
readonly PYTHON_COMMAND=/usr/bin/python3
readonly SNAP_COMMAND=/usr/bin/snap
readonly CHROMIUM_COMMAND=/snap/bin/chromium

die() {
  printf '%s\n' "error: $*" >&2
  exit 1
}

SOURCE_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd) || die 'cannot resolve script directory'
readonly SOURCE_DIR

usage() {
  cat <<'EOF'
Usage: install.sh --site-dir /absolute/path/to/dist [options]

Options:
  --locale LOCALE             Session locale (default: host LANG or C.UTF-8)
  --keyboard-layout LAYOUT    XKB layout (default: host XKBLAYOUT or us)
  --keyboard-model MODEL      XKB model (default: host XKBMODEL or pc105)
  --keyboard-variant VARIANT  XKB variant (default: host XKBVARIANT)
  --keyboard-options OPTIONS  XKB options (default: host XKBOPTIONS)

Copies a reviewed ShutterOS static build into /opt/cyber-shutteros/site, creates
separate browser and static-server accounts, and enables local Python, Cage,
and Chromium services on tty1.
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
  for account in "$KIOSK_USER" "$STATIC_USER"; do
    if id "$account" >/dev/null 2>&1; then
      die "refusing to repurpose existing account: $account"
    fi
    if getent group "$account" >/dev/null 2>&1; then
      die "refusing to repurpose existing group: $account"
    fi
  done
}

validate_kiosk_account() {
  entry=$(getent passwd "$KIOSK_USER" || true)
  [ -n "$entry" ] || die 'the marker exists but the kiosk account does not'
  [ "$(printf '%s' "$entry" | cut -d: -f6)" = "$HOME_ROOT" ] || die 'the kiosk account home is unexpected'
  [ "$(printf '%s' "$entry" | cut -d: -f7)" = "$LIB_ROOT/session" ] || die 'the kiosk account shell is unexpected'
  [ "$(id -u "$KIOSK_USER")" -ne 0 ] || die 'the kiosk account must not be root'
  [ "$(id -gn "$KIOSK_USER")" = "$KIOSK_USER" ] || die 'the kiosk primary group is unexpected'
  [ "$(id -G "$KIOSK_USER")" = "$(id -g "$KIOSK_USER")" ] || die 'the kiosk account has unexpected supplementary groups'
  if [ ! -d "$HOME_ROOT" ] || [ -L "$HOME_ROOT" ]; then
    die 'the kiosk account home is invalid'
  fi
  [ "$(stat -c %u "$HOME_ROOT")" = "$(id -u "$KIOSK_USER")" ] || die 'the kiosk home owner is unexpected'
}

validate_static_account() {
  entry=$(getent passwd "$STATIC_USER" || true)
  [ -n "$entry" ] || return 1
  [ "$(printf '%s' "$entry" | cut -d: -f6)" = /nonexistent ] || die 'the static account home is unexpected'
  [ "$(printf '%s' "$entry" | cut -d: -f7)" = /usr/sbin/nologin ] || die 'the static account shell is unexpected'
  [ "$(id -u "$STATIC_USER")" -ne 0 ] || die 'the static account must not be root'
  [ "$(id -gn "$STATIC_USER")" = "$STATIC_USER" ] || die 'the static primary group is unexpected'
  [ "$(id -G "$STATIC_USER")" = "$(id -g "$STATIC_USER")" ] || die 'the static account has unexpected supplementary groups'
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
  (umask 077
   cat > "$OWNER_MARKER" <<EOF
version=$OWNER_VERSION
getty_enabled=$getty_enabled
getty_active=$getty_active
EOF
  )
  chown root:root "$OWNER_MARKER"
  chmod 600 "$OWNER_MARKER"
}

read_default_assignment() {
  file=$1
  key=$2
  [ -r "$file" ] || return 0
  awk -F= -v wanted="$key" '
    $1 ~ "^[[:space:]]*" wanted "[[:space:]]*$" {
      value = substr($0, index($0, "=") + 1)
      sub(/^[[:space:]]*/, "", value)
      sub(/[[:space:]]*$/, "", value)
      if ((substr(value, 1, 1) == "\"" && substr(value, length(value), 1) == "\"") ||
          (substr(value, 1, 1) == "\047" && substr(value, length(value), 1) == "\047"))
        value = substr(value, 2, length(value) - 2)
      print value
      exit
    }
  ' "$file"
}

prepare_environment() {
  [ -n "$session_locale" ] || session_locale=$(read_default_assignment "$LOCALE_DEFAULTS_FILE" LANG)
  [ -n "$session_locale" ] || session_locale=C.UTF-8
  [ -n "$keyboard_layout" ] || keyboard_layout=$(read_default_assignment "$KEYBOARD_DEFAULTS_FILE" XKBLAYOUT)
  [ -n "$keyboard_layout" ] || keyboard_layout=us
  [ -n "$keyboard_model" ] || keyboard_model=$(read_default_assignment "$KEYBOARD_DEFAULTS_FILE" XKBMODEL)
  [ -n "$keyboard_model" ] || keyboard_model=pc105
  [ "$keyboard_variant_set" = true ] || keyboard_variant=$(read_default_assignment "$KEYBOARD_DEFAULTS_FILE" XKBVARIANT)
  [ "$keyboard_options_set" = true ] || keyboard_options=$(read_default_assignment "$KEYBOARD_DEFAULTS_FILE" XKBOPTIONS)

  case "$session_locale" in ''|*[!A-Za-z0-9_.@-]*) die 'locale contains unsupported characters' ;; esac
  case "$keyboard_layout" in ''|*[!A-Za-z0-9,_+-]*) die 'keyboard layout contains unsupported characters' ;; esac
  case "$keyboard_model" in ''|*[!A-Za-z0-9,_+-]*) die 'keyboard model contains unsupported characters' ;; esac
  case "$keyboard_variant" in *[!A-Za-z0-9,_+-]*) die 'keyboard variant contains unsupported characters' ;; esac
  case "$keyboard_options" in *[!A-Za-z0-9_,:+-]*) die 'keyboard options contain unsupported characters' ;; esac

  environment_tmp=$(mktemp)
  chmod 0600 "$environment_tmp"
  cat > "$environment_tmp" <<EOF
LANG=$session_locale
XKB_DEFAULT_LAYOUT=$keyboard_layout
XKB_DEFAULT_MODEL=$keyboard_model
XKB_DEFAULT_VARIANT=$keyboard_variant
XKB_DEFAULT_OPTIONS=$keyboard_options
EOF
}

prepare_stage() {
  stage_site=$(mktemp -d "$STAGE_ROOT/.shutteros-kiosk-site.XXXXXX")
  cp -a --no-preserve=ownership "$site_dir/." "$stage_site/"
  [ -z "$(find "$stage_site" -xdev ! -type d ! -type f -print -quit)" ] ||
    die 'the copied build contains a symlink or special file; source may have changed while copying'
  chown -R root:root "$stage_site"
  chmod -R u=rwX,go=rX "$stage_site"
}

validate_tree() {
  tree=$1
  root_owned_directory "$tree" || return 1
  [ -f "$tree/index.html" ] && [ -f "$tree/kiosk-config.json" ] || return 1
  [ -z "$(find "$tree" -xdev \( -type l -o ! -user root -o -perm /022 -o \( ! -type d -a ! -type f \) \) -print -quit)" ]
}

recover_interrupted_swap() {
  interrupted="$KIOSK_ROOT/.site-rollback"
  exists_or_link "$interrupted" || return 0
  exists_or_link "$SITE_ROOT" && die 'both the site and rollback directory exist; inspect them manually'
  validate_tree "$interrupted" || die 'the interrupted rollback directory is unsafe; inspect it manually'
  mv "$interrupted" "$SITE_ROOT"
}

restore_getty() {
  case "$getty_enabled" in
    enabled) systemctl enable getty@tty1.service >/dev/null ;;
    disabled) systemctl disable getty@tty1.service >/dev/null ;;
    masked) systemctl mask getty@tty1.service >/dev/null ;;
  esac
  case "$getty_active" in
    active) systemctl start getty@tty1.service ;;
    inactive) systemctl stop getty@tty1.service ;;
  esac
}

wait_for_http() {
  attempts=0
  while [ "$attempts" -lt 15 ]; do
    if "$PYTHON_COMMAND" -c 'from urllib.request import urlopen; urlopen("http://127.0.0.1:8080/", timeout=1).read(1)' >/dev/null 2>&1; then
      return 0
    fi
    systemctl --quiet is-active shutteros-static.service || return 1
    attempts=$((attempts + 1))
    sleep 1
  done
  return 1
}

verify_stable_kiosk_process() {
  first_pid=$(systemctl show --property=MainPID --value shutteros-kiosk.service)
  first_restarts=$(systemctl show --property=NRestarts --value shutteros-kiosk.service)
  case "$first_pid" in ''|0|*[!0-9]*) return 1 ;; esac
  case "$first_restarts" in ''|*[!0-9]*) return 1 ;; esac
  sleep 3
  systemctl --quiet is-active shutteros-kiosk.service || return 1
  [ "$(systemctl show --property=MainPID --value shutteros-kiosk.service)" = "$first_pid" ] || return 1
  [ "$(systemctl show --property=NRestarts --value shutteros-kiosk.service)" = "$first_restarts" ] || return 1
}

stage_site=
environment_tmp=
rollback_site=
new_site_installed=false
getty_reserved=false
activation_started=false
installation_mode=unknown
kiosk_root_created=false
kiosk_account_created=false
static_account_created=false
fresh_mutation_started=false
cleanup() {
  status=$?
  trap - EXIT
  [ -z "$stage_site" ] || rm -rf "$stage_site"
  [ -z "$environment_tmp" ] || rm -f "$environment_tmp"
  if [ "$status" -ne 0 ] && [ "$activation_started" = true ]; then
    systemctl stop shutteros-kiosk.service shutteros-static.service 2>/dev/null || true
    [ "$new_site_installed" = false ] || rm -rf "$SITE_ROOT"
    if [ -n "$rollback_site" ] && exists_or_link "$rollback_site"; then
      mv "$rollback_site" "$SITE_ROOT"
      systemctl restart shutteros-static.service 2>/dev/null || true
      systemctl restart shutteros-kiosk.service 2>/dev/null || true
    fi
  fi
  if [ "$status" -ne 0 ] && [ "$installation_mode" = fresh ] && [ "$fresh_mutation_started" = true ]; then
    systemctl disable shutteros-kiosk.service shutteros-static.service 2>/dev/null || true
  fi
  if [ "$status" -ne 0 ] && [ "$installation_mode" = fresh ] && [ "$getty_reserved" = true ]; then
    restore_getty || true
  fi
  if [ "$status" -ne 0 ] && [ "$installation_mode" = fresh ] && [ "$fresh_mutation_started" = true ]; then
    rm -f "$STATIC_UNIT" "$KIOSK_UNIT" "$POLICY_FILE"
    [ "$static_account_created" = false ] || userdel "$STATIC_USER" 2>/dev/null || true
    [ "$kiosk_account_created" = false ] || userdel --remove "$KIOSK_USER" 2>/dev/null || true
    [ "$kiosk_root_created" = false ] || rm -rf "$KIOSK_ROOT"
    rm -rf "$LIB_ROOT"
    systemctl daemon-reload 2>/dev/null || true
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

site_dir=
session_locale=
keyboard_layout=
keyboard_model=
keyboard_variant=
keyboard_options=
keyboard_variant_set=false
keyboard_options_set=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --site-dir) [ "$#" -ge 2 ] || die '--site-dir requires a value'; site_dir=$2; shift 2 ;;
    --locale) [ "$#" -ge 2 ] || die '--locale requires a value'; session_locale=$2; shift 2 ;;
    --keyboard-layout) [ "$#" -ge 2 ] || die '--keyboard-layout requires a value'; keyboard_layout=$2; shift 2 ;;
    --keyboard-model) [ "$#" -ge 2 ] || die '--keyboard-model requires a value'; keyboard_model=$2; shift 2 ;;
    --keyboard-variant) [ "$#" -ge 2 ] || die '--keyboard-variant requires a value'; keyboard_variant=$2; keyboard_variant_set=true; shift 2 ;;
    --keyboard-options) [ "$#" -ge 2 ] || die '--keyboard-options requires a value'; keyboard_options=$2; keyboard_options_set=true; shift 2 ;;
    --help) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done
[ -n "$site_dir" ] || { usage >&2; exit 2; }

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
  validate_kiosk_account
  if ! validate_static_account; then
    getent group "$STATIC_USER" >/dev/null 2>&1 && die "refusing to repurpose existing group: $STATIC_USER"
    static_account_missing=true
  fi
  assert_installed_getty_state
  recover_interrupted_swap
else
  installation_mode=fresh
  static_account_missing=true
  assert_fresh_target
  read_getty_state
fi
assert_no_graphical_display_manager

# shellcheck disable=SC1090
. "$OS_RELEASE_FILE"
if [ "${ID:-}" != ubuntu ] || [ "${VERSION_ID:-}" != 24.04 ]; then
  die 'this kit supports Ubuntu 24.04 LTS only; do not apply it to another release'
fi

prepare_environment
prepare_stage

missing_packages=
[ -x "$CAGE_COMMAND" ] || missing_packages="$missing_packages cage"
[ -x "$PYTHON_COMMAND" ] || missing_packages="$missing_packages python3"
[ -x "$SNAP_COMMAND" ] || missing_packages="$missing_packages snapd"
if [ -n "$missing_packages" ]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  # Package names above are fixed constants; splitting passes each as an argument.
  # shellcheck disable=SC2086
  apt-get install -y $missing_packages
fi
[ -x "$CAGE_COMMAND" ] || die 'Cage is unavailable after package installation'
[ -x "$PYTHON_COMMAND" ] || die 'Python is unavailable after package installation'
[ -x "$SNAP_COMMAND" ] || die 'Snap is unavailable after package installation'
"$PYTHON_COMMAND" "$SOURCE_DIR/validate-config.py" "$stage_site/kiosk-config.json" ||
  die 'kiosk-config.json is invalid'
"$SNAP_COMMAND" wait system seed.loaded
if ! "$SNAP_COMMAND" list chromium >/dev/null 2>&1; then
  "$SNAP_COMMAND" install chromium
fi
[ -x "$CHROMIUM_COMMAND" ] || die 'the Chromium snap command is unavailable after installation'
"$SNAP_COMMAND" connections chromium |
  awk '$2 == "chromium:etc-chromium-browser-policies" && $3 != "-" { found = 1 } END { exit !found }' ||
  die 'the Chromium snap does not expose a connected etc-chromium-browser-policies interface'

if [ "$installation_mode" = fresh ]; then
  fresh_mutation_started=true
  install -d -o root -g root -m 0755 "$KIOSK_ROOT"
  kiosk_root_created=true
  useradd --create-home --user-group --shell "$LIB_ROOT/session" "$KIOSK_USER"
  kiosk_account_created=true
  write_marker
else
  root_owned_directory "$KIOSK_ROOT" || die 'the kiosk root changed during staging'
fi
if [ "${static_account_missing:-false}" = true ]; then
  useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$STATIC_USER"
  static_account_created=true
fi

install -d -o root -g root -m 0755 "$LIB_ROOT"
install -o root -g root -m 0755 "$SOURCE_DIR/session" "$LIB_ROOT/session"
install -o root -g root -m 0755 "$SOURCE_DIR/launch-chromium" "$LIB_ROOT/launch-chromium"
install -o root -g root -m 0644 "$environment_tmp" "$ENVIRONMENT_FILE"
rm -f "$environment_tmp"
environment_tmp=
install -o root -g root -m 0644 "$SOURCE_DIR/shutteros-static.service" "$STATIC_UNIT"
install -o root -g root -m 0644 "$SOURCE_DIR/shutteros-kiosk.service" "$KIOSK_UNIT"
install -d -o root -g root -m 0755 "$POLICY_ROOT"
install -o root -g root -m 0644 "$SOURCE_DIR/chromium-policy.json" "$POLICY_FILE"
passwd -l "$KIOSK_USER" >/dev/null

systemctl daemon-reload
systemctl enable shutteros-static.service shutteros-kiosk.service >/dev/null
if [ "$installation_mode" = fresh ]; then
  getty_reserved=true
  case "$getty_enabled" in
    enabled|disabled) systemctl disable --now getty@tty1.service ;;
    masked) : ;;
  esac
fi

activation_started=true
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
new_site_installed=true
systemctl restart shutteros-static.service || die 'the static service failed to start'
wait_for_http || die 'the static service did not become reachable on loopback'
systemctl restart shutteros-kiosk.service || die 'the kiosk service failed to start'
verify_stable_kiosk_process || die 'the kiosk process did not remain stable during startup'
[ -z "$rollback_site" ] || rm -rf "$rollback_site"
rollback_site=
new_site_installed=false

printf '%s\n' 'Installed ShutterOS kiosk services and verified HTTP plus short process stability.'
printf '%s\n' 'Run deployment/ubuntu/verify.sh, then complete the documented hardware acceptance.'
