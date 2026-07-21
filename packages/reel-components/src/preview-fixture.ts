import type { MangaManifest, ReelSpec } from "@scrollstack/contracts";

import { compileReel } from "./compile";
import type { ReelCompilationInput, ResolvedReelAsset } from "./types";

const sourceRef = {
  book_id: "book_preview",
  source_unit_id: "unit_preview",
  page_start: 1,
  page_end: 2,
  text_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
} as const;

const PAPER = "#efe7d7";
const INK = "#14100c";

/** Radiating speed lines, the manga shorthand for focus and momentum. */
function speedLines(cx: number, cy: number, count: number, inner: number, outer: number): string {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + (index % 2) * 0.04;
    const width = index % 3 === 0 ? 15 : 7;
    const x1 = cx + Math.cos(angle) * inner;
    const y1 = cy + Math.sin(angle) * inner;
    const x2 = cx + Math.cos(angle) * outer;
    const y2 = cy + Math.sin(angle) * outer;
    return `<path d="M${x1.toFixed(0)} ${y1.toFixed(0)} L${(x2 - width).toFixed(0)} ${y2.toFixed(0)} L${(x2 + width).toFixed(0)} ${y2.toFixed(0)}Z" fill="${INK}"/>`;
  }).join("");
}

/** Diagonal ink hatching, used where a flat fill would read as empty. */
function hatching(x: number, y: number, w: number, h: number, step: number): string {
  return Array.from({ length: Math.ceil((w + h) / step) }, (_, index) => {
    const offset = index * step;
    return `<path d="M${x + offset} ${y} L${x + offset - h} ${y + h}" stroke="${INK}" stroke-width="3" fill="none"/>`;
  }).join("");
}

/**
 * Original artwork drawn in code: solid ink shapes only, because the inline-SVG
 * guard in the renderer rejects `url(` pattern and gradient references. Shading
 * comes from hatching here and from the Screentone overlay at render time.
 */
function mangaArt(variant: "figure" | "impact" | "vista" | "closeup"): string {
  switch (variant) {
    case "figure":
      // Lone silhouette against a low horizon, weight on the lower third.
      return [
        `<rect width="1080" height="1920" fill="${PAPER}"/>`,
        hatching(0, 0, 1080, 820, 26),
        `<path d="M0 1180 L1080 980 L1080 1920 L0 1920Z" fill="${INK}"/>`,
        `<ellipse cx="540" cy="700" rx="150" ry="150" fill="${INK}"/>`,
        `<path d="M470 830 L610 830 L660 1240 L420 1240Z" fill="${INK}"/>`,
        `<path d="M470 850 L360 1120 L410 1150 L500 900Z" fill="${INK}"/>`,
        `<path d="M610 850 L720 1120 L670 1150 L580 900Z" fill="${INK}"/>`,
      ].join("");
    case "impact":
      // Full-bleed burst: the panel that lands on a cut. Lines must be ink on
      // paper — ink on ink renders as an empty black frame.
      return [
        `<rect width="1080" height="1920" fill="${PAPER}"/>`,
        speedLines(540, 960, 44, 210, 1600),
        `<circle cx="540" cy="960" r="200" fill="${INK}"/>`,
        `<circle cx="540" cy="960" r="150" fill="${PAPER}"/>`,
      ].join("");
    case "vista":
      // Wide establishing shot: layered ridges receding into tone.
      return [
        `<rect width="1080" height="1920" fill="${PAPER}"/>`,
        `<circle cx="760" cy="520" r="190" fill="${INK}"/>`,
        `<circle cx="700" cy="470" r="190" fill="${PAPER}"/>`,
        `<path d="M0 1060 L300 820 L520 1010 L760 760 L1080 1030 L1080 1300 L0 1300Z" fill="${INK}"/>`,
        hatching(0, 1300, 1080, 320, 30),
        `<path d="M0 1620 L1080 1500 L1080 1920 L0 1920Z" fill="${INK}"/>`,
      ].join("");
    case "closeup":
      // Eye in shadow: the reaction beat.
      return [
        `<rect width="1080" height="1920" fill="${INK}"/>`,
        `<path d="M140 960 Q540 620 940 960 Q540 1300 140 960Z" fill="${PAPER}"/>`,
        `<circle cx="540" cy="960" r="185" fill="${INK}"/>`,
        `<circle cx="600" cy="900" r="52" fill="${PAPER}"/>`,
        hatching(140, 640, 800, 300, 22),
        `<path d="M120 720 Q540 460 960 720" stroke="${INK}" stroke-width="26" fill="none"/>`,
      ].join("");
  }
}

function panelAsset(assetId: string, variant: Parameters<typeof mangaArt>[0]): ResolvedReelAsset {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">${mangaArt(variant)}</svg>`;
  return {
    assetId,
    contentHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    kind: "image",
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    mimeType: "image/svg+xml",
    width: 1080,
    height: 1920,
  };
}

export const previewMangaManifest = {
  schema_version: "manga-manifest.v1",
  manga_id: "manga_preview",
  project_id: "project_preview",
  scope_id: "scope_preview",
  memory_version: 1,
  rendered_page_artifact_ids: ["artifact_rendered_preview"],
  beats: [
    {
      beat_id: "beat_preview",
      sequence: 0,
      source_refs: [sourceRef],
      required_fact_ids: ["fact_preview"],
      narrative_purpose: "reveal",
      book_essence: "The map preserves the route that everyone else forgot.",
      dramatization: "A strip of red ink appears under the lantern.",
      character_intent: [],
      visual_intent: ["Hard ink shadows and one red route."],
      must_preserve: ["The map preserves the forgotten route."],
      may_compress: [],
      confidence: 1,
    },
  ],
  panels: [
    {
      panel_id: "panel_preview_1",
      page_id: "page_preview_1",
      sequence: 0,
      beat_ids: ["beat_preview"],
      panel_type: "reveal",
      dialogue: [{ speaker_id: "character_kael", text: "This route was erased.", delivery: "hushed" }],
      narration: ["The map remembers what the crew forgot."],
      visual_asset_ids: ["asset_panel_preview_1"],
      crop_hints: [
        {
          crop_id: "crop_preview_1",
          box_pct: { x_pct: 18, y_pct: 24, width_pct: 64, height_pct: 52 },
          subject: "The red route",
        },
      ],
      emotional_tone: "revelatory",
      source_refs: [sourceRef],
    },
    {
      panel_id: "panel_preview_2",
      page_id: "page_preview_1",
      sequence: 1,
      beat_ids: ["beat_preview"],
      panel_type: "reaction",
      dialogue: [{ speaker_id: "character_mira", text: "Then somebody wanted it gone." }],
      narration: [],
      visual_asset_ids: ["asset_panel_preview_2"],
      crop_hints: [],
      emotional_tone: "uneasy",
      source_refs: [sourceRef],
    },
    {
      panel_id: "panel_preview_3",
      page_id: "page_preview_2",
      sequence: 2,
      beat_ids: ["beat_preview"],
      panel_type: "impact",
      dialogue: [{ speaker_id: "character_kael", text: "We follow it." }],
      narration: [],
      visual_asset_ids: ["asset_panel_preview_3"],
      crop_hints: [],
      emotional_tone: "decisive",
      source_refs: [sourceRef],
    },
    {
      panel_id: "panel_preview_4",
      page_id: "page_preview_2",
      sequence: 3,
      beat_ids: ["beat_preview"],
      panel_type: "cliffhanger",
      dialogue: [],
      narration: ["Beyond the erased line, the observatory waits."],
      visual_asset_ids: ["asset_panel_preview_4"],
      crop_hints: [],
      emotional_tone: "ominous",
      source_refs: [sourceRef],
    },
  ],
  character_asset_ids: [],
  art_direction_artifact_id: "artifact_art_direction_preview",
  content_hash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
} satisfies MangaManifest;

export const previewReelSpec = {
  schema_version: "reel-spec.v1",
  reel_id: "reel_preview",
  series_id: "series_preview",
  sequence: 0,
  manga_manifest_id: "artifact_manifest_preview",
  beat_ids: ["beat_preview"],
  format: { width: 1080, height: 1920, fps: 30, duration_frames: 390 },
  style_kit_id: "style_scrollstack_manga_v1",
  audio: { sfx_cues: [] },
  scenes: [
    {
      scene_id: "scene_panel_focus",
      start_frame: 0,
      duration_frames: 60,
      beat_ids: ["beat_preview"],
      scene_type: "panel_focus",
      component_id: "panel_focus",
      panel_id: "panel_preview_1",
      asset_id: "asset_panel_preview_1",
      focus_box_pct: { x_pct: 18, y_pct: 24, width_pct: 64, height_pct: 52 },
      motion_preset: "push_in",
      caption: "The map remembers what the crew forgot.",
    },
    {
      scene_id: "scene_split_panel",
      start_frame: 60,
      duration_frames: 60,
      beat_ids: ["beat_preview"],
      scene_type: "split_panel",
      component_id: "split_panel_reveal",
      panel_ids: ["panel_preview_1", "panel_preview_2"],
      divider_style: "jagged",
      reveal_order: "first_then_second",
    },
    {
      scene_id: "scene_dialogue_exchange",
      start_frame: 120,
      duration_frames: 90,
      beat_ids: ["beat_preview"],
      scene_type: "dialogue_exchange",
      component_id: "dialogue_exchange",
      panel_id: "panel_preview_2",
      dialogue: [
        { speaker_id: "character_mira", text: "Somebody erased this route." },
        { speaker_id: "character_kael", text: "Then it is the route we need." },
      ],
      bubble_motion: "pop",
    },
    {
      scene_id: "scene_impact_cut",
      start_frame: 210,
      duration_frames: 30,
      beat_ids: ["beat_preview"],
      scene_type: "impact_cut",
      component_id: "impact_cut",
      panel_id: "panel_preview_3",
      sfx_text: "GO",
      impact_preset: "ink_burst",
    },
    {
      scene_id: "scene_narrator_card",
      start_frame: 240,
      duration_frames: 60,
      beat_ids: ["beat_preview"],
      scene_type: "narrator_card",
      component_id: "narrator_card",
      text: "The forbidden route leads straight to the last observatory.",
      background_asset_id: "asset_panel_preview_4",
      text_preset: "ink_reverse",
    },
    {
      scene_id: "scene_page_turn",
      start_frame: 300,
      duration_frames: 30,
      beat_ids: ["beat_preview"],
      scene_type: "page_turn",
      component_id: "page_turn",
      from_panel_id: "panel_preview_3",
      to_panel_id: "panel_preview_4",
      direction: "rtl",
    },
    {
      scene_id: "scene_montage",
      start_frame: 330,
      duration_frames: 60,
      beat_ids: ["beat_preview"],
      scene_type: "montage",
      component_id: "panel_montage",
      panel_ids: ["panel_preview_1", "panel_preview_2", "panel_preview_3", "panel_preview_4"],
      layout_preset: "grid",
    },
  ],
  interaction_map: [{ beat_id: "beat_preview", start_frame: 0, end_frame: 390 }],
  source_refs: [sourceRef],
} satisfies ReelSpec;

const previewAssets = Object.freeze({
  asset_panel_preview_1: panelAsset("asset_panel_preview_1", "vista"),
  asset_panel_preview_2: panelAsset("asset_panel_preview_2", "figure"),
  asset_panel_preview_3: panelAsset("asset_panel_preview_3", "impact"),
  asset_panel_preview_4: panelAsset("asset_panel_preview_4", "closeup"),
});

export const previewReelCompilationInput: ReelCompilationInput = Object.freeze({
  spec: previewReelSpec,
  manga: previewMangaManifest,
  assets: previewAssets,
  captions: [],
});

export const previewCompiledReel = compileReel(previewReelCompilationInput);
