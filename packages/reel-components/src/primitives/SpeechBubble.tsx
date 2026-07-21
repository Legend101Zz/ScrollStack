import { colors } from "@scrollstack/design-tokens";
import { Easing, interpolate, useCurrentFrame } from "remotion";

export type BubbleMotion = "pop" | "slide" | "type_on";

export function SpeechBubble({
  text,
  speakerId,
  index,
  total,
  motionPreset,
}: Readonly<{
  text: string;
  speakerId: string;
  index: number;
  total: number;
  motionPreset: BubbleMotion;
}>) {
  const frame = useCurrentFrame();
  const delay = index * 10;
  const visibleCharacters = Math.max(
    1,
    Math.min(text.length, Math.floor(((frame - delay) / Math.max(1, text.length * 0.55)) * text.length)),
  );
  const shownText = motionPreset === "type_on" ? text.slice(0, visibleCharacters) : text;
  const alignRight = index % 2 === 1;
  // Bubbles stack down the upper two thirds. The step is capped so a two-line
  // exchange sits as a conversation rather than being flung to both extremes,
  // and shrinks once there are enough lines to need the full band.
  const y = 16 + index * Math.min(28, 56 / Math.max(1, total - 1));
  // An overshooting curve reads as a pop without spring()'s hidden physics.
  const easing = Easing.bezier(0.16, 1, 0.3, 1);

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 40 + index,
        top: `${Math.min(72, y)}%`,
        left: alignRight ? "28%" : "7%",
        right: alignRight ? "7%" : "28%",
        translate:
          motionPreset === "slide"
            ? `${interpolate(frame, [delay, delay + 20], [(alignRight ? 1 : -1) * 120, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing,
              })}px 0px`
            : "0px 0px",
        scale:
          motionPreset === "slide"
            ? 1
            : interpolate(frame, [delay, delay + 20], [0.72, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing,
              }),
        transformOrigin: alignRight ? "bottom right" : "bottom left",
        opacity: interpolate(frame, [delay, delay + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      <div
        style={{
          position: "relative",
          color: colors.paperText,
          background: colors.paperHigh,
          border: `6px solid ${colors.ink}`,
          borderRadius: "52% 48% 50% 46% / 48% 54% 46% 52%",
          padding: "28px 38px",
          boxShadow: `10px 12px 0 rgba(13, 10, 8, 0.42)`,
          fontFamily: '"Arial Narrow", Arial, sans-serif',
          fontSize: text.length > 160 ? 34 : 42,
          fontWeight: 800,
          lineHeight: 1.12,
        }}
      >
        {shownText}
        <div
          style={{
            position: "absolute",
            bottom: -34,
            [alignRight ? "right" : "left"]: 54,
            width: 44,
            height: 44,
            background: colors.paperHigh,
            borderRight: `6px solid ${colors.ink}`,
            borderBottom: `6px solid ${colors.ink}`,
            transform: "rotate(45deg)",
          }}
        />
      </div>
      <div
        style={{
          // The tail is a 44px square rotated 45deg sitting 34px below the
          // bubble, so it reaches ~65px down. Anything less and it draws
          // straight through the speaker name.
          marginTop: 72,
          textAlign: alignRight ? "right" : "left",
          color: colors.textSecondary,
          fontFamily: "monospace",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {speakerId.replaceAll("_", " ")}
      </div>
    </div>
  );
}
