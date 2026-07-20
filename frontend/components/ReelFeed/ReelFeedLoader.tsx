"use client";

import { Warning } from "@phosphor-icons/react";
import type { SeriesProgress } from "@scrollstack/contracts";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";

import type { ReelFeedFixture } from "./fixture-adapter";
import { ReelFeed } from "./ReelFeed";
import {
  loadCatalogReel,
  loadReelCatalog,
  loadSeriesProgress,
} from "./reel-api-client";
import { selectResumePosition } from "./reel-api-adapter";
import type { ReelFeedCatalog, ReelFeedItem, ReelFeedSelection } from "./types";

type ReadyState = Readonly<{
  catalog: ReelFeedCatalog;
  initialItems: Readonly<Record<string, ReelFeedItem>>;
  initialPosition: ReelFeedSelection;
  persistProgress: boolean;
  progress: Readonly<Record<string, SeriesProgress | null>>;
}>;

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | ({ kind: "ready" } & ReadyState);

function fixtureState(fixture: ReelFeedFixture): ReadyState {
  return {
    catalog: fixture.catalog,
    initialItems: fixture.items,
    initialPosition: { reelIndex: 0, seriesIndex: 0 },
    persistProgress: false,
    progress: {},
  };
}

async function apiState(bookId: string, projectId: string): Promise<ReadyState> {
  const catalog = await loadReelCatalog(bookId, projectId);
  const progressEntries = await Promise.all(
    catalog.series.map((series) => loadSeriesProgress(series.id)),
  );
  const progress = Object.fromEntries(
    catalog.series.map((series, index) => [series.id, progressEntries[index] ?? null]),
  );
  const initialPosition = selectResumePosition(
    catalog,
    progressEntries.filter((entry): entry is SeriesProgress => entry !== null),
  );
  const series = catalog.series[initialPosition.seriesIndex];
  const reel = series?.reels[initialPosition.reelIndex];
  const initialItem = series && reel ? await loadCatalogReel(series, reel) : undefined;

  return {
    catalog,
    initialItems: initialItem ? { [initialItem.id]: initialItem } : {},
    initialPosition,
    persistProgress: true,
    progress,
  };
}

export function ReelFeedLoader({
  bookId,
  fixture,
  projectId,
}: {
  bookId: string;
  fixture?: ReelFeedFixture;
  projectId: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>(() =>
    fixture ? { kind: "ready", ...fixtureState(fixture) } : { kind: "loading" },
  );

  useEffect(() => {
    if (fixture) {
      setState({ kind: "ready", ...fixtureState(fixture) });
      return;
    }
    let active = true;
    setState({ kind: "loading" });
    void apiState(bookId, projectId)
      .then((ready) => {
        if (active) setState({ kind: "ready", ...ready });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "The reel feed could not be loaded.",
        });
      });
    return () => {
      active = false;
    };
  }, [attempt, bookId, fixture, projectId]);

  if (state.kind === "loading") {
    return (
      <main
        aria-busy="true"
        aria-label="Loading reel player"
        className="fixed inset-0 z-[60] grid h-[100dvh] place-items-center bg-shell px-4 py-10"
      >
        <div className="aspect-[9/16] h-[82dvh] max-h-[920px] animate-pulse rounded-panel border border-white/10 bg-ink-raised" />
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main className="fixed inset-0 z-[60] grid h-[100dvh] place-items-center bg-shell px-6 text-center">
        <div className="max-w-md">
          <Warning aria-hidden className="mx-auto text-accent-soft" size={38} weight="duotone" />
          <h1 className="mt-4 font-display text-3xl text-copy">The reels did not arrive</h1>
          <p className="mt-3 text-sm leading-6 text-copy-secondary">{state.message}</p>
          <Button className="mt-6" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </Button>
        </div>
      </main>
    );
  }

  return (
    <ReelFeed
      catalog={state.catalog}
      initialItems={state.initialItems}
      initialPosition={state.initialPosition}
      initialProgress={state.progress}
      persistProgress={state.persistProgress}
    />
  );
}
