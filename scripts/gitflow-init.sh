#!/bin/sh
# One-time local setup for git-flow (AVH edition): branch names, the "v" tag prefix,
# the repository-tracked hooks and automatic pushes after release/hotfix finish.
# Run it from any clone: sh scripts/gitflow-init.sh
set -eu
command -v git-flow >/dev/null 2>&1 || git flow version >/dev/null 2>&1 || {
  echo 'git-flow (AVH edition) is required: pacman -S gitflow-avh, apt install git-flow, brew install git-flow-avh' >&2
  exit 1
}
root=$(git rev-parse --show-toplevel)
cd "$root"
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
git_dir=$(git rev-parse --git-dir)
mkdir -p "$git_dir/hooks"
for hook in .gitflow/hooks/*; do
  name=$(basename "$hook")
  ln -sfn "$(realpath --relative-to="$git_dir/hooks" "$hook")" "$git_dir/hooks/$name"
done
[ -x "$git_dir/hooks/filter-flow-release-start-version" ] || {
  echo 'the git-flow hooks are not executable from the git directory' >&2
  exit 1
}
# Features always merge with a merge commit, as in nvie's model.
git config gitflow.feature.finish.no-ff true
# Publishing stays an explicit, atomic push printed by the finish hook.
git config gitflow.release.finish.push false
git config gitflow.hotfix.finish.push false
# Merge the release or hotfix branch itself back into develop (nvie-style), not main.
git config gitflow.release.finish.nobackmerge true
git config gitflow.hotfix.finish.nobackmerge true
# Annotated tag messages come from the finish-tag-message hooks; a default avoids an editor prompt.
git config gitflow.release.finish.message 'ShutterOS Playground'
git config gitflow.hotfix.finish.message 'ShutterOS Playground'
chmod +x .gitflow/hooks/*
echo "git-flow configured: main/develop, feature/ bugfix/ release/ hotfix/ support/, tags v*, hooks linked from .gitflow/hooks"
