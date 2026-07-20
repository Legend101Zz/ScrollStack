import {
  previewCompiledReel,
  type CompiledReel,
} from "@scrollstack/reel-components";
import { describe, expect, it } from "vitest";

import { assertOfflineAssetSources } from "../src/offline-assets";

describe("offline render assets", () => {
  it("accepts the reviewed inline preview assets", () => {
    expect(() => assertOfflineAssetSources(previewCompiledReel)).not.toThrow();
  });

  it("rejects remote asset sources before Chromium starts", () => {
    const [assetId, asset] = Object.entries(previewCompiledReel.assets)[0]!;
    const compiled: CompiledReel = {
      ...previewCompiledReel,
      assets: {
        ...previewCompiledReel.assets,
        [assetId]: { ...asset, src: "https://example.invalid/panel.png" },
      },
    };

    expect(() => assertOfflineAssetSources(compiled)).toThrow(
      "remote and file URLs are forbidden",
    );
  });

  it("accepts a content-addressed path created by the stager", () => {
    const [assetId, asset] = Object.entries(previewCompiledReel.assets)[0]!;
    const compiled: CompiledReel = {
      ...previewCompiledReel,
      assets: {
        ...previewCompiledReel.assets,
        [assetId]: {
          ...asset,
          src: `assets/render_01/${asset.contentHash}.png`,
        },
      },
    };

    expect(() => assertOfflineAssetSources(compiled)).not.toThrow();
  });

  it("rejects a staged path whose digest differs from the resolved asset", () => {
    const [assetId, asset] = Object.entries(previewCompiledReel.assets)[0]!;
    const compiled: CompiledReel = {
      ...previewCompiledReel,
      assets: {
        ...previewCompiledReel.assets,
        [assetId]: {
          ...asset,
          src: `assets/render_01/${"d".repeat(64)}.png`,
        },
      },
    };

    expect(() => assertOfflineAssetSources(compiled)).toThrow(
      "staged path does not match its content hash",
    );
  });
});
