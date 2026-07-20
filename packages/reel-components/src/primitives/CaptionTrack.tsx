import { colors, reelSafeZone } from "@scrollstack/design-tokens";
import { useCurrentFrame } from "remotion";

import type { CaptionCue } from "../types";

export function CaptionTrack({ captions }: Readonly<{ captions: readonly CaptionCue[] }>) {
  const frame = useCurrentFrame();
  const cue = captions.find((candidate) => frame >= candidate.startFrame && frame < candidate.endFrame);
  if (!cue) return null;

  const fadeFrames = Math.min(5, Math.max(1, Math.floor((cue.endFrame - cue.startFrame) / 3)));
  const fadeIn = Math.min(1, (frame - cue.startFrame + 1) / fadeFrames);
  const fadeOut = Math.min(1, (cue.endFrame - frame) / fadeFrames);

  return (
    <div
      aria-label="Reel captions"
      style={{
        position: "absolute",
        zIndex: 80,
        left: reelSafeZone.side,
        right: reelSafeZone.side,
        bottom: reelSafeZone.bottom,
        display: "flex",
        justifyContent: "center",
        opacity: Math.max(0, Math.min(fadeIn, fadeOut)),
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: "94%",
          color: colors.textPrimary,
          background: "rgba(13, 10, 8, 0.88)",
          border: `3px solid ${colors.paper}`,
          boxShadow: `8px 8px 0 ${colors.accentDeep}`,
          padding: "22px 34px",
          fontFamily: 'Impact, "Arial Narrow", sans-serif',
          fontSize: cue.text.length > 120 ? 42 : 52,
          lineHeight: 1.13,
          letterSpacing: "0.015em",
          textAlign: "center",
          textTransform: cue.speakerId ? "none" : "uppercase",
          whiteSpace: "pre-wrap",
        }}
      >
        {cue.text}
      </div>
    </div>
  );
}
