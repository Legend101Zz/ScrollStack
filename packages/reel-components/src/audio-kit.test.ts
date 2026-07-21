import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  isReelAudioKitBedId,
  isReelAudioKitSoundId,
  reelAudioKit,
  reelAudioKitAll,
  reelAudioKitBeds,
  reelAudioKitSounds,
} from "./audio-kit";
import { deriveReelSpecs } from "./derive-reel-specs";
import { previewMangaManifest } from "./preview-fixture";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "audio");

describe("reel audio kit", () => {
  it("ships every catalogued sound with the exact bytes the catalog claims", async () => {
    for (const sound of reelAudioKitAll) {
      const bytes = await readFile(path.join(KIT_ROOT, sound.fileName));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(sound.contentHash);
    }
  });

  it("only ships rights-cleared audio", () => {
    for (const sound of reelAudioKit) expect(sound.license).toBe("CC0");
    for (const bed of reelAudioKitBeds) expect(bed.license).toBe("generated");
  });

  it("keeps beds well under the one-shots so they never compete with a cut", () => {
    for (const bed of reelAudioKitBeds) expect(bed.durationMs).toBeGreaterThanOrEqual(30_000);
  });

  it("records provenance for every shipped file", async () => {
    const provenance = await readFile(path.join(KIT_ROOT, "PROVENANCE.md"), "utf8");
    for (const sound of reelAudioKitAll) {
      expect(provenance).toContain(sound.fileName);
      expect(provenance).toContain(sound.contentHash);
    }
  });

  it("indexes and narrows sound IDs", () => {
    expect(Object.keys(reelAudioKitSounds)).toHaveLength(reelAudioKitAll.length);
    expect(isReelAudioKitSoundId("sfx_whoosh")).toBe(true);
    expect(isReelAudioKitSoundId("sfx_vine_boom")).toBe(false);
    expect(isReelAudioKitBedId("bed_tension")).toBe(true);
    // A bed is not a one-shot cue and must not be placed as one.
    expect(isReelAudioKitSoundId("bed_tension")).toBe(false);
    expect(isReelAudioKitBedId("sfx_whoosh")).toBe(false);
  });
});

describe("deriveReelSpecs sfx placement", () => {
  const options = { mangaManifestArtifactId: "artifact_x" } as const;

  it("emits no cues unless asked", () => {
    for (const spec of deriveReelSpecs(previewMangaManifest, options)) {
      expect(spec.audio.sfx_cues).toStrictEqual([]);
    }
  });

  it("places one cue per scene plus the opening hit", () => {
    for (const spec of deriveReelSpecs(previewMangaManifest, { ...options, sfx: true })) {
      const cues = spec.audio.sfx_cues ?? [];
      expect(cues).toHaveLength(spec.scenes.length);
      expect(cues[0]?.frame).toBe(0);
      expect(cues.map((cue) => cue.frame)).toStrictEqual(
        spec.scenes.map((scene) => scene.start_frame),
      );
    }
  });

  it("references only kit sounds and stays inside the timeline", () => {
    for (const spec of deriveReelSpecs(previewMangaManifest, { ...options, sfx: true })) {
      for (const cue of spec.audio.sfx_cues ?? []) {
        expect(isReelAudioKitSoundId(cue.asset_id)).toBe(true);
        expect(cue.frame).toBeLessThan(spec.format.duration_frames);
        expect(cue.gain).toBeGreaterThan(0);
        expect(cue.gain).toBeLessThanOrEqual(1);
      }
    }
  });

  it("leads with the opening hit and keeps later cues quieter", () => {
    const [spec] = deriveReelSpecs(previewMangaManifest, { ...options, sfx: true });
    const cues = spec?.audio.sfx_cues ?? [];
    for (const cue of cues.slice(1)) {
      expect(cue.gain ?? 1).toBeLessThan(cues[0]?.gain ?? 1);
    }
  });
});

describe("deriveReelSpecs music bed", () => {
  const options = { mangaManifestArtifactId: "artifact_x" } as const;

  it("attaches no bed unless asked", () => {
    for (const spec of deriveReelSpecs(previewMangaManifest, options)) {
      expect(spec.audio.music_asset_id).toBeUndefined();
    }
  });

  it("attaches a catalogued bed when asked", () => {
    for (const spec of deriveReelSpecs(previewMangaManifest, { ...options, music: true })) {
      expect(isReelAudioKitBedId(spec.audio.music_asset_id ?? "")).toBe(true);
    }
  });

  it("picks the bed from the beat the reel ends on", () => {
    const ending = (purpose: string) => ({
      ...previewMangaManifest,
      beats: previewMangaManifest.beats.map((beat) => ({ ...beat, narrative_purpose: purpose })),
    });
    const unresolved = deriveReelSpecs(ending("cliffhanger") as typeof previewMangaManifest, {
      ...options,
      music: true,
    });
    const resolved = deriveReelSpecs(ending("payoff") as typeof previewMangaManifest, {
      ...options,
      music: true,
    });
    expect(unresolved[0]?.audio.music_asset_id).toBe("bed_tension");
    expect(resolved[0]?.audio.music_asset_id).toBe("bed_resolve");
  });
});
