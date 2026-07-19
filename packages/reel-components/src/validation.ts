import { isMangaManifest, isReelSpec } from "@scrollstack/contracts";

import {
  reelComponentDefinitions,
  SCROLLSTACK_STYLE_KIT_ID,
  isReelComponentId,
} from "./catalog";
import type {
  CaptionCue,
  ManifestPanel,
  ReelCompilationInput,
  ReelScene,
  ReelValidationIssue,
  ResolvedReelAsset,
} from "./types";
import { ReelValidationError } from "./types";

const CONTENT_HASH = /^[a-f0-9]{64}$/;
const MAX_CAPTION_CHARACTERS = 240;
const MAX_DIALOGUE_CHARACTERS = 1_200;

function issue(
  issues: ReelValidationIssue[],
  code: ReelValidationIssue["code"],
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function panelIdsForScene(scene: ReelScene): readonly string[] {
  switch (scene.scene_type) {
    case "panel_focus":
    case "dialogue_exchange":
    case "impact_cut":
      return [scene.panel_id];
    case "split_panel":
    case "montage":
      return scene.panel_ids;
    case "page_turn":
      return [scene.from_panel_id, scene.to_panel_id];
    case "narrator_card":
      return [];
  }
}

function validateAssetShape(
  key: string,
  asset: ResolvedReelAsset,
  issues: ReelValidationIssue[],
): void {
  const path = `assets.${key}`;
  if (asset.assetId !== key) {
    issue(issues, "invalid_asset", `${path}.assetId`, "must match its record key");
  }
  if (!CONTENT_HASH.test(asset.contentHash)) {
    issue(issues, "invalid_asset", `${path}.contentHash`, "must be a lowercase SHA-256 hash");
  }
  if (!asset.src.trim()) {
    issue(issues, "invalid_asset", `${path}.src`, "must be resolved before compilation");
  }
  if (asset.kind === "image" && !asset.mimeType.startsWith("image/")) {
    issue(issues, "invalid_asset", `${path}.mimeType`, "must be an image MIME type");
  }
  if (asset.kind === "audio" && !asset.mimeType.startsWith("audio/")) {
    issue(issues, "invalid_asset", `${path}.mimeType`, "must be an audio MIME type");
  }
  for (const [name, value] of [
    ["width", asset.width],
    ["height", asset.height],
    ["durationMs", asset.durationMs],
  ] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
      issue(issues, "invalid_asset", `${path}.${name}`, "must be a positive finite number");
    }
  }
}

function requireAsset(
  assetId: string,
  expectedKind: ResolvedReelAsset["kind"],
  path: string,
  input: ReelCompilationInput,
  issues: ReelValidationIssue[],
): void {
  const asset = input.assets[assetId];
  if (!asset) {
    issue(issues, "invalid_asset", path, `unresolved asset ID: ${assetId}`);
    return;
  }
  if (asset.kind !== expectedKind) {
    issue(issues, "invalid_asset", path, `expected ${expectedKind}, received ${asset.kind}`);
  }
}

function validateBox(
  box: { x_pct: number; y_pct: number; width_pct: number; height_pct: number },
  path: string,
  issues: ReelValidationIssue[],
): void {
  if (box.x_pct + box.width_pct > 100 || box.y_pct + box.height_pct > 100) {
    issue(issues, "invalid_reference", path, "crop box must remain inside the panel bounds");
  }
}

function firstPanelAssetId(panel: ManifestPanel): string | undefined {
  return panel.visual_asset_ids?.[0];
}

function validateScene(
  scene: ReelScene,
  index: number,
  expectedStart: number,
  input: ReelCompilationInput,
  panels: ReadonlyMap<string, ManifestPanel>,
  mangaBeatIds: ReadonlySet<string>,
  reelBeatIds: ReadonlySet<string>,
  issues: ReelValidationIssue[],
): number {
  const path = `spec.scenes.${index}`;
  if (scene.start_frame !== expectedStart) {
    issue(issues, "invalid_timeline", `${path}.start_frame`, `must equal contiguous frame ${expectedStart}`);
  }
  if (!isReelComponentId(scene.component_id)) {
    issue(issues, "invalid_component", `${path}.component_id`, "is not registered");
  } else {
    const definition = reelComponentDefinitions[scene.component_id];
    if (
      scene.duration_frames < definition.minDurationFrames ||
      scene.duration_frames > definition.maxDurationFrames
    ) {
      issue(
        issues,
        "invalid_timeline",
        `${path}.duration_frames`,
        `must be between ${definition.minDurationFrames} and ${definition.maxDurationFrames} for ${scene.component_id}`,
      );
    }
  }
  for (const beatId of scene.beat_ids) {
    if (!reelBeatIds.has(beatId) || !mangaBeatIds.has(beatId)) {
      issue(issues, "invalid_reference", `${path}.beat_ids`, `unknown manga/reel beat ID: ${beatId}`);
    }
  }

  for (const panelId of panelIdsForScene(scene)) {
    const panel = panels.get(panelId);
    if (!panel) {
      issue(issues, "invalid_reference", path, `unknown manga panel ID: ${panelId}`);
      continue;
    }
    const assetId = firstPanelAssetId(panel);
    if (!assetId) {
      issue(issues, "invalid_asset", path, `panel ${panelId} has no visual asset`);
    } else {
      requireAsset(assetId, "image", path, input, issues);
    }
  }

  switch (scene.scene_type) {
    case "panel_focus": {
      const panel = panels.get(scene.panel_id);
      if (scene.asset_id) {
        if (panel?.visual_asset_ids && !panel.visual_asset_ids.includes(scene.asset_id)) {
          issue(issues, "invalid_reference", `${path}.asset_id`, "must belong to the referenced manga panel");
        }
        requireAsset(scene.asset_id, "image", `${path}.asset_id`, input, issues);
      }
      if (scene.focus_box_pct) validateBox(scene.focus_box_pct, `${path}.focus_box_pct`, issues);
      if ((scene.caption?.length ?? 0) > MAX_CAPTION_CHARACTERS) {
        issue(issues, "text_overflow", `${path}.caption`, `must not exceed ${MAX_CAPTION_CHARACTERS} characters`);
      }
      break;
    }
    case "dialogue_exchange": {
      const characterCount = scene.dialogue.reduce((total, line) => total + line.text.trim().length, 0);
      if (characterCount > MAX_DIALOGUE_CHARACTERS) {
        issue(issues, "text_overflow", `${path}.dialogue`, `must not exceed ${MAX_DIALOGUE_CHARACTERS} total characters`);
      }
      break;
    }
    case "narrator_card":
      if (scene.background_asset_id) {
        requireAsset(scene.background_asset_id, "image", `${path}.background_asset_id`, input, issues);
      }
      break;
    case "split_panel":
    case "impact_cut":
    case "page_turn":
    case "montage":
      break;
  }

  return scene.start_frame + scene.duration_frames;
}

function validateCaption(
  cue: CaptionCue,
  index: number,
  durationFrames: number,
  issues: ReelValidationIssue[],
): void {
  const path = `captions.${index}`;
  if (!cue.text.trim()) issue(issues, "invalid_caption", `${path}.text`, "must not be empty");
  if (cue.text.trim().replace(/\s+/g, " ").length > MAX_CAPTION_CHARACTERS) {
    issue(issues, "text_overflow", `${path}.text`, `must not exceed ${MAX_CAPTION_CHARACTERS} characters`);
  }
  if (!Number.isInteger(cue.startFrame) || cue.startFrame < 0) {
    issue(issues, "invalid_caption", `${path}.startFrame`, "must be a non-negative integer");
  }
  if (!Number.isInteger(cue.endFrame) || cue.endFrame <= cue.startFrame) {
    issue(issues, "invalid_caption", `${path}.endFrame`, "must be an integer after startFrame");
  }
  if (cue.endFrame > durationFrames) {
    issue(issues, "invalid_caption", `${path}.endFrame`, "must fall inside the reel timeline");
  }
}

export function collectReelValidationIssues(input: ReelCompilationInput): ReelValidationIssue[] {
  const issues: ReelValidationIssue[] = [];
  if (!isReelSpec(input.spec)) {
    issue(issues, "invalid_reel_spec", "spec", "does not match the canonical reel-spec.v1 schema");
  }
  if (!isMangaManifest(input.manga)) {
    issue(issues, "invalid_manga_manifest", "manga", "does not match the canonical manga-manifest.v1 schema");
  }
  if (issues.length > 0) return issues;

  if (input.spec.style_kit_id !== SCROLLSTACK_STYLE_KIT_ID) {
    issue(issues, "invalid_style_kit", "spec.style_kit_id", `unsupported style kit: ${input.spec.style_kit_id}`);
  }

  for (const [key, asset] of Object.entries(input.assets)) validateAssetShape(key, asset, issues);

  const panels = new Map(input.manga.panels.map((panel) => [panel.panel_id, panel]));
  const mangaBeatIds = new Set(input.manga.beats.map((beat) => beat.beat_id));
  const reelBeatIds = new Set(input.spec.beat_ids);
  if (reelBeatIds.size !== input.spec.beat_ids.length) {
    issue(issues, "invalid_reference", "spec.beat_ids", "must be unique");
  }
  for (const beatId of reelBeatIds) {
    if (!mangaBeatIds.has(beatId)) {
      issue(issues, "invalid_reference", "spec.beat_ids", `unknown manga beat ID: ${beatId}`);
    }
  }

  let expectedStart = 0;
  const sceneIds = new Set<string>();
  input.spec.scenes.forEach((scene, index) => {
    if (sceneIds.has(scene.scene_id)) {
      issue(issues, "invalid_reference", `spec.scenes.${index}.scene_id`, "must be unique");
    }
    sceneIds.add(scene.scene_id);
    expectedStart = validateScene(
      scene,
      index,
      expectedStart,
      input,
      panels,
      mangaBeatIds,
      reelBeatIds,
      issues,
    );
  });
  if (expectedStart !== input.spec.format.duration_frames) {
    issue(issues, "invalid_timeline", "spec.format.duration_frames", "must equal the sum of scene durations");
  }

  for (const [index, cue] of (input.spec.audio.sfx_cues ?? []).entries()) {
    if (cue.frame >= input.spec.format.duration_frames) {
      issue(issues, "invalid_timeline", `spec.audio.sfx_cues.${index}.frame`, "must fall inside the reel timeline");
    }
    requireAsset(cue.asset_id, "audio", `spec.audio.sfx_cues.${index}.asset_id`, input, issues);
  }
  if (input.spec.audio.music_asset_id) {
    requireAsset(input.spec.audio.music_asset_id, "audio", "spec.audio.music_asset_id", input, issues);
  }
  if (input.spec.audio.narration_asset_id) {
    requireAsset(input.spec.audio.narration_asset_id, "audio", "spec.audio.narration_asset_id", input, issues);
  }
  if (input.spec.audio.caption_track_id) {
    requireAsset(input.spec.audio.caption_track_id, "caption_track", "spec.audio.caption_track_id", input, issues);
  }

  for (const [index, entry] of input.spec.interaction_map.entries()) {
    if (!reelBeatIds.has(entry.beat_id)) {
      issue(issues, "invalid_reference", `spec.interaction_map.${index}.beat_id`, "must reference ReelSpec.beat_ids");
    }
    if (entry.end_frame > input.spec.format.duration_frames) {
      issue(issues, "invalid_timeline", `spec.interaction_map.${index}`, "must fall inside the reel timeline");
    }
  }

  const orderedCaptions = [...input.captions].sort(
    (left, right) => left.startFrame - right.startFrame || left.endFrame - right.endFrame,
  );
  orderedCaptions.forEach((cue, index) => validateCaption(cue, index, input.spec.format.duration_frames, issues));
  orderedCaptions.forEach((cue, index) => {
    const previous = orderedCaptions[index - 1];
    if (previous && cue.startFrame < previous.endFrame) {
      issue(issues, "invalid_caption", `captions.${index}.startFrame`, "caption cues must not overlap");
    }
  });

  return issues;
}

export function assertReelCompilationInput(
  input: ReelCompilationInput,
): asserts input is ReelCompilationInput {
  const issues = collectReelValidationIssues(input);
  if (issues.length > 0) throw new ReelValidationError(issues);
}

export const reelTextLimits = Object.freeze({
  maxCaptionCharacters: MAX_CAPTION_CHARACTERS,
  maxDialogueCharacters: MAX_DIALOGUE_CHARACTERS,
});
