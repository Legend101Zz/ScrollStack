import { bundle } from "@remotion/bundler";
import { fileURLToPath } from "node:url";

import type { ReelBundle, ReelBundleOptions } from "./types";

const defaultEntryPoint = fileURLToPath(new URL("./entry.ts", import.meta.url));

let defaultBundlePromise: Promise<ReelBundle> | undefined;

export async function createReelBundle(
  options: ReelBundleOptions = {},
): Promise<ReelBundle> {
  const entryPoint = options.entryPoint ?? defaultEntryPoint;
  const serveUrl = await bundle({
    entryPoint,
    enableCaching: true,
    outDir: options.outDir ?? null,
    publicDir: options.publicDir ?? null,
    onProgress: options.onProgress,
  });

  return Object.freeze({
    serveUrl,
    assetRoot: serveUrl,
    entryPoint,
  });
}

/** Bundles once per worker process and reuses the immutable reviewed code. */
export function getOrCreateReelBundle(): Promise<ReelBundle> {
  defaultBundlePromise ??= createReelBundle();
  return defaultBundlePromise;
}

/** Test-only lifecycle hook; production workers should retain the cached bundle. */
export function resetReelBundleCacheForTests(): void {
  defaultBundlePromise = undefined;
}
