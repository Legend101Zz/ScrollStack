import "server-only";

function apiBaseUrl(): string {
  const value = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!value) throw new Error("The ScrollStack API URL is not configured.");
  return value.replace(/\/$/, "");
}

function responseHeaders(response: Response): Headers {
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("cache-control", "no-store");
  return headers;
}

export async function proxyReelApi(path: string, request?: Request): Promise<Response> {
  try {
    const method = request?.method ?? "GET";
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      body: method === "GET" || method === "HEAD" ? undefined : await request?.text(),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(request?.headers.get("content-type")
          ? { "Content-Type": request.headers.get("content-type")! }
          : {}),
      },
      method,
    });

    return new Response(response.body, {
      headers: responseHeaders(response),
      status: response.status,
      statusText: response.statusText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The reel API is unavailable.";
    return Response.json({ detail: message }, { status: 502 });
  }
}
