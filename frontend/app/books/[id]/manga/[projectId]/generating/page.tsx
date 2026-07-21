import type { Metadata } from "next";

import { GenerationStage } from "@/components/generation/GenerationStage";

export const metadata: Metadata = {
  title: "Drawing your chapter",
};

export default async function GeneratingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; projectId: string }>;
  searchParams: Promise<{ runId?: string }>;
}) {
  const [{ id, projectId }, { runId }] = await Promise.all([params, searchParams]);

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-5xl px-[var(--ss-page-inline)] py-10 sm:py-14">
      <GenerationStage bookId={id} projectId={projectId} runId={runId} />
    </main>
  );
}
