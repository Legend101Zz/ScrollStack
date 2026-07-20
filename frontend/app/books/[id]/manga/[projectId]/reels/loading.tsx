export default function LoadingReels() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading reel player"
      className="fixed inset-0 z-[60] grid h-[100dvh] place-items-center bg-shell px-4 py-10"
    >
      <div className="aspect-[9/16] h-[82dvh] max-h-[920px] animate-pulse rounded-panel border border-white/10 bg-ink-raised" />
    </main>
  );
}
