"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react";
import type { SeriesProgress, SeriesProgressUpdate } from "@scrollstack/contracts";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";

import { nextProgressUpdate } from "./reel-api-adapter";
import { loadCatalogReel, saveSeriesProgress } from "./reel-api-client";
import { ReelSeriesRail } from "./ReelSeriesRail";
import { ReelViewport } from "./ReelViewport";
import type {
  ReelFeedCatalog,
  ReelFeedItem,
  ReelFeedReel,
  ReelFeedSelection,
  ReelFeedSeries,
} from "./types";
import { useAxisLockedGesture } from "./useAxisLockedGesture";
import { useReelFeedStore } from "./useReelFeedStore";
import { useReelPrefetch } from "./useReelPrefetch";

function isInteractiveKeyboardTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("button, a, input, textarea, select, [role='slider']"));
}

type ProgressFailure = Readonly<{
  message: string;
  seriesId: string;
  signature: string;
  update: SeriesProgressUpdate;
}>;

function isFresh(item: ReelFeedItem): boolean {
  return item.expiresAt === undefined || Date.parse(item.expiresAt) > Date.now() + 30_000;
}

function loadingMessage(message: string, retry: () => void) {
  return (
    <section className="grid h-full w-full place-items-center rounded-panel border border-white/10 bg-ink-raised p-8 text-center">
      <div>
        <p className="text-sm leading-6 text-copy-secondary">{message}</p>
        <Button className="mt-5" onClick={retry} size="sm" variant="secondary">
          Try again
        </Button>
      </div>
    </section>
  );
}

export function ReelFeed({
  catalog,
  initialItems,
  initialPosition,
  initialProgress,
  persistProgress,
}: {
  catalog: ReelFeedCatalog;
  initialItems: Readonly<Record<string, ReelFeedItem>>;
  initialPosition: ReelFeedSelection;
  initialProgress: Readonly<Record<string, SeriesProgress | null>>;
  persistProgress: boolean;
}) {
  const controlsVisible = useReelFeedStore((state) => state.controlsVisible);
  const gestureAxis = useReelFeedStore((state) => state.gestureAxis);
  const muted = useReelFeedStore((state) => state.muted);
  const playing = useReelFeedStore((state) => state.playing);
  const reelIndex = useReelFeedStore((state) => state.reelIndex);
  const seriesIndex = useReelFeedStore((state) => state.seriesIndex);
  const moveHorizontal = useReelFeedStore((state) => state.moveHorizontal);
  const moveVertical = useReelFeedStore((state) => state.moveVertical);
  const hydrate = useReelFeedStore((state) => state.hydrate);
  const setGestureAxis = useReelFeedStore((state) => state.setGestureAxis);
  const setMuted = useReelFeedStore((state) => state.setMuted);
  const setPlaying = useReelFeedStore((state) => state.setPlaying);
  const toggleControls = useReelFeedStore((state) => state.toggleControls);

  const [items, setItems] = useState<Readonly<Record<string, ReelFeedItem>>>(initialItems);
  const itemsRef = useRef(items);
  const [itemErrors, setItemErrors] = useState<Readonly<Record<string, string>>>({});
  const [loadingIds, setLoadingIds] = useState<ReadonlySet<string>>(new Set());
  const inFlightItems = useRef(new Map<string, Promise<void>>());
  const [progress, setProgress] = useState<Readonly<Record<string, SeriesProgress | null>>>(
    initialProgress,
  );
  const progressRef = useRef(progress);
  const progressQueues = useRef(new Map<string, Promise<void>>());
  const lastProgressIntent = useRef<Record<string, string>>({});
  const [progressFailure, setProgressFailure] = useState<ProgressFailure | null>(null);

  useLayoutEffect(() => {
    hydrate(initialPosition.seriesIndex, initialPosition.reelIndex);
  }, [catalog.bookId, catalog.projectId, hydrate, initialPosition.reelIndex, initialPosition.seriesIndex]);

  const loadItem = useCallback(
    (series: ReelFeedSeries, reel: ReelFeedReel, force = false): Promise<void> => {
      const cached = itemsRef.current[reel.id];
      if (!force && cached && isFresh(cached)) return Promise.resolve();
      const pending = inFlightItems.current.get(reel.id);
      if (pending) return pending;

      setItemErrors((current) => {
        const next = { ...current };
        delete next[reel.id];
        return next;
      });
      setLoadingIds((current) => new Set(current).add(reel.id));
      const task = loadCatalogReel(series, reel)
        .then((item) => {
          const next = { ...itemsRef.current, [item.id]: item };
          itemsRef.current = next;
          setItems(next);
        })
        .catch((error: unknown) => {
          setItemErrors((current) => ({
            ...current,
            [reel.id]: error instanceof Error ? error.message : "This reel could not be loaded.",
          }));
        })
        .finally(() => {
          inFlightItems.current.delete(reel.id);
          setLoadingIds((current) => {
            const next = new Set(current);
            next.delete(reel.id);
            return next;
          });
        });
      inFlightItems.current.set(reel.id, task);
      return task;
    },
    [],
  );

  const series = catalog.series[seriesIndex] ?? catalog.series[0];
  const reel = series?.reels[reelIndex] ?? series?.reels[0];
  const item = reel ? items[reel.id] : undefined;
  const reelCounts = catalog.series.map((candidate) => candidate.reels.length);
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
  const verticalSeries = catalog.series[seriesIndex + 1] ?? catalog.series[seriesIndex - 1];
  const verticalNeighbor = verticalSeries?.reels[
    Math.min(reelIndex, Math.max((verticalSeries?.reels.length ?? 1) - 1, 0))
  ];
  useEffect(() => {
    if (series && reel) void loadItem(series, reel);
    if (series && horizontalNeighbor) void loadItem(series, horizontalNeighbor);
    if (verticalSeries && verticalNeighbor) void loadItem(verticalSeries, verticalNeighbor);
  }, [horizontalNeighbor, loadItem, reel, series, verticalNeighbor, verticalSeries]);

  const loadedHorizontalNeighbor = horizontalNeighbor ? items[horizontalNeighbor.id] : undefined;
  const loadedVerticalNeighbor = verticalNeighbor ? items[verticalNeighbor.id] : undefined;
  useReelPrefetch([loadedHorizontalNeighbor, loadedVerticalNeighbor]);

  const enqueueProgress = useCallback(
    (seriesId: string, update: SeriesProgressUpdate, signature: string) => {
      const previous = progressQueues.current.get(seriesId) ?? Promise.resolve();
      const task = previous
        .then(() => saveSeriesProgress(seriesId, update))
        .then((saved) => {
          if (lastProgressIntent.current[seriesId] !== signature) return;
          progressRef.current = { ...progressRef.current, [seriesId]: saved };
          setProgress(progressRef.current);
          setProgressFailure((failure) =>
            failure?.seriesId === seriesId ? null : failure,
          );
        })
        .catch((error: unknown) => {
          if (lastProgressIntent.current[seriesId] !== signature) return;
          setProgressFailure({
            message: error instanceof Error ? error.message : "Progress could not be saved.",
            seriesId,
            signature,
            update,
          });
        });
      progressQueues.current.set(seriesId, task);
    },
    [],
  );

  useEffect(() => {
    if (!persistProgress || !series || !reel || !item) return;
    const previous = progressRef.current[series.id] ?? null;
    const update = nextProgressUpdate(series, reel.id, previous);
    const signature = JSON.stringify(update);
    if (lastProgressIntent.current[series.id] === signature) return;
    lastProgressIntent.current[series.id] = signature;

    const optimistic: SeriesProgress = {
      ...update,
      schema_version: "series-progress.v1",
      series_id: series.id,
      updated_at: previous?.updated_at ?? new Date().toISOString(),
    };
    progressRef.current = { ...progressRef.current, [series.id]: optimistic };
    setProgress(progressRef.current);
    enqueueProgress(series.id, update, signature);
  }, [enqueueProgress, item, persistProgress, reel, series]);

  if (!series || !reel) {
    return (
      <main className="fixed inset-0 z-[60] grid h-[100dvh] place-items-center bg-shell px-4 text-center text-copy-secondary">
        No reels are ready for this manga yet.
      </main>
    );
  }

  const canGoLeft = reelIndex > 0;
  const canGoRight = reelIndex < series.reels.length - 1;
  const canGoUp = seriesIndex > 0;
  const canGoDown = seriesIndex < catalog.series.length - 1;

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
          <p className="truncate font-display text-sm text-copy sm:text-base">{catalog.title}</p>
          <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-copy-muted">
            {catalog.sourceLabel}
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
          seriesTotal={catalog.series.length}
        />
        <div
          aria-label={gestureAxis ? `${gestureAxis} swipe detected` : undefined}
          className="min-h-0 flex-1"
        >
          {item ? (
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
          ) : itemErrors[reel.id] ? (
            loadingMessage(itemErrors[reel.id], () => void loadItem(series, reel, true))
          ) : (
            <section
              aria-busy="true"
              aria-label={`Loading ${reel.label}`}
              className="h-full w-full animate-pulse rounded-panel border border-white/10 bg-ink-raised"
            >
              <span className="sr-only">
                {loadingIds.has(reel.id) ? "Loading reel" : "Preparing reel"}
              </span>
            </section>
          )}
        </div>
        {progressFailure ? (
          <div
            aria-live="polite"
            className="flex items-center justify-between gap-3 rounded-control border border-accent/30 bg-ink-raised px-3 py-2 text-xs text-copy-secondary"
          >
            <span className="truncate">Progress not saved: {progressFailure.message}</span>
            <Button
              onClick={() =>
                enqueueProgress(
                  progressFailure.seriesId,
                  progressFailure.update,
                  progressFailure.signature,
                )
              }
              size="sm"
              variant="ghost"
            >
              Retry
            </Button>
          </div>
        ) : null}
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.17em] text-copy-muted">
          Swipe sideways for reels · Swipe vertically for series
        </p>
      </div>
    </main>
  );
}
