"use client";

import { preloadAudio, preloadImage } from "@remotion/preload";
import { useEffect } from "react";

import type { ReelFeedItem } from "./fixture-adapter";

/** Preloads only the assets for the likely horizontal and vertical destinations. */
export function useReelPrefetch(items: readonly (ReelFeedItem | undefined)[]): void {
  const sources = items
    .flatMap((item) => (item ? Object.values(item.composition.assets) : []))
    .map((asset) => ({ href: asset.src, kind: asset.kind }))
    .filter(
      (asset, index, all) =>
        (asset.kind === "image" || asset.kind === "audio") &&
        all.findIndex((candidate) => candidate.href === asset.href) === index,
    );
  const signature = sources.map((asset) => `${asset.kind}:${asset.href}`).join("|");

  useEffect(() => {
    const cleanup = sources.map((asset) =>
      asset.kind === "audio" ? preloadAudio(asset.href) : preloadImage(asset.href),
    );
    return () => cleanup.forEach((unpreload) => unpreload());
    // Asset identity is represented by the stable primitive signature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
