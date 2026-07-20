import { proxyReelApi } from "../../_lib/proxy";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reelId: string }> },
): Promise<Response> {
  const { reelId } = await params;
  return proxyReelApi(`/reels/${encodeURIComponent(reelId)}`);
}
