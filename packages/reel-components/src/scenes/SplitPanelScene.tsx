import { colors } from "@scrollstack/design-tokens";
import { interpolate, useCurrentFrame } from "remotion";

import { PanelImage, SceneShell, getPanelAsset, type SceneRendererProps } from "./shared";

export function SplitPanelSceneRenderer({ compiled, compiledScene }: SceneRendererProps) {
  if (compiledScene.scene.scene_type !== "split_panel") {
    throw new Error("split_panel_reveal renderer received a different scene type");
  }
  const scene = compiledScene.scene;
  const frame = useCurrentFrame();
  const revealFrame = Math.max(1, Math.floor(scene.duration_frames * 0.25));
  const secondOpacity =
    scene.reveal_order === "simultaneous"
      ? 1
      : interpolate(frame, [revealFrame, revealFrame + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const dividerClip =
    scene.divider_style === "jagged"
      ? "polygon(52% 0, 45% 15%, 54% 29%, 46% 44%, 53% 61%, 44% 78%, 51% 100%, 49% 100%, 42% 78%, 51% 61%, 43% 44%, 51% 29%, 42% 15%, 49% 0)"
      : "polygon(48% 0, 52% 0, 52% 100%, 48% 100%)";

  return (
    <SceneShell>
      <div style={{ position: "absolute", inset: 0, right: "49.3%", overflow: "hidden" }}>
        <PanelImage asset={getPanelAsset(compiled, compiledScene, scene.panel_ids[0])} />
      </div>
      <div style={{ position: "absolute", inset: 0, left: "49.3%", overflow: "hidden", opacity: secondOpacity }}>
        <PanelImage asset={getPanelAsset(compiled, compiledScene, scene.panel_ids[1])} />
      </div>
      <div
        style={{
          position: "absolute",
          zIndex: 30,
          inset: 0,
          background: scene.divider_style === "clean" ? colors.paperHigh : colors.ink,
          clipPath: dividerClip,
        }}
      />
    </SceneShell>
  );
}
