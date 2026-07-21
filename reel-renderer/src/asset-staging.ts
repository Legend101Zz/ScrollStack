import { createReadStream } from "node:fs";
import { constants, copyFile, mkdir, realpath, rm, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import type { ResolvedReelAsset } from "@scrollstack/reel-components";

import type {
  LocalReelAssetSource,
  ReelAssetStager,
  ReelBundle,
  StageReelAssetsOptions,
} from "./types";

const SAFE_NAMESPACE = /^[a-zA-Z0-9_-]{1,128}$/;
const SHA_256 = /^[a-f0-9]{64}$/;

const EXTENSION_BY_MIME: Readonly<Record<string, string>> = Object.freeze({
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "audio/aac": ".aac",
  "audio/flac": ".flac",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "application/json": ".json",
});

function assertSafeNamespace(namespace: string): void {
  if (!SAFE_NAMESPACE.test(namespace)) {
    throw new Error(
      "asset namespace must contain only letters, digits, underscores, and hyphens",
    );
  }
}

function assertInside(root: string, candidate: string, label: string): void {
  const relative = path.relative(root, candidate);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return;
  }
  throw new Error(`${label} is outside its allowlisted root`);
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

function extensionFor(source: LocalReelAssetSource): string {
  const extension = EXTENSION_BY_MIME[source.mimeType];
  if (!extension) throw new Error(`unsupported reel asset MIME type: ${source.mimeType}`);
  if (source.kind === "image" && !source.mimeType.startsWith("image/")) {
    throw new Error(`asset ${source.assetId} must use an image MIME type`);
  }
  if (source.kind === "audio" && !source.mimeType.startsWith("audio/")) {
    throw new Error(`asset ${source.assetId} must use an audio MIME type`);
  }
  if (source.kind === "caption_track" && source.mimeType !== "application/json") {
    throw new Error(`caption track ${source.assetId} must use application/json`);
  }
  return extension;
}

async function stageOne(
  source: LocalReelAssetSource,
  sourceRoot: string,
  destinationRoot: string,
  namespace: string,
): Promise<ResolvedReelAsset> {
  if (!SHA_256.test(source.contentHash)) {
    throw new Error(`asset ${source.assetId} has an invalid SHA-256 content hash`);
  }

  const sourcePath = await realpath(source.localPath);
  assertInside(sourceRoot, sourcePath, `asset ${source.assetId}`);
  const sourceStats = await stat(sourcePath);
  if (!sourceStats.isFile()) throw new Error(`asset ${source.assetId} is not a regular file`);

  const actualHash = await sha256File(sourcePath);
  if (actualHash !== source.contentHash) {
    throw new Error(`asset ${source.assetId} content hash does not match its staged file`);
  }

  const extension = extensionFor(source);
  const relativePath = path.posix.join(
    "assets",
    namespace,
    `${source.contentHash}${extension}`,
  );
  const destinationPath = path.join(destinationRoot, ...relativePath.split("/"));
  assertInside(destinationRoot, destinationPath, `asset ${source.assetId} destination`);
  await mkdir(path.dirname(destinationPath), { recursive: true });
  const destinationDirectory = await realpath(path.dirname(destinationPath));
  assertInside(destinationRoot, destinationDirectory, `asset ${source.assetId} destination`);
  const verifiedDestinationPath = path.join(destinationDirectory, path.basename(destinationPath));
  try {
    await copyFile(sourcePath, verifiedDestinationPath, constants.COPYFILE_EXCL);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existingHash = await sha256File(verifiedDestinationPath);
    if (existingHash !== source.contentHash) {
      throw new Error(`asset ${source.assetId} staged destination does not match its content hash`);
    }
  }

  return Object.freeze({
    assetId: source.assetId,
    contentHash: source.contentHash,
    kind: source.kind,
    src: relativePath,
    mimeType: source.mimeType,
    ...(source.width === undefined ? {} : { width: source.width }),
    ...(source.height === undefined ? {} : { height: source.height }),
    ...(source.durationMs === undefined ? {} : { durationMs: source.durationMs }),
  });
}

export const localReelAssetStager: ReelAssetStager = Object.freeze({
  async stage(
    options: StageReelAssetsOptions,
  ): Promise<Readonly<Record<string, ResolvedReelAsset>>> {
    assertSafeNamespace(options.namespace);
    if (
      new Set(options.sources.map((source) => source.assetId)).size !==
      options.sources.length
    ) {
      throw new Error("reel asset IDs must be unique within a staging request");
    }
    for (const source of options.sources) {
      if (!source.assetId.trim()) throw new Error("reel asset IDs must not be empty");
      if (!path.isAbsolute(source.localPath)) {
        throw new Error(`asset ${source.assetId} localPath must be absolute`);
      }
    }
    const destinationRoot = await realpath(options.bundle.assetRoot);
    const sourceRoot = await realpath(options.allowedSourceRoot);
    const entries = await Promise.all(
      options.sources.map(async (source) => {
        const staged = await stageOne(
          source,
          sourceRoot,
          destinationRoot,
          options.namespace,
        );
        return [source.assetId, staged] as const;
      }),
    );
    return Object.freeze(Object.fromEntries(entries));
  },

  async cleanup(bundle: ReelBundle, namespace: string): Promise<void> {
    assertSafeNamespace(namespace);
    const destinationRoot = await realpath(bundle.assetRoot);
    const namespaceRoot = path.join(destinationRoot, "assets", namespace);
    assertInside(destinationRoot, namespaceRoot, "asset namespace");
    await rm(namespaceRoot, { recursive: true, force: true });
  },
});
