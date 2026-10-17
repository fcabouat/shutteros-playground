#!/bin/sh
# Source from the installer. Publish complete root-owned files on the same filesystem.
kiosk_install_file() (
  set -eu
  source_file=$1
  target_file=$2
  file_mode=$3
  if [ ! -f "$source_file" ] || [ -L "$source_file" ] || [ ! -s "$source_file" ]; then
    printf 'error: missing or empty source file: %s\n' "$source_file" >&2
    exit 1
  fi
  if [ -L "$target_file" ] || { [ -e "$target_file" ] && [ ! -f "$target_file" ]; }; then
    printf 'error: unsafe destination file: %s\n' "$target_file" >&2
    exit 1
  fi
  target_directory=$(dirname -- "$target_file")
  temporary=$(mktemp "$target_directory/.shutteros-file.XXXXXX")
  trap 'rm -f -- "$temporary"' EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM
  install -o root -g root -m "$file_mode" "$source_file" "$temporary"
  cmp -s "$source_file" "$temporary"
  # A successful read can come from cache. Persist data before publishing the
  # name, then persist the rename; never truncate the previous destination.
  sync "$temporary"
  mv -fT -- "$temporary" "$target_file"
  sync "$target_directory"
)
