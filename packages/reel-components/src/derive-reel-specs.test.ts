import { isReelSpec } from "@scrollstack/contracts";
import type { MangaManifest } from "@scrollstack/contracts";
import { describe, expect, it } from "vitest";

import canonicalManifest from "../../fixtures/canonical/manga_manifest.v1.json";

import { reelComponentDefinitions } from "./catalog";
import { deriveReelSpecs } from "./derive-reel-specs";
import { previewMangaManifest } from "./preview-fixture";
import { ReelValidationError } from "./types";

const ARTIFACT_ID = "artifact_manifest_under_test";

function derive(manifest: MangaManifest) {
  return deriveReelSpecs(manifest, { mangaManifestArtifactId: ARTIFACT_ID });
}

describe("deriveReelSpecs", () => {
  const manifests: readonly [string, MangaManifest][] = [
    // The JSON import widens the schema's tuple types, so the cast goes through
    // `unknown`; deriveReelSpecs re-validates against the canonical schema anyway.
    ["canonical fixture", canonicalManifest as unknown as MangaManifest],
    ["preview fixture", previewMangaManifest],
  ];

  for (const [name, manifest] of manifests) {
    describe(name, () => {
      const specs = derive(manifest);

      it("produces at least one schema-valid reel", () => {
        expect(specs.length).toBeGreaterThan(0);
        for (const spec of specs) expect(isReelSpec(spec)).toBe(true);
      });

      it("tiles each timeline contiguously from frame zero", () => {
        for (const spec of specs) {
          let expected = 0;
          for (const scene of spec.scenes) {
            expect(scene.start_frame).toBe(expected);
            expected += scene.duration_frames;
          }
          expect(spec.format.duration_frames).toBe(expected);
        }
      });

      it("keeps scene durations inside their component limits", () => {
        for (const spec of specs) {
          for (const scene of spec.scenes) {
            const definition = reelComponentDefinitions[scene.component_id];
            expect(scene.duration_frames).toBeGreaterThanOrEqual(definition.minDurationFrames);
            expect(scene.duration_frames).toBeLessThanOrEqual(definition.maxDurationFrames);
          }
        }
      });

      it("references only manifest beats and panels", () => {
        const beatIds = new Set(manifest.beats.map((beat) => beat.beat_id));
        const panelIds = new Set(manifest.panels.map((panel) => panel.panel_id));
        for (const spec of specs) {
          for (const beatId of spec.beat_ids) expect(beatIds.has(beatId)).toBe(true);
          for (const entry of spec.interaction_map) {
            expect(spec.beat_ids).toContain(entry.beat_id);
            expect(entry.end_frame).toBeLessThanOrEqual(spec.format.duration_frames);
            expect(entry.start_frame).toBeLessThan(entry.end_frame);
          }
          for (const scene of spec.scenes) {
            for (const beatId of scene.beat_ids) expect(spec.beat_ids).toContain(beatId);
            if ("panel_id" in scene) expect(panelIds.has(scene.panel_id)).toBe(true);
          }
        }
      });

      it("only builds panel-backed scenes for panels that have art", () => {
        const withArt = new Set(
          manifest.panels
            .filter((panel) => (panel.visual_asset_ids?.length ?? 0) > 0)
            .map((panel) => panel.panel_id),
        );
        for (const spec of specs) {
          for (const scene of spec.scenes) {
            if ("panel_id" in scene) expect(withArt.has(scene.panel_id)).toBe(true);
          }
        }
      });

      it("is deterministic", () => {
        expect(derive(manifest)).toStrictEqual(specs);
      });

      it("numbers reels in order within one series", () => {
        expect(specs.map((spec) => spec.sequence)).toStrictEqual(specs.map((_, index) => index));
        expect(new Set(specs.map((spec) => spec.series_id)).size).toBe(1);
        expect(new Set(specs.map((spec) => spec.reel_id)).size).toBe(specs.length);
        for (const spec of specs) expect(spec.manga_manifest_id).toBe(ARTIFACT_ID);
      });
    });
  }

  it("rejects a manifest that is not schema-valid", () => {
    expect(() => derive({ ...previewMangaManifest, panels: [] } as unknown as MangaManifest)).toThrow(
      ReelValidationError,
    );
  });

  it("splits longer manga into more reels as the target shrinks", () => {
    const few = deriveReelSpecs(previewMangaManifest, {
      mangaManifestArtifactId: ARTIFACT_ID,
      targetDurationFrames: 10_000,
    });
    const many = deriveReelSpecs(previewMangaManifest, {
      mangaManifestArtifactId: ARTIFACT_ID,
      targetDurationFrames: 90,
    });
    expect(few.length).toBe(1);
    expect(many.length).toBeGreaterThanOrEqual(few.length);
  });
});
