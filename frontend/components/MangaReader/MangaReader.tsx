"use client";

import { Eye } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";

import { MangaPage, VerticalManga } from "@/components/MangaReader/MangaPage";
import { ReaderControls } from "@/components/MangaReader/ReaderControls";
import type { ReaderProjectView } from "@/lib/fixtures/reader-adapter";
import { useReaderStore } from "@/store/useReaderStore";

export function MangaReader({ project }: { project: ReaderProjectView }) {
  const reduceMotion = useReducedMotion();
  const {
    chromeVisible,
    currentPage,
    mode,
    nextPage,
    previousPage,
    setMode,
    setModeFromViewport,
    toggleChrome,
  } = useReaderStore();

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    setModeFromViewport(media.matches ? "vertical" : "rtl");
  }, [setModeFromViewport]);

  const page = project.pages[currentPage] ?? project.pages[0];

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-shell pb-24">
      <div className="fixed left-4 top-4 z-20 rounded-control border border-white/15 bg-ink/90 px-4 py-2 text-[11px] font-semibold text-copy-secondary backdrop-blur-md sm:left-6 sm:top-6">
        <span className="text-copy">{project.chapterLabel}</span>
        <span className="ml-2 hidden text-copy-muted sm:inline">{page.sourceLabel}</span>
      </div>

      <div
        aria-label={chromeVisible ? "Hide reading controls" : "Show reading controls"}
        className="min-h-[100dvh] cursor-pointer pt-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-soft sm:pt-0"
        onClick={toggleChrome}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleChrome();
          }
        }}
        role="button"
        tabIndex={0}
      >
        {mode === "rtl" ? (
          <div className="grid min-h-[100dvh] place-items-center px-0 py-16 sm:px-16">
            <AnimatePresence mode="wait">
              <motion.div
                key={page.id}
                animate={{ opacity: 1, x: 0 }}
                className="w-full"
                exit={{ opacity: 0, x: reduceMotion ? 0 : -18 }}
                initial={{ opacity: 0, x: reduceMotion ? 0 : 18 }}
                transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <MangaPage page={page} />
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <VerticalManga pages={project.pages} />
        )}
      </div>

      <AnimatePresence>
        {chromeVisible ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            initial={{ opacity: 0, y: 16 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
          >
            <ReaderControls
              bookId={project.bookId}
              bookTitle={project.bookTitle}
              canGoNext={currentPage < project.pages.length - 1}
              canGoPrevious={currentPage > 0}
              currentPage={currentPage}
              mode={mode}
              onClose={toggleChrome}
              onModeChange={setMode}
              onNext={() => nextPage(project.pages.length)}
              onPrevious={previousPage}
              pageCount={project.pages.length}
              projectId={project.projectId}
            />
          </motion.div>
        ) : (
          <button
            aria-label="Show reader controls"
            className="focus-ring fixed bottom-5 right-5 z-20 grid min-h-12 min-w-12 place-items-center rounded-control border border-white/15 bg-ink/95 text-copy shadow-chrome"
            onClick={toggleChrome}
            type="button"
          >
            <Eye aria-hidden size={20} />
          </button>
        )}
      </AnimatePresence>
    </main>
  );
}
