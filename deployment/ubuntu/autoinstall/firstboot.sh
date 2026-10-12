#!/bin/bash
# Needs the booted system's snapd, PAM and logind; never install snaps in a chroot.
set -Eeuo pipefail
# Snap launchers are managed by root/snapd; keep system commands first.
PATH=/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin
export PATH
readonly payload=/opt/shutteros-provisioning
readonly state=/var/lib/shutteros-provisioning
[[ $(id -u) == 0 ]] || { echo 'First-boot provisioning requires root.' >&2; exit 1; }
install -d -m 0700 /var/log/shutteros-provisioning "$state"
exec > >(tee -a /var/log/shutteros-provisioning/firstboot.log) 2>&1
finish() {
  local status=$?
  if (( status != 0 )); then
    echo 'Provisioning failed; use Ctrl+Alt+F2 or administrator SSH.'
    echo 'Logs: /var/log/shutteros-provisioning/firstboot.log'
    echo 'Retry with: sudo systemctl restart shutteros-firstboot.service'
  fi
  exit "$status"
}
trap finish EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
python3 -B "$payload/kit/autoinstall/payload.py" verify "$payload"
# Waiting in ExecStartPre or ordering this unit after cloud-final would block
# multi-user.target, which cloud-final itself needs. Type=exec lets boot proceed;
# disabled cloud-init exits normally, while cloud-init errors remain visible.
echo 'Waiting for cloud-init to finish before provisioning the installed system.'
cloud-init status --wait
python3 -B "$payload/kit/autoinstall/payload.py" hostname "$payload"
# Existing installer-generated host keys are preserved; missing keys are generated locally.
ssh-keygen -A
systemctl enable --now ssh.service
python3 -B "$payload/kit/autoinstall/payload.py" install-snaps "$payload"
/bin/sh "$payload/kit/install.sh" --site-dir "$payload/site" </dev/null
/bin/sh "$payload/kit/verify.sh"
python3 -B "$payload/kit/autoinstall/payload.py" restore-store "$payload"
date --utc --iso-8601=seconds > "$state/success"
systemctl disable shutteros-firstboot.service
echo 'ShutterOS offline provisioning succeeded. Complete the documented hardware acceptance checks.'
