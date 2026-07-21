import { Easing, interpolate, useCurrentFrame } from "remotion";

import { SceneShell, PanelImage, getPanelAsset, type SceneRendererProps } from "./shared";

export function PanelFocusSceneRenderer({ compiled, compiledScene }: SceneRendererProps) {
  if (compiledScene.scene.scene_type !== "panel_focus") {
    throw new Error("panel_focus renderer received a different scene type");
  }
  const scene = compiledScene.scene;
  const frame = useCurrentFrame();
  const focus = scene.focus_box_pct;
  // Camera moves toward the crop hint the manga lane chose, so the subject
  // stays put instead of drifting off the safe area.
  const originX = focus ? focus.x_pct + focus.width_pct / 2 : 50;
  const originY = focus ? focus.y_pct + focus.height_pct / 2 : 50;
  const lastFrame = Math.max(1, scene.duration_frames - 1);
  const ease = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.33, 0, 0.67, 1) } as const;
  const scaleRange: readonly [number, number] =
    scene.motion_preset === "pull_out" ? [1.14, 1.0] : scene.motion_preset === "hold" ? [1.03, 1.03] : [1.02, 1.16];
  const panRange: readonly [number, number] =
    scene.motion_preset === "pan_left" ? [7, -7] : scene.motion_preset === "pan_right" ? [-7, 7] : [0, 0];

  return (
    <SceneShell>
      <PanelImage
        asset={getPanelAsset(compiled, compiledScene, scene.panel_id)}
        style={{
          scale: interpolate(frame, [0, lastFrame], scaleRange, ease),
          translate: `${interpolate(frame, [0, lastFrame], panRange, ease)}% 0%`,
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
