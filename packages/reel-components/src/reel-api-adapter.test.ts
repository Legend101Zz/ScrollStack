import { describe, expect, it } from "vitest";

import playerPayloadJson from "../../fixtures/canonical/reel_player_payload.v1.json";
import seriesJson from "../../fixtures/canonical/reel_series.v1.json";

import {
  ReelApiContractError,
  adaptReelPlayerPayload,
  adaptReelSeriesCatalog,
  nextProgressUpdate,
  parseSeriesProgress,
  selectResumePosition,
} from "../../../frontend/components/ReelFeed/reel-api-adapter";

const SECOND_REEL_ID = "reel_demo_002";

function twoReelSeries(): unknown {
  const series = structuredClone(seriesJson);
  series.reels.push({
    duration_frames: 240,
    reel_id: SECOND_REEL_ID,
    reel_spec_artifact_id: "artifact_reel_spec_002",
    sequence: 1,
  });
  return series;
}

describe("reel API adapter", () => {
  it("validates and maps a lazy catalog with contract-honest labels", () => {
    const catalog = adaptReelSeriesCatalog([seriesJson], "book_demo", "project_demo");

    expect(catalog).toMatchObject({
      bookId: "book_demo",
      projectId: "project_demo",
      sourceLabel: "Manga project project_demo",
      title: "Reels",
    });
    expect(catalog.series[0]).toMatchObject({
      id: "series_demo_001",
      label: "Series 1",
    });
    expect(catalog.series[0]?.reels[0]).toEqual({
      durationFrames: 180,
      id: "reel_demo_001",
      label: "Reel 1",
      reelSpecArtifactId: "artifact_reel_spec_001",
      sequence: 0,
    });
  });

  it("rejects malformed or cross-project catalog responses", () => {
    expect(() =>
      adaptReelSeriesCatalog([{ ...seriesJson, unexpected: true }], "book_demo", "project_demo"),
    ).toThrow(ReelApiContractError);
    expect(() => adaptReelSeriesCatalog([seriesJson], "book_elsewhere", "project_demo")).toThrow(
      /requested book and project/,
    );
  });

  it("maps a validated player payload into camelCase compiler input", () => {
    const item = adaptReelPlayerPayload(playerPayloadJson);

    expect(item).toMatchObject({
      durationFrames: 180,
      expiresAt: "2026-07-20T06:30:00Z",
      id: "reel_demo_001",
      label: "Reel 1",
      posterUrl: "/media/reels/reel_demo_001/poster.png",
      reelSpecArtifactId: "artifact_reel_spec_001",
      renderedMp4Url: "https://media.scrollstack.dev/reels/reel_demo_001.mp4",
      sequence: 0,
      seriesId: "series_demo_001",
    });
    expect(item.composition.assets.asset_last_observatory_key_panel_v1).toEqual({
      assetId: "asset_last_observatory_key_panel_v1",
      contentHash: "1".repeat(64),
      height: 1920,
      kind: "image",
      mimeType: "image/png",
      src: "/media/assets/asset_last_observatory_key_panel_v1.png",
      width: 1080,
    });
    expect(item.composition.captions[0]).toEqual({
      endFrame: 90,
      speakerId: "character_kael",
      startFrame: 0,
      text: "The map remembers every failure.",
    });
    expect(item.composition.spec).toEqual(playerPayloadJson.reel_spec);
    expect(item.composition.manga).toEqual(playerPayloadJson.manga_manifest);
  });

  it("selects the newest valid progress target and defaults to the first reel", () => {
    const first = structuredClone(twoReelSeries()) as typeof seriesJson;
    const second = structuredClone(seriesJson);
    second.series_id = "series_demo_002";
    second.manga_manifest_artifact_id = "artifact_manifest_002";
    second.reels[0] = {
      duration_frames: 180,
      reel_id: "reel_series_2_001",
      reel_spec_artifact_id: "artifact_series_2_reel_001",
      sequence: 0,
    };
    const catalog = adaptReelSeriesCatalog([first, second], "book_demo", "project_demo");
    const older = parseSeriesProgress({
      last_manga_page: 3,
      last_reel_id: SECOND_REEL_ID,
      schema_version: "series-progress.v1",
      series_id: "series_demo_001",
      updated_at: "2026-07-20T05:30:00Z",
      viewed_reel_ids: ["reel_demo_001", SECOND_REEL_ID],
    });
    const newer = parseSeriesProgress({
      last_manga_page: 4,
      last_reel_id: "reel_series_2_001",
      schema_version: "series-progress.v1",
      series_id: "series_demo_002",
      updated_at: "2026-07-20T06:30:00Z",
      viewed_reel_ids: ["reel_series_2_001"],
    });

    expect(selectResumePosition(catalog, [older, newer])).toEqual({
      reelIndex: 0,
      seriesIndex: 1,
    });
    expect(selectResumePosition(catalog, [])).toEqual({ reelIndex: 0, seriesIndex: 0 });
  });

  it("preserves manga progress and emits the viewed union in reel sequence order", () => {
    const catalog = adaptReelSeriesCatalog([twoReelSeries()], "book_demo", "project_demo");
    const series = catalog.series[0];
    if (!series) throw new Error("expected canonical series");
    const existing = parseSeriesProgress({
      last_manga_page: 7,
      last_reel_id: SECOND_REEL_ID,
      schema_version: "series-progress.v1",
      series_id: series.id,
      updated_at: "2026-07-20T06:30:00Z",
      viewed_reel_ids: [SECOND_REEL_ID],
    });

    expect(nextProgressUpdate(series, "reel_demo_001", existing)).toEqual({
      last_manga_page: 7,
      last_reel_id: "reel_demo_001",
      schema_version: "series-progress-update.v1",
      viewed_reel_ids: ["reel_demo_001", SECOND_REEL_ID],
    });
    expect(nextProgressUpdate(series, SECOND_REEL_ID, null).last_manga_page).toBe(0);
    expect(() => nextProgressUpdate(series, "reel_elsewhere", existing)).toThrow(
      ReelApiContractError,
    );
  });
});
