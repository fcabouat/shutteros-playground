#!/bin/sh
# Exercises installation, recovery, verification and removal against a temporary root and fake host services.
set -eu

repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
mkdir -p "$tmp/bin" "$tmp/kit" "$tmp/opt" "$tmp/etc/default" "$tmp/etc/systemd/system" "$tmp/home"
cp -a "$repo_root/deployment/ubuntu/." "$tmp/kit/"
cp -a "$repo_root/static/." "$tmp/dist/"
printf '<!doctype html><title>initial</title>' > "$tmp/dist/index.html"
mkdir -p "$tmp/dist/_app"
printf 'console.log(1);' > "$tmp/dist/_app/game.js"
printf 'ID=%s\nVERSION_ID=%s\n' ubuntu 26.04 > "$tmp/etc/os-release"
printf 'XKBMODEL="pc105"\nXKBLAYOUT="fr"\nXKBVARIANT="oss"\nXKBOPTIONS="compose:ralt"\n' > "$tmp/etc/default/keyboard"
printf 'LANG="fr_FR.UTF-8"\n' > "$tmp/etc/default/locale"
: > "$tmp/accounts"
: > "$tmp/calls"
printf 'enabled active\n' > "$tmp/getty-state"

cat > "$tmp/bin/id" <<'EOF'
#!/bin/sh
if [ "$#" -eq 1 ] && [ "$1" = -u ]; then printf '0\n'; exit 0; fi
option=
case "${1:-}" in -u|-g|-G|-gn) option=$1; shift ;; esac
account=${1:-}
grep -qx "$account" "$TEST_ACCOUNTS" || exit 1
case "$account:$option" in
  shutteros-kiosk:-u|shutteros-kiosk:-g|shutteros-kiosk:-G) printf '1001\n' ;;
  shutteros-static:-u|shutteros-static:-g|shutteros-static:-G) printf '1002\n' ;;
  shutteros-kiosk:-gn) printf 'shutteros-kiosk\n' ;;
  shutteros-static:-gn) printf 'shutteros-static\n' ;;
esac
EOF
cat > "$tmp/bin/getent" <<'EOF'
#!/bin/sh
[ "${1:-}" = passwd ] || {
  if [ "${1:-}" = group ] && grep -qx "${2:-}" "$TEST_ACCOUNTS"; then
    printf '%s:x:1001:\n' "$2"
    exit 0
  fi
  exit 2
}
grep -qx "${2:-}" "$TEST_ACCOUNTS" || exit 2
case "$2" in
  shutteros-kiosk) printf 'shutteros-kiosk:x:1001:1001::%s:%s/session\n' "$TEST_HOME" "$TEST_LIB" ;;
  shutteros-static) printf 'shutteros-static:x:1002:1002::/nonexistent:/usr/sbin/nologin\n' ;;
esac
EOF
cat > "$tmp/bin/stat" <<'EOF'
#!/bin/sh
if [ "$1" = -c ] && [ "$2" = %u ] && [ "$3" = "$TEST_HOME" ]; then printf '1001\n'; exit 0; fi
if [ "$1" = -c ] && { [ "$2" = %u ] || [ "$2" = %g ]; }; then printf '0\n'; exit 0; fi
exec /usr/bin/stat "$@"
EOF
cat > "$tmp/bin/chown" <<'EOF'
#!/bin/sh
exit 0
EOF
cat > "$tmp/bin/install" <<'EOF'
#!/bin/sh
directory=false
mode=
while [ "$#" -gt 0 ]; do
  case "$1" in
    -d) directory=true; shift ;;
    -o|-g) shift 2 ;;
    -m) mode=$2; shift 2 ;;
    *) break ;;
  esac
done
if [ "$directory" = true ]; then
  mkdir -p "$1"
  chmod "$mode" "$1"
else
  /usr/bin/cp "$1" "$2"
  if [ "${CORRUPT_INSTALL_ONCE:-0}" = 1 ] && [ ! -e "$TEST_CALLS.corrupted" ]; then
    : > "$2"
    touch "$TEST_CALLS.corrupted"
  fi
  chmod "$mode" "$2"
fi
EOF
cat > "$tmp/bin/useradd" <<'EOF'
#!/bin/sh
printf 'useradd %s\n' "$*" >> "$TEST_CALLS"
for last do :; done
grep -qx "$last" "$TEST_ACCOUNTS" && exit 9
printf '%s\n' "$last" >> "$TEST_ACCOUNTS"
# Exit 12 represents an identity committed before home creation fails.
if [ "${PARTIAL_USERADD:-}" = "$last" ]; then exit 12; fi
if [ "$last" = shutteros-kiosk ]; then
  mkdir -p "$TEST_HOME"
fi
EOF
cat > "$tmp/bin/systemctl" <<'EOF'
#!/bin/sh
printf 'systemctl %s\n' "$*" >> "$TEST_CALLS"
command=
unit=
for argument do
  case "$argument" in
    is-enabled|is-active|enable|disable|start|stop|restart|mask|show) [ -n "$command" ] || command=$argument ;;
    *.service) unit=$argument ;;
  esac
done
if [ "$unit" = display-manager.service ] && [ "$command" = is-active ]; then exit 3; fi
if [ "$unit" = user@1001.service ] && [ "$command" = stop ]; then
  # Inject an operational error; do not assume an inactive unit fails to stop.
  [ "${FAIL_USER_SLICE_STOP:-0}" != 1 ] || exit 1
  rm -f "$TEST_HOME/session-active"
fi
if [ "$unit" = getty@tty1.service ]; then
  read -r enabled active < "$TEST_GETTY_STATE"
  case "$command" in
    is-enabled) printf '%s\n' "$enabled" ;;
    is-active) printf '%s\n' "$active" ;;
    disable) printf 'disabled inactive\n' > "$TEST_GETTY_STATE" ;;
    enable) printf 'enabled %s\n' "$active" > "$TEST_GETTY_STATE" ;;
    mask) printf 'masked inactive\n' > "$TEST_GETTY_STATE" ;;
    start) printf '%s active\n' "$enabled" > "$TEST_GETTY_STATE" ;;
    stop) printf '%s inactive\n' "$enabled" > "$TEST_GETTY_STATE" ;;
  esac
  exit 0
fi
if [ "$unit" = shutteros-kiosk.service ] && [ "$command" = restart ] && [ "${FAIL_KIOSK_RESTART:-0}" = 1 ]; then
  exit 1
fi
if [ "$unit" = shutteros-kiosk.service ] && [ "$command" = restart ] &&
  [ "${FAIL_KIOSK_RESTART_ONCE:-0}" = 1 ] && [ ! -e "$TEST_HOME/restart-failed" ]; then
  touch "$TEST_HOME/restart-failed"
  exit 1
fi
if [ "$unit" = shutteros-kiosk.service ] && [ "$command" = restart ]; then
  touch "$TEST_HOME/session-active"
fi
if [ "$command" = show ]; then
  case "$*" in *MainPID*) printf '4242\n' ;; *NRestarts*) printf '0\n' ;; esac
  exit 0
fi
case "$command" in is-enabled) printf 'enabled\n' ;; is-active) printf 'active\n' ;; esac
EOF
cat > "$tmp/bin/snap" <<'EOF'
#!/bin/sh
printf 'snap %s\n' "$*" >> "$TEST_CALLS"
case "${1:-}" in
  connections)
    slot=system:etc-chromium-browser-policies
    [ "${DISCONNECTED_POLICY:-0}" != 1 ] || slot=-
    printf 'Interface Plug Slot Notes\nsystem-files chromium:etc-chromium-browser-policies %s -\n' "$slot"
    ;;
  list) [ "${MISSING_CHROMIUM_SNAP:-0}" != 1 ] ;;
  wait) exit 0 ;;
  install) exit 90 ;;
esac
EOF
cat > "$tmp/bin/sync" <<'EOF'
#!/bin/sh
printf 'sync %s\n' "$*" >> "$TEST_CALLS"
# No flush of the host filesystem: only failure/order of this boundary is tested.
if [ "$1" = -f ] && [ "${FAIL_WRITEBACK:-0}" = 1 ]; then exit 1; fi
EOF
cat > "$tmp/bin/cp" <<'EOF'
#!/bin/sh
/usr/bin/cp "$@"
if [ "${CORRUPT_STAGE:-0}" = 1 ]; then
  for argument do :; done
  case "$argument" in */.shutteros-kiosk-site.*/)
    : > "$argument/_app/game.js" ;;
  esac
fi
EOF
cat > "$tmp/bin/python3" <<'EOF'
#!/bin/sh
if [ "${1:-}" = -B ] && [ "${3:-}" = http ]; then
  printf 'http-content-check\n' >> "$TEST_CALLS"
  exit 0
fi
exec /usr/bin/python3 "$@"
EOF
cat > "$tmp/bin/dpkg-query" <<'EOF'
#!/bin/sh
[ "${MISSING_SESSION_PACKAGES:-0}" != 1 ] || exit 1
printf 'install ok installed'
EOF
cat > "$tmp/bin/apt-get" <<'EOF'
#!/bin/sh
printf 'apt-get %s\n' "$*" >> "$TEST_CALLS"
if [ "$1" = update ] && [ "${MISSING_SESSION_PACKAGES:-0}" = 1 ]; then exit 0; fi
exit 91
EOF
cat > "$tmp/bin/sleep" <<'EOF'
#!/bin/sh
printf 'sleep %s\n' "$*" >> "$TEST_CALLS"
EOF
for command in passwd loginctl; do
  cat > "$tmp/bin/$command" <<EOF
#!/bin/sh
printf '%s %s\n' '$command' "\$*" >> "\$TEST_CALLS"
EOF
done
cat > "$tmp/bin/userdel" <<'EOF'
#!/bin/sh
printf 'userdel %s\n' "$*" >> "$TEST_CALLS"
for account do :; done
if [ "$account" = shutteros-kiosk ] && [ "${FAIL_USERDEL:-0}" = 1 ]; then exit 8; fi
if [ "$account" = shutteros-static ] && [ "${FAIL_STATIC_USERDEL:-0}" = 1 ]; then exit 8; fi
if [ "$account" = shutteros-kiosk ] && [ -e "$TEST_HOME/session-active" ]; then
  printf '%s\n' 'userdel: kiosk session processes still exist' >&2
  exit 8
fi
grep -vx "$account" "$TEST_ACCOUNTS" > "$TEST_ACCOUNTS.next" || true
mv "$TEST_ACCOUNTS.next" "$TEST_ACCOUNTS"
[ "$account" != shutteros-kiosk ] || rm -rf "$TEST_HOME"
EOF
cat > "$tmp/bin/ss" <<'EOF'
#!/bin/sh
printf 'LISTEN 0 5 127.0.0.1:8080 0.0.0.0:*\n'
EOF
touch "$tmp/bin/cage" "$tmp/bin/chromium"
chmod 755 "$tmp/bin"/*

sed -i "s|/etc/chromium-browser/policies/managed|$tmp/etc/chromium-browser/policies/managed|g; s|/snap/bin/chromium|$tmp/bin/chromium|g" "$tmp/kit/platform.sh"

script="$tmp/kit/install.sh"
sed -i "s|PATH=/usr/sbin:/usr/bin:/sbin:/bin|PATH=$tmp/bin:/usr/sbin:/usr/bin:/sbin:/bin|" "$script"
sed -i "s|readonly KIOSK_ROOT=/opt/cyber-shutteros|readonly KIOSK_ROOT=$tmp/opt/cyber-shutteros|" "$script"
sed -i "s|readonly STAGE_ROOT=/opt|readonly STAGE_ROOT=$tmp/opt|" "$script"
sed -i "s|readonly HOME_ROOT=\"/home/\$KIOSK_USER\"|readonly HOME_ROOT=$tmp/home/shutteros-kiosk|" "$script"
sed -i "s|readonly LIB_ROOT=/usr/local/lib/shutteros-kiosk|readonly LIB_ROOT=$tmp/lib/shutteros-kiosk|" "$script"
sed -i "s|/etc/systemd/system|$tmp/etc/systemd/system|g" "$script"
sed -i "s|readonly OS_RELEASE_FILE=/etc/os-release|readonly OS_RELEASE_FILE=$tmp/etc/os-release|" "$script"
sed -i "s|readonly KEYBOARD_DEFAULTS_FILE=/etc/default/keyboard|readonly KEYBOARD_DEFAULTS_FILE=$tmp/etc/default/keyboard|" "$script"
sed -i "s|readonly LOCALE_DEFAULTS_FILE=/etc/default/locale|readonly LOCALE_DEFAULTS_FILE=$tmp/etc/default/locale|" "$script"
sed -i "s|readonly CAGE_COMMAND=/usr/bin/cage|readonly CAGE_COMMAND=$tmp/bin/cage|" "$script"
sed -i "s|readonly PYTHON_COMMAND=/usr/bin/python3|readonly PYTHON_COMMAND=$tmp/bin/python3|" "$script"
sed -i "s|readonly SNAP_COMMAND=/usr/bin/snap|readonly SNAP_COMMAND=$tmp/bin/snap|" "$script"
chmod 755 "$script"

# Maintenance follows the same fully redirected filesystem/account boundary.
for maintenance in verify uninstall; do
  target="$tmp/kit/$maintenance.sh"
  sed -i "s|PATH=/usr/sbin:/usr/bin:/sbin:/bin|PATH=$tmp/bin:/usr/sbin:/usr/bin:/sbin:/bin|" "$target"
  sed -i "s|readonly KIOSK_ROOT=/opt/cyber-shutteros|readonly KIOSK_ROOT=$tmp/opt/cyber-shutteros|" "$target"
  sed -i "s|readonly HOME_ROOT=\"/home/\$KIOSK_USER\"|readonly HOME_ROOT=$tmp/home/shutteros-kiosk|" "$target"
  sed -i "s|readonly LIB_ROOT=/usr/local/lib/shutteros-kiosk|readonly LIB_ROOT=$tmp/lib/shutteros-kiosk|" "$target"
  sed -i "s|/etc/systemd/system|$tmp/etc/systemd/system|g" "$target"
  sed -i "s|-user root|-user $(/usr/bin/id -u)|g" "$target"
  sed -i "s|readonly OS_RELEASE_FILE=/etc/os-release|readonly OS_RELEASE_FILE=$tmp/etc/os-release|" "$target"
  chmod 755 "$target"
done
run_maintenance() {
  TEST_ACCOUNTS="$tmp/accounts" TEST_CALLS="$tmp/calls" TEST_GETTY_STATE="$tmp/getty-state" \
    TEST_HOME="$tmp/home/shutteros-kiosk" TEST_LIB="$tmp/lib/shutteros-kiosk" \
    "$tmp/kit/$1.sh"
}

run_install() {
  install_source=$1
  shift
  TEST_ACCOUNTS="$tmp/accounts" TEST_CALLS="$tmp/calls" TEST_GETTY_STATE="$tmp/getty-state" \
    TEST_HOME="$tmp/home/shutteros-kiosk" TEST_LIB="$tmp/lib/shutteros-kiosk" \
    "$script" --site-dir "$install_source" "$@"
}

# A corrupt staging copy must fail before any account or service change.
if CORRUPT_STAGE=1 run_install "$tmp/dist" > "$tmp/corrupt.log" 2>&1; then exit 1; fi
grep -q 'checksum mismatch: _app/game.js' "$tmp/corrupt.log"
[ ! -s "$tmp/accounts" ]
if grep -Eq '^systemctl (enable|disable|restart|stop)' "$tmp/calls"; then exit 1; fi

: > "$tmp/calls"
run_install "$tmp/dist"
# Disk writeback is required before the first HTTP/browser activation.
python3 - "$tmp/calls" <<'PY_CHECK'
from pathlib import Path
import sys
calls = Path(sys.argv[1]).read_text().splitlines()
flush = next(i for i, line in enumerate(calls) if line.startswith("sync -f "))
assert flush < calls.index("systemctl restart shutteros-static.service")
assert flush < calls.index("systemctl restart shutteros-kiosk.service")
PY_CHECK
grep -qx shutteros-kiosk "$tmp/accounts"
grep -qx shutteros-static "$tmp/accounts"
grep -q '^snap wait system seed.loaded$' "$tmp/calls"
test -f "$tmp/etc/chromium-browser/policies/managed/shutteros.json"
grep -q '^sleep 3$' "$tmp/calls"
if grep -q '^apt-get ' "$tmp/calls"; then exit 1; fi
if grep -q '^snap install ' "$tmp/calls"; then exit 1; fi
[ ! -e "$tmp/home/shutteros-kiosk/snap" ]
cmp -s "$tmp/dist/index.html" "$tmp/opt/cyber-shutteros/site/index.html"
cat > "$tmp/expected-environment" <<'EOF'
LANG=fr_FR.UTF-8
XKB_DEFAULT_LAYOUT=fr
XKB_DEFAULT_MODEL=pc105
XKB_DEFAULT_VARIANT=oss
XKB_DEFAULT_OPTIONS=compose:ralt
EOF
cmp -s "$tmp/expected-environment" "$tmp/lib/shutteros-kiosk/environment"
grep -q '^User=shutteros-static$' "$tmp/etc/systemd/system/shutteros-static.service"

cp -a "$tmp/dist" "$tmp/dist-update"
printf '<!doctype html><title>updated</title>' > "$tmp/dist-update/index.html"
run_install "$tmp/dist-update"
# A failed filesystem flush rolls back both site and inventory without launching
# the new game; a truncated temporary support file never replaces its predecessor.
cp "$tmp/opt/cyber-shutteros/.site-sha256.json" "$tmp/saved-inventory"
for failure in FAIL_WRITEBACK CORRUPT_INSTALL_ONCE; do
  : > "$tmp/calls"
  if env "$failure=1" TEST_ACCOUNTS="$tmp/accounts" TEST_CALLS="$tmp/calls" TEST_GETTY_STATE="$tmp/getty-state" \
    TEST_HOME="$tmp/home/shutteros-kiosk" TEST_LIB="$tmp/lib/shutteros-kiosk" \
    "$script" --site-dir "$tmp/dist" > "$tmp/failure.log" 2>&1; then exit 1; fi
  cmp -s "$tmp/dist-update/index.html" "$tmp/opt/cyber-shutteros/site/index.html"
  cmp -s "$tmp/saved-inventory" "$tmp/opt/cyber-shutteros/.site-sha256.json"
  cmp -s "$tmp/kit/session" "$tmp/lib/shutteros-kiosk/session"
  # Only rollback restart may occur, not a candidate HTTP check or activation.
  if grep -q '^http-content-check$' "$tmp/calls"; then exit 1; fi
done
cmp -s "$tmp/dist-update/index.html" "$tmp/opt/cyber-shutteros/site/index.html"

run_install "$tmp/dist-update" --keyboard-layout us
grep -qx 'XKB_DEFAULT_LAYOUT=us' "$tmp/lib/shutteros-kiosk/environment"
grep -qx 'XKB_DEFAULT_VARIANT=' "$tmp/lib/shutteros-kiosk/environment"
run_install "$tmp/dist-update"
cmp -s "$tmp/expected-environment" "$tmp/lib/shutteros-kiosk/environment"

cp -a "$tmp/dist" "$tmp/dist-bad-start"
printf '<!doctype html><title>must roll back</title>' > "$tmp/dist-bad-start/index.html"
cp "$tmp/kit/session" "$tmp/original-session"
printf '#!/bin/sh\nexit 70\n' > "$tmp/kit/session"
if FAIL_KIOSK_RESTART=1 run_install "$tmp/dist-bad-start" 2>/dev/null; then
  printf '%s\n' 'expected kiosk startup failure' >&2
  exit 1
fi
cmp -s "$tmp/dist-update/index.html" "$tmp/opt/cyber-shutteros/site/index.html"
cmp -s "$tmp/original-session" "$tmp/lib/shutteros-kiosk/session"
[ ! -e "$tmp/opt/cyber-shutteros/.site-rollback" ]
mv "$tmp/original-session" "$tmp/kit/session"

# Frozen Ubuntu kit from 7673bfc predates platform.sh and selects Snap directly.
# A failed upgrade must restore that working launcher and unit, not a hybrid kit.
if [ "${TEST_DISTRO:-ubuntu}" = ubuntu ]; then
  legacy="$repo_root/deployment/ubuntu/tests/fixtures/ubuntu-snap-v1"
  cp "$legacy/launch-chromium" "$tmp/lib/shutteros-kiosk/launch-chromium"
  cp "$legacy/shutteros-kiosk.service" "$tmp/etc/systemd/system/shutteros-kiosk.service"
  rm "$tmp/lib/shutteros-kiosk/platform.sh"
  rm -f "$tmp/home/shutteros-kiosk/session-active"
  if FAIL_KIOSK_RESTART_ONCE=1 run_install "$tmp/dist-bad-start" 2>/dev/null; then exit 1; fi
  [ ! -e "$tmp/lib/shutteros-kiosk/platform.sh" ]
  cmp -s "$legacy/launch-chromium" "$tmp/lib/shutteros-kiosk/launch-chromium"
  cmp -s "$legacy/shutteros-kiosk.service" "$tmp/etc/systemd/system/shutteros-kiosk.service"
  cmp -s "$tmp/dist-update/index.html" "$tmp/opt/cyber-shutteros/site/index.html"
  [ -e "$tmp/home/shutteros-kiosk/session-active" ]
  rm "$tmp/home/shutteros-kiosk/restart-failed"
  run_install "$tmp/dist-update"
  cmp -s "$tmp/kit/platform.sh" "$tmp/lib/shutteros-kiosk/platform.sh"
  cmp -s "$tmp/kit/launch-chromium" "$tmp/lib/shutteros-kiosk/launch-chromium"
  cmp -s "$tmp/kit/shutteros-kiosk.service" "$tmp/etc/systemd/system/shutteros-kiosk.service"
fi

# Verification detects a lost Snap policy interface without changing the installation.
if [ "${TEST_DISTRO:-ubuntu}" = ubuntu ]; then
  if DISCONNECTED_POLICY=1 run_maintenance verify >/dev/null 2>&1; then exit 1; fi
  if DISCONNECTED_POLICY=1 run_install "$tmp/dist-bad-start" >/dev/null 2>&1; then exit 1; fi
  cmp -s "$tmp/dist-update/index.html" "$tmp/opt/cyber-shutteros/site/index.html"
fi

# Verification detects a damaged launcher without mutating the installation.
run_maintenance verify >/dev/null
# Regressions from the physical incident: blank HTML and missing/empty JS must
# fail read-only verification even when services still report active.
cp "$tmp/opt/cyber-shutteros/site/index.html" "$tmp/saved-index"
: > "$tmp/opt/cyber-shutteros/site/index.html"
if run_maintenance verify > "$tmp/verify-error" 2>&1; then exit 1; fi
grep -q 'index.html is missing or empty' "$tmp/verify-error"
cp "$tmp/saved-index" "$tmp/opt/cyber-shutteros/site/index.html"
for damage in truncate remove; do
  cp "$tmp/opt/cyber-shutteros/site/_app/game.js" "$tmp/saved-js"
  if [ "$damage" = truncate ]; then
    : > "$tmp/opt/cyber-shutteros/site/_app/game.js"
  else
    rm "$tmp/opt/cyber-shutteros/site/_app/game.js"
  fi
  if run_maintenance verify > "$tmp/verify-error" 2>&1; then exit 1; fi
  grep -q '_app/game.js' "$tmp/verify-error"
  cp "$tmp/saved-js" "$tmp/opt/cyber-shutteros/site/_app/game.js"
done
run_maintenance verify >/dev/null
chmod 0644 "$tmp/lib/shutteros-kiosk/session"
if run_maintenance verify >/dev/null 2>&1; then
  printf '%s\n' 'expected verification to reject an unsafe launcher mode' >&2
  exit 1
fi
chmod 0755 "$tmp/lib/shutteros-kiosk/session"
# Recovery remains possible after an administrator restricts the installation root.
chmod 0750 "$tmp/opt/cyber-shutteros"
# Do not overwrite a getty state that an administrator changed after installation.
printf 'enabled inactive\n' > "$tmp/getty-state"
if run_maintenance uninstall >/dev/null 2>&1; then
  printf '%s\n' 'expected uninstall to preserve an administrator-managed getty state' >&2
  exit 1
fi
[ "$(cat "$tmp/getty-state")" = 'enabled inactive' ]
grep -qx shutteros-kiosk "$tmp/accounts"
printf 'disabled inactive\n' > "$tmp/getty-state"
# If stopping the user slice fails while processes remain, userdel must refuse
# removal and ownership evidence must survive for another attempt.
if FAIL_USER_SLICE_STOP=1 run_maintenance uninstall >/dev/null 2>&1; then
  printf '%s\n' 'expected live kiosk processes to prevent account removal' >&2
  exit 1
fi
grep -qx shutteros-kiosk "$tmp/accounts"
[ -f "$tmp/opt/cyber-shutteros/.shutteros-kiosk-owner" ]
[ "$(cat "$tmp/getty-state")" = 'enabled active' ]
if FAIL_STATIC_USERDEL=1 run_maintenance uninstall >/dev/null 2>&1; then
  printf '%s\n' 'expected static account removal failure' >&2
  exit 1
fi
[ "$(cat "$tmp/getty-state")" = 'enabled active' ]
grep -qx shutteros-static "$tmp/accounts"
[ -f "$tmp/etc/systemd/system/shutteros-kiosk.service" ]
[ -f "$tmp/etc/systemd/system/shutteros-static.service" ]
run_maintenance uninstall >/dev/null
[ "$(cat "$tmp/getty-state")" = 'enabled active' ]
[ ! -s "$tmp/accounts" ]
[ ! -e "$tmp/opt/cyber-shutteros" ]
[ ! -e "$tmp/home/shutteros-kiosk" ]

# Missing offline dependencies fail before accounts or services are mutated.
: > "$tmp/calls"
if MISSING_SESSION_PACKAGES=1 run_install "$tmp/dist" > /dev/null 2> "$tmp/missing-error"; then exit 1; fi
grep -q 'libpam-systemd is missing' "$tmp/missing-error"
if grep -Eq '^(apt-get|snap install|useradd) ' "$tmp/calls"; then exit 1; fi
[ ! -s "$tmp/accounts" ]
[ ! -e "$tmp/opt/cyber-shutteros" ]

: > "$tmp/calls"
if MISSING_CHROMIUM_SNAP=1 run_install "$tmp/dist" > /dev/null 2> "$tmp/missing-error"; then exit 1; fi
grep -q 'Chromium Snap is missing' "$tmp/missing-error"
if grep -Eq '^(apt-get|snap install|useradd) ' "$tmp/calls"; then exit 1; fi
[ ! -s "$tmp/accounts" ]
[ ! -e "$tmp/opt/cyber-shutteros" ]

chmod 0644 "$tmp/bin/chromium"
: > "$tmp/calls"
if run_install "$tmp/dist" > /dev/null 2> "$tmp/missing-error"; then exit 1; fi
grep -q 'Chromium Snap command is unavailable' "$tmp/missing-error"
if grep -Eq '^(apt-get|snap install|useradd) ' "$tmp/calls"; then exit 1; fi
[ ! -s "$tmp/accounts" ]
chmod 0755 "$tmp/bin/chromium"

# A useradd that creates its identity before failing is still owned by this attempt and removed.
if FAIL_USER_SLICE_STOP=1 PARTIAL_USERADD=shutteros-kiosk run_install "$tmp/dist" 2>/dev/null; then
  printf '%s\n' 'expected partial kiosk account creation failure' >&2
  exit 1
fi
[ ! -s "$tmp/accounts" ]
[ ! -e "$tmp/opt/cyber-shutteros" ]
[ ! -e "$tmp/home/shutteros-kiosk" ]

# A failed first activation restores tty1 and removes only resources created by that attempt.
if FAIL_KIOSK_RESTART=1 run_install "$tmp/dist-bad-start" 2>/dev/null; then
  printf '%s\n' 'expected first kiosk startup failure' >&2
  exit 1
fi
[ "$(cat "$tmp/getty-state")" = 'enabled active' ]
[ ! -s "$tmp/accounts" ]
[ ! -e "$tmp/opt/cyber-shutteros" ]
[ ! -e "$tmp/home/shutteros-kiosk" ]

# Failed account removal must retain ownership evidence for a later uninstall.
if FAIL_USERDEL=1 FAIL_KIOSK_RESTART=1 run_install "$tmp/dist-bad-start" 2>/dev/null; then
  printf '%s\n' 'expected first activation and account cleanup failure' >&2
  exit 1
fi
[ -f "$tmp/opt/cyber-shutteros/.shutteros-kiosk-owner" ]
[ -d "$tmp/lib/shutteros-kiosk" ]
[ "$(cat "$tmp/getty-state")" = 'enabled active' ]
run_maintenance uninstall >/dev/null
[ ! -s "$tmp/accounts" ]
[ ! -e "$tmp/opt/cyber-shutteros" ]

printf '%s\n' 'installer nominal tests passed'
