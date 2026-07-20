import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { localReelAssetStager } from "../src/asset-staging";
import type { ReelBundle } from "../src/types";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "scrollstack-reel-assets-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("local reel asset staging", () => {
  it("verifies a content hash and stages inside a namespaced bundle path", async () => {
    const root = await temporaryRoot();
    const sourceRoot = path.join(root, "trusted");
    const assetRoot = path.join(root, "bundle");
    await Promise.all([
      mkdir(sourceRoot, { recursive: true }),
      mkdir(assetRoot, { recursive: true }),
    ]);
    const bytes = Buffer.from("deterministic-image-fixture");
    const localPath = path.join(sourceRoot, "panel.png");
    await writeFile(localPath, bytes);
    const contentHash = createHash("sha256").update(bytes).digest("hex");
    const bundle: ReelBundle = {
      serveUrl: assetRoot,
      assetRoot,
      entryPoint: "/reviewed/entry.ts",
    };

    const staged = await localReelAssetStager.stage({
      bundle,
      namespace: "render_01",
      allowedSourceRoot: sourceRoot,
      sources: [
        {
          assetId: "panel_01",
          contentHash,
          kind: "image",
          mimeType: "image/png",
          localPath,
          width: 1080,
          height: 1920,
        },
      ],
    });

    expect(staged.panel_01?.src).toBe(
      `assets/render_01/${contentHash}.png`,
    );
    expect(
      await readFile(path.join(assetRoot, staged.panel_01!.src)),
    ).toEqual(bytes);

    await localReelAssetStager.cleanup(bundle, "render_01");
    await expect(
      readFile(path.join(assetRoot, staged.panel_01!.src)),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects a source outside the allowlisted input root", async () => {
    const root = await temporaryRoot();
    const sourceRoot = path.join(root, "trusted");
    const assetRoot = path.join(root, "bundle");
    const localPath = path.join(root, "outside.png");
    await Promise.all([
      mkdir(sourceRoot, { recursive: true }),
      mkdir(assetRoot, { recursive: true }),
      writeFile(localPath, "outside"),
    ]);
    const contentHash = createHash("sha256").update("outside").digest("hex");

    await expect(
      localReelAssetStager.stage({
        bundle: {
          serveUrl: assetRoot,
          assetRoot,
          entryPoint: "/reviewed/entry.ts",
        },
        namespace: "render_02",
        allowedSourceRoot: sourceRoot,
        sources: [
          {
            assetId: "outside",
            contentHash,
            kind: "image",
            mimeType: "image/png",
            localPath,
          },
        ],
      }),
    ).rejects.toThrow("outside its allowlisted root");
  });

  it("rejects a corrupt file already occupying a content-addressed destination", async () => {
    const root = await temporaryRoot();
    const sourceRoot = path.join(root, "trusted");
    const assetRoot = path.join(root, "bundle");
    await Promise.all([
      mkdir(sourceRoot, { recursive: true }),
      mkdir(path.join(assetRoot, "assets", "render_03"), { recursive: true }),
    ]);
    const bytes = Buffer.from("trusted-content");
    const localPath = path.join(sourceRoot, "panel.png");
    await writeFile(localPath, bytes);
    const contentHash = createHash("sha256").update(bytes).digest("hex");
    await writeFile(
      path.join(assetRoot, "assets", "render_03", `${contentHash}.png`),
      "corrupt-content",
    );

    await expect(
      localReelAssetStager.stage({
        bundle: { serveUrl: assetRoot, assetRoot, entryPoint: "/reviewed/entry.ts" },
        namespace: "render_03",
        allowedSourceRoot: sourceRoot,
        sources: [
          {
            assetId: "panel_03",
            contentHash,
            kind: "image",
            mimeType: "image/png",
            localPath,
          },
        ],
      }),
    ).rejects.toThrow("staged destination does not match its content hash");
  });
});
