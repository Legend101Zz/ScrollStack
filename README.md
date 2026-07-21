# ScrollStack

ScrollStack turns a selected part of a book into a source-grounded manga, then
derives short vertical reels from the accepted manga. The product is designed
as entertainment-first media: readers see chapters, characters, continuity,
and cuts rather than internal generation terminology.

## Architecture

The implementation follows [`technical-imp.md`](technical-imp.md):

```text
PDF and selected source units
  -> versioned context pack
  -> typed manga direction and composition artifacts
  -> RenderedPage and MangaManifest
  -> ReelSpec
  -> deterministic manga and Remotion renderers
```

- MongoDB owns durable project, memory, run, and artifact truth.
- Celery owns the workflow and retry lifecycle.
- Pi runs bounded creative sessions behind one internal adapter.
- Pydantic models generate JSON Schema and TypeScript contracts.
- `RenderedPage` is the manga reader boundary.
- `MangaManifest` is the manga-to-reel handoff.
- `ReelSpec` drives both live playback and deterministic export.

Architecture decisions live in [`docs/adr/`](docs/adr/README.md).

## Repository lanes

- Mrigesh owns `backend/`, canonical contracts and fixtures, manga surfaces,
  global styling, root workspace configuration, and the shared visual system.
- Utkarsh owns `reel-renderer/`, `packages/reel-components/`, reel routes, and
  `frontend/components/ReelFeed/`.

See [`AGENTS.md`](AGENTS.md) before changing shared paths.

## Local development

Requirements:

- Node.js 22.19 or later
- pnpm 10.15.1 through Corepack
- Python 3.12 and `uv`
- Docker with Compose

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
corepack pnpm install
cp .env.example .env
./start.sh
```

The core services expose:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- MongoDB: `mongodb://localhost:27017`
- Redis: `redis://localhost:6379`

Agent and reel-render worker profiles are enabled separately after their owned
packages are available.

## Verification

```bash
cd backend && uv run pytest tests/ -q
cd ../frontend && corepack pnpm typecheck && corepack pnpm build
cd .. && corepack pnpm contracts:test
docker compose --env-file .env.example config --quiet
zsh -n start.sh
zsh -n stop.sh
git diff --check
```

## AI-assisted engineering provenance

ScrollStack was built with OpenAI Codex and GPT-5.6 used as engineering
assistants during planning, implementation, review, and documentation. Their
role was to accelerate repository setup, coordinate the two-contributor work
split, draft implementation plans, inspect diffs, and produce scoped code
changes under human direction.

The project keeps AI assistance separate from product runtime behavior:

- Codex helped maintain the collaboration guide in [`AGENTS.md`](AGENTS.md),
  plan ownership boundaries, and keep Mrigesh's core/manga lane separate from
  Utkarsh's reel-rendering lane.
- GPT-5.6-assisted coding was used for targeted implementation work such as
  contract-aware reel playback, deterministic Remotion rendering, progress
  integration, tests, and handoff notes.
- Runtime creative generation is intentionally constrained by typed artifacts.
  Models may propose manga or reel data, but the application accepts only
  schema-validated outputs such as `RenderedPage`, `MangaManifest`, and
  `ReelSpec`.
- Deterministic renderers, tests, and visual evidence are used to verify the
  accepted artifacts instead of trusting model output directly.

Human contributors remain responsible for product decisions, final code review,
accepted contracts, submitted PRs, and release readiness. Commit history, PR
descriptions, test output, and evidence files are the source of truth for what
was implemented and validated.

## Build Week notes

ScrollStack is a new repository created for OpenAI Build Week. Before
submission this section should include the primary feedback session ID, golden
demo source license, exact setup instructions, and final validation evidence.
