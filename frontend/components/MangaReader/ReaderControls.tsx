"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import {
  ArrowLeft,
  ArrowRight,
  FilmStrip,
  Rows,
  SquaresFour,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";

import type { ReaderMode } from "@/store/useReaderStore";

export function ReaderControls({
  bookId,
  bookTitle,
  canGoNext,
  canGoPrevious,
  currentPage,
  mode,
  onClose,
  onModeChange,
  onNext,
  onPrevious,
  pageCount,
  projectId,
}: {
  bookId: string;
  bookTitle: string;
  canGoNext: boolean;
  canGoPrevious: boolean;
  currentPage: number;
  mode: ReaderMode;
  onClose: () => void;
  onModeChange: (mode: ReaderMode) => void;
  onNext: () => void;
  onPrevious: () => void;
  pageCount: number;
  projectId: string;
}) {
  return (
    <div
      className="fixed bottom-4 left-1/2 z-20 flex w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 items-center justify-between gap-2 rounded-panel border border-white/15 bg-ink/95 p-2 shadow-chrome backdrop-blur-md sm:bottom-6 sm:rounded-control sm:px-3"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="hidden min-w-0 items-center gap-3 pl-2 sm:flex">
        <span className="max-w-40 truncate text-xs font-semibold text-copy">{bookTitle}</span>
        <span className="text-xs text-copy-muted">
          {currentPage + 1} / {pageCount}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          aria-label="Previous page"
          className="focus-ring grid min-h-10 min-w-10 place-items-center rounded-control text-copy-secondary hover:bg-white/[0.08] disabled:opacity-35"
          disabled={!canGoPrevious || mode === "vertical"}
          onClick={onPrevious}
          type="button"
        >
          <ArrowLeft aria-hidden size={18} />
        </button>
        <button
          aria-label="Next page"
          className="focus-ring grid min-h-10 min-w-10 place-items-center rounded-control text-copy-secondary hover:bg-white/[0.08] disabled:opacity-35"
          disabled={!canGoNext || mode === "vertical"}
          onClick={onNext}
          type="button"
        >
          <ArrowRight aria-hidden size={18} />
        </button>
      </div>
      <ToggleGroup.Root
        aria-label="Reading mode"
        className="flex rounded-control border border-white/15 bg-white/[0.04] p-1"
        onValueChange={(value) => {
          if (value === "rtl" || value === "vertical") onModeChange(value);
        }}
        type="single"
        value={mode}
      >
        <ToggleGroup.Item
          aria-label="Right to left page mode"
          className="focus-ring grid min-h-9 min-w-9 place-items-center rounded-control text-copy-muted data-[state=on]:bg-paper-high data-[state=on]:text-ink"
          value="rtl"
        >
          <SquaresFour aria-hidden size={16} weight="bold" />
        </ToggleGroup.Item>
        <ToggleGroup.Item
          aria-label="Vertical reading mode"
          className="focus-ring grid min-h-9 min-w-9 place-items-center rounded-control text-copy-muted data-[state=on]:bg-paper-high data-[state=on]:text-ink"
          value="vertical"
        >
          <Rows aria-hidden size={16} weight="bold" />
        </ToggleGroup.Item>
      </ToggleGroup.Root>
      <Link
        className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-control border border-accent-deep bg-accent-deep px-4 text-xs font-semibold text-paper-high hover:bg-[#85200f]"
        href={`/books/${bookId}/manga/${projectId}/reels`}
      >
        <FilmStrip aria-hidden size={16} weight="fill" />
        <span className="hidden sm:inline">Watch</span>
      </Link>
      <button
        aria-label="Hide reader controls"
        className="focus-ring grid min-h-10 min-w-10 place-items-center rounded-control text-copy-muted hover:bg-white/[0.08] hover:text-copy"
        onClick={onClose}
        type="button"
      >
        <X aria-hidden size={17} />
      </button>
    </div>
  );
}
