import { colors } from "@scrollstack/design-tokens";
import { interpolate, useCurrentFrame } from "remotion";

import { InkOverlay } from "../primitives/InkOverlay";
import { PanelImage, SceneShell, getAsset, type SceneRendererProps } from "./shared";

export function NarratorCardSceneRenderer({ compiled, compiledScene }: SceneRendererProps) {
  if (compiledScene.scene.scene_type !== "narrator_card") {
    throw new Error("narrator_card renderer received a different scene type");
  }
  const scene = compiledScene.scene;
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, Math.min(16, scene.duration_frames - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const reverse = scene.text_preset === "ink_reverse";
  const chapter = scene.text_preset === "chapter_card";

  return (
    <SceneShell>
      {scene.background_asset_id ? (
        <PanelImage
          asset={getAsset(compiled, scene.background_asset_id)}
          style={{ filter: "grayscale(1) sepia(0.15) contrast(1.25) brightness(0.38)" }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: reverse
              ? colors.ink
              : `repeating-linear-gradient(0deg, ${colors.paper} 0 7px, ${colors.paperSoft} 7px 8px)`,
          }}
        />
      )}
      <InkOverlay durationFrames={scene.duration_frames} mode="wash" />
      <div
        style={{
          position: "absolute",
          zIndex: 40,
          top: "24%",
          left: "9%",
          right: "9%",
          bottom: "26%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 58px",
          color: reverse || scene.background_asset_id ? colors.textPrimary : colors.paperText,
          background: scene.background_asset_id ? "rgba(13, 10, 8, 0.78)" : reverse ? colors.inkRaised : colors.paperHigh,
          border: `8px ${chapter ? "double" : "solid"} ${reverse ? colors.paper : colors.ink}`,
          boxShadow: `18px 20px 0 ${colors.accentDeep}`,
          opacity: progress,
          transform: `translateY(${(1 - progress) * 42}px)`,
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: scene.text.length > 280 ? 48 : scene.text.length > 140 ? 58 : 72,
          fontWeight: chapter ? 900 : 700,
          lineHeight: 1.18,
          textAlign: "center",
          textTransform: chapter ? "uppercase" : "none",
        }}
      >
        {scene.text}
      </div>
    </SceneShell>
  );
}
