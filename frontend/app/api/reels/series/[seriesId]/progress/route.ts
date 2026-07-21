import { proxyReelApi } from "../../../_lib/proxy";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ seriesId: string }> },
): Promise<Response> {
  const { seriesId } = await params;
  return proxyReelApi(`/series/${encodeURIComponent(seriesId)}/progress`);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ seriesId: string }> },
): Promise<Response> {
  const { seriesId } = await params;
  return proxyReelApi(`/series/${encodeURIComponent(seriesId)}/progress`, request);
}
