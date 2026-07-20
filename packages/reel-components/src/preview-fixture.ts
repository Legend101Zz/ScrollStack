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

function panelAsset(assetId: string, color: string, label: string): ResolvedReelAsset {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="1920" fill="${color}"/><path d="M0 1450 L1080 730 L1080 1920 L0 1920Z" fill="#16100c"/><text x="540" y="870" text-anchor="middle" fill="#fbf5e9" font-family="Arial" font-size="92" font-weight="700">${label}</text></svg>`;
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
  asset_panel_preview_1: panelAsset("asset_panel_preview_1", "#9f2815", "THE MAP"),
  asset_panel_preview_2: panelAsset("asset_panel_preview_2", "#665642", "THE WARNING"),
  asset_panel_preview_3: panelAsset("asset_panel_preview_3", "#d93b22", "THE CHOICE"),
  asset_panel_preview_4: panelAsset("asset_panel_preview_4", "#211812", "THE OBSERVATORY"),
});

export const previewReelCompilationInput: ReelCompilationInput = Object.freeze({
  spec: previewReelSpec,
  manga: previewMangaManifest,
  assets: previewAssets,
  captions: [],
});

export const previewCompiledReel = compileReel(previewReelCompilationInput);
