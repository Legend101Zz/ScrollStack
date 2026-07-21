"use client";

import { ArrowLeft, ArrowRight, Books } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { editionAssetUrl, type MangaEditionView } from "@/lib/api";

export function EditionReader({ edition }: { edition: MangaEditionView }) {
  const [pageIndex, setPageIndex] = useState(0);
  const page = edition.pages[pageIndex];

  return (
    <main className="min-h-[100dvh] bg-shell px-3 pb-28 pt-16 sm:px-8 sm:pt-8">
      <div className="mx-auto flex max-w-[76rem] items-center justify-between gap-4 pb-5 text-sm text-copy-secondary">
        <Link className="focus-ring inline-flex items-center gap-2 rounded-control px-3 py-2 hover:bg-white/[0.06]" href="/library">
          <Books aria-hidden size={18} />
          Library
        </Link>
        <p className="truncate text-right font-semibold text-copy">{edition.title}</p>
      </div>

      <div className="mx-auto grid max-w-[76rem] place-items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={`Page ${pageIndex + 1} of ${edition.page_count}`}
          className="max-h-[calc(100dvh-10rem)] w-auto max-w-full border border-white/15 bg-[#f7f5ef] shadow-chrome"
          height={page.height}
          key={page.page_id}
          src={editionAssetUrl(page.url)}
          width={page.width}
        />
      </div>

      <nav
        aria-label="Manga page navigation"
        className="fixed bottom-5 left-1/2 flex w-[min(94vw,40rem)] -translate-x-1/2 items-center justify-between gap-4 rounded-panel border border-white/15 bg-ink/95 p-3 shadow-chrome backdrop-blur-md"
      >
        <Button
          aria-label="Previous page"
          disabled={pageIndex === 0}
          onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
          variant="secondary"
        >
          <ArrowLeft aria-hidden size={18} />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <p aria-live="polite" className="min-w-24 text-center text-sm font-semibold text-copy">
          {pageIndex + 1} / {edition.page_count}
        </p>
        <Button
          aria-label="Next page"
          disabled={pageIndex === edition.page_count - 1}
          onClick={() => setPageIndex((value) => Math.min(edition.page_count - 1, value + 1))}
        >
          <span className="hidden sm:inline">Next</span>
          <ArrowRight aria-hidden size={18} />
        </Button>
      </nav>
    </main>
  );
}
