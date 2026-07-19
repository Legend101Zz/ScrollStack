import { ArrowRight, BookOpen, Selection, Sparkle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { HeroCopy } from "@/components/landing/HeroCopy";
import { TransformationStage } from "@/components/landing/TransformationStage";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Your book, drawn forward",
};

const steps = [
  {
    body: "Add the PDF you are already reading.",
    icon: BookOpen,
    title: "Open your book",
  },
  {
    body: "Choose the chapter or page range you want next.",
    icon: Selection,
    title: "Mark the next pages",
  },
  {
    body: "Read a manga that remembers the accepted story.",
    icon: Sparkle,
    title: "Return to the series",
  },
];

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-frame grid-cols-1 items-center gap-12 px-[var(--ss-page-inline)] py-12 md:grid-cols-[0.88fr_1.12fr] md:py-16 lg:gap-20">
        <HeroCopy />
        <TransformationStage />
      </section>

      <section
        className="border-y border-white/10 bg-ink/60 px-[var(--ss-page-inline)] py-20 sm:py-24"
        id="how-it-works"
      >
        <div className="mx-auto max-w-frame">
          <h2 className="max-w-[13ch] font-display text-3xl leading-tight text-copy sm:text-5xl">
            Keep reading. We carry the world forward.
          </h2>
          <p className="mt-5 max-w-[42rem] text-base leading-7 text-copy-secondary">
            ScrollStack turns one chosen range into grounded manga, then keeps the accepted cast and setting for the next range.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-[1.05fr_0.85fr_1.1fr] md:gap-5">
            {steps.map(({ body, icon: Icon, title }, index) => (
              <article
                className={`border-t border-white/15 pt-6 ${index === 1 ? "md:mt-12" : ""}`}
                key={title}
              >
                <Icon aria-hidden className="text-accent-soft" size={28} weight="duotone" />
                <h3 className="mt-5 font-display text-xl text-copy">{title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-copy-secondary">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-[var(--ss-page-inline)] py-20 sm:py-28">
        <div className="mx-auto grid max-w-frame grid-cols-1 items-end gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <h2 className="font-display text-3xl text-copy sm:text-5xl">Your next chapter is waiting.</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-copy-secondary">
              Start with a small page range. You can continue from the same accepted world later.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/books/new">
              Open a book
              <ArrowRight aria-hidden size={17} weight="bold" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
