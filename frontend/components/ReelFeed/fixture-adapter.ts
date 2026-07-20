import { isMangaManifest, isReelSpec, type MangaManifest, type ReelSpec } from "@scrollstack/contracts";
import type {
  CaptionCue,
  ResolvedReelAsset,
} from "@scrollstack/reel-components";

import mangaManifestJson from "../../../packages/fixtures/canonical/manga_manifest.v1.json";
import reelSpecJson from "../../../packages/fixtures/canonical/reel_spec.v1.json";
import type { ReelFeedCatalog, ReelFeedItem, ReelFeedReel } from "./types";

export type ReelFeedFixture = Readonly<{
  catalog: ReelFeedCatalog;
  items: Readonly<Record<string, ReelFeedItem>>;
}>;

const CANONICAL_IMAGE_HASH = "e2c72c57e72d048781a2fb626b503183017ef35ed0ee118bc9b9ffbc9813d4ef";

function canonicalContracts(): { manga: MangaManifest; spec: ReelSpec } {
  const manga: unknown = mangaManifestJson;
  const spec: unknown = reelSpecJson;
  if (!isMangaManifest(manga)) throw new Error("The canonical MangaManifest fixture is invalid.");
  if (!isReelSpec(spec)) throw new Error("The canonical ReelSpec fixture is invalid.");
  return { manga, spec };
}

function fixtureAssets(): Readonly<Record<string, ResolvedReelAsset>> {
  return {
    asset_last_observatory_key_panel_v1: {
      assetId: "asset_last_observatory_key_panel_v1",
      contentHash: CANONICAL_IMAGE_HASH,
      height: 1672,
      kind: "image",
      mimeType: "image/png",
      src: "/art/last-observatory-key-panel.png",
      width: 941,
    },
  };
}

function fixtureCaptions(spec: ReelSpec): CaptionCue[] {
  return spec.scenes.flatMap((scene) => {
    if (scene.scene_type === "panel_focus" && scene.caption) {
      return [{ text: scene.caption, startFrame: scene.start_frame, endFrame: scene.start_frame + scene.duration_frames }];
    }
    if (scene.scene_type === "narrator_card") {
      return [{ text: scene.text, startFrame: scene.start_frame, endFrame: scene.start_frame + scene.duration_frames }];
    }
    return [];
  });
}

function fixtureReel(
  canonical: ReelSpec,
  manga: MangaManifest,
  seriesId: string,
  sequence: number,
  label: string,
): ReelFeedItem {
  const spec = structuredClone(canonical);
  spec.reel_id = `${seriesId}_reel_${sequence + 1}`;
  spec.series_id = seriesId;
  spec.sequence = sequence;
  spec.audio = {
    caption_track_id: null,
    music_asset_id: null,
    narration_asset_id: null,
    sfx_cues: [],
  };

  return {
    id: spec.reel_id,
    label,
    durationFrames: spec.format.duration_frames,
    reelSpecArtifactId: `fixture_${spec.reel_id}`,
    sequence,
    seriesId,
    composition: {
      assets: fixtureAssets(),
      captions: fixtureCaptions(spec),
      manga,
      spec,
    },
  };
}

function fixtureCatalogItem(item: ReelFeedItem): ReelFeedReel {
  return {
    durationFrames: item.durationFrames,
    id: item.id,
    label: item.label,
    reelSpecArtifactId: item.reelSpecArtifactId,
    sequence: item.sequence,
  };
}

/** Explicit development-only data. Production callers use the reel API boundary. */
export function loadFixtureReelFeed(bookId: string, projectId: string): ReelFeedFixture {
  const { manga, spec } = canonicalContracts();
  const routes = [
    fixtureReel(spec, manga, "series_last_observatory", 0, "The map remembers"),
    fixtureReel(spec, manga, "series_last_observatory", 1, "Where the route ends"),
  ];
  const warnings = [
    fixtureReel(spec, manga, "series_old_warnings", 0, "Fresh ink, old failures"),
    fixtureReel(spec, manga, "series_old_warnings", 1, "The vanished crew"),
  ];

  const items = [...routes, ...warnings];
  return {
    catalog: {
      bookId,
      projectId,
      sourceLabel: "Manga slice · Source pages 1–10",
      title: "The Last Observatory",
      series: [
        {
          bookId,
          id: "series_last_observatory",
          label: "The hidden routes",
          mangaManifestArtifactId: "fixture_manifest_last_observatory",
          projectId,
          reels: routes.map(fixtureCatalogItem),
        },
        {
          bookId,
          id: "series_old_warnings",
          label: "What the map kept",
          mangaManifestArtifactId: "fixture_manifest_old_warnings",
          projectId,
          reels: warnings.map(fixtureCatalogItem),
        },
      ],
    },
    items: Object.fromEntries(items.map((item) => [item.id, item])),
  };
}
