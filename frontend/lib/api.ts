import type {
  Artifact,
  GenerationRun,
  ModelReceipt,
  RenderedPage,
  ScopeManifest,
  SourceUnit,
  StageRun,
} from "@scrollstack/contracts";

import {
  adaptRenderedPage,
  type ReaderProjectView,
  type TrustedReaderAsset,
} from "@/lib/fixtures/reader-adapter";
import { readerProjectFixture } from "@/lib/fixtures/scrollstack-fixture";

export const UI_OWNER_ID = "scrollstack-ui-owner-v1";

export type BookStatus = "pending" | "parsing" | "parsed" | "failed";

export type BookView = {
  author: string | null;
  book_id: string;
  created_at: string;
  error_code: string | null;
  error_detail: string | null;
  original_filename: string;
  owner_id: string;
  parse_version: string | null;
  pdf_hash: string;
  status: BookStatus;
  title: string;
  total_pages: number;
  updated_at: string;
};

export type UploadResult = {
  book: BookView;
  is_cached: boolean;
  task_id?: string | null;
};

export type MangaProjectView = {
  active_memory_version: number;
  book_id: string;
  created_at: string;
  owner_id: string;
  project_id: string;
  updated_at: string;
};

export type GenerationRunView = {
  run: GenerationRun;
  stages: StageRun[];
};

export type SourceUnitMetadata = {
  heading_path: string[];
  image_refs: string[];
  kind: "chapter" | "section" | "page_window";
  page_end: number;
  page_start: number;
  parse_version: string;
  source_unit_id: string;
  text_hash: string;
  token_count: number;
};

export type ReaderAsset = {
  asset_id: string;
  asset_type: "character_sprite" | "expression" | "key_panel" | "background";
  content_hash: string;
  height: number | null;
  mime_type: string;
  model_receipt: ModelReceipt | null;
  url: string;
  width: number | null;
};

export type MangaReaderPayload = {
  assets: ReaderAsset[];
  book: {
    author: string | null;
    book_id: string;
    title: string;
    total_pages: number;
  };
  generated_at: string;
  pages: RenderedPage[];
  project: {
    active_memory_version: number;
    project_id: string;
  };
  run_id: string;
  schema_version: "manga-reader.v1";
  scope_id: string;
};

export type LibraryEdition = {
  edition_id: string;
  book_id: string;
  project_id: string;
  title: string;
  status: "accepted";
  page_count: number;
  cover_url: string;
  created_at: string;
  current_edition: boolean;
};

export type MangaEditionView = {
  edition_id: string;
  book_id: string;
  project_id: string;
  run_id: string;
  scope_id: string;
  title: string;
  status: "accepted";
  page_count: number;
  pages: Array<{
    page_index: number;
    page_id: string;
    rendered_page_artifact_id: string;
    raster_asset_id: string;
    content_hash: string;
    width: number;
    height: number;
    url: string;
  }>;
  cover_url: string;
  plan_artifact_id: string;
  script_artifact_id: string;
  thumbnail_artifact_id: string;
  character_reference_artifact_id: string;
  character_reference_attempt_id: string;
  character_reference_asset_id: string;
  panel_asset_ids: string[];
  image_attempt_artifact_ids: string[];
  image_asset_artifact_ids: string[];
  receipt_artifact_ids: string[];
  image_provider: "openrouter";
  image_model: string;
  renderer_version: string;
  implementation_version: string;
  parent_edition_id: string | null;
  text_cost_usd: number;
  image_cost_usd: number;
  accepted_panel_images: number;
  accepted_image_attempts: number;
  rejected_image_attempts: number;
  created_at: string;
};

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
  detail?: string | Array<{ msg?: string }>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = "request_failed",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function apiBaseUrl(): string {
  const baseUrl =
    typeof window === "undefined"
      ? process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL
      : process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new ApiError("The ScrollStack API is not configured.", 500, "api_not_configured");
  }
  return baseUrl.replace(/\/$/, "");
}

function publicApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new ApiError("The public ScrollStack API is not configured.", 500, "api_not_configured");
  }
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function editionAssetUrl(path: string): string {
  return publicApiUrl(path);
}

function errorMessage(payload: ApiErrorPayload | null, status: number): string {
  if (payload?.error?.message) return payload.error.message;
  if (typeof payload?.detail === "string") return payload.detail;
  if (Array.isArray(payload?.detail)) {
    const messages = payload.detail.flatMap((item) => (item.msg ? [item.msg] : []));
    if (messages.length > 0) return messages.join(" ");
  }
  return `Request failed with status ${status}`;
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      // Some infrastructure errors do not return JSON. The status still
      // remains available to the typed UI state.
    }
    throw new ApiError(
      errorMessage(payload, response.status),
      response.status,
      payload?.error?.code ?? "request_failed",
    );
  }

  return (await response.json()) as T;
}

export async function uploadBook(file: File, ownerId = UI_OWNER_ID): Promise<UploadResult> {
  const form = new FormData();
  form.set("file", file);
  form.set("owner_id", ownerId);
  return requestJson<UploadResult>("/upload", { body: form, method: "POST" });
}

export function getBook(bookId: string, signal?: AbortSignal): Promise<BookView> {
  return requestJson<BookView>(`/books/${encodeURIComponent(bookId)}`, {
    cache: "no-store",
    signal,
  });
}

export function listSourceUnits(
  bookId: string,
  signal?: AbortSignal,
): Promise<SourceUnitMetadata[]> {
  return requestJson<SourceUnitMetadata[]>(`/books/${encodeURIComponent(bookId)}/source-units`, {
    cache: "no-store",
    signal,
  });
}

export function getBookPage(
  bookId: string,
  pageNumber: number,
  signal?: AbortSignal,
): Promise<SourceUnit> {
  return requestJson<SourceUnit>(
    `/books/${encodeURIComponent(bookId)}/pages/${pageNumber}`,
    { cache: "no-store", signal },
  );
}

export function createMangaProject(
  bookId: string,
  ownerId = UI_OWNER_ID,
): Promise<MangaProjectView> {
  return requestJson<MangaProjectView>(
    `/books/${encodeURIComponent(bookId)}/manga-projects`,
    {
      body: JSON.stringify({ owner_id: ownerId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
}

export function getMangaProject(
  projectId: string,
  signal?: AbortSignal,
): Promise<MangaProjectView> {
  return requestJson<MangaProjectView>(`/manga-projects/${encodeURIComponent(projectId)}`, {
    cache: "no-store",
    signal,
  });
}

export function createScope(
  bookId: string,
  input: {
    created_by: string;
    page_ranges: [{ page_end: number; page_start: number }];
    project_id: string;
    selection_label: string;
  },
): Promise<ScopeManifest> {
  return requestJson<ScopeManifest>(`/books/${encodeURIComponent(bookId)}/scopes`, {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

export function startGenerationRun(
  projectId: string,
  scopeId: string,
  createdBy = UI_OWNER_ID,
): Promise<GenerationRunView> {
  return requestJson<GenerationRunView>(
    `/manga-projects/${encodeURIComponent(projectId)}/generation-runs`,
    {
      body: JSON.stringify({
        budget: {
          max_agent_steps: 20,
          max_image_cost_usd: 2,
          max_key_panels: 20,
          max_reels: 0,
          max_render_minutes: 5,
          max_repair_attempts: 2,
          max_sprites: 1,
          max_text_cost_usd: 3,
        },
        created_by: createdBy,
        pipeline_version: "manga-edition.v1",
        requested_outputs: ["manga"],
        scope_id: scopeId,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
}

export function getGenerationRun(runId: string, signal?: AbortSignal): Promise<GenerationRunView> {
  return requestJson<GenerationRunView>(`/generation-runs/${encodeURIComponent(runId)}`, {
    cache: "no-store",
    signal,
  });
}

export function getGenerationArtifacts(runId: string, signal?: AbortSignal): Promise<Artifact[]> {
  return requestJson<Artifact[]>(`/generation-runs/${encodeURIComponent(runId)}/artifacts`, {
    cache: "no-store",
    signal,
  });
}

function trustedAsset(asset: ReaderAsset): TrustedReaderAsset {
  if (
    !asset.asset_id ||
    !/^[a-f0-9]{64}$/.test(asset.content_hash) ||
    !asset.mime_type.startsWith("image/") ||
    asset.width === null ||
    asset.height === null ||
    asset.width <= 0 ||
    asset.height <= 0
  ) {
    throw new ApiError(
      `Reader asset ${asset.asset_id || "unknown"} is invalid.`,
      502,
      "invalid_reader_asset",
    );
  }
  return {
    alt: `Generated manga art ${asset.asset_id}`,
    height: asset.height,
    objectPosition: "center",
    src: publicApiUrl(asset.url),
    unoptimized: true,
    width: asset.width,
  };
}

function sourceRange(payload: MangaReaderPayload): { end: number; start: number } {
  const refs = payload.pages.flatMap((page) =>
    page.storyboard_page.panels.flatMap((panel) => panel.source_refs),
  );
  if (refs.length === 0) {
    throw new ApiError(
      "The accepted manga has no source page coverage.",
      502,
      "reader_source_coverage_missing",
    );
  }
  return {
    end: Math.max(...refs.map((ref) => ref.page_end)),
    start: Math.min(...refs.map((ref) => ref.page_start)),
  };
}

function adaptReaderPayload(
  payload: MangaReaderPayload,
  expectedBookId: string,
  expectedProjectId: string,
): ReaderProjectView {
  if (payload.schema_version !== "manga-reader.v1") {
    throw new ApiError("The reader payload schema is unsupported.", 502, "reader_schema_mismatch");
  }
  if (
    payload.book.book_id !== expectedBookId ||
    payload.project.project_id !== expectedProjectId
  ) {
    throw new ApiError(
      "The reader payload belongs to a different manga project.",
      502,
      "reader_identity_mismatch",
    );
  }
  if (payload.pages.length === 0) {
    throw new ApiError("This manga has no accepted pages.", 409, "reader_pages_missing");
  }
  const range = sourceRange(payload);

  const assets = new Map<string, TrustedReaderAsset>();
  for (const asset of payload.assets) {
    if (assets.has(asset.asset_id)) {
      throw new ApiError(
        `Reader asset ${asset.asset_id} is duplicated.`,
        502,
        "duplicate_reader_asset",
      );
    }
    assets.set(asset.asset_id, trustedAsset(asset));
  }

  let pages: ReaderProjectView["pages"];
  try {
    pages = payload.pages.map((page) =>
      adaptRenderedPage(page, (assetId) => assets.get(assetId), {
        sourcePageEnd: range.end,
        sourcePageStart: range.start,
      }),
    );
  } catch (caught) {
    throw new ApiError(
      caught instanceof Error ? caught.message : "The accepted reader payload is invalid.",
      502,
      "invalid_reader_payload",
    );
  }

  return {
    bookId: payload.book.book_id,
    bookTitle: payload.book.title,
    chapterLabel: `Pages ${range.start}-${range.end}`,
    pages,
    projectId: payload.project.project_id,
    receipt: {
      pageRange: `${range.start}-${range.end}`,
      sourceName: payload.book.title,
    },
  };
}

export async function loadReaderProject(
  bookId: string,
  projectId: string,
): Promise<ReaderProjectView> {
  if (bookId === readerProjectFixture.bookId && projectId === readerProjectFixture.projectId) {
    return readerProjectFixture;
  }

  const payload = await requestJson<MangaReaderPayload>(
    `/books/${encodeURIComponent(bookId)}/manga/${encodeURIComponent(projectId)}/reader`,
    { cache: "no-store" },
  );
  return adaptReaderPayload(payload, bookId, projectId);
}

export function listLibrary(signal?: AbortSignal): Promise<LibraryEdition[]> {
  return requestJson<LibraryEdition[]>("/library", { cache: "no-store", signal });
}

export function getMangaEdition(
  editionId: string,
  signal?: AbortSignal,
): Promise<MangaEditionView> {
  return requestJson<MangaEditionView>(`/manga/${encodeURIComponent(editionId)}`, {
    cache: "no-store",
    signal,
  });
}
