import { colors } from "@scrollstack/design-tokens";
import { useCurrentFrame } from "remotion";

import { PanelImage, SceneShell, getPanelAsset, type SceneRendererProps } from "./shared";

export function MontageSceneRenderer({ compiled, compiledScene }: SceneRendererProps) {
  if (compiledScene.scene.scene_type !== "montage") {
    throw new Error("panel_montage renderer received a different scene type");
  }
  const scene = compiledScene.scene;
  const frame = useCurrentFrame();
  const preset = scene.layout_preset ?? "cascade";
  if (preset === "rapid_cuts") {
    const framesPerPanel = Math.max(1, Math.floor(scene.duration_frames / scene.panel_ids.length));
    const active = Math.min(scene.panel_ids.length - 1, Math.floor(frame / framesPerPanel));
    const panelId = scene.panel_ids[active];
    return (
      <SceneShell>
        <PanelImage asset={getPanelAsset(compiled, compiledScene, panelId)} style={{ transform: "scale(1.08)" }} />
        <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 0 22px ${colors.paperHigh}` }} />
      </SceneShell>
    );
  }

  const columns = preset === "grid" ? 2 : 1;
  return (
    <SceneShell>
      <div
        style={{
          position: "absolute",
          inset: preset === "grid" ? 24 : 54,
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gridAutoRows: "minmax(0, 1fr)",
          gap: 14,
          transform: preset === "cascade" ? "rotate(-2deg)" : undefined,
        }}
      >
        {scene.panel_ids.map((panelId, index) => (
          <div
            key={panelId}
            style={{
              position: "relative",
              minHeight: 0,
              overflow: "hidden",
              border: `8px solid ${colors.paperHigh}`,
              boxShadow: preset === "cascade" ? `${index * 7}px ${index * 9}px 0 ${colors.ink}` : undefined,
              transform: preset === "cascade" ? `translateX(${index % 2 === 0 ? -18 : 18}px)` : undefined,
            }}
          >
            <PanelImage asset={getPanelAsset(compiled, compiledScene, panelId)} />
          </div>
        ))}
      </div>
    </SceneShell>
  );
}
