import type { Metadata } from "next";

import { ReelFeedLoader } from "@/components/ReelFeed/ReelFeedLoader";
import { loadFixtureReelFeed } from "@/components/ReelFeed/fixture-adapter";

export const metadata: Metadata = {
  title: "Reels",
};

export default async function ReelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; projectId: string }>;
  searchParams: Promise<{ fixture?: string | string[] }>;
}) {
  const { id, projectId } = await params;
  const query = await searchParams;
  const useFixture = process.env.NODE_ENV !== "production" && query.fixture === "1";
  return (
    <ReelFeedLoader
      bookId={id}
      fixture={useFixture ? loadFixtureReelFeed(id, projectId) : undefined}
      projectId={projectId}
    />
  );
}
