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

## Build Week provenance

ScrollStack is a new repository created for OpenAI Build Week. The commit and
Codex session history distinguish work created during the event. Before
submission this section will include the primary `/feedback` session ID, the
golden demo source license, exact setup instructions, and the final validation
evidence.
