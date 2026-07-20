import { colors } from "@scrollstack/design-tokens";
import { useCurrentFrame } from "remotion";

const LINES = Object.freeze([
  [-34, 11, 58],
  [-26, 19, 72],
  [-18, 27, 46],
  [-10, 34, 81],
  [-2, 42, 63],
  [6, 49, 75],
  [14, 57, 49],
  [22, 65, 84],
  [30, 73, 61],
  [38, 81, 70],
] as const);

export function SpeedLines() {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", zIndex: 35, inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {LINES.map(([rotation, top, width], index) => (
        <div
          key={`${rotation}-${top}`}
          style={{
            position: "absolute",
            top: `${top}%`,
            left: `${-15 + ((frame * (3 + (index % 3))) % 24)}%`,
            width: `${width}%`,
            height: index % 2 === 0 ? 9 : 5,
            background: index % 3 === 0 ? colors.accent : colors.paperHigh,
            opacity: 0.62,
            transform: `rotate(${rotation / 4}deg) skewX(-24deg)`,
            boxShadow: `0 0 2px ${colors.ink}`,
          }}
        />
      ))}
    </div>
  );
}
