import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MangaReader } from "@/components/MangaReader/MangaReader";
import { ApiError, loadReaderProject } from "@/lib/api";

export const metadata: Metadata = {
  title: "Manga reader",
};

export default async function MangaReaderPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id, projectId } = await params;

  try {
    const project = await loadReaderProject(id, projectId);
    return <MangaReader project={project} />;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
