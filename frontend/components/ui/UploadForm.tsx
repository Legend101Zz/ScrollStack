"use client";

import { CheckCircle, FilePdf, UploadSimple } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { FormEvent, useId, useState } from "react";

import { Button } from "@/components/ui/Button";

export function UploadForm() {
  const inputId = useId();
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fileName) {
      setError("Choose a PDF before continuing.");
      return;
    }
    router.push("/books/the-harbour-bell/scope");
  }

  return (
    <form className="mt-10" onSubmit={handleSubmit}>
      <label
        className="focus-within:ring-2 focus-within:ring-accent-soft focus-within:ring-offset-2 focus-within:ring-offset-shell flex min-h-[22rem] cursor-pointer flex-col items-center justify-center rounded-panel border border-dashed border-white/25 bg-ink-raised px-6 py-12 text-center transition hover:border-accent-soft/70 hover:bg-ink-soft"
        htmlFor={inputId}
      >
        {fileName ? (
          <>
            <CheckCircle aria-hidden className="text-accent-soft" size={42} weight="duotone" />
            <span className="mt-5 font-display text-2xl text-copy">Ready to choose pages</span>
            <span className="mt-3 max-w-full truncate text-sm text-copy-secondary">{fileName}</span>
            <span className="mt-5 text-xs font-semibold text-copy-muted">Choose a different PDF</span>
          </>
        ) : (
          <>
            <div className="grid h-16 w-16 place-items-center rounded-control border border-white/15 bg-shell text-accent-soft">
              <FilePdf aria-hidden size={30} weight="duotone" />
            </div>
            <span className="mt-6 font-display text-2xl text-copy">Choose your PDF</span>
            <span className="mt-3 max-w-md text-sm leading-6 text-copy-secondary">
              Start with a book you have the right to transform. You will choose a small page range next.
            </span>
          </>
        )}
        <input
          accept="application/pdf,.pdf"
          className="sr-only"
          id={inputId}
          name="book"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
              setFileName(null);
              setError("ScrollStack accepts PDF files only.");
              return;
            }
            setError(null);
            setFileName(file.name);
          }}
          type="file"
        />
      </label>
      <div className="mt-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p
          aria-live="polite"
          className={`text-sm ${error ? "text-accent-soft" : "text-copy-muted"}`}
          id={`${inputId}-status`}
        >
          {error ?? "Your selection stays unchanged until you confirm the page range."}
        </p>
        <Button disabled={!fileName} size="lg" type="submit">
          <UploadSimple aria-hidden size={18} weight="bold" />
          Choose pages
        </Button>
      </div>
    </form>
  );
}
