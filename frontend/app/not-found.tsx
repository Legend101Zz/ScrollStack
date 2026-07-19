import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Button } from "@/components/ui/Button";

export default function NotFoundPage() {
  return (
    <main className="grid min-h-[calc(100dvh-4rem)] place-items-center px-4 py-16">
      <section className="max-w-xl text-center">
        <p className="font-display text-sm tracking-[0.2em] text-accent-soft">ページが見つかりません</p>
        <h1 className="mt-5 font-display text-4xl text-copy sm:text-5xl">That page is outside this volume</h1>
        <p className="mt-4 text-base leading-7 text-copy-secondary">
          Return to the library and choose an available chapter.
        </p>
        <Button asChild className="mt-8" variant="secondary">
          <Link href="/library">
            <ArrowLeft aria-hidden size={17} />
            Back to library
          </Link>
        </Button>
      </section>
    </main>
  );
}
