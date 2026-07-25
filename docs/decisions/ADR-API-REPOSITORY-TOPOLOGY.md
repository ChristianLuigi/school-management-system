# ADR: API repository topology

- Status: Accepted
- Date: 2026-07-24
- Decision owner: repository owner

## Context

The parent repository recorded `apps/api` as a Git gitlink (mode `160000`) at API commit `70c78f5f60bf94f86ad47cb5f29f474a5e3e6bc4`, but had no `.gitmodules` file and no configured remote. `apps/api` also contained a nested `.git` directory with no configured remote. Root scripts, CI, Docker builds, migrations, and release documentation all treat the API and web applications as one release unit. Parent and API commits were routinely created in pairs with matching messages and timestamps.

This state could work only on the original workstation. A clean clone could not obtain the API source, so CI and deployment were not reproducible.

## Decision

`apps/api` is normal parent-repository content. The API and web applications share the parent repository version, release branch, CI workflow, and release commit.

The conversion procedure:

1. Created and verified a complete Git bundle containing every nested API ref.
2. Moved the original nested `apps/api/.git` directory into the ignored `.release-backups` recovery directory.
3. Removed only the `apps/api` gitlink from the parent index.
4. Added the existing API source tree to the parent repository with normal file modes.
5. Added CI checks that reject a future `160000` entry under `apps/api`.

The recovery artifacts are deliberately untracked and must never be pushed. They may be moved to encrypted operator storage after the release is safely published.

## Consequences

- A clean clone contains the complete buildable API.
- One commit identifies API, web, database, and deployment artifacts.
- CI no longer depends on an unavailable submodule remote.
- The old nested API commit graph is preserved in the verified local bundle but is not imported into the parent history.
- Future changes under `apps/api` must be committed only from the parent repository.

## Verification

The topology is valid when:

```bash
test -f apps/api/package.json
! git ls-files --stage apps/api | grep -q '^160000 '
pnpm --dir apps/api build
```

A clean-clone build and CI run on the release commit are required before this gate is closed.
