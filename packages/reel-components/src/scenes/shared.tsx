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

/**
 * Printed manga is pure ink on paper, not a sepia photograph. Full grayscale
 * with lifted contrast reads as inked linework; the previous partial grayscale
 * plus sepia left every panel a muddy brown.
 */
const MANGA_INK_FILTER = "grayscale(1) contrast(1.42) brightness(1.06)";

/**
 * Screentone. Real manga shades with printed dot rasters, so the tone belongs to
 * the page rather than to the artwork: it is a fixed overlay and deliberately
 * does not scale or pan with the camera. Built from a CSS gradient because our
 * own inline-SVG guard forbids `url(` references, and because this then applies
 * to generated panels too, not just fixtures.
 */
export function Screentone({ opacity = 0.22 }: Readonly<{ opacity?: number }>) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage:
          "radial-gradient(circle at 50% 50%, rgba(13, 10, 8, 0.9) 1.1px, transparent 1.2px)",
        backgroundSize: "7px 7px",
        mixBlendMode: "multiply",
        opacity,
        pointerEvents: "none",
        zIndex: 5,
      }}
    />
  );
}

export function PanelImage({
  asset,
  style,
  tone = true,
}: Readonly<{ asset: ResolvedReelAsset; style?: React.CSSProperties; tone?: boolean }>) {
  return (
    <>
      <Img
        src={asset.src}
        alt=""
        maxRetries={2}
        pauseWhenLoading
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: MANGA_INK_FILTER,
          ...style,
        }}
      />
      {tone ? <Screentone /> : null}
    </>
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
