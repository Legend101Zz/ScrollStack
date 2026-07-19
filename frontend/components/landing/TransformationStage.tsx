"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { MangaPanelArt } from "@/components/MangaReader/MangaPanelArt";

const phases = ["prose", "ink", "motion"] as const;
type Phase = (typeof phases)[number];

const phaseLabel: Record<Phase, string> = {
  prose: "Prose",
  ink: "Ink",
  motion: "Motion",
};

export function TransformationStage() {
  const reduceMotion = useReducedMotion();
  const [phaseIndex, setPhaseIndex] = useState(0);
  const phase = reduceMotion ? "ink" : phases[phaseIndex];

  useEffect(() => {
    if (reduceMotion) return;

    const interval = window.setInterval(() => {
      setPhaseIndex((current) => (current + 1) % phases.length);
    }, 3200);

    return () => window.clearInterval(interval);
  }, [reduceMotion]);

  const transition = useMemo(
    () => ({ duration: reduceMotion ? 0 : 0.55, ease: [0.16, 1, 0.3, 1] as const }),
    [reduceMotion],
  );

  return (
    <section
      aria-label="A book passage transforming into manga and motion"
      className="relative overflow-hidden rounded-panel border border-white/15 bg-ink-raised p-3 shadow-paper sm:p-5"
    >
      <div className="shell-tone pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative aspect-[4/5] overflow-hidden rounded-input bg-paper sm:aspect-[5/4]">
        <AnimatePresence mode="wait">
          {phase === "prose" ? (
            <motion.div
              key="prose"
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-0 bg-paper-high p-7 text-copy-paper sm:p-10"
              exit={{ opacity: 0, y: -12 }}
              initial={{ opacity: 0, y: 12 }}
              transition={transition}
            >
              <p className="font-semibold uppercase tracking-[0.16em] text-copy-paper-muted text-[10px]">
                Chapter seven, page 112
              </p>
              <p className="mt-6 max-w-[38ch] text-sm leading-7 sm:text-base">
                <span className="float-left mr-2 font-display text-4xl leading-[0.85] text-accent-deep">T</span>
                he letter was already open when Mira reached the landing. Rain pulled the ink sideways while the harbour bell counted the wrong hour.
              </p>
              <p className="mt-5 max-w-[38ch] text-sm leading-7 sm:text-base">
                “You were not supposed to find that,” a voice said from the stair.
              </p>
            </motion.div>
          ) : null}
          {phase === "ink" ? (
            <motion.div
              key="ink"
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 grid grid-cols-2 grid-rows-[0.86fr_1.15fr_0.9fr] gap-2 bg-paper p-3 sm:gap-3 sm:p-4"
              exit={{ opacity: 0, scale: 1.02 }}
              initial={{ opacity: 0, scale: 0.98 }}
              transition={transition}
            >
              <div className="relative overflow-hidden border-[3px] border-ink">
                <MangaPanelArt visual="letter" />
                <span className="absolute left-3 top-3 max-w-[8rem] rounded-[50%] border-2 border-ink bg-paper-high px-3 py-2 text-[10px] font-medium leading-tight text-copy-paper sm:text-xs">
                  Who opened it?
                </span>
              </div>
              <div className="relative overflow-hidden border-[3px] border-ink">
                <MangaPanelArt visual="stairs" />
              </div>
              <div className="relative col-span-2 overflow-hidden border-[3px] border-ink">
                <Image
                  alt="Manga scene of Mira holding a sealed letter inside a rain-dark observatory"
                  className="absolute inset-0 h-full w-full object-cover object-[center_54%]"
                  height={1024}
                  priority
                  sizes="(max-width: 767px) 88vw, 42vw"
                  src="/art/last-observatory-hero.png"
                  width={1536}
                />
                <div className="paper-tone absolute inset-0 opacity-20 mix-blend-multiply" />
                <span className="absolute bottom-3 right-4 rotate-[-7deg] font-display text-3xl text-accent-deep sm:text-5xl">
                  GORON
                </span>
              </div>
              <div className="relative overflow-hidden border-[3px] border-ink">
                <MangaPanelArt visual="silence" />
              </div>
              <div className="relative overflow-hidden border-[3px] border-accent-deep">
                <MangaPanelArt visual="bell" />
                <span className="absolute bottom-3 left-3 max-w-[9rem] bg-ink px-3 py-2 text-[10px] font-medium leading-tight text-paper-high sm:text-xs">
                  The bell counted again.
                </span>
              </div>
            </motion.div>
          ) : null}
          {phase === "motion" ? (
            <motion.div
              key="motion"
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 grid place-items-center bg-ink"
              exit={{ opacity: 0, scale: 1.03 }}
              initial={{ opacity: 0, scale: 0.97 }}
              transition={transition}
            >
              <motion.div
                animate={reduceMotion ? undefined : { y: [8, -8, 8], scale: [1.04, 1.1, 1.04] }}
                className="relative aspect-[9/16] h-[84%] overflow-hidden rounded-panel border-2 border-paper-high/20"
                transition={{ duration: 5, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}
              >
                <MangaPanelArt visual="bell" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_38%,rgb(13_10_8_/_0.9)_100%)]" />
                <p className="absolute bottom-[12%] left-[9%] right-[9%] text-sm font-semibold leading-5 text-paper-high">
                  “Do not turn around.”
                </p>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-3" aria-live="polite">
        {phases.map((item) => (
          <div
            className={`border-t-2 pt-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] ${
              item === phase ? "border-accent-soft text-copy" : "border-white/15 text-copy-muted"
            }`}
            key={item}
          >
            {phaseLabel[item]}
          </div>
        ))}
      </div>
    </section>
  );
}
