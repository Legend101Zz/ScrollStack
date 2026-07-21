import type { ReelCompilationInput } from "@scrollstack/reel-components";

/** Catalog metadata available before the browser-ready payload is fetched. */
export type ReelFeedReel = Readonly<{
  durationFrames: number;
  id: string;
  label: string;
  reelSpecArtifactId: string;
  sequence: number;
}>;

export type ReelFeedSeries = Readonly<{
  bookId: string;
  id: string;
  label: string;
  mangaManifestArtifactId: string;
  projectId: string;
  reels: readonly ReelFeedReel[];
}>;

export type ReelFeedCatalog = Readonly<{
  bookId: string;
  projectId: string;
  series: readonly ReelFeedSeries[];
  sourceLabel: string;
  title: string;
}>;

/** A catalog item after its validated delivery payload has been adapted. */
export type ReelFeedItem = ReelFeedReel &
  Readonly<{
    composition: ReelCompilationInput;
    /** Earliest signed asset expiry, used to decide when the payload must be refreshed. */
    expiresAt?: string;
    posterUrl?: string;
    renderedMp4Url?: string;
    seriesId: string;
  }>;

export type ReelFeedSelection = Readonly<{
  reelIndex: number;
  seriesIndex: number;
}>;

/** Backwards-compatible feed prop name while the fixture adapter is retired. */
export type ReelFeedPayload = ReelFeedCatalog;
