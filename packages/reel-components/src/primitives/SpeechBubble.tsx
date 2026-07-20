import { colors, motion } from "@scrollstack/design-tokens";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

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
  const { fps } = useVideoConfig();
  const delay = index * 10;
  const progress = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { stiffness: motion.springStiffness, damping: motion.springDamping },
    durationInFrames: 20,
  });
  const visibleCharacters = Math.max(
    1,
    Math.min(text.length, Math.floor(((frame - delay) / Math.max(1, text.length * 0.55)) * text.length)),
  );
  const shownText = motionPreset === "type_on" ? text.slice(0, visibleCharacters) : text;
  const y = 16 + (index * 64) / Math.max(1, total);
  const alignRight = index % 2 === 1;
  const transform =
    motionPreset === "slide"
      ? `translateX(${(alignRight ? 1 : -1) * (1 - progress) * 120}px)`
      : `scale(${0.72 + progress * 0.28})`;

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 40 + index,
        top: `${Math.min(76, y)}%`,
        left: alignRight ? "28%" : "7%",
        right: alignRight ? "7%" : "28%",
        transform,
        transformOrigin: alignRight ? "bottom right" : "bottom left",
        opacity: progress,
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
          marginTop: 20,
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
