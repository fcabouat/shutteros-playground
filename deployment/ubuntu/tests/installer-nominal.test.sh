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
printf 'ID=ubuntu\nVERSION_ID=24.04\n' > "$tmp/etc/os-release"
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
[ "${1:-}" = passwd ] || exit 2
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
  chmod "$mode" "$2"
fi
EOF
cat > "$tmp/bin/useradd" <<'EOF'
#!/bin/sh
printf 'useradd %s\n' "$*" >> "$TEST_CALLS"
for last do :; done
grep -qx "$last" "$TEST_ACCOUNTS" && exit 9
printf '%s\n' "$last" >> "$TEST_ACCOUNTS"
[ "$last" != shutteros-kiosk ] || mkdir -p "$TEST_HOME"
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
  connections) printf 'Interface Plug Slot Notes\nsystem-files chromium:etc-chromium-browser-policies system:etc-chromium-browser-policies -\n' ;;
  list|wait) exit 0 ;;
  install) exit 90 ;;
esac
EOF
cat > "$tmp/bin/python3" <<'EOF'
#!/bin/sh
case "${1:-}" in
  -c) exit 0 ;;
  *) exec /usr/bin/python3 "$@" ;;
esac
EOF
cat > "$tmp/bin/apt-get" <<'EOF'
#!/bin/sh
printf 'apt-get %s\n' "$*" >> "$TEST_CALLS"
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

script="$tmp/kit/install.sh"
sed -i "s|PATH=/usr/sbin:/usr/bin:/sbin:/bin|PATH=$tmp/bin:/usr/sbin:/usr/bin:/sbin:/bin|" "$script"
sed -i "s|readonly KIOSK_ROOT=/opt/cyber-shutteros|readonly KIOSK_ROOT=$tmp/opt/cyber-shutteros|" "$script"
sed -i "s|readonly STAGE_ROOT=/opt|readonly STAGE_ROOT=$tmp/opt|" "$script"
sed -i "s|readonly HOME_ROOT=\"/home/\$KIOSK_USER\"|readonly HOME_ROOT=$tmp/home/shutteros-kiosk|" "$script"
sed -i "s|readonly LIB_ROOT=/usr/local/lib/shutteros-kiosk|readonly LIB_ROOT=$tmp/lib/shutteros-kiosk|" "$script"
sed -i "s|readonly POLICY_ROOT=/etc/chromium-browser/policies/managed|readonly POLICY_ROOT=$tmp/etc/chromium-browser/policies/managed|" "$script"
sed -i "s|/etc/systemd/system|$tmp/etc/systemd/system|g" "$script"
sed -i "s|readonly OS_RELEASE_FILE=/etc/os-release|readonly OS_RELEASE_FILE=$tmp/etc/os-release|" "$script"
sed -i "s|readonly KEYBOARD_DEFAULTS_FILE=/etc/default/keyboard|readonly KEYBOARD_DEFAULTS_FILE=$tmp/etc/default/keyboard|" "$script"
sed -i "s|readonly LOCALE_DEFAULTS_FILE=/etc/default/locale|readonly LOCALE_DEFAULTS_FILE=$tmp/etc/default/locale|" "$script"
sed -i "s|readonly CAGE_COMMAND=/usr/bin/cage|readonly CAGE_COMMAND=$tmp/bin/cage|" "$script"
sed -i "s|readonly PYTHON_COMMAND=/usr/bin/python3|readonly PYTHON_COMMAND=$tmp/bin/python3|" "$script"
sed -i "s|readonly SNAP_COMMAND=/usr/bin/snap|readonly SNAP_COMMAND=$tmp/bin/snap|" "$script"
sed -i "s|readonly CHROMIUM_COMMAND=/snap/bin/chromium|readonly CHROMIUM_COMMAND=$tmp/bin/chromium|" "$script"
chmod 755 "$script"

# Maintenance follows the same fully redirected filesystem/account boundary.
for maintenance in verify uninstall; do
  target="$tmp/kit/$maintenance.sh"
  sed -i "s|PATH=/usr/sbin:/usr/bin:/sbin:/bin|PATH=$tmp/bin:/usr/sbin:/usr/bin:/sbin:/bin|" "$target"
  sed -i "s|readonly KIOSK_ROOT=/opt/cyber-shutteros|readonly KIOSK_ROOT=$tmp/opt/cyber-shutteros|" "$target"
  sed -i "s|readonly HOME_ROOT=\"/home/\$KIOSK_USER\"|readonly HOME_ROOT=$tmp/home/shutteros-kiosk|" "$target"
  sed -i "s|readonly LIB_ROOT=/usr/local/lib/shutteros-kiosk|readonly LIB_ROOT=$tmp/lib/shutteros-kiosk|" "$target"
  sed -i "s|/etc/chromium-browser/policies/managed|$tmp/etc/chromium-browser/policies/managed|g" "$target"
  sed -i "s|/etc/systemd/system|$tmp/etc/systemd/system|g" "$target"
  sed -i "s|-user root|-user $(/usr/bin/id -u)|g" "$target"
  chmod 755 "$target"
done
run_maintenance() {
  TEST_ACCOUNTS="$tmp/accounts" TEST_CALLS="$tmp/calls" TEST_GETTY_STATE="$tmp/getty-state" \
    TEST_HOME="$tmp/home/shutteros-kiosk" TEST_LIB="$tmp/lib/shutteros-kiosk" \
    "$tmp/kit/$1.sh"
}

run_install() {
  TEST_ACCOUNTS="$tmp/accounts" TEST_CALLS="$tmp/calls" TEST_GETTY_STATE="$tmp/getty-state" \
    TEST_HOME="$tmp/home/shutteros-kiosk" TEST_LIB="$tmp/lib/shutteros-kiosk" \
    "$script" --site-dir "$1"
}

run_install "$tmp/dist"
grep -qx shutteros-kiosk "$tmp/accounts"
grep -qx shutteros-static "$tmp/accounts"
grep -q '^snap wait system seed.loaded$' "$tmp/calls"
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
cmp -s "$tmp/dist-update/index.html" "$tmp/opt/cyber-shutteros/site/index.html"

cp -a "$tmp/dist" "$tmp/dist-bad-start"
printf '<!doctype html><title>must roll back</title>' > "$tmp/dist-bad-start/index.html"
if FAIL_KIOSK_RESTART=1 run_install "$tmp/dist-bad-start" 2>/dev/null; then
  printf '%s\n' 'expected kiosk startup failure' >&2
  exit 1
fi
cmp -s "$tmp/dist-update/index.html" "$tmp/opt/cyber-shutteros/site/index.html"
[ ! -e "$tmp/opt/cyber-shutteros/.site-rollback" ]

# Verification detects a damaged launcher without mutating the installation.
run_maintenance verify >/dev/null
chmod 0644 "$tmp/lib/shutteros-kiosk/session"
if run_maintenance verify >/dev/null 2>&1; then
  printf '%s\n' 'expected verification to reject an unsafe launcher mode' >&2
  exit 1
fi
chmod 0755 "$tmp/lib/shutteros-kiosk/session"
# Recovery remains possible after an administrator restricts the installation root.
chmod 0750 "$tmp/opt/cyber-shutteros"
run_maintenance uninstall >/dev/null
[ "$(cat "$tmp/getty-state")" = 'enabled active' ]
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

printf '%s\n' 'installer nominal tests passed'
