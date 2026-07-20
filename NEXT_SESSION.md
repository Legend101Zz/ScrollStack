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

## Current baseline — 2026-07-21 — Mrigesh — `codex/mrigesh-core-vertical-slice`

- **Worktree:** `/Volumes/Mrigesh SSD/ScrollStack-manga`
- **Completed:**
  - Wired the existing upload, scope, generation, and reader UI to the live
    backend. Production book/project IDs never fall back to the canonical sample.
  - Added metadata-only source-unit reads, bounded page previews, real parsing
    and generation polling, typed failure states, and automatic reader routing
    only after a succeeded run.
  - Sealed the Pi Manga Director to the pinned `minimax/MiniMax-M3` registry
    entry, repository-owned skill, approved five-tool list, exact repair limit,
    explicit cost/step limits, and `ALLOW_LLM_CODEGEN=false`.
  - Added OpenRouter image generation through
    `google/gemini-2.5-flash-image`, immutable hashed media storage, image
    receipts, deterministic plan-to-page composition, strict RenderedPage
    validation, accepted reader payloads, and accepted-output-only memory merge.
  - Completed one real paid Docker-backed run from the required PDF for pages
    13-15. `run_4064f0e265f9d80d6a307806` succeeded with 10 accepted
    `rendered-page.v1` artifacts and two real PNG key-panel assets.
  - MiniMax receipt: 20,204 input tokens, 14,431 output tokens, $0.02365302,
    89,067 ms, attempt 1. Image receipts total $0.0775215 across two assets.
  - Persisted ProjectMemory v1, then restarted processes and compiled a second,
    non-overlapping pages 17-19 ContextPack from memory v1. The second run was
    intentionally stopped at `AGENT_WORKER_FAILED` with the agent unavailable,
    proving continuity rebuild without a second paid call.
  - Explicit backend/Celery restart preserved a byte-identical reader payload
    (`60983d7621c97f8e56c12c69c5509e8ad9d80da9f56e38750c3dd8b6d1c01bd4`).
- **Owned files changed:**
  - `backend/`, `apps/agent-worker/`, `packages/agent-runtime/`, frontend
    non-reel routes/components/API/state, Compose/start configuration, this
    handoff, and `docs/evidence/mrigesh-core-golden-path-2026-07-21.md`.
  - No reel-owned path changed.
- **Contract version / impact:** additive v1 behavior only. The public reader
  envelope is `manga-reader.v1`; accepted pages remain `rendered-page.v1`.
  Existing shared schemas remain at 18 and no reel contract was forked.
- **Validation:**
  - Backend: 48 pytest tests; Ruff; strict mypy across 46 source files; 18-schema
    export check.
  - Contracts: 22 tests. Agent runtime: 8 tests. Agent worker: 12 tests. Root
    TypeScript/frontend checks and Docker image builds passed.
  - Mongo, Redis, backend, Celery, agent worker, and frontend ran together;
    backend and agent worker readiness returned HTTP 200 inside the network.
  - Real reader endpoint and server-rendered frontend reader route return HTTP
    200 after restart; the frontend HTML contains the real title and asset URLs
    and contains no fixture title.
- **Visual evidence:** the two generated PNG assets were visually inspected and
  are grounded in pages 13-15. Browser screenshots are still missing for the
  reason below; raw image inspection is not being misreported as UI acceptance.
- **Current blockers / honest gaps:**
  - Final browser acceptance is not complete. The in-app Browser reported no
    available browser, Computer Use failed with `Sky Computer Use native pipe
    startup failed`, and the enabled Chrome extension/native-host path still
    returned `Browser is not available: extension` after its approved retry.
    Therefore the exact PDF has not yet been uploaded through the visible UI,
    and desktop/mobile screenshots, live RTL/vertical interaction, refresh in a
    controlled browser, and console inspection remain unaccepted.
  - Docker Desktop stopped unexpectedly several times during acceptance. Named
    volumes survived every restart, all images built, all services recovered,
    and the reader payload remained byte-identical; this is now a stability
    observation, not the former unverified-build blocker.
  - Public user identity is still hackathon single-user input. Production OIDC
    ownership enforcement and upload parser process/container isolation remain.
- **Next action / owner:**
  1. Repair/reinstall the ChatGPT browser-control plugin outside this repo, then
     run the visible `/books/new` upload flow with the required PDF. Do not start
     another paid run unless its scope/input identity is intentionally new.
  2. Capture desktop/mobile reader screenshots, exercise RTL and vertical modes,
     refresh, and inspect browser console/server logs. Use the already persisted
     reader URL when validating the accepted run.
  3. Keep the ignored `.env` secret values local. Never commit or print them.

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
