import { ArrowRight, BookOpenText, Plus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { LibraryEmptyState } from "@/components/ui/AsyncState";
import { ApiError, editionAssetUrl, listLibrary, type LibraryEdition } from "@/lib/api";

export const metadata: Metadata = {
  title: "Library",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function LibraryPage() {
  let editions: LibraryEdition[];
  try {
    editions = await listLibrary();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    editions = [];
  }

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-frame px-[var(--ss-page-inline)] py-12 sm:py-16">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-4xl text-copy sm:text-6xl">Manga library</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-copy-secondary">
            Accepted editions stay immutable. Open the latest version or return to an earlier one.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/books/new">
            <Plus aria-hidden size={17} weight="bold" />
            Add a PDF
          </Link>
        </Button>
      </div>

      {editions.length === 0 ? (
        <div className="mt-12">
          <LibraryEmptyState />
        </div>
      ) : (
        <section className="mt-12 grid grid-cols-1 gap-7 md:grid-cols-2 xl:grid-cols-3">
          {editions.map((edition) => (
            <article
              className="overflow-hidden rounded-panel border border-white/15 bg-ink-raised"
              key={edition.edition_id}
            >
              <div className="relative aspect-[2/3] overflow-hidden border-b border-white/10 bg-shell">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`${edition.title} cover`}
                  className="h-full w-full object-cover transition duration-300 hover:scale-[1.015] motion-reduce:transition-none"
                  src={editionAssetUrl(edition.cover_url)}
                />
              </div>
              <div className="p-6 sm:p-7">
                <div className="flex items-center justify-between gap-4 text-xs text-copy-muted">
                  <span>{edition.page_count} pages</span>
                  <span>{formatDate(edition.created_at)}</span>
                </div>
                <h2 className="mt-4 font-display text-2xl leading-tight text-copy">{edition.title}</h2>
                <p className="mt-3 text-sm text-copy-secondary">
                  {edition.current_edition ? "Current accepted edition" : "Previous immutable edition"}
                </p>
                <Button asChild className="mt-7 w-full">
                  <Link href={`/manga/${encodeURIComponent(edition.edition_id)}`}>
                    Read
                    <ArrowRight aria-hidden size={17} weight="bold" />
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}

      <aside className="mt-12 flex flex-col items-start justify-between gap-6 rounded-panel border border-white/15 bg-ink/70 p-7 sm:flex-row sm:items-center sm:p-9">
        <div className="flex items-start gap-4">
          <BookOpenText aria-hidden className="mt-1 text-accent-soft" size={28} weight="duotone" />
          <div>
            <h2 className="font-display text-2xl text-copy">Generate another book</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-copy-secondary">
              Upload a PDF, follow live stages, and save the accepted result here.
            </p>
          </div>
        </div>
        <Button asChild variant="secondary">
          <Link href="/books/new">Open upload</Link>
        </Button>
      </aside>
    </main>
  );
}
