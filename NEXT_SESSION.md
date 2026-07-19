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

## Current baseline — 2026-07-19

- `technical-imp.md` is the approved architecture blueprint.
- The repository has no implementation scaffold yet.
- `AGENTS.md` defines path ownership, PR workflow, and the contract seam.
- Next owner action: Mrigesh creates the canonical contract and fixture
  scaffold; the reel lane then consumes those fixtures for player work.

## Handoff template

### Date — owner — branch/PR

- **Completed:**
- **Files changed:**
- **Contract version / impact:**
- **Validation:**
- **Visual evidence:**
- **Blocker:**
- **Next action / owner:**
