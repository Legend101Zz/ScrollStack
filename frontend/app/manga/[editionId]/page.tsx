import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EditionReader } from "@/components/MangaReader/EditionReader";
import { ReaderLoadError } from "@/components/ui/AsyncState";
import { ApiError, getMangaEdition } from "@/lib/api";

export const metadata: Metadata = {
  title: "Manga edition",
};

export default async function EditionPage({
  params,
}: {
  params: Promise<{ editionId: string }>;
}) {
  const { editionId } = await params;
  try {
    return <EditionReader edition={await getMangaEdition(editionId)} />;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    if (error instanceof ApiError) {
      return (
        <ReaderLoadError
          bookId="library"
          code={error.code}
          message={error.message}
          projectId={editionId}
        />
      );
    }
    throw error;
  }
}
