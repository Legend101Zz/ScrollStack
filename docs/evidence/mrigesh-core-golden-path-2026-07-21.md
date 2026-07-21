# Mrigesh core manga golden-path evidence — 2026-07-21

## Verdict

The production backend/provider/asset/composition/memory/reader chain completed
successfully with the required PDF and survived fresh service processes. Final
visible-browser acceptance is **not complete** because all permitted UI-control
bridges were unavailable. Direct API and server-rendered route checks below are
not presented as substitutes for the missing UI upload and screenshots.

## Source PDF audit

- Path: `/Users/comreton/Downloads/hell-yeah-or-no-1nbsped_compress.pdf`
- Bytes: `1,315,691`
- SHA-256: `183ca8b5a2da9306fbe404090818e2fbeabba42cafb32cd619fc7ca7c3705a5b`
- Format: valid readable PDF 1.5, unencrypted
- Page count: 132
- Upload limit: 52,428,800 bytes (50 MiB); no limit change was required
- Paid source range: exact PDF pages 13-15, three contiguous text-bearing pages
- Second continuity range: exact PDF pages 17-19, non-overlapping
- No complete source text is reproduced in this evidence.

## Runtime configuration

- `AGENTIC_MANGA_PIPELINE_V1=true`
- `AGENT_PROVIDER=minimax`
- `AGENT_MODEL=MiniMax-M3`
- `AGENT_MODEL_API_KEY_ENV=MINIMAX_API_KEY`
- `IMAGE_MODEL=google/gemini-2.5-flash-image`
- `ALLOW_LLM_CODEGEN=false`
- MiniMax and OpenRouter keys were present in the ignored local `.env`; values
  were never printed, logged, committed, sent to the frontend, or placed in a
  URL.
- Agent-worker and domain-broker service secrets were present, at least 32
  characters, and distinct.
- Backend and agent-worker `/readyz` returned HTTP 200 from inside the Docker
  network before the paid run.

The exact MiniMax identifier came from the pinned Pi registry: provider
`minimax`, model `MiniMax-M3`, endpoint family `https://api.minimax.io/anthropic`.
No alternate model or provider was substituted.

## Persisted identities

- Book: `book_ad03cf1bbeabdc7bafb8ec16`
- Project: `project_de1f684e5e17fea3ebaadfef`
- ProjectMemory initial version: 0
- Paid scope: `scope_081b7b30d085744a853ce6e5`
- Paid run: `run_4064f0e265f9d80d6a307806`
- Second scope: `scope_2fa7d8cf3f4183aec85ec871`
- Second continuity run: `run_5a2933f64dc6f96591ab74f6`
- Parsed SourceUnits: 131; persisted Book page count: 132

The paid run was created at `2026-07-20T19:15:12.071Z` and succeeded at
`2026-07-20T19:16:56.472Z` (UTC).

## Successful artifact chain

| Stage/artifact | ID | Hash/status |
| --- | --- | --- |
| ContextPack v1 | `context_1c901f8d5cef2974109e6cf0` | `d548cb53be3aab3672d44a8a9a16a1fd5683b62822b2614c5629ce7a8351a2fa`, accepted |
| MangaPlan candidate | `candidate_manga_plan_e7d7053c31186f72dbd9e4b6` | `e7d7053c31186f72dbd9e4b6b73756a59b69b73b890b631ee1a248790ade248b`, valid |
| MangaPlan accepted | `manga_plan_e7d7053c31186f72dbd9e4b6` | same content hash, accepted |
| Image asset 1 | `image_asset_9c5ef048501b5099bafe0e7f` | `9753f26c82af6981acae3c1d49d02caa452ebace4ca6d8372c6ae54796d30889`, accepted |
| Image asset 2 | `image_asset_7ee6a4b99b850e4481e609d7` | `c3480aeac161123c451d5995fafda50d43347890bc9ff52d6a630f544b042617`, accepted |
| AssetSet v1 | `asset_set_63536773b846645eb1eeb690` | `63536773b846645eb1eeb69013c3c950261232faf9d7162c46e80877c9465d09`, accepted |
| RenderedPageSet v1 | `rendered_page_set_a4b5281b9b8660a1af30678c` | `a4b5281b9b8660a1af30678cda86147ef384fbe8dc576d8f9d292e03712be14c`, accepted |
| MemoryDelta v1 | `memory_delta_95bcd3130deed0025e9509cc` | `95bcd3130deed0025e9509cc9622512dfe14a88ebadf5a888bb9cecd7362c838`, accepted |

All validators reported `passed=true` with no issues. Validator versions were
`context-compiler.v1`, `manga-plan-validator.v1`,
`generated-image-validator.v1`, `asset-set-validator.v1`,
`rendered-page-validator.v1`, and `accepted-manga-memory-delta.v1`.

### RenderedPage v1 artifacts

| Page artifact | Content hash | Grounded PDF page |
| --- | --- | --- |
| `rendered_page_08b90796bdb8d1ddd23cf4d1` | `166e3738615a970594e29e504456668d09acce106c56239eb6cc1a6261523aae` | 13 |
| `rendered_page_571c1143f6ef26cbaf163139` | `1d42f3ef86bcd58a2cd32358e5fc9f464122f324e5f5071975af1adeb39e1a12` | 13 |
| `rendered_page_c2f03001d5b7ffeb9fad0f01` | `cd800abf7363dedd6966730cedb9b3496b16294a9ae7a7f5f5441367b9dd08c5` | 13 |
| `rendered_page_6d929c3549d30b6c51978d3a` | `836375eb952fe13d03d22bc4112cd8ea6468e2cd0cce8745f8e9a2105037ca0b` | 14 |
| `rendered_page_fe9087fb5d0a4679aa7d3b3a` | `db49acc1fd316e068c3ea0b3b6954ca9f74321057df5413a99123f644d17b527` | 14 |
| `rendered_page_ecc2a207bd55eb49c8715485` | `3ba31126118717752b4521c262601286c02e55ae46376b43fe82f59e78c1b2d4` | 14 |
| `rendered_page_dda8c4faa661ab67c9468cee` | `9862f8e63e78c2be959b46d40d279a1a9a92c867e0d7724129bbb1aee71ddd04` | 15 |
| `rendered_page_2641f73c83bf386a3747fef6` | `dc5030fdd1c74ad78d5735332e1dde8d860960597c791506182d9dff92797754` | 15 |
| `rendered_page_4cd98fb7ac176177808bd5a2` | `2d2d33e911877c223921f6c0a516c1b014ccb16d1096178e01d31db4178f97d4` | 15 |
| `rendered_page_a5b7dea688bf473ad4e6fc22` | `9197ec37b51aec788974ef8a0f49366390ad824d613c04f7803942e58a9a3c22` | 15 |

Each page contains one grounded panel and uses `top-right to bottom-left`
reading flow. The two image-backed key panels are on reader pages 3 and 8; the
remaining grounded panels are deterministic composition, not fake successful
image assets.

## Provider receipts

### Manga Director

- Provider/model: `minimax` / `MiniMax-M3`
- Purpose: `manga_direction`
- Prompt version: `manga-direction.v1`
- Production skill hash:
  `ce7ae89218b23bf27c2a446269ac2a7d94cadcf7a17b6d9669c508c72e909425`
- Input artifact: `context_1c901f8d5cef2974109e6cf0`
- Input/output tokens: 20,204 / 14,431
- Cost: $0.02365302
- Latency: 89,067 ms
- Attempt: 1
- Receipt timestamp: `2026-07-20T19:16:41.294961Z`

### Image assets

Both used provider/model `openrouter` /
`google/gemini-2.5-flash-image`, purpose `image_generation`, prompt version
`manga-key-panel.v1`, attempt 1, and the accepted MangaPlan as parent.

| Asset | Input/output tokens | Cost | Latency | Served file hash |
| --- | ---: | ---: | ---: | --- |
| `asset_key_panel_9c5ef048501b5099bafe0e7f` | 144 / 1,305 | $0.0387807 | 7,088 ms | `4f595346100638fa49a9c4bcf82ff4bd4b17d1253a9489fd55d81683f6a0d5ae` |
| `asset_key_panel_7ee6a4b99b850e4481e609d7` | 136 / 1,290 | $0.0387408 | 7,815 ms | `12b732665b6cfb88f0d6588ea3ca064e5430d212455359eeae48796510d4ef25` |

Both served files are real `image/png` data at 832x1248. Downloaded hashes and
dimensions matched the reader payload exactly. The panels were visually
inspected: one depicts the money/attention thought experiment from page 13; the
other depicts the local/global trade-off and unanswered messages from pages
14-15. No scraped external images or placeholder assets were accepted.

Total paid receipt cost recorded by providers: $0.10117452, below both stage
caps. No reels were requested or generated.

## Stage results

| Stage | Attempt | Status | Output |
| --- | ---: | --- | --- |
| `context_compilation` | 1 | succeeded | `context_1c901f8d5cef2974109e6cf0` |
| `manga_direction` | 1 | succeeded | `manga_plan_e7d7053c31186f72dbd9e4b6` |
| `asset_generation` | 1 | succeeded | `asset_set_63536773b846645eb1eeb690` |
| `manga_composition` | 1 | succeeded | `rendered_page_set_a4b5281b9b8660a1af30678c` |
| `memory_delta_merge` | 1 | succeeded | `memory_delta_95bcd3130deed0025e9509cc` |

The run did not become succeeded until every requested RenderedPage and the
memory delta were accepted.

## Reader and restart proof

- Backend reader URL:
  `http://127.0.0.1:8000/books/book_ad03cf1bbeabdc7bafb8ec16/manga/project_de1f684e5e17fea3ebaadfef/reader`
- Frontend reader URL:
  `http://127.0.0.1:3000/books/book_ad03cf1bbeabdc7bafb8ec16/manga/project_de1f684e5e17fea3ebaadfef`
- Payload: `manga-reader.v1`, 10 pages, two generated assets, memory v1
- Frontend server-rendered route: HTTP 200, real book title and asset URLs
  present, canonical fixture title absent
- Duplicate exact-PDF upload: `is_cached=true`, same Book ID and PDF hash
- Before backend/Celery restart payload SHA-256:
  `60983d7621c97f8e56c12c69c5509e8ad9d80da9f56e38750c3dd8b6d1c01bd4`
- After restart payload SHA-256: identical

Docker Desktop itself stopped unexpectedly more than once during acceptance.
Mongo/media named volumes survived, all services recovered, and the reader was
still identical after the explicit backend/Celery restart.

## Memory and fresh-context continuity

ProjectMemory advanced from version 0 to version 1 with content hash
`f988de25a446e5d60efcc2bb71e846997ae56af9a122926cfea8b19706cc166f`.
The essay slice had no grounded fictional characters/world entities, so those
typed collections correctly remained empty rather than being fabricated.
Memory v1 retained:

- a previous-slice ending;
- unresolved-thread collection;
- complete coverage entries for all three selected SourceUnits;
- two immutable asset-index entries and their hashes/receipts;
- accepted parent artifact IDs for MangaPlan, AssetSet, and RenderedPageSet.

After fresh Docker processes, pages 17-19 compiled accepted ContextPack
`context_7c1b411dd8a69498f1ed4b14`, hash
`fe06a9dfe42eee9a7fb9b01975be1cac3c0bf3fd52815ea303b47410e9c6d1f9`,
with `memory_version=1` and the prior continuity fields. Agent worker was
intentionally absent, so the second run ended `retryable_failed /
AGENT_WORKER_FAILED` after ContextPack success and made no second paid call.

## Negative acceptance

Automated tests cover non-PDF, malformed, encrypted, and oversized uploads;
invalid page ranges; missing MiniMax/image credentials; retryable provider
failure; cross-project and inactive-stage tool rejection; invalid MangaPlan;
missing assets; corrupt reader artifacts; failed-run reader rejection; and
same-run paid-stage replay prevention.

Live supplemental proofs:

- Missing MiniMax configuration previously made agent readiness HTTP 503.
- Duplicate upload returned `is_cached=true`.
- Agent unavailable on the second run produced typed `retryable_failed` after
  accepted ContextPack compilation.
- The reader continued to select the succeeded paid run, never the later failed
  continuity run.

## Browser evidence blocker

No desktop/mobile screenshots are recorded. The in-app Browser returned an
empty backend list; Computer Use returned `Sky Computer Use native pipe startup
failed`; and the enabled ChatGPT Chrome Extension plus correct native manifest
still returned `Browser is not available: extension` after an approved Chrome
window retry. The UI upload, interactive RTL/vertical mode checks, refresh in a
controlled browser, and browser-console inspection therefore remain the only
unaccepted golden-path layer.

## Verification gates

Final clean rerun:

- `corepack pnpm install --frozen-lockfile`: passed
- Contract generation/build: passed; 18 contracts current
- Contracts: 22 tests passed
- Agent runtime: 8 tests passed
- Agent worker: 12 tests passed
- Root TypeScript/frontend checks: passed
- `uv sync --frozen`: passed
- Backend: 48 tests passed
- Ruff: passed
- Strict mypy: passed across 46 source files
- Backend contract export check: 18 schemas current
- `docker compose config --quiet`: passed
- `zsh -n start.sh` and `zsh -n stop.sh`: passed
- `git diff --check`: passed
- `docker compose --profile agent up -d --build`: all four repository images
  built and all six services started
- Backend health/readiness: HTTP 200
- Agent-worker health/readiness from inside Docker: HTTP 200
- Frontend `/books/new`: HTTP 200
- Reader after final rebuild: payload SHA-256 remained
  `60983d7621c97f8e56c12c69c5509e8ad9d80da9f56e38750c3dd8b6d1c01bd4`
- Final 662-line backend/Celery/agent/frontend log sample: no credential-pattern
  matches and no unexpected error/traceback/fatal matches

The final local and remote Git SHA is reported in the completion handoff after
the branch push; Git cannot self-record the hash of the commit that contains
this file.
