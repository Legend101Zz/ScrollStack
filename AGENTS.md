# ScrollStack collaboration guide

Read `technical-imp.md` before making architecture or ownership decisions. It
is the project blueprint; this file defines how two contributors work from it
without overwriting each other.

## Ownership

### Mrigesh — core, manga, and visual system

Mrigesh owns the control plane, canonical contracts, manga workflow, and shared
visual language. This includes:

- `backend/`, including Pydantic models, API, persistence, context, artifacts,
  ingestion, and manga pipeline work;
- `packages/contracts/` schema sources and generated contract artifacts;
- `packages/fixtures/` canonical cross-language fixtures;
- `apps/agent-worker/` and `packages/agent-runtime/`, including the pinned Pi
  adapter, production skills, internal worker API, and domain tool broker;
- `packages/design-tokens/`, including the framework-neutral tokens consumed by
  both the frontend and the reel lane;
- global theme and layout files, including Tailwind configuration and global
  CSS;
- root workspace/package configuration and `docker-compose.yml`.

### Utkarsh — Remotion and reel UX

Utkarsh owns the deterministic reel renderer and the isolated
reel user experience. This includes:

- `reel-renderer/`;
- `packages/reel-components/`;
- `frontend/app/**/reels/`;
- `frontend/components/ReelFeed/`;
- reel-specific tests and visual evidence.

The reel player must consume the shared design tokens and generated contract
types. Do not change the global theme or create local `any`-based copies of
`ReelSpec`, `MangaManifest`, or other shared models.

## Shared integration seam

`packages/contracts/` and the Pydantic schema exports are the only
cross-language data seam.

- Mrigesh owns canonical Pydantic model changes and commits regenerated JSON
  Schema and TypeScript artifacts with the source change.
- Generated files are never hand-edited.
- Utkarsh requests missing data through an issue or PR comment
  that states the field, consumer, and a fixture example.
- Both contributors must review a breaking contract change before it merges.
- Root package files, `pnpm-workspace.yaml`, Docker Compose, shared generated
  contracts, global styling, and common layouts require explicit agreement
  before editing.

## Git and worktree workflow

- `main` is the protected release branch. Do not develop or integrate directly
  on it.
- `dev` is the shared integration branch. Merge reviewed feature branches into
  `dev`, then promote `dev` to `main` through one final PR when both owners are
  ready.
- Use one worktree per lane:
  - Mrigesh: `codex/manga-context-control-plane` in `../ScrollStack-manga`.
  - Reel player: `codex/pi-reel-player` in `../ScrollStack-reel`.
- Keep uncommitted work inside your own worktree. Rebase on current `main`
  only when preparing the final `dev` to `main` promotion. Feature branches
  should start from and rebase on current `dev` before opening their PRs.
- Merge feature work into `dev` through focused PRs only. Resolve conflicts in
  files you own; ask Mrigesh to coordinate conflicts in shared paths.
- Do not bundle refactors from the other lane into your PR.

## Integration order

1. Canonical contract/model change and version decision.
2. Generated schema/types and canonical fixtures.
3. Consumer implementation.
4. Contract tests in Python and TypeScript.
5. End-to-end integration and visual proof.

The reel player may use committed fixtures while the backend is incomplete; it
must switch to the API boundary only after the matching contract is available.

## PR and handoff requirements

Every PR description and meaningful `NEXT_SESSION.md` update must include:

- owned files changed;
- contract version and compatibility impact, or `none`;
- commands/tests run and their results;
- screenshot, still frame, or render evidence for visual/reel changes;
- current blocker, if any;
- the next integration action and its owner.

Before handoff, run the checks relevant to the changed lane plus `git diff
--check`. Do not report a feature complete if its contract fixture or visual
evidence is missing.

## Agent behavior

Agents must respect the same ownership rules. Before editing, inspect `git
status`, read this file, and state the owned paths they will touch. If a task
crosses an ownership boundary, split it into a contract PR followed by a
consumer PR instead of editing both lanes opportunistically.
