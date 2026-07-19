import type { Metadata } from "next";

import { ScopeSelector } from "@/components/ui/ScopeSelector";

export const metadata: Metadata = {
  title: "Choose pages",
};

export default function ScopePage() {
  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-5xl px-[var(--ss-page-inline)] py-12 sm:py-16">
      <h1 className="font-display text-4xl text-copy sm:text-6xl">Choose what comes next</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-copy-secondary">
        Mark one short source range. The accepted cast, setting, and ending carry into this slice.
      </p>
      <ScopeSelector />
    </main>
  );
}
