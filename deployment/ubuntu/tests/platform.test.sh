#!/bin/sh
# Selection is deterministic and never accepts an unqualified future release or derivative.
set -eu
repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../../.." && pwd)
# shellcheck source=deployment/ubuntu/platform.sh
. "$repo_root/deployment/ubuntu/platform.sh"
for release in 24.04 26.04; do kiosk_supported_release ubuntu "$release"; done
kiosk_supported_release debian 13
for pair in ubuntu:22.04 ubuntu:25.10 ubuntu:28.04 debian:12 debian:14 linuxmint:22; do
  if kiosk_supported_release "${pair%:*}" "${pair#*:}" 2>/dev/null; then
    printf 'unexpected release accepted: %s\n' "$pair" >&2; exit 1
  fi
done
kiosk_platform ubuntu
[ "$CHROMIUM_COMMAND" = /snap/bin/chromium ]
[ "$POLICY_ROOT" = /etc/chromium-browser/policies/managed ]
[ "$PROFILE_RELATIVE" = snap/chromium/common/shutteros-kiosk ]
[ "$CHROMIUM_SNAP" = true ]
kiosk_platform debian
[ "$CHROMIUM_COMMAND" = /usr/bin/chromium ]
[ "$POLICY_ROOT" = /etc/chromium/policies/managed ]
[ "$PROFILE_RELATIVE" = .config/shutteros-kiosk ]
[ "$CHROMIUM_SNAP" = false ]
if kiosk_platform unknown 2>/dev/null; then exit 1; fi
printf '%s\n' 'platform selection tests passed'
