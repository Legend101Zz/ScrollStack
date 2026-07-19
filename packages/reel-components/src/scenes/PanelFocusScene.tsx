import { interpolate, useCurrentFrame } from "remotion";

import { SceneShell, PanelImage, getPanelAsset, type SceneRendererProps } from "./shared";

export function PanelFocusSceneRenderer({ compiled, compiledScene }: SceneRendererProps) {
  if (compiledScene.scene.scene_type !== "panel_focus") {
    throw new Error("panel_focus renderer received a different scene type");
  }
  const scene = compiledScene.scene;
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, Math.max(1, scene.duration_frames - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const focus = scene.focus_box_pct;
  const originX = focus ? focus.x_pct + focus.width_pct / 2 : 50;
  const originY = focus ? focus.y_pct + focus.height_pct / 2 : 50;
  const scale =
    scene.motion_preset === "pull_out"
      ? 1.14 - progress * 0.14
      : scene.motion_preset === "hold"
        ? 1.03
        : 1.02 + progress * 0.14;
  const translateX =
    scene.motion_preset === "pan_left"
      ? 7 - progress * 14
      : scene.motion_preset === "pan_right"
        ? -7 + progress * 14
        : 0;

  return (
    <SceneShell>
      <PanelImage
        asset={getPanelAsset(compiled, compiledScene, scene.panel_id)}
        style={{
          transform: `translateX(${translateX}%) scale(${scale})`,
          transformOrigin: `${originX}% ${originY}%`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 50% 48%, transparent 34%, rgba(13, 10, 8, 0.54) 100%)",
        }}
      />
    </SceneShell>
  );
}
