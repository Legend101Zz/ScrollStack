import { describe, expect, it } from "vitest";

import {
  ReelValidationError,
  collectReelValidationIssues,
  compileReel,
  previewCompiledReel,
  previewReelCompilationInput,
  reelComponentCatalog,
  reelComponentRegistry,
  type ReelCompilationInput,
} from "../src/index";

function withInput(
  patch: Partial<ReelCompilationInput>,
): ReelCompilationInput {
  return { ...previewReelCompilationInput, ...patch };
}

describe("compileReel", () => {
  it("compiles a serializable fixture covering every reviewed scene type", () => {
    expect(previewCompiledReel.scenes.map((item) => item.componentId)).toEqual([
      "panel_focus",
      "split_panel_reveal",
      "dialogue_exchange",
      "impact_cut",
      "narrator_card",
      "page_turn",
      "panel_montage",
    ]);
    expect(Object.keys(previewCompiledReel.componentVersions).sort()).toEqual(
      reelComponentCatalog.map((item) => item.componentId).sort(),
    );
    expect(JSON.parse(JSON.stringify(previewCompiledReel))).toEqual(previewCompiledReel);
  });

  it("keeps scene duration identical to the canonical composition duration", () => {
    const total = previewCompiledReel.scenes.reduce(
      (sum, item) => sum + item.durationFrames,
      0,
    );
    expect(total).toBe(previewCompiledReel.spec.format.duration_frames);
    expect(previewCompiledReel.scenes.at(-1)?.startFrame).toBe(330);
  });

  it("derives normalized, non-overlapping fixture captions when no timed track is supplied", () => {
    expect(previewCompiledReel.captions.length).toBeGreaterThan(7);
    for (const [index, cue] of previewCompiledReel.captions.entries()) {
      expect(cue.text).toBe(cue.text.trim().replace(/\s+/g, " "));
      expect(cue.endFrame).toBeGreaterThan(cue.startFrame);
      const previous = previewCompiledReel.captions[index - 1];
      if (previous) expect(cue.startFrame).toBeGreaterThanOrEqual(previous.endFrame);
    }
  });

  it("is deterministic for the same validated input", () => {
    expect(JSON.stringify(compileReel(previewReelCompilationInput))).toBe(
      JSON.stringify(compileReel(previewReelCompilationInput)),
    );
  });

  it("rejects a semantic timeline mismatch omitted by JSON Schema", () => {
    const input = withInput({
      spec: {
        ...previewReelCompilationInput.spec,
        format: { ...previewReelCompilationInput.spec.format, duration_frames: 391 },
      },
    });
    const issues = collectReelValidationIssues(input);
    expect(issues.some((item) => item.code === "invalid_timeline")).toBe(true);
    expect(() => compileReel(input)).toThrow(ReelValidationError);
  });

  it("fails closed when a panel asset is unresolved", () => {
    const assets = { ...previewReelCompilationInput.assets };
    delete assets.asset_panel_preview_1;
    const input = withInput({ assets });
    const issues = collectReelValidationIssues(input);
    expect(issues.some((item) => item.code === "invalid_asset" && item.message.includes("unresolved"))).toBe(true);
  });

  it("rejects unsupported style kits before rendering", () => {
    const input = withInput({
      spec: { ...previewReelCompilationInput.spec, style_kit_id: "style_model_authored" },
    });
    expect(collectReelValidationIssues(input)).toContainEqual(
      expect.objectContaining({ code: "invalid_style_kit", path: "spec.style_kit_id" }),
    );
  });

  it("rejects crop boxes that escape panel bounds", () => {
    const [first, ...rest] = previewReelCompilationInput.spec.scenes;
    if (first.scene_type !== "panel_focus") throw new Error("preview fixture order changed");
    const input = withInput({
      spec: {
        ...previewReelCompilationInput.spec,
        scenes: [
          { ...first, focus_box_pct: { x_pct: 80, y_pct: 10, width_pct: 30, height_pct: 50 } },
          ...rest,
        ],
      },
    });
    expect(collectReelValidationIssues(input)).toContainEqual(
      expect.objectContaining({ code: "invalid_reference", path: "spec.scenes.0.focus_box_pct" }),
    );
  });

  it("rejects captions that overlap or overflow the reel safe text budget", () => {
    const input = withInput({
      captions: [
        { text: "A".repeat(241), startFrame: 0, endFrame: 20 },
        { text: "overlap", startFrame: 10, endFrame: 30 },
      ],
    });
    const issues = collectReelValidationIssues(input);
    expect(issues.some((item) => item.code === "text_overflow")).toBe(true);
    expect(issues.some((item) => item.code === "invalid_caption" && item.message.includes("overlap"))).toBe(true);
  });

  it("validates derived captions before handing them to a renderer", () => {
    // Panel narration may run to 1000 characters, far past the caption budget,
    // so a caption derived from it must still be checked rather than trusted.
    const manga = {
      ...previewReelCompilationInput.manga,
      panels: previewReelCompilationInput.manga.panels.map((panel, index) =>
        index === 0 ? { ...panel, narration: ["A".repeat(600)] } : panel,
      ),
    } as ReelCompilationInput["manga"];

    expect(() => compileReel(withInput({ manga, captions: [] }))).toThrow(ReelValidationError);
  });

  it("does not caption text a scene already draws on screen", () => {
    const compiled = compileReel(withInput({ captions: [] }));
    const narratorCard = previewReelCompilationInput.spec.scenes.find(
      (scene) => scene.scene_type === "narrator_card",
    );
    const dialogue = previewReelCompilationInput.spec.scenes.find(
      (scene) => scene.scene_type === "dialogue_exchange",
    );
    if (narratorCard?.scene_type !== "narrator_card") throw new Error("fixture lost its narrator card");
    if (dialogue?.scene_type !== "dialogue_exchange") throw new Error("fixture lost its dialogue scene");

    // The card draws this copy itself; captioning it too would stack the same
    // sentence twice in the lower third.
    expect(compiled.captions.map((cue) => cue.text)).not.toContain(narratorCard.text);
    for (const line of dialogue.dialogue) {
      expect(compiled.captions.map((cue) => cue.text)).not.toContain(line.text);
    }
    // Scenes with no on-screen words still caption, so muted playback reads.
    expect(compiled.captions.length).toBeGreaterThan(0);
  });
});

describe("reviewed registry", () => {
  it("keeps the serializable catalog and executable registry aligned", () => {
    const catalogIds = reelComponentCatalog.map((item) => item.componentId).sort();
    expect(Object.keys(reelComponentRegistry).sort()).toEqual(catalogIds);
    const serialized = JSON.stringify(reelComponentCatalog);
    expect(serialized).not.toContain("function");
    expect(JSON.parse(serialized)).toHaveLength(7);
  });

  it("does not expose internal effects as model-selectable scene components", () => {
    expect(Object.keys(reelComponentRegistry)).not.toContain("ink_transition");
    expect(Object.keys(reelComponentRegistry)).not.toContain("speedline_transition");
    expect(Object.keys(reelComponentRegistry)).not.toContain("caption_track");
    expect(Object.keys(reelComponentRegistry)).not.toContain("sfx_hit");
  });
});
