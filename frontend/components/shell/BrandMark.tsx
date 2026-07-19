import Link from "next/link";

export function BrandMark() {
  return (
    <Link
      aria-label="ScrollStack home"
      className="font-display text-lg tracking-tight text-copy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
      href="/"
    >
      Scroll<span className="text-accent-soft">Stack</span>
    </Link>
  );
}
