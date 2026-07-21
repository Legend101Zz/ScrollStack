"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Pause,
  Play,
  SpeakerHigh,
  SpeakerSlash,
} from "@phosphor-icons/react";
import type { MouseEvent } from "react";

type ReelControlsProps = {
  canGoDown: boolean;
  canGoLeft: boolean;
  canGoRight: boolean;
  canGoUp: boolean;
  currentFrame: number;
  durationInFrames: number;
  muted: boolean;
  onNavigateHorizontal: (direction: -1 | 1) => void;
  onNavigateVertical: (direction: -1 | 1) => void;
  onSeek: (frame: number) => void;
  onToggleMute: () => void;
  onTogglePlaying: (event: MouseEvent<HTMLButtonElement>) => void;
  playing: boolean;
};

const controlClass =
  "focus-ring grid min-h-11 min-w-11 place-items-center rounded-full border border-white/15 bg-ink/75 text-copy shadow-chrome backdrop-blur-md transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-30";

export function ReelControls(props: ReelControlsProps) {
  return (
    <div className="absolute inset-0 z-30 pointer-events-none" data-reel-interactive>
      <button
        aria-label="Previous reel"
        className={`${controlClass} pointer-events-auto absolute left-3 top-1/2 -translate-y-1/2 sm:left-5`}
        disabled={!props.canGoLeft}
        onClick={() => props.onNavigateHorizontal(-1)}
        type="button"
      >
        <ArrowLeft aria-hidden size={20} weight="bold" />
      </button>
      <button
        aria-label="Next reel"
        className={`${controlClass} pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2 sm:right-5`}
        disabled={!props.canGoRight}
        onClick={() => props.onNavigateHorizontal(1)}
        type="button"
      >
        <ArrowRight aria-hidden size={20} weight="bold" />
      </button>

      <div className="pointer-events-auto absolute bottom-4 left-4 right-4 rounded-control border border-white/15 bg-ink/80 p-2.5 shadow-chrome backdrop-blur-md sm:bottom-5 sm:left-5 sm:right-5">
        <label className="sr-only" htmlFor="reel-progress">
          Reel progress
        </label>
        <input
          aria-label="Reel progress"
          className="focus-ring h-5 w-full cursor-pointer accent-accent-soft"
          data-reel-interactive
          id="reel-progress"
          max={Math.max(props.durationInFrames - 1, 0)}
          min={0}
          onChange={(event) => props.onSeek(Number(event.currentTarget.value))}
          type="range"
          value={Math.min(props.currentFrame, Math.max(props.durationInFrames - 1, 0))}
        />
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <button
              aria-label={props.playing ? "Pause reel" : "Play reel"}
              className={controlClass}
              onClick={props.onTogglePlaying}
              type="button"
            >
              {props.playing ? <Pause aria-hidden size={18} weight="fill" /> : <Play aria-hidden size={18} weight="fill" />}
            </button>
            <button
              aria-label={props.muted ? "Unmute reel" : "Mute reel"}
              className={controlClass}
              onClick={props.onToggleMute}
              type="button"
            >
              {props.muted ? <SpeakerSlash aria-hidden size={18} /> : <SpeakerHigh aria-hidden size={18} />}
            </button>
          </div>
          <div className="flex gap-1">
            <button
              aria-label="Previous reel series"
              className={controlClass}
              disabled={!props.canGoUp}
              onClick={() => props.onNavigateVertical(-1)}
              type="button"
            >
              <ArrowUp aria-hidden size={18} weight="bold" />
            </button>
            <button
              aria-label="Next reel series"
              className={controlClass}
              disabled={!props.canGoDown}
              onClick={() => props.onNavigateVertical(1)}
              type="button"
            >
              <ArrowDown aria-hidden size={18} weight="bold" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
