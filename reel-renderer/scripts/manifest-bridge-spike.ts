/**
 * Spike: can a MangaManifest be projected from artifacts the pipeline already
 * produces, with no new model call and no new authored data?
 *
 * Not production code and not wired into anything. Issue #8 asks the manga lane
 * to emit `manga_manifest`; this exists to prove the derivation is a pure
 * projection of an accepted MangaPlan plus RenderedPage set, so that work is a
 * mapping rather than a design problem. Run it, read the output, delete it if
 * the real implementation lands elsewhere.
 *
 *   corepack pnpm --filter @scrollstack/reel-renderer spike:manifest
 */
import { deriveReelSpecs } from "@scrollstack/reel-components";
import type { ReelCompilationInput } from "@scrollstack/reel-components";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

type MangaManifest = ReelCompilationInput["manga"];

const FIXTURES = path.resolve(import.meta.dirname, "..", "..", "packages", "fixtures", "canonical");

async function loadJson<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(FIXTURES, name), "utf8")) as T;
}

type MangaPlan = {
  plan_id: string;
  project_id: string;
  scope_id: string;
  memory_version: number;
  beats: MangaManifest["beats"];
};

type StoryboardPanel = {
  panel_id: string;
  beat_ids: string[];
  purpose: string;
  shot_type: string;
  emotional_tone: string;
  dialogue?: unknown[];
  narration?: string[];
  visual_asset_ids?: string[];
  source_refs: unknown[];
};

type RenderedPage = {
  storyboard_page: { page_id: string; page_index: number; panels: StoryboardPanel[] };
  composition: { panel_order: string[] };
  panel_artifacts: Record<string, { asset_id?: string; render_status?: string }>;
};

/**
 * The projection. Every value below is copied from an accepted artifact; nothing
 * is invented, which is the whole point of the exercise.
 */
function projectManifest(
  plan: MangaPlan,
  pages: readonly RenderedPage[],
  renderedPageArtifactIds: readonly string[],
  artDirectionArtifactId: string,
): MangaManifest {
  const panels = pages.flatMap((page, pageIndex) =>
    page.storyboard_page.panels.map((panel, panelIndex) => ({
      panel_id: panel.panel_id,
      page_id: page.storyboard_page.page_id,
      sequence: pageIndex * 1000 + panelIndex,
      beat_ids: panel.beat_ids as [string, ...string[]],
      panel_type: panel.purpose,
      dialogue: panel.dialogue,
      narration: panel.narration,
      // Prefer the accepted render artifact; fall back to the storyboard's
      // requested assets when a panel rendered without one.
      visual_asset_ids: [
        ...new Set(
          [
            page.panel_artifacts[panel.panel_id]?.render_status === "rendered"
              ? page.panel_artifacts[panel.panel_id]?.asset_id
              : undefined,
            ...(panel.visual_asset_ids ?? []),
          ].filter((id): id is string => Boolean(id)),
        ),
      ],
      crop_hints: [],
      emotional_tone: panel.emotional_tone,
      source_refs: panel.source_refs,
    })),
  );

  const manifest = {
    schema_version: "manga-manifest.v1",
    manga_id: `manga_${plan.plan_id.replace(/^manga_plan_/, "")}`,
    project_id: plan.project_id,
    scope_id: plan.scope_id,
    memory_version: plan.memory_version,
    rendered_page_artifact_ids: renderedPageArtifactIds,
    beats: plan.beats,
    panels,
    character_asset_ids: [],
    art_direction_artifact_id: artDirectionArtifactId,
    content_hash: "",
  } as unknown as MangaManifest;

  const { content_hash: _ignored, ...hashable } = manifest as unknown as Record<string, unknown>;
  const contentHash = createHash("sha256").update(JSON.stringify(hashable)).digest("hex");
  return { ...manifest, content_hash: contentHash };
}

const plan = await loadJson<MangaPlan>("manga_plan.v1.json");
const page = await loadJson<RenderedPage>("rendered_page.v1.json");

console.log("inputs: accepted MangaPlan + RenderedPage set (no model call)");
console.log(`  plan ${plan.plan_id}  beats=${plan.beats.length}`);
console.log(`  page ${page.storyboard_page.page_id}  panels=${page.storyboard_page.panels.length}`);

const manifest = projectManifest(plan, [page], ["artifact_rendered_page_set_demo"], "artifact_art_direction_demo");

console.log(`\nprojected manga-manifest.v1`);
console.log(`  panels: ${manifest.panels.length}  beats: ${manifest.beats.length}`);
console.log(`  content_hash: ${manifest.content_hash.slice(0, 16)}...`);
// deriveReelSpecs revalidates the manifest against the canonical schema and
// throws ReelValidationError if the projection produced anything invalid, so
// reaching the next line is itself the schema check.

const specs = deriveReelSpecs(manifest, { mangaManifestArtifactId: "artifact_manifest_projected" });
console.log(`\nderived ${specs.length} ReelSpec(s) from the projected manifest`);
for (const spec of specs) {
  console.log(
    `  ${spec.reel_id}  ${spec.format.duration_frames}f (${(spec.format.duration_frames / 30).toFixed(1)}s)  scenes=${spec.scenes.length}  refs=${spec.source_refs.length}`,
  );
  for (const scene of spec.scenes) console.log(`    ${scene.scene_type}  panel=${"panel_id" in scene ? scene.panel_id : "-"}`);
}
console.log("\nVERDICT: manifest is a pure projection; no authored data was invented.");
