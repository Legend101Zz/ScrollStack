# Collaboration handoff

## Working agreement

- **Integration branch:** `main` (PR-only)
- **Core/manga/theme owner:** Mrigesh
- **Reel renderer/player owner:** Utkarsh
- **Canonical seam owner:** Mrigesh (`packages/contracts/` and Pydantic exports)
- **Architecture source:** `technical-imp.md`

## Worktrees

| Lane | Branch | Worktree |
| --- | --- | --- |
| Core, manga, contracts, theme | `codex/manga-context-control-plane` | `../ScrollStack-manga` |
| Reel renderer and player | `codex/pi-reel-player` | `../ScrollStack-reel` |

Create or refresh the worktrees from `main` before starting lane work. Do not
share uncommitted files between them.

## Current baseline — 2026-07-19 — Mrigesh — `codex/manga-context-control-plane`

- **Completed:**
  - Root pnpm/uv/Compose scaffold and ADR-001 through ADR-008.
  - Canonical Pydantic v1 contracts, deterministic JSON Schema export,
    generated TypeScript, Ajv validation, and 17 canonical fixtures.
  - Mongo/Beanie document and index definitions, bounded `ContextCompiler`,
    optimistic `MemoryDelta` merge, scope/run APIs, and Celery authority shell.
  - Pinned Pi adapter and authenticated Fastify worker with built-in tools
    disabled and repository-owned production skills.
  - Shared design tokens and manga-first Next.js routes for landing, library,
    upload, scope selection, generation, RTL reading, and vertical reading.
  - Rights-safe Last Observatory hero and key-panel art with recorded hashes.
- **Contract version / impact:** all shared artifacts are v1. `RenderedPage`
  remains the only persisted reader payload; `MangaManifest` is the reel handoff;
  `ReelSpec` is a strict discriminated registry contract. Breaking impact: none,
  because this repository had no prior implementation contract.
- **Validation:**
  - Backend: 34 pytest tests, Ruff, and strict mypy pass.
  - Shared contracts: 21 Vitest cases pass and generated files are current.
  - Agent runtime/worker: 10 Vitest cases and both typechecks pass.
  - Frontend: typecheck, lint, production build, and six HTTP route smokes pass.
  - Production dependency audit reports no known vulnerabilities.
  - Compose config, shell syntax, and `git diff --check` pass.
- **Visual evidence:** original art exists under `frontend/public/art/`; the
  production build and route smokes pass. Screenshot-level browser QA is still
  missing because the in-app browser service reported no available browsers.
- **Current blockers / honest gaps:**
  - A Docker image build could not be completed because the local Docker daemon
    stopped responding; static Compose validation passed.
  - The existing PDF parser and manga pipeline are not yet ported into this new
    repository. The Celery task plans the Phase 1 stages but does not claim a
    generated manga succeeded.
  - The Pi worker has not made a paid model call. FastAPI domain-tool broker
    endpoints and live provider configuration are the next control-plane seam.

## Reel-lane handoff — Utkarsh

- Consume `@scrollstack/contracts` from the pnpm workspace. Do not create local
  copies of `ReelSpec`, `MangaManifest`, or `RenderedPage`.
- Start from:
  - `packages/fixtures/canonical/manga_manifest.v1.json`
  - `packages/fixtures/canonical/reel_spec.v1.json`
  - `packages/contracts/src/validators.ts`
- Consume `@scrollstack/design-tokens`; its CSS variables, Tailwind preset,
  motion values, and reel safe zones are the shared visual language.
- Continue to own only `reel-renderer/`, `packages/reel-components/`,
  `frontend/app/**/reels/`, and `frontend/components/ReelFeed/`.
- First integration action: render every strict scene fixture through the
  reviewed Remotion registry, then mount the same validated spec in Player.

## Handoff template

### Date — owner — branch/PR

- **Completed:**
- **Files changed:**
- **Contract version / impact:**
- **Validation:**
- **Visual evidence:**
- **Blocker:**
- **Next action / owner:**
