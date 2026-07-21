"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/ui/AsyncState";

export default function ReelsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="fixed inset-0 z-[60] overflow-auto bg-shell">
      <ErrorState reset={reset} />
    </div>
  );
}
