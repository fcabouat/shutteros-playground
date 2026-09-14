#!/bin/sh
# Create a GitHub release, or repair a partial one by uploading only missing assets.
set -eu

tag=${1:-}
shift || true
repository=${GH_REPO:-}
if [ -z "$tag" ] || [ "$#" -eq 0 ]; then
  echo 'usage: sh scripts/publish-release.sh <vX.Y.Z> <asset>...' >&2
  exit 2
fi
[ -n "$repository" ] || {
  echo 'GH_REPO is required' >&2
  exit 2
}
for asset in "$@"; do
  [ -f "$asset" ] || {
    echo "release asset does not exist: $asset" >&2
    exit 1
  }
done

if existing_assets=$(gh api "repos/$repository/releases/tags/$tag" --jq '.assets[].name' 2>&1); then
  echo "release $tag already exists; checking its assets"
else
  status=$(printf '%s\n' "$existing_assets" | sed -n 's/.*(HTTP \([0-9][0-9]*\)).*/\1/p' | tail -1)
  if [ "$status" != 404 ]; then
    printf '%s\n' "$existing_assets" >&2
    exit 1
  fi
  previous=$(git tag --merged "$tag^{}" --list 'v*' --sort=-v:refname | grep -vx "$tag" | head -1 || true)
  if [ -n "$previous" ]; then
    gh release create "$tag" --verify-tag --title "ShutterOS Playground $tag" \
      --generate-notes --notes-start-tag "$previous"
  else
    gh release create "$tag" --verify-tag --title "ShutterOS Playground $tag" --generate-notes
  fi
  existing_assets=''
fi

for asset in "$@"; do
  name=$(basename "$asset")
  if printf '%s\n' "$existing_assets" | grep -Fxq "$name"; then
    echo "$name is already attached"
  else
    gh release upload "$tag" "$asset"
  fi
done
