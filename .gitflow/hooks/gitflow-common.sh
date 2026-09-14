#!/bin/sh
# Shared by the git-flow hooks. Sourced, not executed.
set -eu
repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

# Accept "patch", "minor", "major" or an explicit X.Y.Z (with or without a leading v)
# and print the resulting version, computed from the base branch of the new branch
# (develop for a release, main for a hotfix) rather than from whatever is checked out.
# An existing tag for that version stops the start.
resolve_version() {
  version=$(node scripts/version.mjs next "$1" --ref "$2") || exit 1
  if git rev-parse -q --verify "refs/tags/v$version" >/dev/null; then
    echo "tag v$version already exists" >&2
    exit 1
  fi
  echo "$version"
}

# git-flow passes the version with its tag prefix in some hooks; normalise it.
bare_version() {
  printf '%s\n' "$1" | sed 's/^v//'
}
