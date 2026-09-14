#!/bin/sh
# Runs installer preflight against a rewritten temporary root and command stubs.
set -eu

repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
mkdir -p "$tmp/bin" "$tmp/dist" "$tmp/kit" "$tmp/opt"
printf '<!doctype html>' > "$tmp/dist/index.html"
printf '{}' > "$tmp/dist/kiosk-config.json"

cat > "$tmp/bin/id" <<'EOF'
#!/bin/sh
if [ "${1:-}" = '-u' ]; then
  printf '0\n'
  exit 0
fi
[ "${ACCOUNT_EXISTS:-0}" = 1 ]
EOF
cat > "$tmp/bin/systemctl" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" >> "$TEST_CALLS"
case "${1:-}" in
  is-enabled) printf 'enabled\n' ;;
  is-active) printf 'active\n' ;;
esac
EOF
for command in apt-get snap install useradd usermod passwd chown chmod cp mv rm; do
  cat > "$tmp/bin/$command" <<EOF
#!/bin/sh
printf '%s %s\\n' '$command' "\$*" >> "\$TEST_CALLS"
exit 99
EOF
done
chmod 755 "$tmp/bin"/*

prepare_script() {
  cp "$repo_root/deployment/ubuntu/install.sh" "$tmp/kit/install.sh"
  sed -i "s|readonly KIOSK_ROOT=/opt/cyber-shutteros|readonly KIOSK_ROOT=$tmp/opt/cyber-shutteros|" "$tmp/kit/install.sh"
  sed -i "s|readonly STAGE_ROOT=/opt|readonly STAGE_ROOT=$tmp/opt|" "$tmp/kit/install.sh"
  sed -i "s|readonly HOME_ROOT=\"/home/\$KIOSK_USER\"|readonly HOME_ROOT=$tmp/home/shutteros-kiosk|" "$tmp/kit/install.sh"
  sed -i "s|readonly LIB_ROOT=/usr/local/lib/shutteros-kiosk|readonly LIB_ROOT=$tmp/lib/shutteros-kiosk|" "$tmp/kit/install.sh"
  sed -i "s|readonly POLICY_ROOT=/etc/chromium-browser/policies/managed|readonly POLICY_ROOT=$tmp/etc/chromium-browser/policies/managed|" "$tmp/kit/install.sh"
  sed -i "s|/etc/systemd/system|$tmp/etc/systemd/system|g" "$tmp/kit/install.sh"
  sed -i "s|PATH=/usr/sbin:/usr/bin:/sbin:/bin|PATH=$tmp/bin:/usr/sbin:/usr/bin:/sbin:/bin|" "$tmp/kit/install.sh"
  chmod 755 "$tmp/kit/install.sh"
}

expect_refusal() {
  name=$1
  shift
  : > "$tmp/calls"
  if PATH="$tmp/bin:$PATH" TEST_CALLS="$tmp/calls" "$@"; then
    printf '%s\n' "expected refusal: $name" >&2
    exit 1
  fi
  [ ! -s "$tmp/calls" ] || {
    printf '%s\n' "mutation attempted during refusal: $name" >&2
    cat "$tmp/calls" >&2
    exit 1
  }
}

prepare_script
expect_refusal existing-account env ACCOUNT_EXISTS=1 "$tmp/kit/install.sh" --site-dir "$tmp/dist"

# A missing account is expected on a fresh target; preflight must reach staging.
: > "$tmp/calls"
if PATH="$tmp/bin:$PATH" TEST_CALLS="$tmp/calls" ACCOUNT_EXISTS=0 \
  "$tmp/kit/install.sh" --site-dir "$tmp/dist" 2> "$tmp/fresh-error"; then
  printf '%s\n' 'expected the stub display manager to stop the fresh preflight' >&2
  exit 1
fi
grep -q 'active display manager' "$tmp/fresh-error"
grep -q 'is-enabled getty@tty1.service' "$tmp/calls"
if grep -Eq '^(apt-get|snap|install|useradd|usermod|passwd|chown|chmod|cp|mv|rm) ' "$tmp/calls"; then
  printf '%s\n' 'fresh preflight attempted a host mutation' >&2
  exit 1
fi

mkdir -p "$tmp/opt/cyber-shutteros"
prepare_script
expect_refusal existing-root env ACCOUNT_EXISTS=0 "$tmp/kit/install.sh" --site-dir "$tmp/dist"

rm -rf "$tmp/opt/cyber-shutteros"
mkdir -p "$tmp/opt/cyber-shutteros"
cat > "$tmp/opt/cyber-shutteros/.shutteros-kiosk-owner" <<'EOF'
version=shutteros-kiosk-install-v1
getty_enabled=enabled
getty_active=active
EOF
chmod 666 "$tmp/opt/cyber-shutteros/.shutteros-kiosk-owner"
prepare_script
expect_refusal unsafe-marker env ACCOUNT_EXISTS=0 "$tmp/kit/install.sh" --site-dir "$tmp/dist"

printf '%s\n' 'installer refusal tests passed'
