"use client";

import { ArrowRight, BookOpenText } from "@phosphor-icons/react";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";

export function ScopeSelector() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [startPage, setStartPage] = useState(112);
  const [endPage, setEndPage] = useState(117);
  const invalid = endPage < startPage || startPage < 1 || endPage - startPage > 12;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalid) return;
    router.push(`/books/${params.id}/manga/manga-harbour-01/generating`);
  }

  return (
    <form className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]" onSubmit={handleSubmit}>
      <section className="rounded-panel border border-white/15 bg-ink-raised p-6 sm:p-9">
        <div className="flex items-start gap-4">
          <BookOpenText aria-hidden className="mt-1 shrink-0 text-accent-soft" size={28} weight="duotone" />
          <div>
            <h2 className="font-display text-2xl text-copy">The Harbour Bell</h2>
            <p className="mt-2 text-sm leading-6 text-copy-secondary">
              Chapter seven begins on page 112. The previous accepted slice ends as Mira reaches the rain-dark landing.
            </p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-copy" htmlFor="start-page">
            Start page
            <input
              aria-describedby="range-help"
              className="focus-ring min-h-12 rounded-input border border-white/20 bg-shell px-4 text-base text-copy placeholder:text-copy-muted"
              id="start-page"
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
              id="end-page"
              min={1}
              onChange={(event) => setEndPage(Number(event.target.value))}
              type="number"
              value={endPage}
            />
          </label>
        </div>
        <p className={`mt-4 text-sm ${invalid ? "text-accent-soft" : "text-copy-muted"}`} id="range-help">
          {invalid ? "Choose an ordered range of no more than 13 pages." : "A focused range gives each manga beat room to breathe."}
        </p>
      </section>

      <aside className="flex flex-col justify-between rounded-panel border border-white/15 bg-ink/70 p-6 sm:p-9">
        <div>
          <p className="text-sm font-semibold text-copy-muted">Selected source</p>
          <p className="mt-4 font-display text-4xl text-copy">
            {startPage}-{endPage}
          </p>
          <p className="mt-4 text-sm leading-6 text-copy-secondary">
            ScrollStack will ground the next manga slice only in this range and the previously accepted story state.
          </p>
        </div>
        <Button className="mt-8 w-full" disabled={invalid} size="lg" type="submit">
          Draw this chapter
          <ArrowRight aria-hidden size={17} weight="bold" />
        </Button>
      </aside>
    </form>
  );
}
