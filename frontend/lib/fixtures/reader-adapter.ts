import type { RenderedPage } from "@scrollstack/contracts";

import type { MangaPanelVisual } from "@/components/MangaReader/MangaPanelArt";

/**
 * Frontend-only projection of the canonical RenderedPage contract. These view
 * types may change with the renderer, but API payloads must remain generated
 * @scrollstack/contracts types.
 */
export type ReaderBubbleView = {
  anchor: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  id: string;
  kind: "dialogue" | "narration";
  text: string;
};

export type ReaderPanelView = {
  bubbles: ReaderBubbleView[];
  id: string;
  image?: {
    alt: string;
    height: number;
    objectPosition: string;
    src: string;
    unoptimized?: boolean;
    width: number;
  };
  layout: "impact" | "standard" | "tall" | "wide";
  sceneDescription?: string;
  sfx?: string;
  visual?: MangaPanelVisual;
};

export type ReaderPageView = {
  id: string;
  panels: ReaderPanelView[];
  pageNumber: number;
  readingDirection?: "ltr" | "rtl";
  sourceLabel: string;
};

export type ReaderProjectView = {
  bookId: string;
  bookTitle: string;
  chapterLabel: string;
  pages: ReaderPageView[];
  projectId: string;
  receipt: {
    pageRange: string;
    sourceName: string;
  };
};

export type TrustedReaderAsset = ReaderPanelView["image"];

const panelLayout: Record<
  RenderedPage["storyboard_page"]["panels"][number]["shot_type"],
  ReaderPanelView["layout"]
> = {
  close_up: "standard",
  extreme_close_up: "impact",
  extreme_wide: "wide",
  insert: "standard",
  medium: "standard",
  over_shoulder: "tall",
  wide: "wide",
};

/**
 * Converts validated persisted pages into render-only fields. Asset IDs are
 * resolved through a trusted registry supplied by the caller; contract data
 * never becomes an arbitrary URL or filesystem path.
 */
export function adaptRenderedPage(
  page: RenderedPage,
  resolveAsset: (assetId: string) => TrustedReaderAsset | undefined,
  sourceRange?: { sourcePageEnd: number; sourcePageStart: number },
): ReaderPageView {
  return {
    id: page.storyboard_page.page_id,
    pageNumber: page.storyboard_page.page_index + 1,
    readingDirection:
      page.storyboard_page.reading_flow === "top-left to bottom-right" ? "ltr" : "rtl",
    sourceLabel: sourceLabelFor(page, sourceRange),
    panels: page.storyboard_page.panels.map((panel) => {
      const renderArtifact = page.panel_artifacts[panel.panel_id];
      if (!renderArtifact) {
        throw new Error(`Accepted panel ${panel.panel_id} has no render record.`);
      }
      const renderedAssetId =
        renderArtifact.asset_id ?? panel.visual_asset_ids?.[0];
      let image: TrustedReaderAsset | undefined;
      if (renderArtifact.render_status === "rendered") {
        if (!renderedAssetId) {
          throw new Error(`Rendered panel ${panel.panel_id} has no asset ID.`);
        }
        image = resolveAsset(renderedAssetId);
        if (!image) {
          throw new Error(`Rendered panel ${panel.panel_id} references missing asset ${renderedAssetId}.`);
        }
      } else if (renderArtifact.render_status !== "not_requested") {
        throw new Error(
          `Accepted panel ${panel.panel_id} has invalid render status ${renderArtifact.render_status}.`,
        );
      }
      const dialogue = (panel.dialogue ?? []).map((line, lineIndex) => ({
        anchor: lineIndex % 2 === 0 ? ("top-right" as const) : ("top-left" as const),
        id: `${panel.panel_id}-dialogue-${lineIndex}`,
        kind: "dialogue" as const,
        text: line.text,
      }));
      const narration = (panel.narration ?? []).map((text, lineIndex) => ({
        anchor: lineIndex % 2 === 0 ? ("bottom-left" as const) : ("bottom-right" as const),
        id: `${panel.panel_id}-narration-${lineIndex}`,
        kind: "narration" as const,
        text,
      }));

      return {
        bubbles: [...dialogue, ...narration],
        id: panel.panel_id,
        image,
        layout: panelLayout[panel.shot_type],
        sceneDescription: panel.action ?? panel.composition,
      };
    }),
  };
}

function sourceLabelFor(
  page: RenderedPage,
  fallback?: { sourcePageEnd: number; sourcePageStart: number },
): string {
  const refs = page.storyboard_page.panels.flatMap((panel) => panel.source_refs);
  if (refs.length === 0 && fallback) {
    return `Source pages ${fallback.sourcePageStart}-${fallback.sourcePageEnd}`;
  }
  const starts = refs.map((ref) => ref.page_start);
  const ends = refs.map((ref) => ref.page_end);
  return `Source pages ${Math.min(...starts)}-${Math.max(...ends)}`;
}
