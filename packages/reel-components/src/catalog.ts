import type { ReelComponentId } from "./types";

export const REEL_COMPONENTS_VERSION = "0.1.0";
export const SCROLLSTACK_STYLE_KIT_ID = "style_scrollstack_manga_v1";

export type SafeZonePolicy = Readonly<{
  topPct: number;
  bottomPct: number;
  sidePct: number;
}>;

export type ReelComponentDefinition = Readonly<{
  componentId: ReelComponentId;
  version: string;
  description: string;
  propSchemaId: string;
  supportedAssetKinds: readonly ("image" | "audio" | "caption_track")[];
  defaultDurationFrames: number;
  minDurationFrames: number;
  maxDurationFrames: number;
  safeZones: SafeZonePolicy;
  motionPresets: readonly string[];
  previewFixtureId: string;
}>;

const SAFE_ZONES: SafeZonePolicy = Object.freeze({
  topPct: 10,
  bottomPct: 18,
  sidePct: 6,
});

function definition(
  value: Omit<ReelComponentDefinition, "version" | "safeZones">,
): ReelComponentDefinition {
  return Object.freeze({
    ...value,
    version: "1.0.0",
    safeZones: SAFE_ZONES,
    supportedAssetKinds: Object.freeze([...value.supportedAssetKinds]),
    motionPresets: Object.freeze([...value.motionPresets]),
  });
}

export const reelComponentCatalog: readonly ReelComponentDefinition[] = Object.freeze([
  definition({
    componentId: "panel_focus",
    description: "Single manga panel with deterministic crop and camera motion.",
    propSchemaId: "reel-spec.v1#/$defs/PanelFocusScene",
    supportedAssetKinds: ["image"],
    defaultDurationFrames: 90,
    minDurationFrames: 30,
    maxDurationFrames: 300,
    motionPresets: ["hold", "push_in", "pull_out", "pan_left", "pan_right"],
    previewFixtureId: "reel_component_panel_focus_v1",
  }),
  definition({
    componentId: "split_panel_reveal",
    description: "Two-panel reveal with a reviewed ink, clean, or jagged divider.",
    propSchemaId: "reel-spec.v1#/$defs/SplitPanelScene",
    supportedAssetKinds: ["image"],
    defaultDurationFrames: 90,
    minDurationFrames: 30,
    maxDurationFrames: 300,
    motionPresets: ["simultaneous", "first_then_second"],
    previewFixtureId: "reel_component_split_panel_reveal_v1",
  }),
  definition({
    componentId: "dialogue_exchange",
    description: "Panel-backed exchange with timed reviewed speech bubbles.",
    propSchemaId: "reel-spec.v1#/$defs/DialogueExchangeScene",
    supportedAssetKinds: ["image"],
    defaultDurationFrames: 150,
    minDurationFrames: 60,
    maxDurationFrames: 450,
    motionPresets: ["pop", "slide", "type_on"],
    previewFixtureId: "reel_component_dialogue_exchange_v1",
  }),
  definition({
    componentId: "impact_cut",
    description: "Short emphasis cut with deterministic manga impact effects.",
    propSchemaId: "reel-spec.v1#/$defs/ImpactCutScene",
    supportedAssetKinds: ["image"],
    defaultDurationFrames: 45,
    minDurationFrames: 12,
    maxDurationFrames: 120,
    motionPresets: ["flash", "shake", "speedlines", "ink_burst"],
    previewFixtureId: "reel_component_impact_cut_v1",
  }),
  definition({
    componentId: "narrator_card",
    description: "Typography-led narrative card with an optional resolved background.",
    propSchemaId: "reel-spec.v1#/$defs/NarratorCardScene",
    supportedAssetKinds: ["image"],
    defaultDurationFrames: 90,
    minDurationFrames: 30,
    maxDurationFrames: 300,
    motionPresets: ["paper_box", "ink_reverse", "chapter_card"],
    previewFixtureId: "reel_component_narrator_card_v1",
  }),
  definition({
    componentId: "page_turn",
    description: "Directional page turn between two resolved manga panels.",
    propSchemaId: "reel-spec.v1#/$defs/PageTurnScene",
    supportedAssetKinds: ["image"],
    defaultDurationFrames: 45,
    minDurationFrames: 12,
    maxDurationFrames: 120,
    motionPresets: ["rtl", "ltr"],
    previewFixtureId: "reel_component_page_turn_v1",
  }),
  definition({
    componentId: "panel_montage",
    description: "Two-to-eight panel montage using fixed cascade, grid, or rapid-cut layouts.",
    propSchemaId: "reel-spec.v1#/$defs/MontageScene",
    supportedAssetKinds: ["image"],
    defaultDurationFrames: 120,
    minDurationFrames: 30,
    maxDurationFrames: 360,
    motionPresets: ["cascade", "grid", "rapid_cuts"],
    previewFixtureId: "reel_component_panel_montage_v1",
  }),
]);

export const reelComponentDefinitions: Readonly<Record<ReelComponentId, ReelComponentDefinition>> =
  Object.freeze(
    Object.fromEntries(
      reelComponentCatalog.map((item) => [item.componentId, item]),
    ) as Record<ReelComponentId, ReelComponentDefinition>,
  );

export const supportedStyleKits = Object.freeze([
  Object.freeze({
    styleKitId: SCROLLSTACK_STYLE_KIT_ID,
    version: "1.0.0",
    description: "ScrollStack ink, paper, accent, and reel-safe-zone visual system.",
  }),
]);

export function isReelComponentId(value: string): value is ReelComponentId {
  return Object.hasOwn(reelComponentDefinitions, value);
}
