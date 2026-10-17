#!/bin/sh
# Selection is deterministic and never accepts an unqualified future release or derivative.
set -eu
repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../../.." && pwd)
# shellcheck source=deployment/ubuntu/platform.sh
. "$repo_root/deployment/ubuntu/platform.sh"
kiosk_supported_release ubuntu 26.04
for pair in ubuntu:22.04 ubuntu:24.04 ubuntu:25.10 ubuntu:28.04 debian:12 debian:13 debian:14 linuxmint:22; do
  if kiosk_supported_release "${pair%:*}" "${pair#*:}" 2>/dev/null; then
    printf 'unexpected release accepted: %s\n' "$pair" >&2; exit 1
  fi
done
kiosk_platform ubuntu
[ "$CHROMIUM_COMMAND" = /snap/bin/chromium ]
[ "$POLICY_ROOT" = /etc/chromium-browser/policies/managed ]
[ "$PROFILE_RELATIVE" = snap/chromium/common/shutteros-kiosk ]
for distro in debian linuxmint unknown; do
  if kiosk_platform "$distro" 2>/dev/null; then exit 1; fi
done
printf '%s\n' 'platform selection tests passed'
