"use client";

import {
  ArrowRight,
  CheckCircle,
  FilePdf,
  SpinnerGap,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  createMangaProject,
  getBook,
  type BookView,
  type MangaProjectView,
  uploadBook,
} from "@/lib/api";

type UploadPhase =
  | "choosing"
  | "uploading"
  | "upload_rejected"
  | "parsing_queued"
  | "parsing"
  | "parsed"
  | "parsing_failed"
  | "project_failed";

function wait(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, delayMs);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("Polling cancelled", "AbortError"));
      },
      { once: true },
    );
  });
}

function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function phaseCopy(phase: UploadPhase, book: BookView | null): string {
  switch (phase) {
    case "uploading":
      return "Uploading the original PDF securely.";
    case "parsing_queued":
      return "Upload complete. Parsing is queued.";
    case "parsing":
      return "Reading page structure and text.";
    case "parsed":
      return `${book?.total_pages ?? 0} pages parsed and ready to scope.`;
    case "upload_rejected":
      return "The upload was rejected before parsing.";
    case "parsing_failed":
      return "The PDF was stored, but parsing did not complete.";
    case "project_failed":
      return "The PDF parsed, but its manga project could not be prepared.";
    default:
      return "Choose one PDF you have the right to transform.";
  }
}

export function UploadForm() {
  const inputId = useId();
  const router = useRouter();
  const activeRequest = useRef<AbortController | null>(null);
  const [book, setBook] = useState<BookView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("choosing");
  const [project, setProject] = useState<MangaProjectView | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function finishParsedBook(parsedBook: BookView, signal: AbortSignal) {
    setBook(parsedBook);
    const nextProject = await createMangaProject(parsedBook.book_id);
    if (signal.aborted) return;
    setProject(nextProject);
    setPhase("parsed");
  }

  async function pollBook(bookId: string, signal: AbortSignal) {
    while (!signal.aborted) {
      await wait(900, signal);
      let current: BookView;
      try {
        current = await getBook(bookId, signal);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") throw caught;
        setError("Connection interrupted while parsing. ScrollStack is retrying.");
        await wait(1_600, signal);
        continue;
      }
      if (signal.aborted) return;
      setError(null);
      setBook(current);
      if (current.status === "parsed") {
        await finishParsedBook(current, signal);
        return;
      }
      if (current.status === "failed") {
        setError(current.error_detail ?? "PDF parsing failed.");
        setPhase("parsing_failed");
        return;
      }
      setPhase(current.status === "parsing" ? "parsing" : "parsing_queued");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a PDF before uploading.");
      setPhase("upload_rejected");
      return;
    }

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setBook(null);
    setError(null);
    setProject(null);
    setPhase("uploading");
    let uploadAccepted = false;

    try {
      const result = await uploadBook(file);
      if (controller.signal.aborted) return;
      uploadAccepted = true;
      setBook(result.book);
      if (result.book.status === "parsed") {
        await finishParsedBook(result.book, controller.signal);
        return;
      }
      if (result.book.status === "failed") {
        setError(result.book.error_detail ?? "PDF parsing failed.");
        setPhase("parsing_failed");
        return;
      }
      setPhase(result.book.status === "parsing" ? "parsing" : "parsing_queued");
      await pollBook(result.book.book_id, controller.signal);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      const message = caught instanceof Error ? caught.message : "The upload could not be completed.";
      setError(message);
      setPhase(uploadAccepted ? "project_failed" : "upload_rejected");
    }
  }

  const busy = phase === "uploading" || phase === "parsing_queued" || phase === "parsing";
  const failed =
    phase === "upload_rejected" || phase === "parsing_failed" || phase === "project_failed";

  return (
    <form className="mt-10" onSubmit={handleSubmit}>
      <label
        className="focus-within:ring-2 focus-within:ring-accent-soft focus-within:ring-offset-2 focus-within:ring-offset-shell flex min-h-[22rem] cursor-pointer flex-col items-center justify-center rounded-panel border border-dashed border-white/25 bg-ink-raised px-6 py-12 text-center transition hover:border-accent-soft/70 hover:bg-ink-soft"
        htmlFor={inputId}
      >
        {phase === "parsed" ? (
          <>
            <CheckCircle aria-hidden className="text-accent-soft" size={42} weight="duotone" />
            <span className="mt-5 font-display text-2xl text-copy">{book?.total_pages} pages are ready</span>
            <span className="mt-3 max-w-full truncate text-sm text-copy-secondary">{book?.title}</span>
            <span className="mt-5 text-xs font-semibold text-copy-muted">Choose a different PDF</span>
          </>
        ) : busy ? (
          <>
            <SpinnerGap aria-hidden className="animate-spin text-accent-soft" size={42} weight="bold" />
            <span className="mt-5 font-display text-2xl text-copy">
              {phase === "uploading" ? "Uploading your PDF" : phase === "parsing" ? "Reading the book" : "Waiting to parse"}
            </span>
            <span className="mt-3 max-w-md text-sm leading-6 text-copy-secondary">{phaseCopy(phase, book)}</span>
          </>
        ) : failed ? (
          <>
            <WarningCircle aria-hidden className="text-accent-soft" size={42} weight="duotone" />
            <span className="mt-5 font-display text-2xl text-copy">This PDF is not ready</span>
            <span className="mt-3 max-w-md text-sm leading-6 text-copy-secondary">{error}</span>
            <span className="mt-5 text-xs font-semibold text-copy-muted">Choose another PDF</span>
          </>
        ) : file ? (
          <>
            <CheckCircle aria-hidden className="text-accent-soft" size={42} weight="duotone" />
            <span className="mt-5 font-display text-2xl text-copy">Ready to upload</span>
            <span className="mt-3 max-w-full truncate text-sm text-copy-secondary">{file.name}</span>
            <span className="mt-2 text-xs text-copy-muted">{fileSize(file.size)}</span>
            <span className="mt-5 text-xs font-semibold text-copy-muted">Choose a different PDF</span>
          </>
        ) : (
          <>
            <div className="grid h-16 w-16 place-items-center rounded-control border border-white/15 bg-shell text-accent-soft">
              <FilePdf aria-hidden size={30} weight="duotone" />
            </div>
            <span className="mt-6 font-display text-2xl text-copy">Choose your PDF</span>
            <span className="mt-3 max-w-md text-sm leading-6 text-copy-secondary">
              Start with a book you have the right to transform. You will choose a short page range next.
            </span>
          </>
        )}
        <input
          accept="application/pdf,.pdf"
          aria-describedby={`${inputId}-status`}
          className="sr-only"
          disabled={busy}
          id={inputId}
          name="file"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            activeRequest.current?.abort();
            setBook(null);
            setProject(null);
            if (!selected) {
              setFile(null);
              setError(null);
              setPhase("choosing");
              return;
            }
            if (selected.type !== "application/pdf" && !selected.name.toLowerCase().endsWith(".pdf")) {
              setFile(null);
              setError("ScrollStack accepts PDF files only.");
              setPhase("upload_rejected");
              return;
            }
            setFile(selected);
            setError(null);
            setPhase("choosing");
          }}
          type="file"
        />
      </label>

      <div className="mt-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div aria-live="polite" id={`${inputId}-status`}>
          <p className={`text-sm font-semibold ${failed ? "text-accent-soft" : "text-copy-secondary"}`}>
            {phaseCopy(phase, book)}
          </p>
          {error && !failed ? <p className="mt-1 text-xs text-accent-soft">{error}</p> : null}
          {book ? (
            <p className="mt-1 text-xs text-copy-muted">
              {book.original_filename}
              {book.total_pages > 0 ? `, ${book.total_pages} pages` : ""}
            </p>
          ) : null}
        </div>

        {phase === "parsed" && project && book ? (
          <Button
            onClick={() =>
              router.push(
                `/books/${encodeURIComponent(book.book_id)}/scope?projectId=${encodeURIComponent(project.project_id)}`,
              )
            }
            size="lg"
            type="button"
          >
            Choose pages
            <ArrowRight aria-hidden size={18} weight="bold" />
          </Button>
        ) : (
          <Button disabled={!file || busy} size="lg" type="submit">
            {busy ? <SpinnerGap aria-hidden className="animate-spin" size={18} weight="bold" /> : <UploadSimple aria-hidden size={18} weight="bold" />}
            {failed ? "Try this PDF" : "Upload PDF"}
          </Button>
        )}
      </div>
    </form>
  );
}
