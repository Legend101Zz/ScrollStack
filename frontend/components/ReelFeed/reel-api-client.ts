import {
  isSeriesProgress,
  isSeriesProgressUpdate,
  type SeriesProgress,
  type SeriesProgressUpdate,
} from "@scrollstack/contracts";

import { adaptReelPlayerPayload, adaptReelSeriesCatalog } from "./reel-api-adapter";
import type { ReelFeedCatalog, ReelFeedItem, ReelFeedReel, ReelFeedSeries } from "./types";

export class ReelApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ReelApiError";
  }
}

async function responseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ReelApiError("The reel API returned an unreadable response.", response.status || 502);
  }
}

function errorMessage(value: unknown, fallback: string): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "detail" in value &&
    typeof value.detail === "string"
  ) {
    return value.detail;
  }
  return fallback;
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ReelApiError("The reel API could not be reached.", 0);
  }

  const value = await responseJson(response);
  if (!response.ok) {
    throw new ReelApiError(
      errorMessage(value, `The reel API returned status ${response.status}.`),
      response.status,
    );
  }
  return value;
}

export async function loadReelCatalog(
  bookId: string,
  projectId: string,
): Promise<ReelFeedCatalog> {
  const value = await request(`/api/reels/projects/${encodeURIComponent(projectId)}`);
  return adaptReelSeriesCatalog(value, bookId, projectId);
}

export async function loadReelItem(reelId: string): Promise<ReelFeedItem> {
  const value = await request(`/api/reels/items/${encodeURIComponent(reelId)}`);
  const item = adaptReelPlayerPayload(value);
  if (item.id !== reelId) {
    throw new ReelApiError("The reel API returned a payload for a different reel.", 502);
  }
  return item;
}

export async function loadCatalogReel(
  series: ReelFeedSeries,
  reel: ReelFeedReel,
): Promise<ReelFeedItem> {
  const item = await loadReelItem(reel.id);
  if (
    item.seriesId !== series.id ||
    item.sequence !== reel.sequence ||
    item.reelSpecArtifactId !== reel.reelSpecArtifactId
  ) {
    throw new ReelApiError("The reel payload does not match its catalog entry.", 502);
  }
  return item;
}

export async function loadSeriesProgress(seriesId: string): Promise<SeriesProgress | null> {
  let value: unknown;
  try {
    value = await request(`/api/reels/series/${encodeURIComponent(seriesId)}/progress`);
  } catch (error) {
    if (error instanceof ReelApiError && error.status === 404) return null;
    throw error;
  }
  if (!isSeriesProgress(value) || value.series_id !== seriesId) {
    throw new ReelApiError("The reel API returned invalid series progress.", 502);
  }
  return value;
}

export async function saveSeriesProgress(
  seriesId: string,
  update: SeriesProgressUpdate,
): Promise<SeriesProgress> {
  if (!isSeriesProgressUpdate(update)) {
    throw new ReelApiError("Refusing to save invalid series progress.", 400);
  }
  const value = await request(`/api/reels/series/${encodeURIComponent(seriesId)}/progress`, {
    body: JSON.stringify(update),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
  if (!isSeriesProgress(value) || value.series_id !== seriesId) {
    throw new ReelApiError("The reel API returned invalid saved progress.", 502);
  }
  return value;
}
