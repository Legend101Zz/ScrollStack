# Collaboration handoff

## Working agreement

- **Integration branch:** `dev` (PR-only)
- **Release promotion:** `dev` -> `main` (final reviewed PR)
- **Core/manga/theme owner:** Mrigesh
- **Reel renderer/player owner:** Utkarsh
- **Canonical seam owner:** Mrigesh (`packages/contracts/` and Pydantic exports)
- **Architecture source:** `technical-imp.md`

## Worktrees

| Lane | Branch | Worktree |
| --- | --- | --- |
| Core, manga, contracts, theme | `codex/manga-context-control-plane` | `../ScrollStack-manga` |
| Reel renderer and player | `codex/pi-reel-player` | `../ScrollStack-reel` |

Create or refresh feature worktrees from `dev` before starting lane work. Do not
share uncommitted files between them.

## Reel API consumer — 2026-07-20 — Utkarsh — `codex/reel-api-consumer`

- **Completed:** Replaced the live fixture path with generated-contract-validated
  reel discovery, player-payload, and per-series progress clients. Browser calls
  now stay same-origin through reel-owned Next route handlers. The feed restores
  the newest valid position, fetches and deduplicates only the current reel plus
  the likely horizontal and vertical destinations, preloads their media, and
  serializes full-replacement progress writes with optimistic viewed-ID unions
  and an explicit retry state. Fixtures are available only through
  `?fixture=1` in development; API failures never silently select demo data.
- **Owned files changed:** `frontend/app/**/reels/`,
  `frontend/components/ReelFeed/`, and reel consumer tests under
  `packages/reel-components/src/`; this handoff is the only shared document
  changed.
- **Contract version / impact:** consumes `reel-series.v1`,
  `reel-player-payload.v1`, `series-progress.v1`, and
  `series-progress-update.v1` unchanged. Breaking impact: none.
- **Validation:** frontend lint, typecheck, and production build pass;
  reel-components typecheck passes; all 21 reel-component/consumer tests pass;
  `git diff --check` passes. Manual Chromium checks covered 390x844 and
  1440x1000 fixture playback plus the real-mode API failure/retry screen.
- **Visual evidence:** current captures were checked at
  `/tmp/scrollstack-reel-api-mobile.png`,
  `/tmp/scrollstack-reel-api-desktop.png`, and
  `/tmp/scrollstack-reel-api-error.png`; the committed visual baseline remains
  `docs/evidence/dev-reel-player-mobile-2026-07-20.png` and
  `docs/evidence/dev-reel-player-desktop-2026-07-20.png`.
- **Current blocker:** Mrigesh's manga workflow still does not emit accepted
  manifest/reel artifacts, so production discovery is honestly empty until
  that lane lands. Container deployments should set `INTERNAL_API_URL` to the
  backend service URL; changing shared Compose/env defaults remains a
  coordinated core-lane edit.
- **Next action / owner:** Utkarsh opens this focused PR into `dev`. Mrigesh
  reviews it, connects accepted artifacts, and supplies the container-internal
  API URL before the next `dev` promotion to `main`.

## Current dev integration baseline — 2026-07-20 — Utkarsh on behalf of both lanes

- **Completed:**
  - Created `dev` from `origin/main` without modifying `main`.
  - Merged Mrigesh's `codex/mrigesh-core-vertical-slice`, the additive
    `codex/reel-api-contract`, and Utkarsh's `codex/pi-reel-player` in dependency
    order. All merges were clean; `NEXT_SESSION.md` was the only overlapping
    path and its separate handoffs were retained.
  - Confirmed the combined branch exposes reel discovery/player/progress APIs
    alongside the fixture-backed Remotion player and renderer.
- **Files changed:** merge commits preserve each lane's owned files. This
  integration handoff updates `AGENTS.md`, `NEXT_SESSION.md`, and adds the two
  reel screenshots under `docs/evidence/`.
- **Contract version / impact:** additive only. The merged branch contains
  `manga-plan.v1`, `reel-series.v1`, `reel-player-payload.v1`,
  `series-progress.v1`, and `series-progress-update.v1`; existing v1 contracts
  remain compatible.
- **Validation:** backend 57 tests passed; Ruff and strict mypy passed; all 22
  schemas and generated TypeScript contracts are current; root `pnpm check`
  passed; frontend lint and production build passed; Docker Compose static
  config passed; and all 11 renderer tests passed, including the real Chromium
  still and H.264/AAC MP4 plus ffprobe checks. `git diff --check` passed.
- **Visual evidence:**
  - `docs/evidence/dev-reel-player-mobile-2026-07-20.png`
  - `docs/evidence/dev-reel-player-desktop-2026-07-20.png`
- **Current blockers / honest gaps:**
  - `frontend/components/ReelFeed/fixture-adapter.ts` still supplies the live
    player. The API DTO uses snake_case and requires a small consumer adapter
    before reload/resume progress can be proven end to end.
  - Mrigesh's workflow intentionally stops at `MANGA_PIPELINE_NOT_CONNECTED`;
    it does not yet emit accepted `MangaManifest` or `ReelSpec` artifacts for
    the new read API.
  - `storage://` media still needs a signing or delivery route; the API rejects
    those references rather than returning unusable browser URLs.
- **Next action / owner:**
  1. Utkarsh replaces the fixture adapter with the merged API and persists
     progress, retaining a fixture fallback only for isolated visual tests.
  2. Mrigesh connects accepted manga composition/manifest output and then reel
     generation so the API has production artifacts to serve.
  3. Mrigesh reviews the integration PR and promotes `dev` to `main` when the
     desired integration boundary is accepted.

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

## 2026-07-19 — Utkarsh — `codex/pi-reel-player`

- **Completed:**
  - Added a strict, deterministic `compileReel()` boundary and a reviewed
    seven-scene Remotion registry shared by browser preview and server render.
  - Added offline, content-addressed asset staging plus cancellable still/MP4
    rendering fixed to H.264/AAC, 1080x1920, 30fps, yuv420p, and 48kHz audio.
  - Added the fixture-backed reel route with one mounted Player, muted-first
    autoplay, accessible controls, axis-locked horizontal/vertical navigation,
    adjacent-only preloading, retry states, and full-screen mobile layout.
- **Files changed:** `packages/reel-components/`, `reel-renderer/`,
  `frontend/app/books/[id]/manga/[projectId]/reels/`,
  `frontend/components/ReelFeed/`, `frontend/package.json`, and the mechanical
  dependency update in `pnpm-lock.yaml`.
- **Contract version / impact:** consumes `manga-manifest.v1` and
  `reel-spec.v1` unchanged; breaking impact: none.
- **Validation:** `pnpm check` passes; reel-components has 12 passing tests;
  renderer unit tests have 9 passing tests and 2 explicitly gated real-render
  tests; the gated Chromium/FFmpeg run passes both the still and complete MP4
  cases with ffprobe codec, dimensions, frame rate, audio, and duration checks;
  frontend lint and production build pass; `git diff --check` passes.
- **Visual evidence:** mobile browser capture at
  `/tmp/scrollstack-reel-final.png`; the real-render smoke produced a
  representative 1080x1920 still and a complete 390-frame MP4 before its
  isolated temporary workspace was cleaned.
- **Blocker:** none for the fixture-backed vertical slice. Live data, progress
  persistence, signed media inputs, thumbnails, and persisted render receipts
  wait on control-plane endpoints/contracts.
- **Next action / owner:** Mrigesh provides the API payload and persistence
  seams without changing v1 artifacts; Utkarsh replaces `fixture-adapter.ts`,
  adds device-level gesture/Playwright coverage, and wires render receipts once
  those seams land.

## Handoff template

### Date — owner — branch/PR

- **Completed:**
- **Files changed:**
- **Contract version / impact:**
- **Validation:**
- **Visual evidence:**
- **Blocker:**
- **Next action / owner:**
