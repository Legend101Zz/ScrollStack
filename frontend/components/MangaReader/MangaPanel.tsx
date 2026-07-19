import { MangaPanelArt } from "@/components/MangaReader/MangaPanelArt";
import type { ReaderBubbleView, ReaderPanelView } from "@/lib/fixtures/reader-adapter";
import { cn } from "@/lib/cn";
import Image from "next/image";

const layoutClass: Record<ReaderPanelView["layout"], string> = {
  impact: "col-span-3 border-accent-deep sm:col-span-3",
  standard: "col-span-3",
  tall: "col-span-3 row-span-2 min-h-72",
  wide: "col-span-6 min-h-48 sm:min-h-56",
};

const bubbleAnchorClass: Record<ReaderBubbleView["anchor"], string> = {
  "bottom-left": "bottom-3 left-3",
  "bottom-right": "bottom-3 right-3",
  "top-left": "left-3 top-3",
  "top-right": "right-3 top-3",
};

export function MangaPanel({
  panel,
  vertical = false,
}: {
  panel: ReaderPanelView;
  vertical?: boolean;
}) {
  return (
    <article
      aria-label={`Manga panel ${panel.id}`}
      className={cn(
        "relative min-h-44 overflow-hidden border-[3px] border-ink bg-paper-soft",
        vertical ? "min-h-[18rem] w-full border-x-0 border-b-[3px] border-t-0" : layoutClass[panel.layout],
      )}
    >
      {panel.image ? (
        <Image
          alt={panel.image.alt}
          className="absolute inset-0 h-full w-full object-cover"
          height={panel.image.height}
          sizes={vertical ? "100vw" : "(max-width: 767px) 100vw, 38vw"}
          src={panel.image.src}
          style={{ objectPosition: panel.image.objectPosition }}
          width={panel.image.width}
        />
      ) : (
        <MangaPanelArt visual={panel.visual} />
      )}
      {panel.sfx ? (
        <span className="absolute left-[7%] top-[8%] rotate-[-7deg] font-display text-3xl text-accent-deep drop-shadow-[1px_1px_0_var(--ss-color-paper-high)] sm:text-5xl">
          {panel.sfx}
        </span>
      ) : null}
      {panel.bubbles.map((bubble) => (
        <span
          className={cn(
            "absolute z-[1] max-w-[10rem] text-[11px] font-medium leading-[1.35] sm:max-w-[12rem] sm:text-xs",
            bubbleAnchorClass[bubble.anchor],
            bubble.kind === "dialogue"
              ? "rounded-[48%] border-2 border-ink bg-paper-high px-3 py-2 text-center text-copy-paper"
              : "bg-ink px-3 py-2 text-paper-high",
          )}
          key={bubble.id}
        >
          {bubble.text}
        </span>
      ))}
    </article>
  );
}
