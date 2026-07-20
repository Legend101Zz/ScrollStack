# Mrigesh core vertical-slice evidence — 2026-07-20

## Scope

This evidence covers only Mrigesh-owned PDF ingestion, durable context,
Manga Director domain tools, worker invocation, artifacts, and lifecycle
handling. No reel-owned path or visual surface changed.

## Fresh-process Mongo continuity proof

An ephemeral local MongoDB 8.2.3 process was started on `127.0.0.1:27019`.
The following commands ran as separate Python processes against the same empty
database:

```bash
cd "/Volumes/Mrigesh SSD/ScrollStack-manga/backend"
uv run python scripts/verify_mongo_continuity.py seed \
  --mongo-uri mongodb://127.0.0.1:27019/scrollstack_golden_20260720c \
  --media-root /private/tmp/scrollstack-mongo.oOhnd5/media-c
uv run python scripts/verify_mongo_continuity.py verify \
  --mongo-uri mongodb://127.0.0.1:27019/scrollstack_golden_20260720c
```

Seed result:

```json
{"book_id":"book_3b1f3846fd2e19c14ae174f3","first_scope_id":"scope_98b292cf8ffb8cfe1ae72919","memory_version":1,"phase":"seed","project_id":"project_b9adb88995d739cb0197de33","second_scope_id":"scope_b71a2aecafd55106f4ea2824"}
```

Fresh-process verification result:

```json
{"context_hash":"d904c371350d6f06f61866e5c54e9e7a4661768de034dd5c8cd0c61ffc7e4bd4","context_pack_id":"context_e6f2435ea729e185d5663b23","included_source_ids":["page_00011_56ed5f7d0a1d","page_00012_4d458be1abd8","page_00013_ddbd0cf8f65d","page_00014_ec076b8e5db6","page_00015_897c90097780","page_00016_17ef7ae0df88","page_00017_f691236a2f60","page_00018_3e8b54d482c6","page_00019_25299b4ba6c2","page_00020_8ba36c43fd39"],"memory_version":1,"phase":"verify","project_id":"project_b9adb88995d739cb0197de33","scope_id":"scope_b71a2aecafd55106f4ea2824"}
```

The verifier also asserted that the rebuilt context contained scope 1's
accepted ending, Mara's character state, the canonical `Wake Light` term, the
source-grounded low-tide fact, and only page 11-20 source units. The temporary
Mongo process was then shut down cleanly.

## Automated checks

```text
Backend pytest:             40 passed
Backend Ruff:               passed
Backend strict mypy:        passed, 43 source files
Contract schemas:           18 current
Contract Vitest:            22 passed
Agent-runtime Vitest:       4 passed
Agent-worker Vitest:        7 passed
Agent runtime typecheck:    passed
Agent worker typecheck:     passed
Root pnpm check:            passed
Compose static config:      passed
start.sh / stop.sh syntax:  passed
git diff --check:           passed
```

## Acceptance limits

- No provider/model credential was configured, so there is no paid live model
  receipt yet. The integration test exercises the same broker persistence and
  validation path with a bounded fake agent gateway.
- `docker compose build` hung without output because the Docker daemon was
  unresponsive and was interrupted after 30 seconds.
- The overall generation run intentionally ends as
  `terminal_failed / MANGA_PIPELINE_NOT_CONNECTED` after accepting MangaPlan;
  manga composition and `RenderedPage` assembly are not yet implemented.
