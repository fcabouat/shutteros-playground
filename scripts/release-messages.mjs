// PR titles and merge subjects share these templates so GitHub's default
// merge-message settings cannot change the automated release history.
export function releaseMessages(version, kind = 'release') {
  const prefix = `chore(${kind})`;
  return {
    prepare: `${prefix}: prepare v${version}`,
    main: `${prefix}: merge v${version} into main`,
    develop: `${prefix}: merge v${version} into develop`,
  };
}
