# Mrigesh core and visual system handoff

**Snapshot:** 2026-07-19  
**Repository:** `Legend101Zz/ScrollStack`  
**Branch:** `codex/manga-context-control-plane`  
**Worktree:** `/Volumes/Mrigesh SSD/Scrollhack/ScrollStack-manga`  
**Implementation baseline:** `82cf96c` (`docs: align ownership with reel-only lane`)  
**Architecture source of truth:** [`technical-imp.md`](technical-imp.md)

This document is the execution handoff for Mrigesh's lane. It records what was
built, what is still only a scaffold, and the order in which the next session
should continue. It does not assign work in Utkarsh's reel-owned paths.

## Ownership boundary

Mrigesh owns:

- `backend/`;
- `apps/agent-worker/` and `packages/agent-runtime/`;
- `packages/contracts/` and `packages/fixtures/`;
- `packages/design-tokens/`;
- manga and shared frontend surfaces;
- global styling, root workspace files, and Docker Compose.

Utkarsh owns:

- `reel-renderer/`;
- `packages/reel-components/`;
- `frontend/app/**/reels/`;
- `frontend/components/ReelFeed/`;
- reel-specific rendering, playback, gesture, and visual evidence.

Do not edit Utkarsh's paths from this branch. Cross-lane work must happen
through the generated v1 contracts, canonical fixtures, and shared design
tokens.

## What was completed

### 1. Repository and architecture foundation

- Created the pnpm, `uv`, Next.js, FastAPI, Celery, MongoDB, Redis, and Docker
  Compose workspace foundation.
- Added ADR-001 through ADR-008 for the provider, persistence, Pi runtime,
  security, contract, Remotion, generation, and worker-isolation decisions.
- Preserved the technical document's hard boundaries: Mongo is durable truth,
  Celery owns workflows, Pi receives bounded context, models emit typed
  artifacts, and renderers stay deterministic.
- Added contributor ownership and worktree rules in [`AGENTS.md`](AGENTS.md).

### 2. Canonical contracts and fixtures

- Added Pydantic v1 contracts for source, scope, context, run, artifact, manga,
  and reel boundaries.
- Added deterministic JSON Schema export and generated TypeScript types.
- Added Ajv validators and 17 canonical cross-language fixtures.
- Established `RenderedPage` as the reader payload, `MangaManifest` as the
  manga-to-reel handoff, and strict `ReelSpec` as the reel boundary.
- Added rejection coverage for unknown scene types, extra props, arbitrary
  paths, and unsafe URLs.

### 3. Durable context and control-plane foundation

- Added Beanie documents and indexes for source units, scopes, manga projects,
  memory snapshots, artifacts, generation runs, and stage runs.
- Added Mongo-backed and deterministic in-memory repository adapters.
- Added bounded context compilation, source selection, optimistic memory-delta
  merging, hashing, idempotent run creation, cancellation, and artifact
  listing.
- Added versioned scope and generation-run API surfaces.
- Added a Celery workflow authority and dispatcher shell.

### 4. Safe Pi worker foundation

- Pinned the Pi coding-agent dependency behind `packages/agent-runtime/`.
- Disabled all built-in shell, filesystem, search, and network tools.
- Added typed goal policies, per-goal tool allowlists, budgets, cancellation,
  trace collection, and sealed repository-owned skills.
- Added an authenticated Fastify worker with health, readiness, start, status,
  cancellation, concurrency, request-size, and timeout handling.
- Added the HTTP domain-tool broker client used by the worker to call the
  trusted FastAPI control plane.

### 5. Core visual system and manga-first UI

- Converted the selected Book-Reel design direction into the framework-neutral
  `@scrollstack/design-tokens` package.
- Added shared color, typography, spacing, radius, shadow, motion, and reel
  safe-zone values plus CSS and Tailwind consumers.
- Built the ScrollStack landing page, library, upload, scope-selection,
  generation, error, loading, manga RTL reader, and vertical-reader surfaces.
- Added reusable shell, button, form, async-state, generation, and manga-reader
  components.
- Added original Last Observatory hero and key-panel art with provenance and
  recorded hashes under `docs/assets/`.
- Kept the reader behind a projection adapter so the production boundary can
  remain `RenderedPage` when the live endpoint is connected.

### 6. Validation completed before this handoff

| Area | Result |
| --- | --- |
| Backend | 34 pytest tests passed; Ruff passed; strict mypy passed |
| Contracts | 21 Vitest cases passed; generated artifacts were current |
| Agent runtime and worker | 10 Vitest cases passed; both typechecks passed |
| Frontend | Typecheck, lint, production build, and six HTTP route smokes passed |
| Dependencies | Production audit reported no known vulnerabilities |
| Infrastructure | Compose config, shell syntax, and `git diff --check` passed |
| Browser evidence | Not completed; no browser backend was available |
| Docker image build | Not completed; the local Docker daemon stopped responding |

## What is still left

The current code is a strong foundation, not an end-to-end product. The
following gaps are deliberately listed without claiming completion.

### Phase 1 exit is not met: durable context is not connected to real manga

- The existing PDF upload/parser and manga pipeline have not been ported into
  this new repository.
- Parsed chapters are not yet normalized into persisted `SourceUnitDoc`
  records through a real upload flow.
- The Celery generation task currently returns a planned stage list; it does
  not execute the stages or mark a manga run successful.
- There is no golden proof that scope 11-20 reuses accepted continuity and
  source memory from scope 1-10 in a fresh session.

### Phase 2 exit is not met: Pi has not produced a live accepted artifact

- The FastAPI endpoints behind the domain-tool broker still need to be
  implemented with project, run, stage, and context authorization.
- Submission tools must validate and persist candidates before acknowledging
  acceptance.
- The backend/Celery process still needs to invoke the authenticated agent
  worker and record its trace and `ModelReceipt`.
- No configured provider call has yet returned and persisted a validated
  Manga Director plan.
- Capability and prompt-injection tests need to cover the complete
  backend-to-worker boundary, not only unit-level policy behavior.

### Phase 3 is not implemented: agentic manga production

- Manga Director output, asset requests, budget enforcement, asset reuse,
  Manga Composer output, geometry/bubble validation, `RenderedPage` assembly,
  and `MangaManifest` derivation are not connected as a live pipeline.
- A validated memory delta is not yet merged after manga acceptance.
- The new agentic lane has not been compared with the prior manga path using a
  legally usable golden PDF and reviewed fixtures.

### The visual system is demo-ready but not production-wired

- `frontend/lib/api.ts` intentionally returns deterministic reader fixtures;
  the upload, library, scope, progress, generation, and reader screens still
  need live API projections.
- Screenshot-level QA is missing for desktop, mobile, RTL reading, vertical
  reading, keyboard operation, reduced motion, overflow, empty states, and API
  failures.
- The original art proves the direction, but real accepted `RenderedPage`
  content and asset IDs must drive the reader before visual acceptance.
- Docker images and the complete Compose topology still need a successful
  build and live smoke test.

### Cross-lane integration remains

- Utkarsh must consume `@scrollstack/contracts`, the canonical
  `manga_manifest.v1.json` and `reel_spec.v1.json` fixtures, and
  `@scrollstack/design-tokens` directly.
- Any missing reel data must be requested as a contract change with the field,
  consumer, and fixture example. Do not create local duplicate types.
- The two branches still need an integration pass, focused PRs, visual/render
  evidence, and the complete golden flow before submission.

## Recommended next-session order

Follow this order. Do not spend the next session adding more decorative UI or
starting reel work.

### 1. Re-establish the branch safely

```bash
cd "/Volumes/Mrigesh SSD/Scrollhack/ScrollStack-manga"
git status -sb
git fetch origin
git log --oneline --decorate -5
git diff --name-status origin/main...HEAD
```

Read `AGENTS.md`, this file, `NEXT_SESSION.md`, and the Phase 1-3 sections of
`technical-imp.md`. Preserve unrelated work and do not rebase until immediately
before a PR.

### 2. Close the Phase 1 exit criterion first

1. Port only the required PDF ingestion and existing manga-pipeline pieces
   from `/Volumes/Mrigesh SSD/Book-Reel`; adapt them to ScrollStack's current
   contracts instead of importing the old architecture wholesale.
2. Persist normalized `SourceUnitDoc` records with stable source references and
   hashes.
3. Connect upload/book/source-unit/page endpoints needed by the existing
   product flow.
4. Replace the Celery planning response with real stage lifecycle updates while
   keeping Celery as the only workflow owner.
5. Run two scopes from one golden source and prove that the second compiled
   context contains the first scope's accepted ending, entities, terminology,
   and source-grounded memory.
6. Add the exact Phase 1 context and restart/idempotency tests from
   `technical-imp.md`.

**Phase 1 stop condition:** do not claim completion until a fresh process can
rebuild the second scope's context solely from Mongo-backed artifacts.

### 3. Close the smallest safe Phase 2 vertical slice

1. Implement authenticated FastAPI domain-tool endpoints for the Manga
   Director's approved read, submit, and conflict-report tools.
2. Enforce project ownership, run/stage identity, response-size limits, source
   provenance, schema validation, and artifact immutability at that boundary.
3. Make Celery compile a persisted `ContextPack`, create a typed `AgentGoal`,
   call the worker, and persist the candidate plus trace/receipt.
4. Configure one approved OpenAI provider/model through environment variables;
   never hardcode a key or enable Pi built-ins.
5. Execute one bounded Manga Director call and retain the validated artifact
   and test evidence.

**Phase 2 stop condition:** Pi must return a schema-valid Manga Director plan
from persisted context while shell, filesystem, arbitrary network, and unknown
tools remain unavailable.

### 4. Wire one honest frontend golden path

1. Replace fixture-only upload, scope, generation-progress, and manga-reader
   data with typed API projections while retaining fixtures for tests and
   offline visual development.
2. Keep `RenderedPage` as the only reader payload; do not expose internal run
   or agent terminology in the entertainment UI.
3. Capture desktop and mobile screenshots for landing, scope, generation, RTL
   reader, vertical reader, error, and empty states.
4. Verify focus order, keyboard controls, touch targets, reduced motion,
   overflow, and contrast.

### 5. Verify, document, and hand off

Run at minimum:

```bash
cd "/Volumes/Mrigesh SSD/Scrollhack/ScrollStack-manga/backend"
uv run pytest tests/ -q
uv run ruff check .
uv run mypy app tests

cd ..
corepack pnpm contracts:generate
git diff --exit-code -- packages/contracts/schema packages/contracts/src/generated
corepack pnpm check

docker compose --env-file .env.example config --quiet
docker compose --env-file .env.example build
zsh -n start.sh
zsh -n stop.sh
git diff --check
```

Then update `NEXT_SESSION.md` with files changed, contract impact, commands and
results, screenshot evidence, blockers, and the next owner/action. Commit and
push only Mrigesh-owned changes.

## Definition of done for the next session

The next session is successful if it produces one evidence-backed vertical
slice rather than more scaffolding:

```text
golden PDF
  -> persisted source units
  -> selected scope
  -> Mongo-rebuildable ContextPack
  -> bounded Manga Director call
  -> validated and persisted manga-plan artifact
  -> visible run progress or typed failure
```

Stretch work begins only after that slice is repeatable. The next stretch is
Manga Composer through accepted `RenderedPage`, not reel implementation.

## Copy-ready prompt for the next Codex session

```text
Continue Mrigesh's core and visual lane in ScrollStack.

Workspace:
/Volumes/Mrigesh SSD/Scrollhack/ScrollStack-manga

Branch:
codex/manga-context-control-plane

Read completely before editing:
1. AGENTS.md
2. MRIGESH_CORE_VISUAL_HANDOFF.md
3. NEXT_SESSION.md
4. technical-imp.md sections 19, 21, 22, and 23

Follow technical-imp.md exactly. Utkarsh owns reel-renderer/,
packages/reel-components/, frontend/app/**/reels/, and
frontend/components/ReelFeed/; do not edit those paths.

First inspect git status and current main without overwriting user changes.
Then close the Phase 1 exit criterion and implement the smallest safe Phase 2
vertical slice: real PDF/source-unit persistence, two-scope durable continuity,
Mongo-rebuildable ContextPack, authenticated domain tools, one bounded Manga
Director call, and a validated persisted manga-plan artifact. Keep Celery as
workflow owner, Mongo as durable truth, Pi built-ins disabled, and RenderedPage
as the reader boundary.

Do not claim completion from mocks, planned task output, static Compose config,
or fixture-only frontend screens. Run the relevant backend, contract, worker,
frontend, Compose, and diff checks; capture visual evidence when a browser is
available; update NEXT_SESSION.md; commit and push only this lane.
```
