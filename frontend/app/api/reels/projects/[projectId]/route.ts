import { proxyReelApi } from "../../_lib/proxy";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await params;
  return proxyReelApi(`/manga-projects/${encodeURIComponent(projectId)}/reel-series`);
}
