import { colors } from "@scrollstack/design-tokens";
import { interpolate, useCurrentFrame } from "remotion";

export function InkOverlay({
  durationFrames,
  mode = "burst",
}: Readonly<{ durationFrames: number; mode?: "burst" | "wash" }>) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, Math.max(1, durationFrames - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const radius = mode === "burst" ? 8 + progress * 120 : 150 - progress * 150;
  const opacity = mode === "burst" ? Math.max(0, 0.72 - progress * 0.72) : 0.28 * (1 - progress);

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 25,
        inset: 0,
        pointerEvents: "none",
        opacity,
        background: colors.ink,
        clipPath: `circle(${radius}% at 50% 48%)`,
      }}
    />
  );
}
