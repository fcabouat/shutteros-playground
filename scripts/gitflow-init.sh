#!/bin/sh
# One-time local setup for git-flow (AVH edition): branch names, the "v" tag prefix,
# repository-tracked hooks, and explicit local release/hotfix publication.
# Run it from any clone: sh scripts/gitflow-init.sh
set -eu
command -v git-flow >/dev/null 2>&1 || git flow version >/dev/null 2>&1 || {
  echo 'git-flow (AVH edition) is required: pacman -S gitflow-avh, apt install git-flow, brew install git-flow-avh' >&2
  exit 1
}
root=$(git rev-parse --show-toplevel)
cd "$root"
# AVH 1.12.3 interpolates this option into an invalid shell variable (FLAGS_ff-master).
# Its built-in default is already false. Remove our old local setting, but never
# rewrite a user's global/system configuration on their behalf.
if git config --show-scope --get-all gitflow.release.finish.ff-master |
  awk '$1 != "local" { found = 1 } END { exit !found }'; then
  echo 'remove inherited gitflow.release.finish.ff-master (AVH 1.12.3 cannot read this option); inspect: git config --show-origin --get-all gitflow.release.finish.ff-master' >&2
  exit 1
fi
# Refuse all hook conflicts before changing branches or local Gitflow configuration.
git_dir=$(git rev-parse --absolute-git-dir)
hooks_dir="$git_dir/hooks"
for hook in .gitflow/hooks/*; do
  name=$(basename "$hook")
  destination="$hooks_dir/$name"
  target=$(node -e \
    "const { relative, resolve } = require('node:path'); console.log(relative(process.argv[1], resolve(process.argv[2])))" \
    "$hooks_dir" "$hook")
  if [ -e "$destination" ] || [ -L "$destination" ]; then
    if [ ! -L "$destination" ] || [ "$(readlink "$destination")" != "$target" ]; then
      echo "refusing to replace existing hook: $destination" >&2
      exit 1
    fi
  fi
done
# git-flow 1.12.3 suggests "master" by default; name both branches explicitly and make
# sure a local main exists (a fresh clone of develop only tracks origin/main).
git rev-parse -q --verify main >/dev/null || git branch --track main origin/main
git config gitflow.branch.master main
git config gitflow.branch.develop develop
git flow init -d -f -t v >/dev/null
# git-flow reads hooks from the git directory. Link the tracked hooks there with
# relative links: an absolute gitflow.path.hooks silently stops applying once the
# clone is moved or renamed, and git-flow then passes versions through unchanged.
git config --unset gitflow.path.hooks 2>/dev/null || true
mkdir -p "$hooks_dir"
for hook in .gitflow/hooks/*; do
  name=$(basename "$hook")
  destination="$hooks_dir/$name"
  if [ ! -L "$destination" ]; then
    target=$(node -e \
      "const { relative, resolve } = require('node:path'); console.log(relative(process.argv[1], resolve(process.argv[2])))" \
      "$hooks_dir" "$hook")
    ln -s "$target" "$destination"
  fi
done
[ -x "$hooks_dir/filter-flow-release-start-version" ] || {
  echo 'the git-flow hooks are not executable from the git directory' >&2
  exit 1
}
# Features always merge with a merge commit, as in nvie's model.
git config gitflow.feature.finish.no-ff true
# Override inherited AVH preferences that would omit a tag, flatten a merge or
# publish only some references. Finish must produce the graph that CI validates;
# publication remains the explicit atomic push printed by the finish hook.
for kind in release hotfix; do
  for option in push squash notag; do
    git config "gitflow.$kind.finish.$option" false
  done
  git config "gitflow.$kind.finish.nobackmerge" true
done
git config --local --unset-all gitflow.release.finish.ff-master 2>/dev/null || true
for option in nodevelopmerge pushproduction pushdevelop pushtag; do
  git config "gitflow.release.finish.$option" false
done
# Annotated tag messages come from the finish-tag-message hooks; a default avoids an editor prompt.
git config gitflow.release.finish.message 'ShutterOS Playground'
git config gitflow.hotfix.finish.message 'ShutterOS Playground'
chmod +x .gitflow/hooks/*
echo "git-flow configured: main/develop, feature/ bugfix/ release/ hotfix/ support/, tags v*, hooks linked from .gitflow/hooks"
