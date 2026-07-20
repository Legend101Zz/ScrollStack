import { reelComponentDefinitions } from "./catalog";
import type {
  CaptionCue,
  CompiledReel,
  CompiledScene,
  ManifestPanel,
  ReelCompilationInput,
  ReelScene,
} from "./types";
import { assertReelCompilationInput } from "./validation";

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

function textForPanel(panel: ManifestPanel | undefined): string | undefined {
  return panel?.narration?.[0] ?? panel?.dialogue?.[0]?.text;
}

function fallbackCaptionTexts(
  scene: ReelScene,
  panels: ReadonlyMap<string, ManifestPanel>,
): readonly { text: string; speakerId?: string }[] {
  switch (scene.scene_type) {
    case "panel_focus": {
      const text = scene.caption ?? textForPanel(panels.get(scene.panel_id));
      return text ? [{ text }] : [];
    }
    case "split_panel":
    case "montage":
      return scene.panel_ids
        .map((panelId) => textForPanel(panels.get(panelId)))
        .filter((text): text is string => Boolean(text))
        .map((text) => ({ text }));
    case "dialogue_exchange":
      return scene.dialogue.map((line) => ({ text: line.text, speakerId: line.speaker_id }));
    case "impact_cut": {
      const text = textForPanel(panels.get(scene.panel_id));
      return text ? [{ text }] : [{ text: scene.sfx_text }];
    }
    case "narrator_card":
      return [{ text: scene.text }];
    case "page_turn": {
      const text = textForPanel(panels.get(scene.to_panel_id));
      return text ? [{ text }] : [];
    }
  }
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function fallbackCaptions(input: ReelCompilationInput): CaptionCue[] {
  const panels = new Map(input.manga.panels.map((panel) => [panel.panel_id, panel]));
  return input.spec.scenes.flatMap((scene) => {
    const texts = fallbackCaptionTexts(scene, panels);
    if (texts.length === 0) return [];
    return texts.map((item, index) => {
      const startFrame = scene.start_frame + Math.floor((scene.duration_frames * index) / texts.length);
      const endFrame =
        scene.start_frame + Math.floor((scene.duration_frames * (index + 1)) / texts.length);
      return {
        text: normalizeText(item.text),
        startFrame,
        endFrame,
        ...(item.speakerId ? { speakerId: item.speakerId } : {}),
      };
    });
  });
}

function normalizedCaptions(input: ReelCompilationInput): readonly CaptionCue[] {
  const source = input.captions.length > 0 ? input.captions : fallbackCaptions(input);
  return Object.freeze(
    [...source]
      .sort((left, right) => left.startFrame - right.startFrame || left.endFrame - right.endFrame)
      .map((cue) =>
        Object.freeze({
          text: normalizeText(cue.text),
          startFrame: cue.startFrame,
          endFrame: cue.endFrame,
          ...(cue.speakerId ? { speakerId: cue.speakerId } : {}),
        }),
      ),
  );
}

function compileScene(
  scene: ReelScene,
  panels: ReadonlyMap<string, ManifestPanel>,
): CompiledScene {
  const definition = reelComponentDefinitions[scene.component_id];
  const panelAssetIds = Object.fromEntries(
    panelIdsForScene(scene).map((panelId) => {
      const panel = panels.get(panelId);
      const assetId =
        scene.scene_type === "panel_focus" && scene.panel_id === panelId && scene.asset_id
          ? scene.asset_id
          : panel?.visual_asset_ids?.[0];
      if (!assetId) throw new Error(`validated panel ${panelId} has no asset`);
      return [panelId, assetId];
    }),
  );
  return Object.freeze({
    scene,
    componentId: definition.componentId,
    componentVersion: definition.version,
    startFrame: scene.start_frame,
    durationFrames: scene.duration_frames,
    panelAssetIds: Object.freeze(panelAssetIds),
  });
}

export function compileReel(input: ReelCompilationInput): CompiledReel {
  assertReelCompilationInput(input);
  const captions = normalizedCaptions(input);
  // Derived captions are renderer input too, so they must satisfy the same
  // timing and safe-text constraints as an explicitly supplied caption track.
  if (input.captions.length === 0 && captions.length > 0) {
    assertReelCompilationInput({ ...input, captions });
  }
  const panels = new Map(input.manga.panels.map((panel) => [panel.panel_id, panel]));
  const scenes = Object.freeze(input.spec.scenes.map((scene) => compileScene(scene, panels)));
  const componentVersions = Object.freeze(
    Object.fromEntries(scenes.map((scene) => [scene.componentId, scene.componentVersion])),
  );
  return Object.freeze({
    spec: input.spec,
    manga: input.manga,
    assets: Object.freeze({ ...input.assets }),
    captions,
    scenes,
    componentVersions,
  });
}
