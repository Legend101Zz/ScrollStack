"use client";

import { ArrowRight, Check } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { MangaPanelArt } from "@/components/MangaReader/MangaPanelArt";
import { Button } from "@/components/ui/Button";

const statuses = [
  "The cast remembers the previous slice",
  "Five story beats are laid into panels",
  "Ink is drying on the final page",
] as const;

export function GenerationStage({ bookId, projectId }: { bookId: string; projectId: string }) {
  const reduceMotion = useReducedMotion();
  const [activeStatus, setActiveStatus] = useState(reduceMotion ? statuses.length : 1);

  useEffect(() => {
    if (reduceMotion || activeStatus >= statuses.length) return;
    const timeout = window.setTimeout(() => setActiveStatus((current) => current + 1), 1700);
    return () => window.clearTimeout(timeout);
  }, [activeStatus, reduceMotion]);

  const complete = activeStatus >= statuses.length;

  return (
    <section className="mt-10 grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
      <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-panel bg-paper shadow-paper">
        <div className="paper-tone absolute inset-0 opacity-50" />
        <div className="absolute inset-4 grid grid-cols-2 grid-rows-[0.85fr_1.1fr] gap-3">
          <motion.div
            animate={{ opacity: 1, scaleX: 1 }}
            className="relative origin-left overflow-hidden border-[3px] border-ink"
            initial={reduceMotion ? false : { opacity: 0, scaleX: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <MangaPanelArt visual="letter" />
          </motion.div>
          <motion.div
            animate={{ opacity: 1, scaleX: 1 }}
            className="relative origin-right overflow-hidden border-[3px] border-ink"
            initial={reduceMotion ? false : { opacity: 0, scaleX: 0 }}
            transition={{ delay: reduceMotion ? 0 : 0.25, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <MangaPanelArt visual="stairs" />
          </motion.div>
          <motion.div
            animate={{ opacity: 1, scaleY: 1 }}
            className="relative col-span-2 origin-top overflow-hidden border-[3px] border-ink"
            initial={reduceMotion ? false : { opacity: 0, scaleY: 0 }}
            transition={{ delay: reduceMotion ? 0 : 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <MangaPanelArt visual="bell" />
            <span className="absolute bottom-5 right-5 rotate-[-7deg] font-display text-5xl text-accent-deep">GORON</span>
          </motion.div>
        </div>
        {!reduceMotion && !complete ? <div className="absolute inset-0 animate-tone-settle bg-screentone bg-tone opacity-50" /> : null}
      </div>

      <div>
        <p className="font-display text-xs tracking-[0.22em] text-accent-soft">墨入れ中</p>
        <h1 className="mt-4 font-display text-4xl text-copy sm:text-5xl">
          {complete ? "Chapter seven is ready" : "Drawing chapter seven"}
        </h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-copy-secondary">
          You can leave this screen. Your selected pages and accepted story state stay attached to this chapter.
        </p>
        <ol className="mt-9 grid gap-4">
          {statuses.map((status, index) => {
            const done = index < activeStatus;
            const active = index === activeStatus && !complete;
            return (
              <li className={`flex items-center gap-3 text-sm ${done ? "text-copy" : "text-copy-muted"}`} key={status}>
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-control border ${
                    done ? "border-accent-deep bg-accent-deep text-paper-high" : "border-white/20"
                  }`}
                >
                  {done ? (
                    <Check aria-hidden size={14} weight="bold" />
                  ) : active ? (
                    <span aria-hidden className="h-2 w-2 animate-status-breathe rounded-control bg-accent-soft" />
                  ) : null}
                </span>
                {status}
              </li>
            );
          })}
        </ol>
        {complete ? (
          <Button asChild className="mt-9" size="lg">
            <Link href={`/books/${bookId}/manga/${projectId}`}>
              Read the chapter
              <ArrowRight aria-hidden size={17} weight="bold" />
            </Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
