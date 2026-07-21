"use client";

import {
  ArrowRight,
  BookOpenText,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  createMangaProject,
  createScope,
  getBook,
  getBookPage,
  getMangaProject,
  listSourceUnits,
  startGenerationRun,
  type BookView,
  type MangaProjectView,
  type SourceUnitMetadata,
} from "@/lib/api";

type LoadState = "loading" | "ready" | "error" | "submitting";

function sourcePages(units: SourceUnitMetadata[]): number[] {
  const pages = new Set<number>();
  for (const unit of units) {
    for (let page = unit.page_start; page <= unit.page_end; page += 1) pages.add(page);
  }
  return [...pages].sort((left, right) => left - right);
}

function initialRange(pages: number[]): [number, number] {
  if (pages.length === 0) return [1, 1];
  return [pages[0], pages[pages.length - 1]];
}

function formatPageSpans(pages: number[]): string {
  if (pages.length === 0) return "None";
  const spans: string[] = [];
  let start = pages[0];
  let previous = pages[0];
  for (const page of pages.slice(1)) {
    if (page === previous + 1) {
      previous = page;
      continue;
    }
    spans.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = page;
    previous = page;
  }
  spans.push(start === previous ? `${start}` : `${start}-${previous}`);
  const visible = spans.slice(0, 5).join(", ");
  return spans.length > 5 ? `${visible}, and ${spans.length - 5} more ranges` : visible;
}

function validationMessage(
  startPage: number,
  endPage: number,
  totalPages: number,
  availablePages: Set<number>,
): string | null {
  if (!Number.isInteger(startPage) || !Number.isInteger(endPage)) return "Use whole page numbers.";
  if (startPage < 1 || endPage < 1 || startPage > totalPages || endPage > totalPages) {
    return `Choose pages between 1 and ${totalPages}.`;
  }
  if (endPage < startPage) return "The end page must follow the start page.";
  const count = endPage - startPage + 1;
  if (count < 2 || count > totalPages) return `Choose between 2 and ${totalPages} pages.`;
  if (!availablePages.has(startPage) || !availablePages.has(endPage)) {
    return "Start and end on pages where ScrollStack found readable text.";
  }
  return null;
}

export function ScopeSelector({
  bookId,
  initialProjectId,
}: {
  bookId: string;
  initialProjectId?: string;
}) {
  const router = useRouter();
  const [book, setBook] = useState<BookView | null>(null);
  const [endPage, setEndPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [preview, setPreview] = useState<string | null>(null);
  const [project, setProject] = useState<MangaProjectView | null>(null);
  const [startPage, setStartPage] = useState(1);
  const [units, setUnits] = useState<SourceUnitMetadata[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoadState("loading");
      setError(null);
      try {
        const [nextBook, nextUnits] = await Promise.all([
          getBook(bookId, controller.signal),
          listSourceUnits(bookId, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        if (nextBook.status !== "parsed") {
          throw new Error("This book has not finished parsing yet.");
        }
        if (nextUnits.length === 0) {
          throw new Error("No readable source pages were found for this book.");
        }
        const nextProject = initialProjectId
          ? await getMangaProject(initialProjectId, controller.signal)
          : await createMangaProject(bookId, nextBook.owner_id);
        if (controller.signal.aborted) return;
        if (nextProject.book_id !== bookId) {
          throw new Error("This manga project belongs to a different book.");
        }
        const [nextStart, nextEnd] = initialRange(sourcePages(nextUnits));
        setBook(nextBook);
        setEndPage(nextEnd);
        setProject(nextProject);
        setStartPage(nextStart);
        setUnits(nextUnits);
        setLoadState("ready");
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "The parsed pages could not be loaded.");
        setLoadState("error");
      }
    }
    void load();
    return () => controller.abort();
  }, [bookId, initialProjectId]);

  const availablePageNumbers = useMemo(() => sourcePages(units), [units]);
  const availablePageSet = useMemo(() => new Set(availablePageNumbers), [availablePageNumbers]);
  const invalid = book
    ? validationMessage(startPage, endPage, book.total_pages, availablePageSet)
    : "The book is still loading.";

  useEffect(() => {
    if (loadState !== "ready" || !availablePageSet.has(startPage)) {
      setPreview(null);
      return;
    }
    const controller = new AbortController();
    async function loadPreview() {
      try {
        const page = await getBookPage(bookId, startPage, controller.signal);
        if (controller.signal.aborted) return;
        const compact = page.text?.replace(/\s+/g, " ").trim() ?? "";
        setPreview(compact ? `${compact.slice(0, 280)}${compact.length > 280 ? "..." : ""}` : null);
      } catch {
        if (!controller.signal.aborted) setPreview(null);
      }
    }
    void loadPreview();
    return () => controller.abort();
  }, [availablePageSet, bookId, loadState, startPage]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalid || !book || !project) return;
    setLoadState("submitting");
    setError(null);
    try {
      const scope = await createScope(book.book_id, {
        created_by: project.owner_id,
        page_ranges: [{ page_end: endPage, page_start: startPage }],
        project_id: project.project_id,
        selection_label:
          startPage === 1 && endPage === book.total_pages
            ? "Complete book"
            : `Pages ${startPage}-${endPage}`,
      });
      const run = await startGenerationRun(project.project_id, scope.scope_id, project.owner_id);
      router.push(
        `/books/${encodeURIComponent(book.book_id)}/manga/${encodeURIComponent(project.project_id)}/generating?runId=${encodeURIComponent(run.run.run_id)}`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Generation could not be started.");
      setLoadState("ready");
    }
  }

  if (loadState === "loading") {
    return (
      <section aria-busy="true" className="mt-10 rounded-panel border border-white/15 bg-ink-raised p-9">
        <SpinnerGap aria-hidden className="animate-spin text-accent-soft" size={30} weight="bold" />
        <h2 className="mt-5 font-display text-2xl text-copy">Loading parsed pages</h2>
        <p className="mt-2 text-sm text-copy-secondary">Reading the persisted source map for this book.</p>
      </section>
    );
  }

  if (loadState === "error" || !book || !project) {
    return (
      <section className="mt-10 rounded-panel border border-accent/35 bg-ink-raised p-9">
        <WarningCircle aria-hidden className="text-accent-soft" size={32} weight="duotone" />
        <h2 className="mt-5 font-display text-2xl text-copy">Parsed pages are unavailable</h2>
        <p className="mt-3 text-sm leading-6 text-copy-secondary">{error}</p>
        <Button className="mt-7" onClick={() => window.location.reload()} variant="secondary">
          Try again
        </Button>
      </section>
    );
  }

  const submitting = loadState === "submitting";

  return (
    <form className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]" onSubmit={handleSubmit}>
      <section className="rounded-panel border border-white/15 bg-ink-raised p-6 sm:p-9">
        <div className="flex items-start gap-4">
          <BookOpenText aria-hidden className="mt-1 shrink-0 text-accent-soft" size={28} weight="duotone" />
          <div>
            <h2 className="font-display text-2xl text-copy">{book.title}</h2>
            <p className="mt-2 text-sm leading-6 text-copy-secondary">
              {book.total_pages} total pages. Readable text was found on {availablePageNumbers.length} pages.
            </p>
            <p className="mt-2 text-xs leading-5 text-copy-muted">
              Text-bearing source pages: {formatPageSpans(availablePageNumbers)}
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-copy" htmlFor="start-page">
            Start page
            <input
              aria-describedby="range-help"
              className="focus-ring min-h-12 rounded-input border border-white/20 bg-shell px-4 text-base text-copy placeholder:text-copy-muted"
              disabled={submitting}
              id="start-page"
              max={book.total_pages}
              min={1}
              onChange={(event) => setStartPage(Number(event.target.value))}
              type="number"
              value={startPage}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-copy" htmlFor="end-page">
            End page
            <input
              aria-describedby="range-help"
              className="focus-ring min-h-12 rounded-input border border-white/20 bg-shell px-4 text-base text-copy placeholder:text-copy-muted"
              disabled={submitting}
              id="end-page"
              max={book.total_pages}
              min={1}
              onChange={(event) => setEndPage(Number(event.target.value))}
              type="number"
              value={endPage}
            />
          </label>
        </div>
        <p className={`mt-4 text-sm ${invalid ? "text-accent-soft" : "text-copy-muted"}`} id="range-help">
          {invalid ?? "The complete selected range will be condensed into one accepted manga edition."}
        </p>

        {preview ? (
          <div className="mt-7 rounded-input border border-white/10 bg-shell/70 p-4">
            <p className="text-xs font-semibold text-copy-muted">Start-page preview</p>
            <p className="mt-2 line-clamp-4 text-sm leading-6 text-copy-secondary">{preview}</p>
          </div>
        ) : null}
      </section>

      <aside className="flex flex-col justify-between rounded-panel border border-white/15 bg-ink/70 p-6 sm:p-9">
        <div>
          <p className="text-sm font-semibold text-copy-muted">Selected source</p>
          <p className="mt-4 font-display text-4xl text-copy">
            {startPage}-{endPage}
          </p>
          <p className="mt-4 text-sm leading-6 text-copy-secondary">
            ScrollStack will ground the manga in these persisted pages and accepted project continuity.
          </p>
          <dl className="mt-7 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-5">
              <dt className="text-copy-muted">Page count</dt>
              <dd className="font-semibold text-copy">{Math.max(0, endPage - startPage + 1)}</dd>
            </div>
            <div className="flex items-center justify-between gap-5">
              <dt className="text-copy-muted">Memory version</dt>
              <dd className="font-semibold text-copy">{project.active_memory_version}</dd>
            </div>
          </dl>
          {error ? <p className="mt-6 text-sm leading-6 text-accent-soft">{error}</p> : null}
        </div>
        <Button className="mt-8 w-full" disabled={Boolean(invalid) || submitting} size="lg" type="submit">
          {submitting ? (
            <>
              <SpinnerGap aria-hidden className="animate-spin" size={17} weight="bold" />
              Starting generation
            </>
          ) : (
            <>
              Draw these pages
              <ArrowRight aria-hidden size={17} weight="bold" />
            </>
          )}
        </Button>
      </aside>
    </form>
  );
}
