import { colors } from "@scrollstack/design-tokens";
import { interpolate, useCurrentFrame } from "remotion";

import { PanelImage, SceneShell, getPanelAsset, type SceneRendererProps } from "./shared";

export function PageTurnSceneRenderer({ compiled, compiledScene }: SceneRendererProps) {
  if (compiledScene.scene.scene_type !== "page_turn") {
    throw new Error("page_turn renderer received a different scene type");
  }
  const scene = compiledScene.scene;
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, Math.max(1, scene.duration_frames - 1)], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fromClip =
    scene.direction === "ltr"
      ? `inset(0 ${progress}% 0 0)`
      : `inset(0 0 0 ${progress}%)`;
  const creaseLeft = scene.direction === "ltr" ? `${progress}%` : `${100 - progress}%`;

  return (
    <SceneShell>
      <PanelImage asset={getPanelAsset(compiled, compiledScene, scene.to_panel_id)} />
      <div style={{ position: "absolute", inset: 0, clipPath: fromClip }}>
        <PanelImage asset={getPanelAsset(compiled, compiledScene, scene.from_panel_id)} />
      </div>
      <div
        style={{
          position: "absolute",
          zIndex: 45,
          top: 0,
          bottom: 0,
          left: creaseLeft,
          width: 26,
          transform: "translateX(-50%)",
          background: `linear-gradient(90deg, transparent, ${colors.paperHigh}, ${colors.ink}, transparent)`,
          boxShadow: `0 0 36px ${colors.ink}`,
        }}
      />
    </SceneShell>
  );
}
