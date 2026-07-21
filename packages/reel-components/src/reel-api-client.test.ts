import { afterEach, describe, expect, it, vi } from "vitest";

import playerPayloadJson from "../../fixtures/canonical/reel_player_payload.v1.json";
import progressJson from "../../fixtures/canonical/series_progress.v1.json";
import seriesJson from "../../fixtures/canonical/reel_series.v1.json";

import { adaptReelSeriesCatalog } from "../../../frontend/components/ReelFeed/reel-api-adapter";
import {
  ReelApiError,
  loadCatalogReel,
  loadReelCatalog,
  loadSeriesProgress,
  saveSeriesProgress,
} from "../../../frontend/components/ReelFeed/reel-api-client";

function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

afterEach(() => vi.unstubAllGlobals());

describe("reel API client", () => {
  it("loads discovery through the same-origin project route", async () => {
    const fetcher = vi.fn(async () => jsonResponse([seriesJson]));
    vi.stubGlobal("fetch", fetcher);

    const catalog = await loadReelCatalog("book_demo", "project_demo");

    expect(catalog.series[0]?.id).toBe("series_demo_001");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/reels/projects/project_demo",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("treats only a progress 404 as an empty resume state", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ detail: "not found" }, 404))
        .mockResolvedValueOnce(jsonResponse({ detail: "broken" }, 500)),
    );

    await expect(loadSeriesProgress("series_demo_001")).resolves.toBeNull();
    await expect(loadSeriesProgress("series_demo_001")).rejects.toMatchObject({ status: 500 });
  });

  it("rejects a player payload that disagrees with its catalog entry", async () => {
    const catalog = adaptReelSeriesCatalog([seriesJson], "book_demo", "project_demo");
    const series = catalog.series[0];
    const reel = series?.reels[0];
    if (!series || !reel) throw new Error("expected canonical reel");
    const mismatched = structuredClone(playerPayloadJson);
    mismatched.reel_spec_artifact_id = "artifact_elsewhere";
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(mismatched)));

    await expect(loadCatalogReel(series, reel)).rejects.toBeInstanceOf(ReelApiError);
  });

  it("sends a validated full progress replacement and validates the result", async () => {
    const fetcher = vi.fn(async () => jsonResponse(progressJson));
    vi.stubGlobal("fetch", fetcher);
    const update = {
      last_manga_page: 0,
      last_reel_id: "reel_demo_001",
      schema_version: "series-progress-update.v1" as const,
      viewed_reel_ids: ["reel_demo_001"],
    };

    await expect(saveSeriesProgress("series_demo_001", update)).resolves.toEqual(progressJson);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/reels/series/series_demo_001/progress",
      expect.objectContaining({
        body: JSON.stringify(update),
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        method: "PUT",
      }),
    );
  });
});
