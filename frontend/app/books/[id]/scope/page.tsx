import type { Metadata } from "next";

import { ScopeSelector } from "@/components/ui/ScopeSelector";

export const metadata: Metadata = {
  title: "Choose pages",
};

export default async function ScopePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ projectId?: string }>;
}) {
  const [{ id }, { projectId }] = await Promise.all([params, searchParams]);

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-5xl px-[var(--ss-page-inline)] py-12 sm:py-16">
      <h1 className="font-display text-4xl text-copy sm:text-6xl">Choose the source</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-copy-secondary">
        The whole parsed book is selected by default. Narrow it only when you want a shorter edition.
      </p>
      <ScopeSelector bookId={id} initialProjectId={projectId} />
    </main>
  );
}
