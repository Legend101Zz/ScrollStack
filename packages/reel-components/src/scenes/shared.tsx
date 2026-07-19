import { colors } from "@scrollstack/design-tokens";
import { Img } from "remotion";

import type { CompiledReel, CompiledScene, ManifestPanel, ResolvedReelAsset } from "../types";

export type SceneRendererProps = Readonly<{
  compiled: CompiledReel;
  compiledScene: CompiledScene;
}>;

export function getPanel(compiled: CompiledReel, panelId: string): ManifestPanel {
  const panel = compiled.manga.panels.find((candidate) => candidate.panel_id === panelId);
  if (!panel) throw new Error(`compiled reel is missing panel ${panelId}`);
  return panel;
}

export function getAsset(compiled: CompiledReel, assetId: string): ResolvedReelAsset {
  const asset = compiled.assets[assetId];
  if (!asset) throw new Error(`compiled reel is missing asset ${assetId}`);
  return asset;
}

export function getPanelAsset(
  compiled: CompiledReel,
  compiledScene: CompiledScene,
  panelId: string,
): ResolvedReelAsset {
  const assetId = compiledScene.panelAssetIds[panelId];
  if (!assetId) throw new Error(`compiled scene is missing a panel asset mapping for ${panelId}`);
  return getAsset(compiled, assetId);
}

export function PanelImage({
  asset,
  style,
}: Readonly<{ asset: ResolvedReelAsset; style?: React.CSSProperties }>) {
  return (
    <Img
      src={asset.src}
      alt=""
      maxRetries={2}
      pauseWhenLoading
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        filter: "grayscale(0.82) sepia(0.18) contrast(1.2)",
        ...style,
      }}
    />
  );
}

export function SceneShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: colors.shell,
        color: colors.textPrimary,
        fontFamily: 'Inter, "Arial Narrow", Arial, sans-serif',
      }}
    >
      {children}
      <div
        style={{
          position: "absolute",
          zIndex: 70,
          inset: 20,
          border: `5px solid ${colors.ink}`,
          boxShadow: `inset 0 0 0 2px ${colors.paperSoft}`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
