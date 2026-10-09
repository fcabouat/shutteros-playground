#!/bin/sh
# shellcheck disable=SC2034
# Variables are consumed by the installer, verifier and browser launcher.
# Shared, fixed distribution paths. No environment-controlled executable or policy path.
kiosk_platform() {
  case "$1" in
    ubuntu)
      CHROMIUM_COMMAND=/snap/bin/chromium
      POLICY_ROOT=/etc/chromium-browser/policies/managed
      PROFILE_RELATIVE=snap/chromium/common/shutteros-kiosk
      CHROMIUM_SNAP=true
      ;;
    debian)
      CHROMIUM_COMMAND=/usr/bin/chromium
      POLICY_ROOT=/etc/chromium/policies/managed
      PROFILE_RELATIVE=.config/shutteros-kiosk
      CHROMIUM_SNAP=false
      ;;
    *) printf '%s\n' 'unsupported kiosk distribution' >&2; return 1 ;;
  esac
}

kiosk_supported_release() {
  case "$1:$2" in
    ubuntu:24.04|ubuntu:26.04|debian:13) return 0 ;;
    *) printf '%s\n' 'supported releases: Debian 13, Ubuntu 24.04 LTS and Ubuntu 26.04 LTS' >&2; return 1 ;;
  esac
}
