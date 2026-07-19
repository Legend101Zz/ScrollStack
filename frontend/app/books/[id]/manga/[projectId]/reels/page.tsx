import type { Metadata } from "next";

import { ReelFeed } from "@/components/ReelFeed/ReelFeed";
import { loadFixtureReelFeed } from "@/components/ReelFeed/fixture-adapter";

export const metadata: Metadata = {
  title: "Reels",
};

export default async function ReelsPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id, projectId } = await params;
  return <ReelFeed payload={loadFixtureReelFeed(id, projectId)} />;
}
