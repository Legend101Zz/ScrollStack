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

## Current baseline — 2026-07-20 — Mrigesh — `codex/mrigesh-core-vertical-slice`

- **Worktree:** `/Volumes/Mrigesh SSD/ScrollStack-manga`
- **Completed:**
  - Added bounded, hash-idempotent PDF upload and PyMuPDF page-text ingestion.
    Raw PDFs are stored outside the web root, filenames cannot select paths,
    encrypted/malformed/empty/oversized PDFs fail explicitly, and every parsed
    page becomes an immutable, provenance-rich `SourceUnitDoc`.
  - Added Mongo-backed `BookDoc`, book/source-unit/page APIs, manga-project
    creation, and an immutable version-zero project-memory snapshot.
  - Added accepted-artifact verification to memory merges plus grounded
    terminology updates. A two-process Mongo proof now rebuilds scope 11-20
    with scope 1-10's accepted ending, character state, terminology, grounded
    fact, coverage, and unresolved thread without a shared chat.
  - Added canonical `MangaPlan` v1 Python/JSON Schema/TypeScript contracts,
    generated artifacts, Ajv registration, and a cross-language fixture.
  - Added authenticated, project/run/stage/ContextPack-scoped Manga Director
    tools for bounded source reads, canon reads, asset metadata, conflict
    reports, and schema-valid plan submission. `submit_manga_plan` persists a
    validated candidate before acknowledging it and rejects cross-project or
    inactive-stage calls.
  - Replaced the planning-only Celery response with durable context-compilation
    and Manga Director stage execution. Accepted plans retain candidate lineage,
    source receipts, agent trace, and `ModelReceipt`. The run then ends with
    typed `MANGA_PIPELINE_NOT_CONNECTED` failure instead of falsely claiming a
    completed manga before composition and `RenderedPage` assembly exist.
  - Fixed Mongo UTC round trips by enabling timezone-aware PyMongo decoding and
    allowed bounded worker retries after failed runs without replaying a
    succeeded paid run.
- **Owned files changed:**
  - `backend/app/` persistence, services, API, worker, and contracts;
  - `backend/tests/`, `backend/scripts/verify_mongo_continuity.py`, dependency
    metadata and lockfile;
  - `apps/agent-worker/` run retry behavior and tests;
  - `packages/contracts/` generated contract seam and validators;
  - `packages/fixtures/` canonical MangaPlan fixture;
  - this handoff and `docs/evidence/mrigesh-core-vertical-slice-2026-07-20.md`.
- **Contract version / impact:** additive only. Added `manga-plan.v1`; added the
  optional `terminology_updates` field to `memory-delta.v1`. Existing v1
  fixtures remain valid; no breaking reader or reel contract change.
- **Validation:**
  - Backend: 40 pytest tests passed; Ruff passed; strict mypy passed across 43
    source files; deterministic export reports 18 current schemas.
  - Shared contracts: 22 Vitest cases passed; generated JSON Schema and
    TypeScript artifacts are current.
  - Agent runtime/worker: 4 runtime and 7 worker Vitest cases passed; both
    typechecks passed.
  - Root `pnpm check` passed, including frontend typecheck.
  - `docker compose --env-file .env.example config --quiet`, `zsh -n start.sh`,
    `zsh -n stop.sh`, and `git diff --check` passed.
  - Fresh-process Mongo proof passed. Rebuilt ContextPack:
    `context_e6f2435ea729e185d5663b23`; hash:
    `d904c371350d6f06f61866e5c54e9e7a4661768de034dd5c8cd0c61ffc7e4bd4`.
- **Visual evidence:** none required for this backend/control-plane slice. No
  entertainment UI or reel-owned path changed.
- **Current blockers / honest gaps:**
  - A live Manga Director provider call was not run: `OPENAI_API_KEY` and
    `AGENT_MODEL` are unset and no local `.env` was present. Unit/integration
    tests use a broker-calling fake worker; paid-provider acceptance is still
    required.
  - `docker compose build` produced no output for 30 seconds because the Docker
    daemon remained unresponsive; it was interrupted. Static Compose validation
    passed, and the Mongo continuity proof used a temporary local `mongod` 8.2.3
    process that was shut down cleanly.
  - Manga composition, deterministic validators, accepted `RenderedPage`,
    `MangaManifest`, and post-manga `MemoryDelta` derivation remain unconnected.
    The workflow exposes this as a terminal typed gap, not success.
  - Public user identity is still hackathon single-user input. Production OIDC
    ownership enforcement and upload parser process/container isolation remain.
- **Next action / owner:**
  1. Mrigesh/operator configures an approved `AGENT_MODEL` and provider key,
     starts Mongo, Redis, backend, Celery, and the agent profile, then retains
     one real broker-validated MangaPlan plus trace/receipt evidence.
  2. Mrigesh ports the smallest existing Python manga composition/validation
     path behind the accepted plan and emits `RenderedPage`; only then replace
     `MANGA_PIPELINE_NOT_CONNECTED` and merge the accepted continuity delta.
  3. After that backend slice repeats, wire the typed frontend golden path and
     capture the required desktop/mobile/RTL/vertical/error evidence.

## Previous baseline — 2026-07-19 — Mrigesh — `codex/manga-context-control-plane`

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
