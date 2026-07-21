# ScrollStack manga production: research and implementation handoff

- **Investigation date:** 2026-07-21
- **Owner/lane:** Mrigesh — core, manga, contracts, shared visual system
- **Worktree:** `/Volumes/Mrigesh SSD/ScrollStack-manga`
- **Branch inspected:** `codex/mrigesh-core-vertical-slice`
- **HEAD inspected:** `d0c2315` (`feat: complete persisted manga golden path`)
- **Architecture source:** `technical-imp.md`
- **Live example:** `book_ad03cf1bbeabdc7bafb8ec16` / `project_de1f684e5e17fea3ebaadfef`
- **Run:** `run_4064f0e265f9d80d6a307806`

This began as a documentation and architecture handoff. Phase 0 and the
Phase 1 proof/service slice are now implemented in the uncommitted worktree:
versioned contracts, the recursive compiler, deterministic validation and SVG
previews, planning tools/skills, durable artifacts, and a real Mongo-backed
two-page zero-image proof. Production `GenerationWorkflowService` activation is
still deliberately deferred behind a v2 pipeline gate. Utkarsh's reel-owned
paths remain untouched.

## 1. Executive summary

The current output does not feel like manga because the pipeline stops its
creative reasoning too early. MiniMax produces a source-grounded list of ten
adaptation beats, but the application then deterministically maps **one beat to
one page and one panel**, mechanically cycles four shot labels, produces only
two images, leaves eight panels as prose-filled placeholders, and adds the same
narration treatment to every page. The frontend makes this worse by ignoring
the persisted `PageComposition` and projecting each panel through four fixed
CSS classes and four fixed text anchors. Good individual images cannot repair a
missing page script, thumbnail/name, panel rhythm, composition plan, lettering
plan, or revision loop.

The recommended architecture is:

> source-grounded adaptation agent -> page script -> thumbnail/name ->
> hierarchical layout DSL -> budgeted panel/layer generation -> deterministic
> composition and lettering -> deterministic plus vision QA -> typed revisions
> -> accepted `RenderedPage`

Celery must remain the workflow authority, Mongo the durable truth, and the Pi
runtime a bounded creative worker. Pi may make creative decisions and request
images through typed domain tools, but it must not receive arbitrary filesystem,
shell, provider, or network access. The backend validates and persists every
intermediate artifact, executes idempotent image jobs, compiles layout geometry,
renders pages, enforces budgets, and decides whether acceptance gates are met.

`RenderedPage` remains the correct reader boundary, but `rendered-page.v1` is
not expressive enough for real manga composition. Introduce internal versioned
artifacts and `rendered-page.v2`; retain a legacy v1 reader adapter for existing
projects. Do not mutate old accepted artifacts or pretend that converting a
single-panel v1 page creates a real v2 composition.

### The most important product correction

The next goal is not “generate ten better full-page images.” It is to produce
an inspectable, editable two-page sequence whose panel count, panel sizes,
camera decisions, eye path, dialogue/narration, images, and page-turn payoff are
all intentional and separately revisable.

## 2. Evidence from the current implementation

### 2.1 Confirmed persisted project evidence

The investigation read the live reader, its DOM, the repository, the committed
golden-path evidence, and the Mongo records backed by the named Docker volume.
No new paid generation was started.

| Evidence | Confirmed value |
| --- | --- |
| Book | `hell yeah or no 1nbsped compress`; 132-page PDF; SHA-256 starts `183ca8`; parser `pymupdf-page-text.v1` |
| Selected source | PDF pages 13, 14, and 15 through scope `scope_081b...` |
| Plan | `manga_plan_e7d...`; ten source-grounded beats; `target_page_count: 10` |
| Images | Two 832x1248 PNG key-panel assets generated with `google/gemini-2.5-flash-image` |
| Pages | Ten accepted `rendered-page.v1` artifacts |
| Page geometry | Every page has exactly one panel at `x=0, y=0, width=100, height=100` |
| Text | Every panel has narration copied from `beat.book_essence`; dialogue is empty |
| Bubble metadata | `bubble_placements` is empty on every page |
| Image coverage | Two pages use generated images; eight are `render_status: not_requested` |
| Storyboard/name | No persisted thumbnail or name artifact exists |
| Revisions/QA | No panel visual-QA report or asset revision history exists |
| Continuity | ProjectMemory v1 and a second non-overlapping ContextPack were persisted and rebuilt after restart |

The accepted Manga Director output is not random or ungrounded. It adapts the
source essay into “Two Trade-offs: Satiation and Locality,” and several beat
descriptions even ask for “two stacked panels” or a “parallel panel.” Those
instructions are lost because the downstream composer turns each beat into one
panel. This isolates the principal defect: the plan has useful story intent,
but there is no structured page-writing and thumbnailing layer capable of
realizing it.

The two image receipts cost `$0.0775215` total. The Manga Director receipt
records 20,204 input tokens, 14,431 output tokens, `$0.02365302`, 89,067 ms, and
attempt 1. These figures are evidence for the current run, not estimates for the
new architecture.

### 2.2 What the live reader actually shows

The target URL was inspected in the running browser at desktop size and in both
vertical and RTL modes.

- Vertical mode is a stream of ten large, single-panel cards rather than ten
  composed pages.
- Only pages 3 and 8 have generated artwork. The other eight panels display the
  action/composition prose as centered text over a halftone placeholder.
- Each page has one black narration rectangle at the lower-left. Because there
  is only one narration item per page and the anchor alternation starts at
  index zero, the alternation never advances.
- RTL mode shows one small page/panel centered in a large black reader surface;
  the sixth page still has one panel and its long narration obscures the
  placeholder.
- The browser console contained unrelated wallet-extension warnings; no
  ScrollStack application error explained the visual result.

This visual inspection closes the old “browser unavailable” observation for
this persisted reader URL. It does **not** count as a complete upload-flow,
mobile, accessibility, or refresh acceptance pass.

### 2.3 Current pipeline traced from code and data

```text
PDF upload
  backend/app/services/pdf_ingestion.py
  backend/app/services/source_units.py
    -> PyMuPDF page text
    -> SourceUnitDoc + hashes in Mongo

scope selection
  backend/app/services/scopes.py
    -> ScopeManifest

Celery workflow authority
  backend/app/services/generation_workflow.py:87-184
    -> context_compilation
       ContextCompiler -> persisted context-pack.v1
    -> manga_direction
       AgentGoal(MANGA_DIRECTION) -> authenticated worker
       -> sealed Pi skill + five domain tools
       -> candidate manga-plan.v1
       -> backend validation -> accepted manga-plan.v1
    -> asset_generation
       MangaProductionService.generate_assets
       -> choose two distributed beats
       -> OpenRouter image gateway
       -> two image-asset.v1 artifacts + asset-set.v1
    -> manga_composition
       MangaProductionService.compose_rendered_pages
       -> partition ten beats across ten pages
       -> one StoryboardPanel per beat
       -> equal-height full-width layout
       -> ten rendered-page.v1 artifacts + page set
    -> memory_delta_merge
       -> accepted-output-derived memory-delta.v1

reader API
  backend/app/services/manga_reader.py
    -> manga-reader.v1 envelope containing accepted RenderedPages

frontend projection
  frontend/lib/fixtures/reader-adapter.ts
    -> discard PageComposition geometry
    -> map shot_type to four coarse layout classes
    -> synthesize fixed bubble/narration anchors
  frontend/components/MangaReader/MangaPage.tsx
    -> fixed six-column grid or flattened vertical panel stream
  frontend/components/MangaReader/MangaPanel.tsx
    -> image or text placeholder + absolute text overlays
```

### 2.4 Root causes mapped to responsible code

| Visible problem | Confirmed cause | Responsible path |
| --- | --- | --- |
| Ten pages all feel the same | `target_page_count` equals beat count; even partition yields one beat/panel per page | `backend/app/services/manga_production.py:300-367` |
| No thumbnail/name stage | Workflow jumps from accepted `MangaPlan` to image selection and deterministic final composition | `backend/app/services/generation_workflow.py:132-181` |
| Two images only | `_distributed_beats` selects at most `max_key_panels`; current budget is two | `backend/app/services/manga_production.py:100-286,713-737` |
| Eight prose cards | Non-selected panels are `not_requested`; frontend prints action prose in the visual placeholder | `manga_production.py:351-358`; `frontend/components/MangaReader/MangaPanel.tsx:35-55` |
| Repeated narrator box | Composer puts `beat.book_essence` into every panel; adapter always gives the first narration `bottom-left` | `manga_production.py:324-350`; `frontend/lib/fixtures/reader-adapter.ts:106-117` |
| Saved layout has no variation | `_page_composition` creates only full-width equal-height vertical rows and empty bubbles | `backend/app/services/manga_production.py:781-808` |
| Saved geometry is not rendered | New frontend adapter derives layout from shot type and never consumes `PageComposition` | `frontend/lib/fixtures/reader-adapter.ts:56-67,119-125` |
| Camera direction is cosmetic | Shot types cycle `wide -> medium -> close_up -> over_shoulder`; they do not drive image framing or crop constraints | `backend/app/services/manga_production.py:765-778` |
| Narration policy contradicts output | Context constraints say `narration_enabled=False`, while composition unconditionally assigns narration | `backend/app/services/generation_workflow.py:199-207`; `manga_production.py:348` |
| No dialogue/bubble system | Plan has no page dialogue; compositor creates no dialogue and no bubble placements | `backend/app/contracts/manga.py:20-71`; `manga_production.py:342,791` |
| Layout validation is too weak | Validator checks vertical y intervals and asset existence, not reading graph, 2-D collision, text fit, repetition, focus, or eye path | `backend/app/services/manga_production.py:810-894` |
| Image replay is incomplete | Asset records store prompt hash/version but not exact prompt, negative prompt, parameters, seed/reference inputs, or visual QA | `backend/app/services/manga_production.py:128-224` |
| Agent cannot compose today | Active backend service implements only five Manga Director tools; its goal explicitly forbids images and RenderedPage composition | `backend/app/services/domain_tools.py:48-316`; `generation_workflow.py:303-358` |
| Resume is process-local | Pi uses an in-memory session manager and the worker run registry is in memory; a restart loses live continuation | `packages/agent-runtime/src/pi-runtime.ts:171-188,262-292` |

There is also a naming defect worth fixing when the contracts change: each
individual page artifact is saved with `kind: rendered_page_set` while using
schema `rendered-page.v1`. The accepted content remains readable, but artifact
kind should describe page versus page set unambiguously.

### 2.5 What is already strong and must be preserved

- PDF ingestion, stable source-unit IDs/hashes, scopes, bounded ContextPacks,
  ProjectMemory, restart/idempotency behavior, and accepted-output-only memory.
- Celery as the single workflow owner and Mongo as durable truth.
- Immutable artifacts with content hashes and explicit lineage.
- Authenticated worker, repository-owned skills, disabled Pi built-ins, typed
  goal policies, step/cost/repair budgets, traces, and receipts.
- OpenRouter image gateway and immutable hashed media storage.
- Pydantic -> deterministic JSON Schema -> generated TypeScript/Ajv workflow.
- `manga-reader.v1` public envelope and `RenderedPage` as the reader concept.
- Existing two generated images. They can be reused if the new panel specs
  consider them semantically suitable; they are not proof of page composition.

## 3. Research findings translated into requirements

This is not a generic manga tutorial. Each finding below changes a software
stage or contract.

| Production finding | Software requirement |
| --- | --- |
| Traditional workflows separate script, rough page/name, rough drawing, and finished page. AnimeOutline explicitly places rough sketches before final pages, with panel layout and dialogue already decided. | Persist `PageScript` and `ThumbnailPage` before any expensive final panel generation. Do not let image generation invent page structure. |
| MediBang describes the “name” as the stage where frame layout, dialogue, character placement, and camera work are decided. | The thumbnail is structured editorial data, not a low-resolution final image. It must contain panel beats, camera/blocking, text intent, layout tree, and focal/avoid regions. |
| Clip Studio recommends planning eye travel, bubble position, shot mixture, and page rhythm while thumbnails are still small and cheap to revise. | Validate reading graph, text density, repeated shot runs, panel emphasis, and page-turn anchor before image calls. Generate a cheap SVG thumbnail preview for agent/human inspection. |
| Panel size and gutter rhythm communicate time and emphasis; splashes, insets, overlaps, diagonals, and broken borders are intentional exceptions. | A fixed grid or mandatory minimum panel count is invalid. The DSL needs page kinds, recursive splits, explicit overlays/insets, angled boundaries, and controlled freeform clips. |
| Eye-tracking research finds external panel structure strongly directs order, while text and content resolve ambiguous layouts. | Reading order cannot be derived only from array order or geometry. Persist a reading graph and check it against compiled geometry and overlay sequence. |
| Attention-based manga composition treats subjects and balloons together as an eye path. | Panel generation specs need focal zones and reserved text zones; lettering cannot be bolted on after uncropped images are accepted. |
| Automatic balloon placement work optimizes both avoiding important image regions and preserving inter-panel reading tempo. | Bubble placement should be a deterministic constrained layout problem informed by detected/declared faces, focal regions, speaker locations, and next-reading target. |
| Automatic comic-generation research uses panel importance and inter-image relations for layout, and emotion for balloon styling. | `PageScript` and `PanelSpec` require beat importance, transition relation, emotion, and intended tempo; layout selection must optimize the whole page/sequence, not panel count alone. |

References:

- [AnimeOutline — Steps to Make Your Own Manga](https://www.animeoutline.com/steps-to-make-your-own-manga/)
- [MediBang — Manga Tutorial for Beginners: Process of Manga Making](https://medibangpaint.com/en/use/2021/06/mangatutorialforbeginners01/)
- [MangaName — rough manga storyboard tool](https://medibangpaint.com/en/manganame/)
- [Clip Studio — Comic and manga creation](https://www.clipstudio.net/en/comics-manga/comic-creation/)
- [Clip Studio — Comic page layout guide](https://www.clipstudio.net/how-to-draw/archives/160963)
- [ComfyUI Panels — hierarchical cut representation](https://github.com/bmad4ever/comfyui_panels)
- [Nakazawa et al. — eye movements and manga reading order](https://eric.ed.gov/?id=EJ1363085)
- [Cao et al. — Attention-based composition for manga](https://www.ying-cao.com/projects/manga_composition/manga_composition.htm)
- [Kuo et al. — optimized speech-balloon placement](https://researchoutput.ncku.edu.tw/zh/publications/optimized-speech-balloon-placement-for-automatic-comics-generatio/)
- [Automatic Comic Generation with Stylistic Multi-page Layouts and Emotion-driven Text Balloon Generation](https://arxiv.org/abs/2101.11111)

### 3.1 ComfyUI Panels: adopt the concept, not the dependency

`comfyui_panels` represents a page as recursive cuts: direction, split position,
optional angle, and child cuts. It compiles those abstract cuts to polygons and
supports arbitrary nesting. This is substantially better than naming a handful
of templates or asking a model for unrelated rectangles.

ScrollStack should independently implement the same **hierarchical-cut idea**
as a versioned JSON contract because:

- the repository already has a Pydantic/JSON Schema/TypeScript contract toolchain;
- ComfyUI and Shapely should not become runtime requirements for browser rendering;
- ScrollStack also needs margins, trim/bleed/safe regions, reading graphs,
  overlays, spreads, text, layers, asset lineage, and revision metadata;
- normalized geometry needs identical compilation in backend tests and frontend
  rendering, with an explicit `layout_engine_version` and test vectors.

The upstream repository is MIT licensed. If code rather than only the concept
is borrowed, preserve its license and record the exact copied/modified files.

## 4. Proposed end-to-end pipeline

```text
1. INGEST [deterministic]
   PDF -> SourceUnits + hashes + provenance

2. COMPILE CONTEXT [deterministic]
   scope + accepted memory -> bounded ContextPack

3. UNDERSTAND/ADAPT [agentic, typed]
   ContextPack -> AdaptationBrief + CharacterBible + EnvironmentBible
               -> SceneList/MangaPlan

4. WRITE PAGES [agentic, typed]
   plan -> PageBeatSheet -> PageScript set
   each page declares entry state, exit/payoff, tempo, panel beats,
   dialogue/narration/SFX, source facts, and continuity mutations

5. CREATE NAME/THUMBNAILS [agentic proposal + deterministic compile]
   PageScript -> ThumbnailPage
   agent chooses hierarchical layout, camera/blocking, rough focal boxes,
   text intent, and page-turn anchor
   compiler -> concrete polygons + reading graph + SVG thumbnail preview

6. PRE-FLIGHT [deterministic, then optional model editor]
   schema, lineage, source coverage, geometry, reading order, text budget,
   layout/shot repetition, cost estimate
   failed -> typed patch request; no image spend yet

7. PLAN ASSETS [agentic proposal, deterministic authorization]
   accepted thumbnail -> PanelGenerationSpec/AssetRequestSet
   references character/location bible, exact crop, focal and reserved-text zones

8. GENERATE ASSETS [deterministic orchestration, model execution]
   Celery authorizes idempotent image jobs through backend provider gateway
   persist exact request snapshot + receipt + immutable output for every attempt

9. ASSET QA/REVISION [deterministic + separate vision reviewer]
   dimensions/hash/safety -> beat and composition compliance -> identity/continuity
   failed -> bounded `PanelRevisionRequest`, preferably patching only that panel

10. COMPOSE/LETTER [deterministic]
    layout polygons + selected assets/layers + text specs
    -> fitted bubbles/narration/SFX with collision avoidance and tail targets
    -> canonical SVG/scene graph + PNG/WebP export

11. PAGE QA/REVISION [deterministic + model-assisted]
    readability, eye path, pacing, similarity, continuity, missing visual info
    failed -> layout/text/asset-specific revision, never blind full-run retry

12. ACCEPT/PUBLISH [control plane]
    accepted RenderedPage v2 + manifest + revision history
    -> reader projection -> accepted memory delta
```

### 4.1 Agentic versus deterministic boundary

| Agent may decide | Backend/control plane must decide or enforce |
| --- | --- |
| Adaptation voice, scene/beat selection, page boundaries, pacing intention | Source access, ownership, scope, provenance, and maximum output size |
| Panel count when consistent with page kind and budgets | Contract validation, allowed ranges, lineage, immutability, and idempotency |
| Layout tree proposal, camera, blocking, focal point, text intent | Layout compilation, polygon clipping, safe/bleed bounds, reading graph validation |
| Which approved reference assets to reuse | Whether an asset ID belongs to project/run and is safe to expose |
| Image request content and revision instruction | Provider/model allowlist, budget reservation, request identity, retry cap, storage |
| Proposed bubble regions and emotional style | Font shaping, fit, collision avoidance, tail geometry, accessible text |
| Editorial review and typed issue proposals | Hard validation gates and final status transition |

Pi must never receive a raw provider key, arbitrary URL fetch, filesystem path,
or general renderer execution. A tool call submits a typed, bounded intent. The
backend returns IDs, metadata, previews, and typed issues.

### 4.2 Resume and reproducibility

Resume from persisted artifacts and stage checkpoints, not from the worker's
live in-memory conversation. A repair goal should be reconstructible from the
accepted parent artifact, validation report, and revision request in a new
bounded Pi session. `agent_session_id` may aid observability, but it is not a
durable dependency.

For image models that expose a seed, persist it. When they do not, “reproducible”
means exact request/receipt lineage and replay of the accepted immutable bytes,
not a false promise of regenerating identical pixels.

## 5. Proposed manga DSL and intermediate contracts

### 5.1 Representation decision

Use canonical JSON authored as Pydantic discriminated unions, exported to JSON
Schema and generated TypeScript. Do not introduce a custom textual language in
the first version.

Reasons:

- validation and migrations fit the existing contract system;
- Pi can reliably submit JSON through current tool adapters;
- browser/editor consumers need typed, addressable nodes;
- JSON Patch-like revision operations can target stable IDs;
- a compact textual shorthand can be added later as an authoring convenience,
  while JSON stays canonical.

Keep creative intent and compiled geometry separate:

- `PageLayoutTree` records the authored recursive cut/overlay plan.
- `CompiledPageLayout` records deterministic polygons, clip paths, bboxes,
  gutters, and a reading graph produced by `layout_engine_version`.
- `PageCompositionV2` binds compiled panels to assets and text layers.

### 5.2 Draft type shape

```ts
type NormalizedPoint = { x: number; y: number }; // each 0..1
type NormalizedBox = { x: number; y: number; width: number; height: number };

type LayoutNode =
  | { kind: "panel"; node_id: string; panel_id: string }
  | {
      kind: "split";
      node_id: string;
      axis: "x" | "y";
      ratios: number[];              // positive, sum normalized by compiler
      gutter: { value: number; unit: "page_pct" };
      angle_deg?: number;            // guarded range, e.g. -18..18
      children: LayoutNode[];        // ratios.length === children.length
    }
  | {
      kind: "overlay";
      node_id: string;
      base: LayoutNode;
      insets: Array<{
        node: LayoutNode;
        anchor: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "center";
        box: NormalizedBox;
        z_index: number;
        border_style: "standard" | "borderless" | "broken";
      }>;
    }
  | {
      kind: "freeform_panel";
      node_id: string;
      panel_id: string;
      polygon: NormalizedPoint[];
      exception_reason: string;
    };

interface MangaPagePlanV1 {
  schema_version: "manga-page-plan.v1";
  page_id: string;
  page_index: number;
  page_kind: "standard" | "splash" | "spread_left" | "spread_right";
  canvas: {
    width_px: number;
    height_px: number;
    trim: NormalizedBox;
    safe: NormalizedBox;
    bleed_pct: number;
  };
  reading_direction: "rtl" | "ltr";
  entry_state: string;
  exit_state: string;
  page_turn_panel_id?: string;
  layout_root: LayoutNode;
  panels: PanelPlanV1[];
  text_elements: TextElementV1[];
  reading_edges: Array<{ from: string; to: string; reason: string }>;
  source_fact_ids: string[];
  continuity_in: ContinuityRefV1;
  continuity_out: ContinuityDeltaV1;
}

interface PanelPlanV1 {
  panel_id: string;
  purpose: "setup" | "action" | "reaction" | "reveal" | "transition" | "insert" | "payoff";
  story_beat: string;
  importance: "low" | "medium" | "high" | "page_turn";
  tempo: "hold" | "normal" | "quick" | "impact";
  camera: {
    shot: "extreme_wide" | "wide" | "medium" | "close_up" | "extreme_close_up" | "insert" | "pov";
    angle: "eye" | "high" | "low" | "dutch" | "over_shoulder";
    movement?: "static" | "pan" | "push_in" | "pull_out" | "tracking";
  };
  blocking: Array<{
    subject_ref: string;
    pose: string;
    expression: string;
    anchor: NormalizedPoint;
    scale: number;
    facing: "left" | "right" | "front" | "away";
    depth: "foreground" | "midground" | "background";
  }>;
  environment_ref?: string;
  prop_refs: string[];
  focal_regions: NormalizedBox[];
  avoid_text_regions: NormalizedBox[];
  motion: { direction?: string; speed?: string; effects: string[] };
  desired_asset_refs: string[];
  source_fact_ids: string[];
}

interface TextElementV1 {
  text_id: string;
  panel_id: string;
  kind: "dialogue" | "thought" | "narration" | "monologue" | "sfx";
  content: string;
  speaker_ref?: string;
  emotion?: string;
  writing_direction: "horizontal" | "vertical";
  shape: "oval" | "round_rect" | "thought_cloud" | "jagged" | "caption" | "free_sfx";
  preferred_region: NormalizedBox;
  tail_target?: { subject_ref?: string; point: NormalizedPoint };
  typography: {
    font_token: string;
    weight: number;
    min_px: number;
    max_px: number;
    emphasis?: "normal" | "bold" | "whisper" | "shout";
  };
  overflow: "fit" | "reflow" | "split" | "reject";
  z_index: number;
}
```

Generation attempts belong in linked artifacts rather than bloating the page
plan:

```ts
interface ImageAttemptV1 {
  schema_version: "image-attempt.v1";
  attempt_id: string;
  panel_id: string;
  purpose: "panel" | "character_reference" | "environment" | "prop" | "texture";
  provider: string;
  model: string;
  prompt_snapshot: string;
  negative_prompt?: string;
  reference_asset_ids: string[];
  parameters: Record<string, string | number | boolean>;
  seed?: number;
  request_hash: string;
  provider_response_id?: string;
  output_asset_id?: string;
  receipt_id?: string;
  cost_usd?: number;
  status: "requested" | "succeeded" | "failed" | "rejected" | "accepted";
  validation_report_ids: string[];
  revision_instruction?: string;
}
```

### 5.3 Example A: normal four-panel dialogue page

```json
{
  "schema_version": "manga-page-plan.v1",
  "page_id": "page_locality_01",
  "page_index": 0,
  "page_kind": "standard",
  "canvas": {
    "width_px": 1600,
    "height_px": 2400,
    "trim": { "x": 0.03, "y": 0.02, "width": 0.94, "height": 0.96 },
    "safe": { "x": 0.06, "y": 0.05, "width": 0.88, "height": 0.90 },
    "bleed_pct": 0.02
  },
  "reading_direction": "rtl",
  "entry_state": "The narrator believes geography no longer matters.",
  "exit_state": "The first doubt appears when a local meeting is missed.",
  "page_turn_panel_id": "p4",
  "layout_root": {
    "kind": "split",
    "node_id": "root",
    "axis": "y",
    "ratios": [0.25, 0.42, 0.33],
    "gutter": { "value": 0.012, "unit": "page_pct" },
    "children": [
      { "kind": "panel", "node_id": "n1", "panel_id": "p1" },
      {
        "kind": "split",
        "node_id": "middle",
        "axis": "x",
        "ratios": [0.44, 0.56],
        "gutter": { "value": 0.012, "unit": "page_pct" },
        "children": [
          { "kind": "panel", "node_id": "n2", "panel_id": "p3" },
          { "kind": "panel", "node_id": "n3", "panel_id": "p2" }
        ]
      },
      { "kind": "panel", "node_id": "n4", "panel_id": "p4" }
    ]
  },
  "panels": [
    {
      "panel_id": "p1",
      "purpose": "setup",
      "story_beat": "A map collapses into a glowing network.",
      "importance": "medium",
      "tempo": "hold",
      "camera": { "shot": "extreme_wide", "angle": "high", "movement": "push_in" },
      "blocking": [],
      "environment_ref": "env_world_map_network",
      "prop_refs": [],
      "focal_regions": [{ "x": 0.42, "y": 0.32, "width": 0.2, "height": 0.3 }],
      "avoid_text_regions": [{ "x": 0.35, "y": 0.2, "width": 0.35, "height": 0.55 }],
      "motion": { "direction": "inward", "speed": "slow", "effects": ["network_lines"] },
      "desired_asset_refs": [],
      "source_fact_ids": ["fact_locality_01"]
    },
    {
      "panel_id": "p2",
      "purpose": "insert",
      "story_beat": "A chat window says: Anywhere is local now.",
      "importance": "low",
      "tempo": "quick",
      "camera": { "shot": "insert", "angle": "eye", "movement": "static" },
      "blocking": [],
      "prop_refs": ["prop_laptop"],
      "focal_regions": [{ "x": 0.2, "y": 0.18, "width": 0.6, "height": 0.6 }],
      "avoid_text_regions": [],
      "motion": { "effects": [] },
      "desired_asset_refs": [],
      "source_fact_ids": ["fact_locality_01"]
    },
    {
      "panel_id": "p3",
      "purpose": "reaction",
      "story_beat": "The narrator answers confidently, still unconvinced by place.",
      "importance": "medium",
      "tempo": "normal",
      "camera": { "shot": "close_up", "angle": "eye", "movement": "static" },
      "blocking": [{ "subject_ref": "char_narrator", "pose": "typing", "expression": "assured", "anchor": { "x": 0.68, "y": 0.72 }, "scale": 0.75, "facing": "left", "depth": "midground" }],
      "prop_refs": ["prop_laptop"],
      "focal_regions": [{ "x": 0.48, "y": 0.18, "width": 0.35, "height": 0.42 }],
      "avoid_text_regions": [{ "x": 0.42, "y": 0.08, "width": 0.48, "height": 0.55 }],
      "motion": { "effects": [] },
      "desired_asset_refs": ["character_ref_narrator_v1"],
      "source_fact_ids": []
    },
    {
      "panel_id": "p4",
      "purpose": "reveal",
      "story_beat": "An invitation expires while Singapore sleeps.",
      "importance": "page_turn",
      "tempo": "impact",
      "camera": { "shot": "close_up", "angle": "high", "movement": "push_in" },
      "blocking": [{ "subject_ref": "char_narrator", "pose": "slumped beside phone", "expression": "uneasy", "anchor": { "x": 0.72, "y": 0.75 }, "scale": 0.68, "facing": "left", "depth": "midground" }],
      "environment_ref": "env_singapore_night_room",
      "prop_refs": ["prop_phone_missed_invite"],
      "focal_regions": [{ "x": 0.12, "y": 0.2, "width": 0.35, "height": 0.4 }, { "x": 0.56, "y": 0.16, "width": 0.26, "height": 0.35 }],
      "avoid_text_regions": [{ "x": 0.54, "y": 0.1, "width": 0.32, "height": 0.5 }],
      "motion": { "direction": "down", "speed": "still", "effects": ["screen_glow"] },
      "desired_asset_refs": ["character_ref_narrator_v1", "environment_ref_singapore_room_v1"],
      "source_fact_ids": ["fact_locality_03"]
    }
  ],
  "text_elements": [
    {
      "text_id": "t1",
      "panel_id": "p1",
      "kind": "narration",
      "content": "Distance looked solved.",
      "writing_direction": "horizontal",
      "shape": "caption",
      "preferred_region": { "x": 0.68, "y": 0.06, "width": 0.25, "height": 0.18 },
      "typography": { "font_token": "manga_narration", "weight": 600, "min_px": 24, "max_px": 40 },
      "overflow": "reject",
      "z_index": 40
    },
    {
      "text_id": "t2",
      "panel_id": "p3",
      "kind": "dialogue",
      "content": "I can work from anywhere.",
      "speaker_ref": "char_narrator",
      "emotion": "confident",
      "writing_direction": "horizontal",
      "shape": "oval",
      "preferred_region": { "x": 0.05, "y": 0.06, "width": 0.4, "height": 0.3 },
      "tail_target": { "subject_ref": "char_narrator", "point": { "x": 0.58, "y": 0.42 } },
      "typography": { "font_token": "manga_dialogue", "weight": 500, "min_px": 24, "max_px": 38 },
      "overflow": "reflow",
      "z_index": 40
    },
    {
      "text_id": "t3",
      "panel_id": "p4",
      "kind": "sfx",
      "content": "TIK",
      "writing_direction": "horizontal",
      "shape": "free_sfx",
      "preferred_region": { "x": 0.32, "y": 0.58, "width": 0.2, "height": 0.18 },
      "typography": { "font_token": "manga_sfx", "weight": 800, "min_px": 30, "max_px": 64, "emphasis": "whisper" },
      "overflow": "reject",
      "z_index": 45
    }
  ],
  "reading_edges": [
    { "from": "p1", "to": "p2", "reason": "establish then object detail" },
    { "from": "p2", "to": "p3", "reason": "claim then speaker reaction" },
    { "from": "p3", "to": "p4", "reason": "confidence contradicted by missed local moment" }
  ],
  "source_fact_ids": ["fact_locality_01", "fact_locality_03"],
  "continuity_in": { "snapshot_id": "memory_v1" },
  "continuity_out": { "changes": ["narrator_confidence: assured -> uneasy"] }
}
```

### 5.4 Example B: irregular action page with angled cut and inset

```json
{
  "page_id": "page_action_02",
  "page_kind": "standard",
  "reading_direction": "rtl",
  "page_turn_panel_id": "a4",
  "layout_root": {
    "kind": "overlay",
    "node_id": "action_root",
    "base": {
      "kind": "split",
      "node_id": "angled_base",
      "axis": "y",
      "ratios": [0.30, 0.70],
      "angle_deg": -9,
      "gutter": { "value": 0.008, "unit": "page_pct" },
      "children": [
        {
          "kind": "split",
          "node_id": "top_pair",
          "axis": "x",
          "ratios": [0.38, 0.62],
          "gutter": { "value": 0.008, "unit": "page_pct" },
          "children": [
            { "kind": "panel", "node_id": "a2_leaf", "panel_id": "a2" },
            { "kind": "panel", "node_id": "a1_leaf", "panel_id": "a1" }
          ]
        },
        { "kind": "panel", "node_id": "a4_leaf", "panel_id": "a4" }
      ]
    },
    "insets": [
      {
        "node": { "kind": "panel", "node_id": "a3_leaf", "panel_id": "a3" },
        "anchor": "top_left",
        "box": { "x": 0.05, "y": 0.32, "width": 0.31, "height": 0.25 },
        "z_index": 18,
        "border_style": "broken"
      }
    ]
  },
  "reading_edges": [
    { "from": "a1", "to": "a2", "reason": "movement crosses right to left" },
    { "from": "a2", "to": "a3", "reason": "inset reaction interrupts motion" },
    { "from": "a3", "to": "a4", "reason": "reaction releases into impact splash" }
  ],
  "text_elements": [
    {
      "text_id": "sfx_impact",
      "panel_id": "a4",
      "kind": "sfx",
      "content": "KRAK",
      "writing_direction": "vertical",
      "shape": "free_sfx",
      "preferred_region": { "x": 0.04, "y": 0.14, "width": 0.26, "height": 0.62 },
      "typography": { "font_token": "manga_sfx", "weight": 900, "min_px": 42, "max_px": 120, "emphasis": "shout" },
      "overflow": "reject",
      "z_index": 50
    }
  ]
}
```

The compiler clips the angled split to the trim polygon. The inset is an
explicit overlap, so it does not trigger the accidental-overlap validator. SFX
is a first-class layer, not text baked into the generated image.

### 5.5 Example C: full-bleed splash page

```json
{
  "page_id": "page_reveal_03",
  "page_kind": "splash",
  "reading_direction": "rtl",
  "page_turn_panel_id": "s1",
  "layout_root": { "kind": "panel", "node_id": "splash_leaf", "panel_id": "s1" },
  "panels": [
    {
      "panel_id": "s1",
      "purpose": "payoff",
      "story_beat": "The map resolves into one bright local circle and hundreds of dim remote connections.",
      "importance": "page_turn",
      "tempo": "hold",
      "camera": { "shot": "extreme_wide", "angle": "high", "movement": "pull_out" },
      "blocking": [],
      "environment_ref": "env_network_map_reveal",
      "prop_refs": [],
      "focal_regions": [{ "x": 0.56, "y": 0.34, "width": 0.28, "height": 0.3 }],
      "avoid_text_regions": [{ "x": 0.48, "y": 0.25, "width": 0.4, "height": 0.45 }],
      "motion": { "direction": "outward", "speed": "slow", "effects": ["white_bleed", "network_threads"] },
      "desired_asset_refs": ["asset_key_panel_9c5..."],
      "source_fact_ids": ["fact_locality_payoff"]
    }
  ],
  "text_elements": [
    {
      "text_id": "splash_caption",
      "panel_id": "s1",
      "kind": "narration",
      "content": "The network was global. Opportunity was still local.",
      "writing_direction": "horizontal",
      "shape": "caption",
      "preferred_region": { "x": 0.07, "y": 0.77, "width": 0.34, "height": 0.13 },
      "typography": { "font_token": "manga_narration", "weight": 650, "min_px": 28, "max_px": 48 },
      "overflow": "reject",
      "z_index": 40
    }
  ]
}
```

A splash is valid because `page_kind` makes its single-panel rhythm explicit.
Validators must not impose the old Book-Reel rule that every page needs at least
three panels.

### 5.6 Example D: targeted revision, not whole-page regeneration

```json
{
  "schema_version": "revision-request.v1",
  "revision_id": "rev_page_locality_01_p4_02",
  "target_artifact_id": "image_attempt_p4_01",
  "scope": "panel_asset",
  "issue_codes": ["FOCAL_SUBJECT_OCCUPIES_TEXT_RESERVE", "WRONG_TIME_OF_DAY"],
  "evidence": [
    { "region": { "x": 0.54, "y": 0.1, "width": 0.32, "height": 0.5 }, "message": "Face collides with reserved narration area." }
  ],
  "instruction": "Keep the phone on the left and move the narrator down-right; render unmistakable Singapore night lighting.",
  "preserve": ["character_identity", "phone_screen_content", "camera_angle"],
  "max_additional_cost_usd": 0.05,
  "author": "system_reviewer",
  "status": "approved_for_retry"
}
```

## 6. Intermediate artifacts and data model changes

### 6.1 Artifact graph

```text
SourceUnits + MemorySnapshot
        |
        v
ContextPack
        |
        v
AdaptationBrief ---- CharacterBible ---- EnvironmentBible
        |                    |                    |
        +---------------- MangaPlan --------------+
                              |
                        PageScriptSet
                              |
                         ThumbnailSet
                              |
             PageLayoutTree -> CompiledPageLayout
                              |
                  PanelGenerationSpecSet
                       /      |      \
                ImageAttempt ImageAttempt ImageAttempt ...
                       \      |      /
                       AssetManifest
                              |
                     PageCompositionV2
                              |
               ValidationReport <-> RevisionRequest
                              |
                     RenderedPageV2 set
                              |
                    MangaManifest + MemoryDelta
```

### 6.2 Persistence and versioning policy

| Artifact | Persist? | Version/immutability | Regenerable? |
| --- | --- | --- | --- |
| `adaptation-brief.v1` | Yes | Immutable accepted revisions | Yes from same ContextPack, but accepted choice must be retained |
| `character-bible.v1`, `environment-bible.v1` | Yes | Project-level, immutable versions with explicit successor | Yes; never overwrite references used by accepted pages |
| `manga-plan.v1` | Keep current | Existing accepted artifact | Yes, but do not mutate |
| `page-script-set.v1` | Yes | Immutable child of plan | Yes before downstream acceptance |
| `thumbnail-set.v1` | Yes | Immutable; every repair creates a successor | Yes; cheap |
| `page-layout.v1` + `compiled-layout.v1` | Yes | Authored tree and compiler output separately hashed | Compiled geometry is exactly reproducible from tree + engine version |
| `panel-generation-spec.v1` | Yes | Exact request intent | Yes |
| `image-attempt.v1` | Yes | One artifact per attempt; exact request and receipt | Metadata yes; pixels only replayable from stored accepted bytes |
| `asset-set.v2` | Yes | References accepted attempts only | Yes from accepted attempt records |
| `page-composition.v2` | Yes | Immutable scene graph/layers | Exactly reproducible |
| `validation-report.v1` | Yes | Reviewer/version/thresholds recorded | Deterministic part yes; model review may vary |
| `revision-request.v1` | Yes | Append-only state transitions or immutable successors | N/A |
| `rendered-page.v2` | Yes | Accepted canonical reader artifact | Exactly renderable from accepted inputs |

Initially, these can remain `ArtifactDoc` rows with new `ArtifactKind` enum
values and schema versions. Add a dedicated `ImageJobDoc` only if asynchronous
provider polling and lease/retry state cannot be represented safely by
`StageRunDoc`. Do not create a collection for every artifact type.

Every artifact needs:

- `project_id`, `run_id`, `stage_run_id`, `artifact_id`, kind/schema version;
- parent artifact IDs and content hash;
- author `agent | human | system`, creation timestamp, and supersedes ID;
- source fact/unit references where the artifact carries story claims;
- acceptance state separate from generation success.

### 6.3 Migration and compatibility

1. Add new schema versions; never rewrite current accepted v1 rows.
2. Add `pipeline_version` to project/run reader metadata and route accepted v1
   pages through the current legacy adapter.
3. New projects behind `MANGA_PAGE_DSL_V2` use v2 artifacts and a
   composition-aware renderer.
4. The reader endpoint may temporarily return a discriminated `v1 | v2` page
   union inside a versioned envelope, or expose a new `manga-reader.v2` endpoint.
   Prefer the latter if adding the union would weaken current generated types.
5. Do not auto-“upgrade” v1 one-panel pages into invented multi-panel v2 pages.
   Regeneration is an explicit new run that references the old run as lineage.
6. Keep `MangaManifest` stable for Utkarsh unless v2 pages require a documented
   additive field. Request a contract change with consumer and fixture example;
   do not fork reel types in this lane.

## 7. Proposed orchestrator goals and domain tools

The current runtime already declares future composition tool names, but the
backend implements only the Director set. Expand by goal, not by granting one
worker every tool.

### 7.1 Goal boundaries

| Goal | Required submission | Allowed tools |
| --- | --- | --- |
| `MANGA_DIRECTION` | `submit_manga_plan` | Current five read/submit/conflict tools; optionally submit bibles |
| `MANGA_PAGE_WRITING` | `submit_page_script_set` | Get accepted plan/context/bibles, submit scripts, report conflict |
| `MANGA_THUMBNAIL` | `submit_thumbnail_set` | Get scripts/assets, validate layout draft, request preview, submit thumbnails |
| `MANGA_ASSET_PLANNING` | `submit_asset_request_set` | Get accepted thumbnail/reference metadata, estimate budget, submit requests |
| `MANGA_COMPOSITION_REPAIR` | `submit_composition_patch` | Get composition + validation issues + approved assets, preview patch, submit patch |
| `MANGA_EDITOR_REVIEW` | `submit_editor_report` | Read accepted candidates and previews only; no image generation or approval bypass |

Use new bounded sessions for each goal. A goal should receive only the minimum
parent artifact snapshots and tool allowlist it needs.

### 7.2 Tool contracts

| Tool | Inputs | Output | Validation/persistence | Failure/retry behavior |
| --- | --- | --- | --- | --- |
| `get_book_context` | `project_id`, `run_id`, bounded section/query | Source excerpts, fact IDs, memory/version, response hash | Ownership, active stage, context token/byte ceiling; read-only trace | No automatic widening; return typed `CONTEXT_LIMIT` |
| `get_manga_canon` | accepted plan/bible IDs | Minimal accepted canon + hashes | Artifact must belong to project/run lineage | Stale ID returns `ARTIFACT_VERSION_CONFLICT` |
| `submit_page_script_set` | typed `PageScriptSet` | candidate ID + deterministic issue list | Schema, source facts, page/word/panel budgets; immutable candidate | Up to policy repair limit; agent resubmits complete or patch form |
| `validate_layout_draft` | page ID + layout tree + reading edges | compiled low-res geometry summary, SVG preview ID, issue list | Pure compiler; no acceptance; preview persisted as diagnostic | Same input hash is idempotent; invalid geometry is non-retryable until changed |
| `submit_thumbnail_set` | scripts + layout trees + panel intents + text intents | candidate thumbnail ID | Parent hashes, coverage, rhythm/text preflight, immutable artifact | Return addressable issue codes/paths; bounded repairs |
| `estimate_asset_budget` | accepted thumbnail ID + requested purposes/models | itemized upper bound | Read-only allowlist/pricing snapshot | Fail closed if price/model capability unknown |
| `submit_asset_request_set` | panel specs, references, prompt snapshots, max cost | accepted request-set ID or issues | Source/project refs, prompt policy, dimension/model limits, total budget reservation | No provider call in submission; conflicts are repairable |
| `request_image_generation` | accepted request ID, idempotency key | image job ID/status | Celery/backend only; provider allowlist, reserved cost, immutable request | Provider retry policy only; never agent-controlled unbounded loop |
| `get_image_job_result` | job ID | accepted/rejected output metadata, preview ID, receipt, issues | Redacts storage internals; project/run authorization | Pending returns typed state and next poll floor |
| `request_panel_revision` | failed attempt ID + typed revision + preserve list + max cost | revision job ID | Must reference failed QA and stay within repair/cost budget | Max attempts per panel; then `HUMAN_REVIEW_REQUIRED` |
| `submit_page_composition` | compiled layout ID + selected assets + text layer intents | candidate composition ID + renderer preflight | Exact asset lineage, layer/mask/transform limits, text IDs | Invalid candidate is persisted as rejected evidence, not published |
| `render_page_preview` | candidate composition ID, scale | preview asset ID + render metrics | Deterministic renderer only; bounded dimensions | Same inputs return same artifact; renderer errors are typed |
| `get_page_validation_report` | candidate/preview ID | deterministic and model issue list | Report versions and thresholds persisted | Read-only; never changes acceptance |
| `submit_composition_patch` | target ID + allowed JSON Patch-like ops | successor candidate ID | Patch paths allowlisted; parent remains immutable | Reject broad/unsafe patch; budgeted repair count |
| `approve_page` | accepted candidate ID + validation report IDs | accepted `RenderedPageV2` ID | Backend verifies all hard gates and role policy | Tool cannot override an error; returns blocker list |

`request_image_generation` is intentionally not “arbitrary image tool access.”
Pi chooses when a valid, accepted request should run; the control plane owns the
provider invocation and cost.

### 7.3 Safeguards

- Goal-specific allowlists and one required submission tool.
- Active project/run/stage authorization on every call, as the Director service
  already enforces.
- Idempotency key derived from parent hashes + normalized request + model policy.
- Per-run, per-page, and per-panel dollar/attempt reservations before execution.
- Maximum output bytes and no raw filesystem paths/URLs in tool responses.
- Exact provider/model allowlist and capability record (seed, references,
  masks, aspect ratios).
- Prompt-injection defense: source text is data, never system/tool policy.
- Separate reviewer goal/model where practical; the creator cannot self-certify
  hard acceptance.
- Durable trace of started/succeeded/failed tool calls and accepted artifacts.

## 8. Rendering and composition design

### 8.1 Layout compiler

Implement one deterministic compiler shared by fixtures/test vectors:

1. Start from page trim or bleed polygon.
2. Recursively apply `split` nodes using ratios, gutter, and optional angle.
3. Clip children to their parent polygon.
4. Apply explicit overlay/inset boxes and z-order.
5. Validate minimum panel area/edge length and accidental intersections.
6. Emit `CompiledPanelGeometry` containing normalized polygon, bbox, clip path,
   bleed edges, adjacency, and computed read-rank.
7. Validate the authored reading DAG against geometric expectations for RTL/LTR.
8. Hash source tree + engine version + canvas settings.

Backend Python and frontend TypeScript implementations should consume shared
golden fixtures. For the first slice, make Python authoritative and export
compiled polygons; the frontend should render those polygons rather than
reimplement non-trivial angled cutting immediately.

### 8.2 Layer model

Each panel should render a deterministic scene graph:

```text
panel clip/mask
  z=0   background color/texture
  z=5   environment asset(s)
  z=10  generated full-panel or subject assets with crop/transform
  z=20  foreground/prop/sprite layers
  z=30  motion lines, screentone, atmospheric effects
  z=40  speech/thought/narration bubbles and tails
  z=50  SFX and deliberate border-breaking effects
  z=60  accessibility/editor overlays (not exported)
```

Asset transforms require crop mode, normalized position, scale, rotation,
opacity, blend mode allowlist, mask asset, and focal-point preservation. Do not
store arbitrary CSS or executable SVG.

### 8.3 Lettering and bubbles

1. Shape text with the actual licensed font and requested writing direction.
2. Generate candidate bubble rectangles/ellipses near `preferred_region`.
3. Penalize overlap with faces/focal/avoid regions, other text, panel borders,
   and future eye-path targets.
4. Size and reflow within min/max font bounds.
5. Route a tail to the declared target without crossing text or another bubble.
6. If no legal solution exists, obey `overflow`: reflow, split, or reject. Never
   silently truncate accepted story text.
7. Render narration, thought, dialogue, monologue, and SFX as different typed
   elements with design tokens, not one generic black box.

Use SVG for the canonical editable composition/preview because clip paths,
text, tails, and layer IDs remain addressable. Export PNG/WebP for delivery and
retain the SVG/scene graph as the editable artifact. The web reader can render
the trusted compiled scene graph or use the canonical raster with an accessible
text layer; choose one in Phase 2 after performance testing.

The visual implementation must continue to consume `@scrollstack/design-tokens`
and the selected source direction under `/Users/comreton/Downloads/Book-Reel
Design System`. Translate any remaining manga-specific paper, ink, gutter,
lettering, and motion decisions into shared tokens; do not copy ad hoc values
into individual panels.

### 8.4 What to do with missing art

Never render private prompt/action prose as the panel's final visual content.
Development previews may show clearly labeled thumbnail boxes or silhouettes.
Publication acceptance requires an approved visual asset or an explicitly
designed deterministic motif/texture for every visual panel.

## 9. Validation and revision strategy

### 9.1 Deterministic validation

Run these before expensive generation where possible:

- schema version, stable unique IDs, artifact lineage, project/run ownership;
- source-unit/fact coverage and no dangling character/location/asset references;
- layout tree acyclic, ratios/children valid, angle/range limits, polygons in
  page, legal explicit overlaps, minimum area, margins/safe/bleed rules;
- reading DAG contains every panel exactly once, is acyclic, and begins/ends at
  intended panels; page-turn anchor is last;
- page/panel/dialogue/narration/SFX budget and configurable text-density limits;
- actual font shaping, text fit, minimum font size, bubble/panel collisions,
  tail-to-speaker target, and no silent overflow;
- asset bytes/hash/MIME/dimensions, project ownership, prompt snapshot and
  receipt presence, transform/mask limits;
- all required panel assets complete and selected attempt accepted;
- repeated-layout fingerprint, repeated shot runs, repeated narration-region
  coordinates, and repeated camera/subject centroid across adjacent pages;
- perceptual hash for near-duplicate images and identical crop reuse;
- budget reserved/spent consistency and retry ceiling;
- deterministic render hash and no external runtime fetches.

Do not make “at least three panels per page” a universal validator. Diversity
is evaluated across a sequence; a deliberate splash is valid.

### 9.2 Model-assisted validation

A separate vision/editor goal receives low-resolution previews plus the exact
panel/page intent and returns `validation-report.v1`, never unstructured praise.
It should evaluate:

- prompt/beat compliance and missing required visual information;
- character identity, clothing, props, location, time-of-day, and emotional
  continuity against approved references;
- whether pose, expression, camera, focus, and movement match the panel plan;
- whether sequential panels are excessively similar despite different beats;
- whether eye flow, pacing, emphasis, and page-turn payoff read as intended;
- whether generated text/watermarks/artifacts pollute image layers;
- whether narration/dialogue is redundant with the visible action.

Each issue needs code, severity, artifact/panel/text ID, evidence region,
confidence, and allowed repair scopes. Model review cannot waive deterministic
errors.

### 9.3 Revision policy

- Prefer the smallest repair: lettering -> crop/transform -> one asset -> one
  panel plan -> one layout subtree -> one page script.
- Never regenerate the whole manga because one bubble collides.
- Persist failed attempts and their receipts; do not include them in accepted
  asset sets.
- Default caps for the proof slice: two asset retries per panel, two layout/text
  repairs per page, one editor-review retry, then human review.
- A revision records `preserve` constraints to prevent identity/composition
  regressions.
- Re-run deterministic checks after every patch and vision review only when the
  changed scope could affect its findings.

### 9.4 Acceptance criteria for a page

A page is accepted only when:

1. all referenced parents are accepted and immutable;
2. no deterministic error remains;
3. all intended source facts/beats are represented;
4. every visual panel has an approved visual asset or approved deterministic
   visual layer;
5. all text shapes at or above minimum size with correct speaker/tail mapping;
6. reading order and page-turn anchor pass;
7. required vision issues are cleared or explicitly sent to human review;
8. exact scene graph and export hashes are persisted;
9. cost and receipt records reconcile;
10. it improves sequence diversity rather than repeating the preceding page.

## 10. Reuse, refactor, replace, and migrate

### Reuse directly

- ScrollStack ingestion, sources, scopes, ContextCompiler, ProjectMemory,
  repository adapters, GenerationRun/StageRun, artifact hashing/lineage.
- Worker authentication, Pi sealed runtime, policy budgets, tool-call trace,
  domain broker client, and repository-owned skills pattern.
- OpenRouter model registry/image gateway and immutable media storage.
- Contract generation and canonical fixture machinery.
- Reader routing, API polling/failure projection, and design tokens.

### Wrap or extend

- Wrap the existing image gateway in typed image-job authorization and persist
  exact prompt/reference/parameter snapshots.
- Split `GenerationWorkflowService.execute` into explicit page-writing,
  thumbnail, preflight, asset, composition, review, and acceptance stage helpers.
- Generalize `MangaDirectorToolService` into goal-specific services sharing the
  existing authorization/size/lineage guard.
- Extend artifact kinds and reader service for v2 without weakening v1 reads.

### Selectively port from `/Volumes/Mrigesh SSD/Book-Reel`

Useful concepts and validators exist in:

- `backend/app/manga_pipeline/stages/storyboard_stage.py` — script-to-thumbnail
  separation, panel purpose/composition/source facts;
- `stages/page_composition_stage.py` — slice-level rhythm, page-turn intent,
  explicit placements;
- `manga_dsl.py`, `dsl_validation_stage.py`, and
  `rtl_composition_validation_stage.py` — issue codes, source coverage, shot and
  RTL checks;
- `quality_gate_stage.py`, `quality_repair_stage.py`, and
  `services/manga/quality_service.py` — common typed issue stream and repair loop;
- `frontend/components/MangaReader/page_layout.ts` — consume persisted
  composition rather than re-derive it;
- `frontend/components/MangaReader/MangaPageRenderer.tsx` — separate page and
  panel rendering with explicit placements and layer inputs.

Port ideas and tests, not the old architecture wholesale. The old code still
falls back to fixed grids, uses flat rectangles, sometimes replaces an entire
storyboard on repair, and has rigid panel-count heuristics. It lacks recursive
cuts, polygon clips, full text kinds, prompt-attempt lineage, and v2 revision
patches.

### Replace

- `MangaProductionService.compose_rendered_pages`, `_shot_type`, and
  `_page_composition` as the production v2 path.
- The frontend's shot-type layout mapping, fixed narrator/bubble anchors, fixed
  six-column page grid, and text-as-art placeholder.
- “Two selected key panels plus prose placeholders” as an accepted page policy.

## 11. Recommended first vertical slice

Build a **two-page mini-sequence** from the already accepted plan and source
facts in `project_de1f684e5e17fea3ebaadfef`. Do not run all ten pages.

Implemented source-grounded sequence:

- **Page A, four panels:** local/global trade-off map -> a Woodstock company
  operating entirely online -> the nearby local absence -> global growth beyond
  the quiet town.
- **Page B, three panels:** an open Singapore door fills with local requests ->
  exhaustion leaves globally useful work unfinished -> worldwide readers ask
  about the silence and the narrator admits, "I'm not local." The last panel is
  visually dominant.

The earlier suggested "invitation expires at night" beat was rejected during
implementation because it is not present in the accepted MangaPlan or selected
source evidence. The persisted proof uses only the accepted locality beats.

The slice must prove:

1. an accepted `page-script-set.v1` with page entry/exit states and short,
   purposeful narration/dialogue;
2. an accepted `thumbnail-set.v1` with two different hierarchical layout trees,
   explicit reading edges, camera/blocking, text regions, and page-turn anchors;
3. deterministic compilation to polygon/bbox geometry and two SVG thumbnail
   previews before image generation;
4. at least three distinct approved panel images plus reuse of an existing
   semantically suitable key-panel asset, with exact attempt metadata;
5. fitted dialogue/narration/SFX elements in more than one placement and at
   least one tail bound to a speaker/subject;
6. one deliberately rejected attempt and targeted revision fixture (the live
   paid proof may simulate the rejection with a stored test fixture if avoiding
   extra spend);
7. deterministic final SVG + PNG/WebP for each page and a reader view that
   consumes the compiled composition rather than shot-derived classes;
8. deterministic validation plus one typed model-assisted report behind a
   configurable budget/feature flag;
9. v1 reader compatibility for the current project.

Why two pages: one page proves geometry, but not sequence rhythm or page-turn
payoff. Two pages are still narrow enough to cap cost and debug every artifact.

### Slice cost guard

- Reuse current accepted images only when their beat/crop passes the new spec.
- Default to three new panel generations, at most one paid retry each, and fail
  closed if the estimated maximum exceeds an explicitly configured slice cap.
- Thumbnail previews and composition previews must be deterministic and free of
  image-model calls.

## 12. Implementation phases

### Phase 0 — lock ADR and contracts before provider work

**Goal:** make the v2 boundary explicit and keep v1 compatible.

Likely files:

- `docs/adr/009-manga-page-dsl-v2.md` (new)
- `backend/app/contracts/manga.py`
- `backend/app/contracts/artifacts.py`
- `backend/app/contracts/agent.py`
- `packages/contracts/scripts/generate-contracts.py`
- `packages/fixtures/canonical/`
- `technical-imp.md` sections 9, 12, 19, 22, 23

Tests:

- canonical normal/action/splash/revision fixtures validate in Pydantic and Ajv;
- invalid cycles, ratios, polygons, reading graphs, references, and unsafe extra
  properties fail in both languages;
- existing 18 schemas/fixtures and v1 reader tests remain green.

Completion: schemas, fixtures, ADR, migration policy, and generated TypeScript
are reviewed before workflow implementation.

### Phase 1 — page scripts, thumbnails, and layout compiler

**Goal:** reach accepted SVG name previews without image calls.

Likely files:

- `backend/app/services/manga_page_planning.py` (new)
- `backend/app/services/manga_layout.py` (new)
- `backend/app/services/manga_validation.py` (new)
- `backend/app/services/domain_tools.py` or split `domain_tools/` modules
- `backend/app/services/generation_workflow.py`
- `apps/agent-worker/src/skills/manga-page-writing/SKILL.md` (new)
- `apps/agent-worker/src/skills/manga-thumbnail/SKILL.md` (new)
- `packages/agent-runtime/src/types.ts`, `policies.ts`, `tool-adapter.ts`

Tests:

- recursive split compiler golden polygons and hashes;
- RTL/LTR reading DAG, angled split clipping, inset overlap, splash exception;
- source coverage, page rhythm, text budget, repeated-layout warnings;
- domain tool ownership, stage identity, byte cap, idempotency, repair cap;
- restart between page-script and thumbnail stages resumes from Mongo artifacts.

Completion: the exact project's selected two-page sequence has persisted script,
thumbnail, compiled layout, validation report, and SVG previews with zero image
spend.

### Phase 2 — image jobs, scene graph, lettering, renderer

**Goal:** produce canonical composed pages from approved assets and text.

Likely files:

- `backend/app/services/image_jobs.py` (new or extracted)
- `backend/app/services/manga_renderer.py` (new)
- `backend/app/services/manga_lettering.py` (new)
- `backend/app/services/manga_production.py` (retain v1; add/route v2 service)
- `backend/app/services/manga_reader.py`
- `frontend/lib/api.ts`
- `frontend/lib/reader-adapter.ts` (replace the fixture-located production adapter)
- `frontend/components/MangaReader/` non-reel files

Tests:

- idempotent provider request, exact prompt snapshot, cost reservation/reconcile;
- reference ownership, failed-attempt retention, retry cap, accepted asset set;
- text shaping/overflow fixtures, collision/tail routing, z-order/mask limits;
- deterministic SVG and raster hash fixtures;
- frontend renders compiled geometry and no production action prose placeholder;
- current `rendered-page.v1` project still loads unchanged.

Completion: two pages render from the scene graph in backend artifact exports and
the frontend, with no fixed text anchors or shot-derived layout.

### Phase 3 — QA and targeted revisions

**Goal:** reject and repair a bad panel/page without restarting the sequence.

Likely files:

- `backend/app/services/manga_review.py` (new)
- `backend/app/services/manga_revisions.py` (new)
- `backend/app/services/generation_workflow.py`
- reviewer skill and goal policy under `apps/agent-worker/` and
  `packages/agent-runtime/`

Tests:

- deterministic issue fixtures for overlap, overflow, duplicate layout,
  duplicate image, bad reading order, wrong asset, missing receipt;
- typed vision report validation and creator/reviewer separation;
- JSON Patch allowlist, immutable predecessor, revalidation scope, cost ceiling;
- restart after rejected attempt resumes from stored issue/revision artifacts.

Completion: an intentionally bad panel is rejected, one bounded repair succeeds,
and only affected downstream artifacts receive successor versions.

### Phase 4 — golden acceptance, editor affordances, and observability

**Goal:** prove the mini-sequence and leave edit-ready artifacts.

Likely files:

- reader/editor inspection UI in Mrigesh-owned manga paths;
- run/stage API projections and evidence docs;
- canonical examples and screenshot fixtures.

Tests/evidence:

- desktop/mobile RTL and vertical reader screenshots;
- keyboard/focus/touch/reduced-motion/overflow/contrast checks;
- restart payload identity and artifact lineage audit;
- cost/token/latency report by stage and rejected attempt;
- side-by-side current v1 versus v2 pages for the exact book/source facts.

Completion: a reviewer can inspect page script, thumbnail, layout, chosen assets,
text placements, QA issues, revisions, and final page rather than only an opaque
PNG.

## 13. Risks and unresolved questions

| Risk/question | Consequence | Recommended handling |
| --- | --- | --- |
| Image provider may not support deterministic seeds or strong reference conditioning | Pixel regeneration and identity consistency vary | Record capability per model; persist exact accepted bytes; test reference support before promising character consistency |
| More stages increase latency and token use | Hackathon flow could feel slow | Cheap script/name preflight first; parallelize independent accepted panel jobs; two-page proof; show stage progress |
| Agent/tool orchestration becomes complex | Hidden state and runaway retries | Celery owns transitions; goal-specific tools; artifact-driven resume; hard budgets and attempt caps |
| Model reviewer may agree with its own generation | False acceptance | Separate reviewer goal/model when possible; deterministic blockers cannot be overridden; retain human-review state |
| Font licensing and vertical text shaping are unresolved | Export may differ by platform or be legally unsafe | Select and vendor a licensed manga font; test shaping in the chosen renderer before Phase 2 |
| SVG scene graph versus backend raster as reader source | Performance/security/editability trade-off | Keep SVG/scene graph canonical; benchmark trusted compiled SVG and raster+accessible overlay on mobile |
| Double-page spreads increase reader/layout complexity | Scope expansion before core proof | Include schema kinds now, but defer rendering spreads until standard/splash pages pass |
| Nonfiction essay adaptation lacks a natural cast | Dialogue may feel forced or didactic | Make narrator/avatar/motif choices explicit in AdaptationBrief; allow visual metaphor and sparse narration; do not invent source claims |
| Existing images may not satisfy new crops/reserved text zones | Reuse can degrade composition | Treat reuse as a candidate that must pass the same panel spec; regenerate only when it fails |
| v2 artifact kinds expand shared contracts | Potential reel consumer impact | Keep manifest seam stable or make additive, fixture-backed changes only; coordinate before touching shared enum consumers |
| Human editing UI is not in the proof slice | Schema could become hard to edit later | Stable node/text/layer IDs, immutable revisions, JSON Patch-like operations, canonical SVG from day one |
| “Manga feel” is partly subjective | Gates may optimize superficial variety | Combine measurable repetition/readability checks with typed editor review and exact sequence acceptance evidence |
| Prompt snapshot persistence may expose source text | Sensitive data risk | Store under project authorization; redact logs/tool responses; never put prompts in public asset URLs |

Questions that require a product decision before Phase 2:

1. Is the hackathon default page canvas web-only, or should trim/bleed target a
   printable standard? The schema supports both, but one canonical preset is
   needed.
2. Which licensed fonts and languages must vertical writing support in the demo?
3. Which configured image model supports the best reference-image conditioning,
   crop/aspect control, and optional masks at the acceptable cost?
4. Is the narrator represented as a recurring character, a documentary voice,
   or an abstract visual motif for this nonfiction book?
5. Does page acceptance require a separate vision model now, or is a human
   review gate acceptable for the hackathon proof after deterministic checks?
6. Should `manga-reader.v2` return the scene graph, canonical raster URLs plus an
   accessible text layer, or both?

## 14. Exact next-session task list

Phase 0 and the Phase 1 proof/service slice are complete in this worktree. The
next session should review/commit this patch, then wire the two stages into the
production workflow behind an explicit v2 gate before considering Phase 2. Do
not spend on images until that activation path and its workflow/API tests pass.

### Before editing

- [x] `cd "/Volumes/Mrigesh SSD/ScrollStack-manga"`
- [x] Read `AGENTS.md`, this file, `technical-imp.md` sections 9, 12, 19, 22,
      and 23, and `docs/evidence/mrigesh-core-golden-path-2026-07-21.md`.
- [x] Run `git status --short --branch`, `git rev-parse HEAD`, and inspect the
      diff. Preserve user changes and do not touch Utkarsh's reel paths.
- [x] Confirm the active branch remains Mrigesh's isolated lane; do not recreate
      or overwrite the old worktree.
- [x] Do not start a new paid run for the existing project.

### Contracts and ADR

- [x] Add ADR-009 defining hierarchical layout JSON, agent/control-plane split,
      v1 compatibility, and artifact-driven resume.
- [x] Add Pydantic contracts for `PageScriptSet`, `MangaPagePlan`, layout-node
      union, compiled geometry, text elements, validation issue/report, revision
      request, generation attempt, and `RenderedPageV2`/reader strategy.
- [x] Extend `ArtifactKind` intentionally and audit every exhaustive TypeScript
      consumer before generating schemas.
- [x] Add canonical JSON fixtures for the normal, action, splash, and revision
      examples; add invalid cycle/ratio/overlap/order/text/reference fixtures.
- [x] Export deterministic JSON Schema and generated TypeScript.

### Layout compiler and preview

- [x] Implement an authoritative pure-Python recursive layout compiler with no
      provider or database dependency.
- [x] Emit normalized polygons, bboxes, clip paths, adjacency, read ranks, and a
      compiler hash/version.
- [x] Implement deterministic SVG thumbnail preview using only boxes, arrows,
      rough subject silhouettes, focal/avoid zones, and text placeholders.
- [x] Add geometry and reading-order golden tests for RTL/LTR, angled split,
      inset, splash, margins, and invalid accidental overlap.

### Page-writing and thumbnail goals

- [x] Add `MANGA_PAGE_WRITING` and `MANGA_THUMBNAIL` policies and sealed skills.
- [x] Implement goal-specific backend domain tools using the current Director
      authorization, response-size, source-provenance, and immutable-submission
      patterns.
- [x] Persist accepted page scripts, thumbnail trees, compiler output, preview,
      and deterministic validation report.
- [x] Make repair responses addressable by issue code and JSON path/node ID.
- [x] Add restart test: kill/recreate service objects between accepted script and
      thumbnail; continue solely from repository artifacts.

### Exact proof artifact

- [x] Use the accepted plan and source facts for
      `project_de1f684e5e17fea3ebaadfef` to author the two-page sequence from
      Section 11 without a new image call.
- [x] Persist two different layout trees and two SVG name previews.
- [x] Review the previews for page rhythm, eye path, page-turn payoff, text
      reserve, and non-repeated narrator position before enabling Phase 2.
- [x] Record artifact IDs, hashes, validation results, model receipt if an agent
      was used, and exact zero image cost for this phase.

### Tests and commands

```bash
cd "/Volumes/Mrigesh SSD/ScrollStack-manga/backend"
uv run pytest tests/ -q
uv run ruff check .
uv run mypy app tests

cd "/Volumes/Mrigesh SSD/ScrollStack-manga"
corepack pnpm contracts:generate
git diff --exit-code -- packages/contracts/schema packages/contracts/src/generated
corepack pnpm --filter @scrollstack/contracts test
corepack pnpm --filter @scrollstack/agent-runtime test
corepack pnpm --filter @scrollstack/agent-worker test
corepack pnpm check
docker compose --env-file .env.example config --quiet
zsh -n start.sh
zsh -n stop.sh
git diff --check
```

Add focused commands as packages expose them, but do not use a broad green root
check to hide a missing geometry or restart test.

### Phase 1 stop condition

Stop before image generation unless a fresh process can reconstruct and render
both SVG thumbnail previews solely from Mongo-backed accepted artifacts and all
of these are true:

- the two pages use different intentional hierarchical layouts;
- every panel has a page-script beat, camera/blocking, and source lineage;
- reading order and page-turn anchors are explicit and validated;
- dialogue/narration/SFX fit their planned regions without fixed anchors;
- repetition validators do not flag the current single-panel/narrator pattern;
- v1 reader tests for the current accepted project still pass;
- no reel-owned path changed.

## 15. Current validation status and session handoff

### What was done in this investigation

- Inspected the current branch/worktree and preserved its existing implementation.
- Read the live reader in vertical and RTL modes and inspected DOM/console state.
- Read Mongo project, run, stage, plan, asset, page, receipt, and memory records.
- Traced ingestion, context, Pi goal, domain tools, image generation, composition,
  reader projection, and frontend rendering code.
- Examined the predecessor Book-Reel storyboard/layout/quality/reader code for
  reusable patterns and limitations.
- Researched name/thumbnail workflows, page rhythm/eye path, hierarchical cuts,
  attention-aware composition, and balloon placement.
- Designed the versioned pipeline, DSL, tools, data model, renderer, validation,
  migration, phases, and first proof slice above.
- Added ADR-009 and additive Pydantic/JSON Schema/TypeScript contracts for page
  scripts, hierarchical page plans, thumbnails, compiled layouts, validation,
  revisions, image attempts, and `rendered-page.v2`; v1 remains intact.
- Added canonical and invalid cross-language fixtures. The registry now exports
  26 schemas, and Pydantic/Ajv semantic validation covers cycles, ratios,
  overlaps, reading order, text references, and source references.
- Implemented the pure recursive layout compiler, polygon clipping, stable
  geometry hashes, deterministic validators, and image-free SVG name renderer.
- Added page-writing/thumbnail goal policies, sealed skills, bounded tool
  schemas, project/stage authorization, the additive domain-tool dispatcher,
  durable planning services, and context compiler support for both new purposes.
- Added unit, cross-language, idempotency, wrong-stage/project, and fresh-service
  reconstruction tests. No reel-owned path changed.

### Persisted Phase 1 proof

The final proof was persisted against the accepted plan without a provider or
image-model call:

| Field | Value |
| --- | --- |
| Project | `project_de1f684e5e17fea3ebaadfef` |
| Source MangaPlan | `manga_plan_e7d7053c31186f72dbd9e4b6` |
| Proof run | `run_phase1_4fb3ad80a84860ed29f00d3e` |
| Pipeline | `manga-page-dsl-phase1-proof.v4` |
| PageScriptSet | `page_script_set_67ca466fd620cbdcd57aebeb` |
| ThumbnailSet | `thumbnail_set_40c94a97385fb26175caef78` |
| Validation report | `page_validation_17b269aaf1817c0f70516009` |
| Compiled layouts | `compiled_layout_ef63e77899e839bbc8c58498`, `compiled_layout_89e6be0daff52338f5ca1e7c` |
| Compiled hashes | `ef63e77899e839bbc8c58498ae0fb711583d4186509e6377d21ed5f5341fc1dc`, `89e6be0daff52338f5ca1e7c8f341f944999a05c4d5642563bc2e7f1b52871ec` |
| SVG previews | `thumbnail_preview_85e91e02cf112552753e7439`, `thumbnail_preview_b987acefcee6d6a7edf70d8b` |
| Preview hashes | `85e91e02cf112552753e7439ea6f22ea6a10d24f36a7be2a3e297c3688b46db9`, `b987acefcee6d6a7edf70d8bbedac49bc5245b187a726043a9f50f22419b76c5` |
| Validation | 10 accepted artifacts; 0 invalid; both stages succeeded |
| Replay | Idempotent rerun returned the same IDs and hashes |
| Fresh reconstruction | Passed from a new repository/service instance using Mongo artifacts |
| Model receipt | `null` — the proof was authored deterministically, not by a model |
| Image artifacts/cost | 0 / `$0` |

Visual review accepted the Phase 1 planning intent: Page A uses a measured
top/split/bottom four-panel rhythm; Page B uses an angled two-panel lead-in and
a dominant payoff panel. Both expose explicit eye-path arrows, text reserves,
camera labels, rough blocking, and focal/avoid regions. These are name previews,
not finished manga art.

### Verification completed on 2026-07-21

- Backend: `70 passed`; Ruff clean; mypy clean across 52 source files.
- Contracts: 26 generated schemas current; 36 fixture/semantic tests passed.
- Agent runtime: 10 tests passed; agent worker: 12 tests passed.
- Root `corepack pnpm check` passed, including TypeScript typechecks.
- Compose config, `start.sh`/`stop.sh` syntax, `git diff --check`, and the
  reel-path ownership audit passed.
- The handoff's `git diff --exit-code` check is expected to be non-zero against
  HEAD because this patch intentionally adds generated contracts. The stronger
  currentness gate, `pnpm --filter @scrollstack/contracts check:generated`,
  passed after regeneration.

### Contract impact

The changes are additive: new v2 planning/render contracts and artifact kinds,
plus optional artifact lineage metadata. Existing `rendered-page.v1`, its
fixtures, and current reader behavior remain unchanged. Shared generated types
were regenerated and all existing consumers typechecked. No reel contract or
reel-owned file was edited.

### Honest limitations

- The stored raw Pi transcript was not treated as a source of truth beyond its
  accepted plan/tool artifacts and persisted receipt.
- The exact prompts for the two existing image calls cannot be proven from the
  database because only prompt hashes/versions were persisted; current code can
  reconstruct what it would build, but code drift prevents exact historical
  replay.
- Visual inspection covered the existing persisted desktop reader, not a fresh
  upload, new paid run, exhaustive mobile/accessibility pass, or the proposed v2
  output.
- Model-specific seed, reference-image, mask, and vision-review capabilities
  still require a small provider capability test before Phase 2.
- `GenerationWorkflowService.execute()` still runs only the v1 route. Before
  Phase 2, add an explicit `manga-page-dsl.v2` gate that compiles fresh planning
  contexts, runs `manga_page_writing` then `manga_thumbnail`, and stops before
  asset generation. Add router/container and full workflow tests for that path.
- The proof script is a deterministic acceptance harness, not an API endpoint or
  replacement for the gated production workflow.

### Ownership reminder

Mrigesh owns `backend/`, `apps/agent-worker/`, `packages/agent-runtime/`,
`packages/contracts/`, `packages/fixtures/`, `packages/design-tokens/`, manga and
shared frontend surfaces, global styling, root workspace files, and Compose.

Do not edit Utkarsh-owned `reel-renderer/`, `packages/reel-components/`,
`frontend/app/**/reels/`, or `frontend/components/ReelFeed/`. Cross-lane changes
must use reviewed contracts, fixtures, and shared tokens.
