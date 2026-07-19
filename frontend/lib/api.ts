import type { ReaderProjectView } from "@/lib/fixtures/reader-adapter";
import { readerProjectFixture } from "@/lib/fixtures/scrollstack-fixture";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new ApiError("NEXT_PUBLIC_API_URL is not configured", 500);
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

export async function loadReaderProject(
  bookId: string,
  projectId: string,
): Promise<ReaderProjectView> {
  // The initial visual demo stays deterministic while the control-plane page
  // endpoint is wired. Production responses must use generated RenderedPage
  // types and the trusted projection in reader-adapter.ts.
  if (bookId !== readerProjectFixture.bookId || projectId !== readerProjectFixture.projectId) {
    throw new ApiError("Manga project was not found", 404);
  }

  return Promise.resolve(readerProjectFixture);
}
