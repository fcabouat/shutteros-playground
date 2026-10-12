#!/bin/bash
# Installer-only hook: copies the payload; disk selection belongs to Subiquity's UI.
set -Eeuo pipefail
# Keep the trusted installer service's PATH and Python environment: Subiquity
# provides curtin from its snap, including the bundled interpreter/libraries.
# Installed-target scripts use their own fixed system PATH after in-target.
payload=${1:-/cdrom/shutteros-payload}
target=${2:-/target}
destination="$target/opt/shutteros-provisioning"
[[ $(id -u) == 0 && -d "$target/etc" ]] || { echo 'Run in the installer with a mounted target.' >&2; exit 1; }
[[ ! -e "$destination" && ! -L "$destination" ]] || { echo 'Provisioning destination already exists.' >&2; exit 1; }
install -d -m 0700 "$target/var/log/shutteros-provisioning"
exec > >(tee -a "$target/var/log/shutteros-provisioning/installer.log") 2>&1
finish() {
  local status=$?
  if (( status != 0 )); then
    echo 'Offline preparation failed; inspect /var/log/shutteros-provisioning/installer.log.'
  fi
  exit "$status"
}
trap finish EXIT
python3 -B "$payload/kit/autoinstall/payload.py" verify "$payload"
install -d -m 0755 "$destination"
cp -a --no-preserve=ownership "$payload/." "$destination/"
chown -R root:root "$destination"
chmod -R u=rwX,go=rX "$destination"
python3 -B "$destination/kit/autoinstall/payload.py" verify "$destination"
curtin in-target --target="$target" -- /bin/sh /opt/shutteros-provisioning/kit/autoinstall/install-packages.sh
install -m 0644 "$destination/kit/autoinstall/shutteros-firstboot.service" "$target/etc/systemd/system/shutteros-firstboot.service"
# Keep a recovery console available even after the kiosk takes tty1.
systemctl --root="$target" enable shutteros-firstboot.service getty@tty2.service ssh.service
echo 'Offline packages prepared. Signed snaps and kiosk setup run on the installed system at first boot.'
