"use client";

import type { ReelFeedSeries } from "./types";

export function ReelSeriesRail({
  reelIndex,
  series,
  seriesIndex,
  seriesTotal,
}: {
  reelIndex: number;
  series: ReelFeedSeries;
  seriesIndex: number;
  seriesTotal: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-copy-secondary">
      <div>
        <span className="text-copy">{series.label}</span>
        <span className="ml-2 text-copy-muted">
          Series {seriesIndex + 1}/{seriesTotal}
        </span>
      </div>
      <div aria-label={`Reel ${reelIndex + 1} of ${series.reels.length}`} className="flex gap-1.5">
        {series.reels.map((reel, index) => (
          <span
            aria-hidden
            className={`h-1.5 rounded-full transition-all ${index === reelIndex ? "w-6 bg-accent-soft" : "w-1.5 bg-white/25"}`}
            key={reel.id}
          />
        ))}
      </div>
    </div>
  );
}
