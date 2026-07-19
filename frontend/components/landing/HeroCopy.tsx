"use client";

import { ArrowRight, BookOpenText } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import { Button } from "@/components/ui/Button";

export function HeroCopy() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="font-display text-xs tracking-[0.22em] text-accent-soft">連載開始</p>
      <h1 className="mt-4 max-w-[11ch] font-display text-5xl leading-[0.98] tracking-[-0.04em] text-copy sm:text-6xl lg:text-7xl">
        The book becomes a <span className="text-accent-soft">series.</span>
      </h1>
      <p className="mt-6 max-w-[38rem] text-base leading-7 text-copy-secondary sm:text-lg">
        Upload a PDF, choose the next pages, and return to the same cast and world every week.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/books/new">
            Open a book
            <ArrowRight aria-hidden size={17} weight="bold" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/books/the-harbour-bell/manga/manga-harbour-01">
            <BookOpenText aria-hidden size={18} />
            Read the sample
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
