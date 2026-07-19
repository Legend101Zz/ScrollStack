"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useCallback, useEffect } from "react";

import type { ReelFeedPayload } from "./fixture-adapter";
import { ReelSeriesRail } from "./ReelSeriesRail";
import { ReelViewport } from "./ReelViewport";
import { useAxisLockedGesture } from "./useAxisLockedGesture";
import { useReelFeedStore } from "./useReelFeedStore";
import { useReelPrefetch } from "./useReelPrefetch";

function isInteractiveKeyboardTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("button, a, input, textarea, select, [role='slider']"));
}

export function ReelFeed({ payload }: { payload: ReelFeedPayload }) {
  const controlsVisible = useReelFeedStore((state) => state.controlsVisible);
  const gestureAxis = useReelFeedStore((state) => state.gestureAxis);
  const muted = useReelFeedStore((state) => state.muted);
  const playing = useReelFeedStore((state) => state.playing);
  const reelIndex = useReelFeedStore((state) => state.reelIndex);
  const seriesIndex = useReelFeedStore((state) => state.seriesIndex);
  const moveHorizontal = useReelFeedStore((state) => state.moveHorizontal);
  const moveVertical = useReelFeedStore((state) => state.moveVertical);
  const reset = useReelFeedStore((state) => state.reset);
  const setGestureAxis = useReelFeedStore((state) => state.setGestureAxis);
  const setMuted = useReelFeedStore((state) => state.setMuted);
  const setPlaying = useReelFeedStore((state) => state.setPlaying);
  const toggleControls = useReelFeedStore((state) => state.toggleControls);

  useEffect(() => reset(), [payload.bookId, payload.projectId, reset]);

  const series = payload.series[seriesIndex] ?? payload.series[0];
  const item = series?.reels[reelIndex] ?? series?.reels[0];
  const reelCounts = payload.series.map((candidate) => candidate.reels.length);
  const navigateHorizontal = useCallback(
    (direction: -1 | 1) => moveHorizontal(direction, series?.reels.length ?? 0),
    [moveHorizontal, series?.reels.length],
  );
  const navigateVertical = useCallback(
    (direction: -1 | 1) => moveVertical(direction, reelCounts),
    [moveVertical, reelCounts],
  );
  const gesture = useAxisLockedGesture({
    onAxisChange: setGestureAxis,
    onNavigateHorizontal: navigateHorizontal,
    onNavigateVertical: navigateVertical,
  });

  const horizontalNeighbor = series
    ? series.reels[reelIndex + 1] ?? series.reels[reelIndex - 1]
    : undefined;
  const verticalSeries = payload.series[seriesIndex + 1] ?? payload.series[seriesIndex - 1];
  const verticalNeighbor = verticalSeries?.reels[
    Math.min(reelIndex, Math.max((verticalSeries?.reels.length ?? 1) - 1, 0))
  ];
  useReelPrefetch([horizontalNeighbor, verticalNeighbor]);

  if (!series || !item) {
    return (
      <main className="fixed inset-0 z-[60] grid h-[100dvh] place-items-center bg-shell px-4 text-center text-copy-secondary">
        No reels are ready for this manga yet.
      </main>
    );
  }

  const canGoLeft = reelIndex > 0;
  const canGoRight = reelIndex < series.reels.length - 1;
  const canGoUp = seriesIndex > 0;
  const canGoDown = seriesIndex < payload.series.length - 1;

  return (
    <main
      {...gesture}
      aria-label="Reel feed"
      className="fixed inset-0 z-[60] h-[100dvh] touch-none overflow-hidden bg-shell px-3 pb-6 pt-16 outline-none sm:px-6 sm:pb-8 sm:pt-20"
      onKeyDown={(event) => {
        if (isInteractiveKeyboardTarget(event.target)) return;
        if (event.key === "ArrowLeft" && canGoLeft) navigateHorizontal(-1);
        else if (event.key === "ArrowRight" && canGoRight) navigateHorizontal(1);
        else if (event.key === "ArrowUp" && canGoUp) navigateVertical(-1);
        else if (event.key === "ArrowDown" && canGoDown) navigateVertical(1);
        else return;
        event.preventDefault();
      }}
      tabIndex={0}
    >
      <header className="pointer-events-none absolute inset-x-4 top-3 z-40 flex items-start justify-between gap-4 sm:inset-x-6 sm:top-5">
        <div className="min-w-0 rounded-control border border-white/10 bg-ink/75 px-3 py-2 shadow-chrome backdrop-blur-md">
          <p className="truncate font-display text-sm text-copy sm:text-base">{payload.title}</p>
          <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-copy-muted">
            {payload.sourceLabel}
          </p>
        </div>
        <button
          aria-label={controlsVisible ? "Hide reel controls" : "Show reel controls"}
          className="focus-ring pointer-events-auto grid min-h-11 min-w-11 place-items-center rounded-full border border-white/15 bg-ink/80 text-copy shadow-chrome backdrop-blur-md"
          data-reel-interactive
          onClick={toggleControls}
          type="button"
        >
          {controlsVisible ? <EyeSlash aria-hidden size={19} /> : <Eye aria-hidden size={19} />}
        </button>
      </header>

      <div className="mx-auto flex h-[calc(100dvh-5.5rem)] max-h-[960px] w-full max-w-[540px] flex-col gap-3">
        <ReelSeriesRail
          reelIndex={reelIndex}
          series={series}
          seriesIndex={seriesIndex}
          seriesTotal={payload.series.length}
        />
        <div
          aria-label={gestureAxis ? `${gestureAxis} swipe detected` : undefined}
          className="min-h-0 flex-1"
        >
          <ReelViewport
            canGoDown={canGoDown}
            canGoLeft={canGoLeft}
            canGoRight={canGoRight}
            canGoUp={canGoUp}
            item={item}
            muted={muted}
            onMutedChange={setMuted}
            onNavigateHorizontal={navigateHorizontal}
            onNavigateVertical={navigateVertical}
            onPlayingChange={setPlaying}
            playing={playing}
            showControls={controlsVisible}
          />
        </div>
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.17em] text-copy-muted">
          Swipe sideways for reels · Swipe vertically for series
        </p>
      </div>
    </main>
  );
}
