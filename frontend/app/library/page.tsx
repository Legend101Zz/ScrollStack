import { ArrowRight, BookOpenText, Plus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { MangaPanelArt } from "@/components/MangaReader/MangaPanelArt";
import { Button } from "@/components/ui/Button";
import { LibraryEmptyState } from "@/components/ui/AsyncState";
import { libraryFixture } from "@/lib/fixtures/scrollstack-fixture";

export const metadata: Metadata = {
  title: "Library",
};

export default function LibraryPage() {
  if (libraryFixture.length === 0) {
    return (
      <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-frame px-[var(--ss-page-inline)] py-16">
        <LibraryEmptyState />
      </main>
    );
  }

  const current = libraryFixture[0];

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-frame px-[var(--ss-page-inline)] py-12 sm:py-16">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-4xl text-copy sm:text-6xl">Your library</h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-copy-secondary">
            Return to an accepted chapter or choose the next pages from the same book.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/books/new">
            <Plus aria-hidden size={17} weight="bold" />
            Add a book
          </Link>
        </Button>
      </div>

      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[1.45fr_0.55fr]">
        <article className="group grid min-h-[28rem] overflow-hidden rounded-panel border border-white/15 bg-ink-raised md:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-[20rem] overflow-hidden border-b border-white/10 md:min-h-full md:border-b-0 md:border-r">
            <MangaPanelArt visual="bell" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgb(13_10_8_/_0.9)_100%)]" />
            <p className="absolute bottom-5 left-5 right-5 font-display text-3xl leading-tight text-paper-high">
              The bell counted the wrong hour.
            </p>
          </div>
          <div className="flex flex-col justify-between p-7 sm:p-9">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-soft">Sample manga</p>
              <h2 className="mt-5 font-display text-3xl text-copy">{current.bookTitle}</h2>
              <p className="mt-3 text-base text-copy-secondary">{current.chapterLabel}</p>
              <div className="mt-8 grid grid-cols-2 gap-5 border-t border-white/15 pt-5 text-sm">
                <div>
                  <p className="text-copy-muted">Reading position</p>
                  <p className="mt-1 font-semibold text-copy">{current.pageLabel}</p>
                </div>
                <div>
                  <p className="text-copy-muted">Source pages</p>
                  <p className="mt-1 font-semibold text-copy">{current.sourceRange}</p>
                </div>
              </div>
            </div>
            <Button asChild className="mt-9 w-full sm:w-fit">
              <Link href={`/books/${current.bookId}/manga/${current.projectId}`}>
                Open sample
                <ArrowRight aria-hidden size={17} weight="bold" />
              </Link>
            </Button>
          </div>
        </article>

        <aside className="flex min-h-[20rem] flex-col justify-between rounded-panel border border-white/15 bg-ink/70 p-7 sm:p-9">
          <div>
            <BookOpenText aria-hidden size={30} weight="duotone" className="text-accent-soft" />
            <h2 className="mt-6 font-display text-2xl text-copy">Create your manga</h2>
            <p className="mt-3 text-sm leading-6 text-copy-secondary">
              Upload your own PDF, choose a real parsed page range, and follow generation into the reader.
            </p>
          </div>
          <Button asChild className="mt-8 w-full" variant="secondary">
            <Link href="/books/new">
              Open a book
              <ArrowRight aria-hidden size={16} />
            </Link>
          </Button>
        </aside>
      </section>
    </main>
  );
}
