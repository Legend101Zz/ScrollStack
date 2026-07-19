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
    width: number;
  };
  layout: "impact" | "standard" | "tall" | "wide";
  sfx?: string;
  visual: MangaPanelVisual;
};

export type ReaderPageView = {
  id: string;
  panels: ReaderPanelView[];
  pageNumber: number;
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

const purposeVisual: Record<
  RenderedPage["storyboard_page"]["panels"][number]["purpose"],
  MangaPanelVisual
> = {
  action: "stairs",
  dialogue: "letter",
  establishing: "harbour",
  explanation: "letter",
  reaction: "silence",
  reveal: "bell",
  transition: "stairs",
};

/**
 * Converts validated persisted pages into render-only fields. Asset IDs are
 * resolved through a trusted registry supplied by the caller; contract data
 * never becomes an arbitrary URL or filesystem path.
 */
export function adaptRenderedPage(
  page: RenderedPage,
  resolveAsset: (assetId: string) => TrustedReaderAsset | undefined,
): ReaderPageView {
  return {
    id: page.storyboard_page.page_id,
    pageNumber: page.storyboard_page.page_index + 1,
    sourceLabel: sourceLabelFor(page),
    panels: page.storyboard_page.panels.map((panel) => {
      const renderedAssetId = page.panel_artifacts[panel.panel_id]?.asset_id;
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
        image: renderedAssetId ? resolveAsset(renderedAssetId) : undefined,
        layout: panelLayout[panel.shot_type],
        visual: purposeVisual[panel.purpose],
      };
    }),
  };
}

function sourceLabelFor(page: RenderedPage): string {
  const refs = page.storyboard_page.panels.flatMap((panel) => panel.source_refs);
  const starts = refs.map((ref) => ref.page_start);
  const ends = refs.map((ref) => ref.page_end);
  return `Source pages ${Math.min(...starts)}-${Math.max(...ends)}`;
}
