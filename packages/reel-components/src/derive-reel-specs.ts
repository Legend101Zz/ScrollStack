import { isMangaManifest, isReelSpec } from "@scrollstack/contracts";
import type { MangaManifest, ReelSpec } from "@scrollstack/contracts";

import { SCROLLSTACK_STYLE_KIT_ID, reelComponentDefinitions } from "./catalog";
import type { ManifestPanel, ReelScene } from "./types";
import { ReelValidationError } from "./types";
import { reelTextLimits } from "./validation";

type SourceRef = ReelSpec["source_refs"][number];
type DialogueExchangeScene = Extract<ReelScene, { scene_type: "dialogue_exchange" }>;
type DialogueLine = DialogueExchangeScene["dialogue"][number];

export type DeriveReelSpecsOptions = Readonly<{
  /**
   * Artifact ID of the persisted MangaManifest. The manifest does not carry its
   * own artifact ID, so the control plane supplies it at derivation time.
   */
  mangaManifestArtifactId: string;
  seriesId?: string;
  /** Reel length to aim for. 600 frames is 20s, the middle of the 10-30s rule. */
  targetDurationFrames?: number;
}>;

const DEFAULT_TARGET_DURATION_FRAMES = 600;
const REEL_FORMAT = Object.freeze({
  width: 1080,
  height: 1920,
  fps: 30,
} as const);

// ponytail: deterministic derivation, no model call. The Pi Reel Director from
// technical-imp.md 13.2 replaces the body of this module behind the same
// signature; everything downstream consumes ReelSpec either way.

const MOTION_BY_PURPOSE: Readonly<Record<string, "hold" | "push_in" | "pull_out" | "pan_left" | "pan_right">> =
  Object.freeze({
    hook: "push_in",
    setup: "hold",
    conflict: "pan_left",
    explanation: "hold",
    reveal: "push_in",
    payoff: "pull_out",
    cliffhanger: "push_in",
  });

function clampText(text: string, limit: number): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (normalized.length <= limit) return normalized;
  const cut = normalized.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function panelText(panel: ManifestPanel): string | undefined {
  return panel.narration?.[0] ?? panel.dialogue?.[0]?.text;
}

/** Draft scene: duration is known before start frames are assigned. */
type DraftScene = Readonly<{
  panel: ManifestPanel;
  durationFrames: number;
  build: (startFrame: number) => ReelScene;
}>;

function draftFor(panel: ManifestPanel, purpose: string): DraftScene | undefined {
  const sceneId = `scene_${panel.panel_id}`;
  const beatIds = [...panel.beat_ids] as [string, ...string[]];
  const assetId = panel.visual_asset_ids?.[0];
  const text = panelText(panel);
  const dialogue = panel.dialogue ?? [];

  // A panel with no rendered art can still carry the story as typography.
  if (!assetId) {
    if (!text) return undefined;
    const duration = reelComponentDefinitions.narrator_card.defaultDurationFrames;
    return {
      panel,
      durationFrames: duration,
      build: (start) => ({
        scene_id: sceneId,
        scene_type: "narrator_card",
        component_id: "narrator_card",
        start_frame: start,
        duration_frames: duration,
        beat_ids: beatIds,
        text: clampText(text, reelTextLimits.maxCaptionCharacters),
        text_preset: purpose === "reveal" || purpose === "payoff" ? "ink_reverse" : "paper_box",
      }),
    };
  }

  if (dialogue.length >= 2) {
    const lines = boundedDialogue(dialogue);
    const duration = Math.min(
      reelComponentDefinitions.dialogue_exchange.maxDurationFrames,
      Math.max(reelComponentDefinitions.dialogue_exchange.minDurationFrames, 60 + 45 * lines.length),
    );
    return {
      panel,
      durationFrames: duration,
      build: (start) => ({
        scene_id: sceneId,
        scene_type: "dialogue_exchange",
        component_id: "dialogue_exchange",
        start_frame: start,
        duration_frames: duration,
        beat_ids: beatIds,
        panel_id: panel.panel_id,
        dialogue: lines,
        bubble_motion: "pop",
      }),
    };
  }

  const duration = reelComponentDefinitions.panel_focus.defaultDurationFrames;
  const cropBox = panel.crop_hints?.[0]?.box_pct;
  return {
    panel,
    durationFrames: duration,
    build: (start) => ({
      scene_id: sceneId,
      scene_type: "panel_focus",
      component_id: "panel_focus",
      start_frame: start,
      duration_frames: duration,
      beat_ids: beatIds,
      panel_id: panel.panel_id,
      asset_id: assetId,
      motion_preset: MOTION_BY_PURPOSE[purpose] ?? "hold",
      ...(cropBox ? { focus_box_pct: cropBox } : {}),
      ...(text ? { caption: clampText(text, reelTextLimits.maxCaptionCharacters) } : {}),
    }),
  };
}

/** Respects both the 8-line and the total-character ceilings the renderer enforces. */
function boundedDialogue(dialogue: readonly DialogueLine[]): DialogueExchangeScene["dialogue"] {
  const lines: DialogueLine[] = [];
  let characters = 0;
  for (const line of dialogue.slice(0, 8)) {
    const next = characters + line.text.trim().length;
    if (lines.length >= 2 && next > reelTextLimits.maxDialogueCharacters) break;
    lines.push(line);
    characters = next;
  }
  return lines as DialogueExchangeScene["dialogue"];
}

function chunk(drafts: readonly DraftScene[], targetDurationFrames: number): DraftScene[][] {
  const reels: DraftScene[][] = [];
  let current: DraftScene[] = [];
  let frames = 0;
  for (const draft of drafts) {
    current.push(draft);
    frames += draft.durationFrames;
    if (frames >= targetDurationFrames) {
      reels.push(current);
      current = [];
      frames = 0;
    }
  }
  if (current.length > 0) {
    // A stray tail is folded back rather than shipped as a two-second reel.
    const last = reels[reels.length - 1];
    if (last && frames < targetDurationFrames / 2) last.push(...current);
    else reels.push(current);
  }
  return reels;
}

function dedupeSourceRefs(panels: readonly ManifestPanel[]): SourceRef[] {
  const seen = new Map<string, SourceRef>();
  for (const panel of panels) {
    for (const ref of panel.source_refs) {
      seen.set(`${ref.source_unit_id}:${ref.page_start}:${ref.page_end}:${ref.text_hash}`, ref);
    }
  }
  return [...seen.values()];
}

export function deriveReelSpecs(
  manifest: MangaManifest,
  options: DeriveReelSpecsOptions,
): ReelSpec[] {
  if (!isMangaManifest(manifest)) {
    throw new ReelValidationError([
      {
        code: "invalid_manga_manifest",
        path: "manifest",
        message: "does not match the canonical manga-manifest.v1 schema",
      },
    ]);
  }

  const purposeByBeat = new Map(manifest.beats.map((beat) => [beat.beat_id, beat.narrative_purpose]));
  const knownBeatIds = new Set(manifest.beats.map((beat) => beat.beat_id));
  const panels = [...manifest.panels].sort(
    (left, right) => left.sequence - right.sequence || left.panel_id.localeCompare(right.panel_id),
  );

  const drafts = panels
    .map((panel) => draftFor(panel, purposeByBeat.get(panel.beat_ids[0]) ?? "setup"))
    .filter((draft): draft is DraftScene => draft !== undefined);
  if (drafts.length === 0) return [];

  const seriesId = options.seriesId ?? `series_${manifest.manga_id}`;
  const target = options.targetDurationFrames ?? DEFAULT_TARGET_DURATION_FRAMES;

  return chunk(drafts, target).map((group, index) => {
    let frame = 0;
    const scenes = group.map((draft) => {
      const scene = draft.build(frame);
      frame += draft.durationFrames;
      return scene;
    }) as ReelSpec["scenes"];

    const beatIds = [
      ...new Set(scenes.flatMap((scene) => scene.beat_ids).filter((id) => knownBeatIds.has(id))),
    ] as ReelSpec["beat_ids"];

    // One interaction span per beat, covering every scene that carries it.
    const interactionMap = beatIds.map((beatId) => {
      const carrying = scenes.filter((scene) => scene.beat_ids.includes(beatId));
      return {
        beat_id: beatId,
        start_frame: Math.min(...carrying.map((scene) => scene.start_frame)),
        end_frame: Math.max(...carrying.map((scene) => scene.start_frame + scene.duration_frames)),
      };
    }) as ReelSpec["interaction_map"];

    const spec: ReelSpec = {
      schema_version: "reel-spec.v1",
      reel_id: `reel_${manifest.manga_id}_${index}`,
      series_id: seriesId,
      sequence: index,
      manga_manifest_id: options.mangaManifestArtifactId,
      beat_ids: beatIds,
      format: { ...REEL_FORMAT, duration_frames: frame },
      style_kit_id: SCROLLSTACK_STYLE_KIT_ID,
      audio: { sfx_cues: [] },
      scenes,
      interaction_map: interactionMap,
      source_refs: dedupeSourceRefs(group.map((draft) => draft.panel)) as ReelSpec["source_refs"],
    };

    if (!isReelSpec(spec)) {
      throw new ReelValidationError([
        {
          code: "invalid_reel_spec",
          path: `reels.${index}`,
          message: "derived spec does not match the canonical reel-spec.v1 schema",
        },
      ]);
    }
    return spec;
  });
}
