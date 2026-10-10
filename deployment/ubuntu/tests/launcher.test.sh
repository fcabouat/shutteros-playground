#!/bin/sh
# Exercise the actual launcher on both layouts without starting a browser.
set -eu
repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
mkdir -p "$tmp/home" "$tmp/runtime"
cp "$repo_root/deployment/ubuntu/platform.sh" "$tmp/platform.sh"
sed "s|/usr/local/lib/shutteros-kiosk/platform.sh|$tmp/platform.sh|; s|/etc/os-release|$tmp/os-release|" \
  "$repo_root/deployment/ubuntu/launch-chromium" > "$tmp/launch"
cat > "$tmp/chromium" <<'BROWSER'
#!/bin/sh
printf '%s\n' "$@"
BROWSER
chmod 755 "$tmp/chromium"
sed -i "s|/snap/bin/chromium|$tmp/chromium|; s|/usr/bin/chromium|$tmp/chromium|" "$tmp/platform.sh"
for distro in ubuntu debian; do
  printf 'ID=%s\n' "$distro" > "$tmp/os-release"
  case "$distro" in
    ubuntu) profile="$tmp/home/snap/chromium/common/shutteros-kiosk" ;;
    debian) profile="$tmp/home/.config/shutteros-kiosk" ;;
  esac
  mkdir -p "$profile"
  touch "$tmp/keep"
  ln -s "$tmp/keep" "$profile/SingletonLock"
  HOME="$tmp/home" XDG_RUNTIME_DIR="$tmp/runtime" sh "$tmp/launch" > "$tmp/args"
  grep -qx -- '--ozone-platform=wayland' "$tmp/args"
  grep -qx -- '--kiosk' "$tmp/args"
  grep -qx -- 'http://127.0.0.1:8080/?kiosk=1' "$tmp/args"
  grep -qx -- "--user-data-dir=$profile" "$tmp/args"
  if grep -q -- '--no-sandbox' "$tmp/args"; then exit 1; fi
  [ ! -L "$profile/SingletonLock" ] && [ -f "$tmp/keep" ]
  [ "$(stat -c %a "$profile")" = 700 ]
  HOME="$tmp/home" XDG_RUNTIME_DIR="$tmp/runtime" SHUTTEROS_INSPECT_POLICY=1 sh "$tmp/launch" > "$tmp/args"
  grep -qx 'chrome://policy' "$tmp/args"
  if grep -qx -- '--kiosk' "$tmp/args"; then exit 1; fi
  if HOME="$tmp/home" XDG_RUNTIME_DIR="$tmp/runtime" SHUTTEROS_INSPECT_POLICY=bad sh "$tmp/launch" >/dev/null 2>&1; then exit 1; fi
done
# The historical launcher restored by the migration test must still open the game.
sed "s|/snap/bin/chromium|$tmp/chromium|g" \
  "$repo_root/deployment/ubuntu/tests/fixtures/ubuntu-snap-v1/launch-chromium" > "$tmp/legacy-launch"
HOME="$tmp/home" XDG_RUNTIME_DIR="$tmp/runtime" sh "$tmp/legacy-launch" > "$tmp/args"
grep -qx -- '--kiosk' "$tmp/args"
grep -qx -- 'http://127.0.0.1:8080/?kiosk=1' "$tmp/args"
grep -qx -- "--user-data-dir=$tmp/home/snap/chromium/common/shutteros-kiosk" "$tmp/args"
printf '%s\n' 'Chromium launcher tests passed'
