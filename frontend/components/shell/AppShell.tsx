"use client";

import { List, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { BrandMark } from "@/components/shell/BrandMark";
import { Button } from "@/components/ui/Button";

const readerPath = /^\/books\/[^/]+\/manga\/[^/]+$/;

export function AppShell() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  if (readerPath.test(pathname)) {
    return null;
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-shell/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-frame items-center justify-between px-[var(--ss-page-inline)]">
        <BrandMark />
        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          <Link
            className="text-sm text-copy-secondary transition-colors hover:text-copy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
            href="/library"
          >
            Library
          </Link>
          <Link
            className="text-sm text-copy-secondary transition-colors hover:text-copy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
            href="/#how-it-works"
          >
            How it works
          </Link>
          <Button asChild size="sm">
            <Link href="/books/new">Open a book</Link>
          </Button>
        </nav>
        <button
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          className="grid min-h-11 min-w-11 place-items-center rounded-control border border-white/15 text-copy md:hidden"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          {menuOpen ? <X aria-hidden size={20} /> : <List aria-hidden size={20} />}
        </button>
      </div>
      {menuOpen ? (
        <nav aria-label="Mobile" className="border-t border-white/10 px-4 py-4 md:hidden">
          <div className="mx-auto grid max-w-frame gap-2">
            <Link className="rounded-input px-4 py-3 text-copy-secondary hover:bg-white/[0.06]" href="/library">
              Library
            </Link>
            <Link className="rounded-input px-4 py-3 text-copy-secondary hover:bg-white/[0.06]" href="/#how-it-works">
              How it works
            </Link>
            <Button asChild className="mt-2 w-full">
              <Link href="/books/new">Open a book</Link>
            </Button>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
