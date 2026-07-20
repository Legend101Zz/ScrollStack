import {
  isReelPlayerPayload,
  isReelSeries,
  isSeriesProgress,
  type ReelPlayerPayload,
  type ReelSeries,
  type SeriesProgress,
  type SeriesProgressUpdate,
} from "@scrollstack/contracts";
import type {
  CaptionCue,
  ReelCompilationInput,
  ResolvedReelAsset,
} from "@scrollstack/reel-components";

import type {
  ReelFeedCatalog,
  ReelFeedItem,
  ReelFeedPayload,
  ReelFeedReel,
  ReelFeedSelection,
  ReelFeedSeries,
} from "./types";

export class ReelApiContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReelApiContractError";
  }
}

type ProgressState = Pick<SeriesProgress, "last_manga_page" | "viewed_reel_ids"> | SeriesProgressUpdate;

function reelLabel(sequence: number): string {
  return `Reel ${sequence + 1}`;
}

function catalogItem(reel: ReelSeries["reels"][number]): ReelFeedReel {
  return {
    durationFrames: reel.duration_frames,
    id: reel.reel_id,
    label: reelLabel(reel.sequence),
    reelSpecArtifactId: reel.reel_spec_artifact_id,
    sequence: reel.sequence,
  };
}

function seriesItem(series: ReelSeries, index: number): ReelFeedSeries {
  return {
    bookId: series.book_id,
    id: series.series_id,
    label: `Series ${index + 1}`,
    mangaManifestArtifactId: series.manga_manifest_artifact_id,
    projectId: series.project_id,
    reels: series.reels.map(catalogItem),
  };
}

/**
 * Validates project discovery at the generated contract boundary and projects
 * it into honest UI metadata. Display titles deliberately stay generic until
 * the canonical contract owns title fields.
 */
export function adaptReelSeriesCatalog(
  value: unknown,
  bookId: string,
  projectId: string,
): ReelFeedCatalog {
  if (!Array.isArray(value) || !value.every(isReelSeries)) {
    throw new ReelApiContractError("The reel-series response does not match reel-series.v1.");
  }

  const duplicateSeriesIds = value
    .map((series) => series.series_id)
    .filter((seriesId, index, all) => all.indexOf(seriesId) !== index);
  if (duplicateSeriesIds.length > 0) {
    throw new ReelApiContractError("The reel-series response contains duplicate series IDs.");
  }

  value.forEach((series) => {
    if (series.book_id !== bookId || series.project_id !== projectId) {
      throw new ReelApiContractError(
        "The reel-series response does not belong to the requested book and project.",
      );
    }
  });

  return {
    bookId,
    projectId,
    series: value.map(seriesItem),
    sourceLabel: `Manga project ${projectId}`,
    title: "Reels",
  };
}

type PlayerAsset = ReelPlayerPayload["assets"][string];
type PlayerCaption = NonNullable<ReelPlayerPayload["captions"]>[number];

function resolvedAsset(asset: PlayerAsset): ResolvedReelAsset {
  return {
    assetId: asset.asset_id,
    contentHash: asset.content_hash,
    kind: asset.kind,
    mimeType: asset.mime_type,
    src: asset.url,
    ...(asset.width == null ? {} : { width: asset.width }),
    ...(asset.height == null ? {} : { height: asset.height }),
    ...(asset.duration_ms == null ? {} : { durationMs: asset.duration_ms }),
  };
}

function captionCue(cue: PlayerCaption): CaptionCue {
  return {
    endFrame: cue.end_frame,
    startFrame: cue.start_frame,
    text: cue.text,
    ...(cue.speaker_id == null ? {} : { speakerId: cue.speaker_id }),
  };
}

function earliestExpiry(payload: ReelPlayerPayload): string | undefined {
  const expiries = Object.values(payload.assets)
    .map((asset) => asset.url_expires_at)
    .filter((expiresAt): expiresAt is string => expiresAt != null)
    .sort((left, right) => Date.parse(left) - Date.parse(right));
  return expiries[0];
}

/** Validates and converts a browser delivery DTO into deterministic compiler input. */
export function adaptReelPlayerPayload(value: unknown): ReelFeedItem {
  if (!isReelPlayerPayload(value)) {
    throw new ReelApiContractError(
      "The reel-player response does not match reel-player-payload.v1.",
    );
  }
  const composition: ReelCompilationInput = {
    assets: Object.fromEntries(
      Object.entries(value.assets).map(([assetId, asset]) => [assetId, resolvedAsset(asset)]),
    ),
    captions: (value.captions ?? []).map(captionCue),
    manga: value.manga_manifest,
    spec: value.reel_spec,
  };
  const expiresAt = earliestExpiry(value);

  return {
    composition,
    durationFrames: value.reel_spec.format.duration_frames,
    id: value.reel_spec.reel_id,
    label: reelLabel(value.reel_spec.sequence),
    reelSpecArtifactId: value.reel_spec_artifact_id,
    sequence: value.reel_spec.sequence,
    seriesId: value.series_id,
    ...(expiresAt === undefined ? {} : { expiresAt }),
    ...(value.poster_url == null ? {} : { posterUrl: value.poster_url }),
    ...(value.rendered_mp4_url == null ? {} : { renderedMp4Url: value.rendered_mp4_url }),
  };
}

export function parseSeriesProgress(value: unknown, expectedSeriesId?: string): SeriesProgress {
  if (!isSeriesProgress(value)) {
    throw new ReelApiContractError("The progress response does not match series-progress.v1.");
  }
  if (expectedSeriesId !== undefined && value.series_id !== expectedSeriesId) {
    throw new ReelApiContractError("The progress response belongs to another series.");
  }
  return value;
}

/** Selects the most recently updated valid resume point, then falls back to the first reel. */
export function selectResumePosition(
  catalog: ReelFeedPayload,
  progressEntries: readonly SeriesProgress[],
): ReelFeedSelection {
  const positions = new Map(
    catalog.series.flatMap((series, seriesIndex) =>
      series.reels.map((reel, reelIndex) => [
        `${series.id}\u0000${reel.id}`,
        { reelIndex, seriesIndex },
      ] as const),
    ),
  );
  const candidates = progressEntries
    .map((progress) => {
      if (progress.last_reel_id == null) return undefined;
      const position = positions.get(`${progress.series_id}\u0000${progress.last_reel_id}`);
      return position === undefined
        ? undefined
        : { ...position, updatedAt: Date.parse(progress.updated_at) };
    })
    .filter(
      (candidate): candidate is ReelFeedSelection & { updatedAt: number } =>
        candidate !== undefined,
    )
    .sort(
      (left, right) =>
        right.updatedAt - left.updatedAt ||
        left.seriesIndex - right.seriesIndex ||
        left.reelIndex - right.reelIndex,
    );

  const selected = candidates[0];
  return selected === undefined
    ? { reelIndex: 0, seriesIndex: 0 }
    : { reelIndex: selected.reelIndex, seriesIndex: selected.seriesIndex };
}

/**
 * Builds the full-replacement progress body expected by the API. Existing
 * manga position is preserved and viewed reels are emitted in catalog order.
 */
export function nextProgressUpdate(
  series: ReelFeedSeries,
  lastReelId: string,
  previous: ProgressState | null | undefined = null,
): SeriesProgressUpdate {
  const reelIds = new Set(series.reels.map((reel) => reel.id));
  if (!reelIds.has(lastReelId)) {
    throw new ReelApiContractError(`Reel ${lastReelId} does not belong to series ${series.id}.`);
  }
  if (previous !== null && "series_id" in previous && previous.series_id !== series.id) {
    throw new ReelApiContractError("Existing progress belongs to another series.");
  }

  const previouslyViewed = new Set(previous?.viewed_reel_ids ?? []);
  const unknownViewedIds = [...previouslyViewed].filter((reelId) => !reelIds.has(reelId));
  if (unknownViewedIds.length > 0) {
    throw new ReelApiContractError("Existing progress references reels outside this series.");
  }
  previouslyViewed.add(lastReelId);

  return {
    last_manga_page: previous?.last_manga_page ?? 0,
    last_reel_id: lastReelId,
    schema_version: "series-progress-update.v1",
    viewed_reel_ids: series.reels
      .filter((reel) => previouslyViewed.has(reel.id))
      .map((reel) => reel.id),
  };
}
