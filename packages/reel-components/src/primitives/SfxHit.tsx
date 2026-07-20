import { colors } from "@scrollstack/design-tokens";
import { interpolate, useCurrentFrame } from "remotion";

export function SfxHit({ text, durationFrames }: Readonly<{ text: string; durationFrames: number }>) {
  const frame = useCurrentFrame();
  const enter = Math.min(8, Math.max(1, Math.floor(durationFrames / 4)));
  const scale = interpolate(frame, [0, enter], [1.8, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotation = Math.sin(frame * 1.7) * Math.max(0, 8 - frame * 0.45);

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 60,
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${scale}) rotate(${rotation}deg) skewX(-8deg)`,
        color: colors.paperHigh,
        WebkitTextStroke: `10px ${colors.ink}`,
        paintOrder: "stroke fill",
        textShadow: `18px 20px 0 ${colors.accentDeep}`,
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: text.length > 12 ? 150 : 220,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
      }}
    >
      {text}
    </div>
  );
}
