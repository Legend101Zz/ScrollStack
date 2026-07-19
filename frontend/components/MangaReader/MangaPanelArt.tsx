import { cn } from "@/lib/cn";

export type MangaPanelVisual = "bell" | "harbour" | "letter" | "stairs" | "silence";

export function MangaPanelArt({
  className,
  visual,
}: {
  className?: string;
  visual: MangaPanelVisual;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute inset-0 overflow-hidden bg-paper-soft",
        visual === "harbour" &&
          "bg-[linear-gradient(168deg,#f1e6d1_0%,#d6c29d_55%,#9c8464_100%)]",
        visual === "letter" &&
          "bg-[linear-gradient(142deg,#fbf5e9_0%,#e2d1b4_60%,#c4aa83_100%)]",
        visual === "stairs" &&
          "bg-[linear-gradient(155deg,#eee1ca_0%,#cbb390_48%,#4c3829_49%,#211812_100%)]",
        visual === "silence" && "bg-ink",
        visual === "bell" &&
          "bg-[radial-gradient(circle_at_68%_38%,#f6eddd_0_8%,#c9af86_9%_22%,#5c4431_23%_24%,#211812_25%_100%)]",
        className,
      )}
    >
      <div className="paper-tone absolute inset-0 opacity-45" />
      {visual === "letter" ? (
        <>
          <div className="absolute left-[16%] top-[20%] h-[54%] w-[68%] rotate-[-6deg] border-2 border-ink bg-paper-high shadow-[8px_10px_0_rgb(22_16_12_/_0.16)]" />
          <div className="absolute left-[28%] top-[36%] h-[2px] w-[40%] rotate-[-6deg] bg-ink/45" />
          <div className="absolute left-[30%] top-[46%] h-[2px] w-[32%] rotate-[-6deg] bg-ink/35" />
        </>
      ) : null}
      {visual === "harbour" ? (
        <>
          <div className="absolute bottom-[22%] left-[-10%] h-[28%] w-[80%] rotate-[-8deg] border-t-[3px] border-ink/70" />
          <div className="absolute bottom-[8%] right-[-8%] h-[42%] w-[68%] rotate-[12deg] border-t-[3px] border-ink/70" />
          <div className="absolute right-[18%] top-[12%] h-[44%] w-[3px] bg-ink/70" />
          <div className="absolute right-[10%] top-[26%] h-[3px] w-[18%] bg-ink/70" />
        </>
      ) : null}
      {visual === "stairs" ? (
        <>
          <div className="absolute bottom-[9%] left-[12%] h-[3px] w-[68%] rotate-[-18deg] bg-paper-high/60" />
          <div className="absolute bottom-[27%] left-[16%] h-[3px] w-[68%] rotate-[-18deg] bg-paper-high/45" />
          <div className="absolute bottom-[45%] left-[20%] h-[3px] w-[68%] rotate-[-18deg] bg-paper-high/35" />
        </>
      ) : null}
      {visual === "silence" ? (
        <div className="absolute left-[42%] top-[14%] h-[72%] w-[16%] rounded-[46%_46%_30%_30%] bg-paper-high/10 shadow-[0_0_0_2px_rgb(251_245_233_/_0.2)]" />
      ) : null}
      {visual === "bell" ? (
        <div className="absolute left-[26%] top-[15%] h-[60%] w-[48%] rounded-[48%_48%_30%_30%] border-[3px] border-paper-high/35" />
      ) : null}
    </div>
  );
}
