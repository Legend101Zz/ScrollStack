import { reelAudioKitAll } from "@scrollstack/reel-components";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { LocalReelAssetSource } from "./types";

/**
 * Directory holding the vendored CC0 kit files. Resolved from the package entry
 * rather than hard-coded so it survives hoisting and worktree layouts.
 */
export function reelAudioKitRoot(): string {
  const entry = fileURLToPath(import.meta.resolve("@scrollstack/reel-components"));
  return path.resolve(path.dirname(entry), "..", "assets", "audio");
}

/**
 * Kit sounds as stager input. The stager re-hashes every file and refuses one
 * whose bytes do not match the hash recorded in the catalog, so a tampered or
 * truncated kit file fails the render instead of shipping silently.
 */
export function reelAudioKitSources(root: string = reelAudioKitRoot()): LocalReelAssetSource[] {
  return reelAudioKitAll.map((item) => ({
    assetId: item.soundId,
    contentHash: item.contentHash,
    kind: "audio" as const,
    mimeType: item.mimeType,
    localPath: path.join(root, item.fileName),
    durationMs: item.durationMs,
  }));
}
