import { colors } from "@scrollstack/design-tokens";
import { interpolate, useCurrentFrame } from "remotion";

import { InkOverlay } from "../primitives/InkOverlay";
import { SfxHit } from "../primitives/SfxHit";
import { SpeedLines } from "../primitives/SpeedLines";
import { PanelImage, SceneShell, getPanelAsset, type SceneRendererProps } from "./shared";

export function ImpactCutSceneRenderer({ compiled, compiledScene }: SceneRendererProps) {
  if (compiledScene.scene.scene_type !== "impact_cut") {
    throw new Error("impact_cut renderer received a different scene type");
  }
  const scene = compiledScene.scene;
  const frame = useCurrentFrame();
  const shake = scene.impact_preset === "shake" ? Math.sin(frame * 2.6) * Math.max(0, 18 - frame) : 0;
  const flashOpacity =
    scene.impact_preset === "flash"
      ? interpolate(frame, [0, 2, 8], [1, 0.85, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  return (
    <SceneShell>
      <PanelImage
        asset={getPanelAsset(compiled, compiledScene, scene.panel_id)}
        style={{ transform: `translate(${shake}px, ${-shake * 0.7}px) scale(1.13)` }}
      />
      {scene.impact_preset === "speedlines" ? <SpeedLines /> : null}
      {scene.impact_preset === "ink_burst" ? <InkOverlay durationFrames={scene.duration_frames} /> : null}
      <div style={{ position: "absolute", zIndex: 45, inset: 0, background: colors.paperHigh, opacity: flashOpacity }} />
      <SfxHit text={scene.sfx_text} durationFrames={scene.duration_frames} />
    </SceneShell>
  );
}
