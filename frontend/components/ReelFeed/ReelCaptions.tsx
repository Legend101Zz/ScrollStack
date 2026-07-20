"use client";

import type { CaptionCue } from "@scrollstack/reel-components";

export function ReelCaptions({
  captions,
  currentFrame,
}: {
  captions: readonly CaptionCue[];
  currentFrame: number;
}) {
  const cue = captions.find(
    (candidate) => currentFrame >= candidate.startFrame && currentFrame < candidate.endFrame,
  );
  if (!cue) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-auto absolute inset-x-6 bottom-24 z-20 h-28 sm:inset-x-12 sm:bottom-28"
      data-reel-caption
    >
      <p className="sr-only">{cue.text}</p>
    </div>
  );
}
