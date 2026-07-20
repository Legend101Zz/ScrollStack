"use client";

import { compileReel, ReelValidationError, type CompiledReel } from "@scrollstack/reel-components";
import { Warning } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";

import type { ReelFeedItem } from "./types";
import { ReelPlayer } from "./ReelPlayer";

type ReelViewportProps = {
  canGoDown: boolean;
  canGoLeft: boolean;
  canGoRight: boolean;
  canGoUp: boolean;
  item: ReelFeedItem;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  onNavigateHorizontal: (direction: -1 | 1) => void;
  onNavigateVertical: (direction: -1 | 1) => void;
  onPlayingChange: (playing: boolean) => void;
  playing: boolean;
  showControls: boolean;
};

type CompilationResult =
  | { compiled: CompiledReel; error?: never }
  | { compiled?: never; error: Error };

export function ReelViewport(props: ReelViewportProps) {
  const [retry, setRetry] = useState(0);
  const [runtimeError, setRuntimeError] = useState<Error | null>(null);
  const result = useMemo<CompilationResult>(() => {
    try {
      return { compiled: compileReel(props.item.composition) };
    } catch (error) {
      const message =
        error instanceof ReelValidationError
          ? error.issues.map((issue) => issue.message).join(" ")
          : error instanceof Error
            ? error.message
            : "The reel could not be compiled.";
      return { error: new Error(message) };
    }
  }, [props.item.composition]);

  const error = result.error ?? runtimeError;
  if (error || !result.compiled) {
    return (
      <section className="grid h-full w-full place-items-center rounded-panel border border-accent/35 bg-ink-raised p-8 text-center">
        <div>
          <Warning aria-hidden className="mx-auto text-accent-soft" size={36} weight="duotone" />
          <h2 className="mt-4 font-display text-2xl text-copy">This reel stopped drawing</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-copy-secondary">{error?.message}</p>
          {runtimeError ? (
            <Button
              className="mt-6"
              onClick={() => {
                setRuntimeError(null);
                setRetry((value) => value + 1);
              }}
            >
              Try again
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <ReelPlayer
      key={`${props.item.id}-${retry}`}
      canGoDown={props.canGoDown}
      canGoLeft={props.canGoLeft}
      canGoRight={props.canGoRight}
      canGoUp={props.canGoUp}
      compiled={result.compiled}
      muted={props.muted}
      onMutedChange={props.onMutedChange}
      onNavigateHorizontal={props.onNavigateHorizontal}
      onNavigateVertical={props.onNavigateVertical}
      onPlayingChange={props.onPlayingChange}
      onRuntimeError={setRuntimeError}
      playing={props.playing}
      showControls={props.showControls}
    />
  );
}
