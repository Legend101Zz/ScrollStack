import { ArrowRight, BookOpenText, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Button } from "@/components/ui/Button";

export function ReaderSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading manga reader"
      className="min-h-[100dvh] bg-shell px-4 py-16"
    >
      <div className="mx-auto max-w-3xl animate-pulse">
        <div className="mx-auto mb-6 h-4 w-40 rounded-control bg-ink-soft" />
        <div className="aspect-[4/5] rounded-panel bg-ink-raised p-4">
          <div className="grid h-full grid-cols-2 gap-3">
            <div className="rounded-input bg-paper/15" />
            <div className="rounded-input bg-paper/10" />
            <div className="col-span-2 rounded-input bg-paper/15" />
          </div>
        </div>
      </div>
    </main>
  );
}

export function LibraryEmptyState() {
  return (
    <section className="rounded-panel border border-white/15 bg-ink-raised p-8 text-center sm:p-12">
      <BookOpenText aria-hidden size={34} weight="duotone" className="mx-auto text-accent-soft" />
      <h2 className="mt-5 font-display text-2xl text-copy">Your shelf is ready</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-copy-secondary">
        Add a PDF, choose the pages you want next, and ScrollStack will keep the story together.
      </p>
      <Button asChild className="mt-7">
        <Link href="/books/new">
          Open a book
          <ArrowRight aria-hidden size={16} weight="bold" />
        </Link>
      </Button>
    </section>
  );
}

export function ErrorState({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-shell px-4 py-16">
      <section className="w-full max-w-xl rounded-panel border border-accent/35 bg-ink-raised p-8 text-center sm:p-12">
        <Warning aria-hidden size={36} weight="duotone" className="mx-auto text-accent-soft" />
        <h1 className="mt-5 font-display text-3xl text-copy">This page did not finish drawing</h1>
        <p className="mt-3 text-sm leading-6 text-copy-secondary">
          Your book and selected pages are safe. Try this view again.
        </p>
        <Button className="mt-7" onClick={reset}>
          Try again
        </Button>
      </section>
    </main>
  );
}
