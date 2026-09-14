# shutteros-playground

## 0.3.1

### Patch Changes

- 7003fee: Restore the local develop reference before Changesets planning in detached CI checkouts.
- 6946aa7: Start a release from develop with one command. GitHub handles Changesets versioning, verified release and return merges, tags and publication without an open terminal. Feature merges remain independent of release requests.
- Maintenance release.
- f48517e: Give release requests a dedicated GitHub workflow with only the version choice; keep recovery inputs in the technical workflow.
- @shutteros/core@0.3.1

## 0.3.0

### Minor Changes

- 71ebd39: Add a bilingual product site with a hosted demo, standalone download, translated player guide, generated core API reference and Storybook. Keep the kiosk distribution separate, and carry the selected site language into the demo.

### Patch Changes

- @shutteros/core@0.3.0

## 0.2.0

### Minor Changes

- e59c84f: Add a bilingual AI assistant scenario: choose a workspace, review the exercise usage policy and send a fictional prompt. Five variants let players compare routine work and confidential security notes, with or without names, plus a general template. The internal tool permits both versions of routine work; confidential notes are excluded from both tools. The commercial tool accepts anonymised routine work and a general template, also available internally. Explore confidentiality, anonymisation and organisational rules through direct actions in free and guided play, with a shared reminder after every outcome.

  Keep only the global session timer. Remove local decision deadlines and the calm-mode switch so players can explore and respond without time penalties. Older kiosk configuration files remain compatible.

  Allow completed situations to be replayed from the desktop, Start menu and taskbar. Practice shows a fresh consequence while preserving the first result in the recap and the original session deadline.

  Make the sender demonstration's next action reveal the address before acknowledgement, so guided completion never presents an inactive primary button. Permit Vite's reconnection worker only in development; the published content security policy remains unchanged.

### Patch Changes

- b8187b6: Make release preparation isolated and publication recovery explicit. Test partial GitHub failures, preserve immutable tags, and report deployment and release outcomes separately.
- @shutteros/core@0.2.0

## 0.1.2

### Patch Changes

- fa5455c: Make release preparation isolated and publication recovery explicit. Test partial GitHub failures, preserve immutable tags, and report deployment and release outcomes separately.
- @shutteros/core@0.1.2

## 0.1.1

### Patch Changes

- Automate release preparation with Changesets and Gitflow pull requests. Create the version tag and GitHub release after main passes verification, then propose synchronization back to develop.
- @shutteros/core@0.1.1
