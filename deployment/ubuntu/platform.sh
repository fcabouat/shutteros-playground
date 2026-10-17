#!/bin/sh
# Shared fixed paths for the Ubuntu 26.04 Chromium Snap installation.
# shellcheck disable=SC2034
kiosk_platform() {
  [ "$1" = ubuntu ] || { printf '%s\n' 'supported distribution: Ubuntu' >&2; return 1; }
  CHROMIUM_COMMAND=/snap/bin/chromium
  POLICY_ROOT=/etc/chromium-browser/policies/managed
  PROFILE_RELATIVE=snap/chromium/common/shutteros-kiosk
}

kiosk_supported_release() {
  [ "$1:$2" = ubuntu:26.04 ] || {
    printf '%s\n' 'supported release: Ubuntu 26.04 LTS' >&2
    return 1
  }
}
