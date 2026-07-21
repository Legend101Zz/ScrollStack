import { MangaPanel } from "@/components/MangaReader/MangaPanel";
import type { ReaderPageView } from "@/lib/fixtures/reader-adapter";

export function MangaPage({ page }: { page: ReaderPageView }) {
  return (
    <section
      aria-label={`Manga page ${page.pageNumber}`}
      className="paper-tone relative mx-auto grid w-full max-w-[46rem] auto-rows-[minmax(11rem,auto)] grid-cols-6 gap-[var(--ss-manga-gutter)] bg-paper p-[var(--ss-manga-gutter)]"
      dir={page.readingDirection ?? "rtl"}
    >
      {page.panels.map((panel) => (
        <MangaPanel key={panel.id} panel={panel} />
      ))}
    </section>
  );
}

export function VerticalManga({ pages }: { pages: ReaderPageView[] }) {
  return (
    <div className="paper-tone mx-auto w-full max-w-[40rem] bg-paper">
      {pages.flatMap((page) =>
        page.panels.map((panel) => <MangaPanel key={panel.id} panel={panel} vertical />),
      )}
    </div>
  );
}
