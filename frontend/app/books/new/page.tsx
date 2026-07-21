import type { Metadata } from "next";

import { UploadForm } from "@/components/ui/UploadForm";

export const metadata: Metadata = {
  title: "Open a book",
};

export default function NewBookPage() {
  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-4xl px-[var(--ss-page-inline)] py-12 sm:py-16">
      <h1 className="max-w-[12ch] font-display text-4xl leading-tight text-copy sm:text-6xl">Turn a PDF into manga</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-copy-secondary">
        Upload one book, generate a condensed edition, and keep it in your library.
      </p>
      <UploadForm />
    </main>
  );
}
