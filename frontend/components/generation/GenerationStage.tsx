"use client";

import {
  Check,
  Clock,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Artifact, StageRun } from "@scrollstack/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  getGenerationArtifacts,
  getGenerationRun,
  type GenerationRunView,
} from "@/lib/api";

const terminalRunStates = new Set([
  "succeeded",
  "retryable_failed",
  "terminal_failed",
  "cancelled",
  "superseded",
]);

const stageLabels: Record<string, string> = {
  asset_generation: "Generate bounded manga art",
  context_compilation: "Compile grounded book context",
  existing_manga_pipeline: "Compose manga pages",
  manga_composition: "Compose manga panels and pages",
  manga_direction: "Condense the book with MiniMax M2.7 highspeed",
  manga_page_writing: "Write ten grounded manga pages",
  manga_page_writing_context: "Compile page-writing context",
  manga_thumbnail: "Validate page layouts",
  memory_delta: "Carry continuity into project memory",
  rendered_page_validation: "Validate finished manga pages",
};

function stageLabel(name: string): string {
  return stageLabels[name] ?? name.replaceAll("_", " ");
}

function stageStatusLabel(stage: StageRun): string {
  switch (stage.status) {
    case "waiting_for_assets":
      return "Waiting for generated art";
    case "retryable_failed":
      return `Retryable failure${stage.error_code ? `: ${stage.error_code}` : ""}`;
    case "terminal_failed":
      return `Stopped${stage.error_code ? `: ${stage.error_code}` : ""}`;
    default:
      return stage.status.replaceAll("_", " ");
  }
}

function errorDetail(stage: StageRun | undefined): string | null {
  if (!stage?.error_detail || typeof stage.error_detail !== "object") return null;
  const message = stage.error_detail.message;
  return typeof message === "string" ? message : null;
}

export function GenerationStage({
  bookId,
  projectId,
  runId,
}: {
  bookId: string;
  projectId: string;
  runId?: string;
}) {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<GenerationRunView | null>(null);

  useEffect(() => {
    if (!runId) {
      setLoaded(true);
      setPollError("This generation page is missing its persisted run ID.");
      return;
    }
    const persistedRunId = runId;

    let active = true;
    let timeout: number | undefined;
    let controller: AbortController | null = null;

    async function poll() {
      controller = new AbortController();
      try {
        const nextSnapshot = await getGenerationRun(persistedRunId, controller.signal);
        if (!active) return;
        setSnapshot(nextSnapshot);
        setLoaded(true);
        setPollError(null);

        let nextArtifacts: Artifact[] = [];
        try {
          nextArtifacts = await getGenerationArtifacts(persistedRunId, controller.signal);
          if (active) {
            setArtifacts(nextArtifacts);
            const edition = nextArtifacts.find((artifact) => artifact.kind === "manga_edition");
            if (nextSnapshot.run.status === "succeeded" && edition) {
              router.replace(`/manga/${encodeURIComponent(edition.artifact_id)}`);
              return;
            }
          }
        } catch (caught) {
          if (active) {
            setPollError(
              caught instanceof Error
                ? `Run progress is current, but artifacts could not be refreshed: ${caught.message}`
                : "Run progress is current, but artifacts could not be refreshed.",
            );
          }
        }

        if (nextSnapshot.run.status === "succeeded" && nextArtifacts.length === 0) {
          router.replace(
            "/library",
          );
          return;
        }
        if (!terminalRunStates.has(nextSnapshot.run.status)) {
          timeout = window.setTimeout(() => void poll(), 1_250);
        }
      } catch (caught) {
        if (!active || (caught instanceof DOMException && caught.name === "AbortError")) return;
        setLoaded(true);
        setPollError(caught instanceof Error ? caught.message : "Generation progress is unavailable.");
        timeout = window.setTimeout(() => void poll(), 2_500);
      }
    }

    void poll();
    return () => {
      active = false;
      controller?.abort();
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [bookId, projectId, router, runId]);

  if (!loaded) {
    return (
      <section aria-busy="true" className="mt-10 rounded-panel border border-white/15 bg-ink-raised p-8 sm:p-10">
        <SpinnerGap aria-hidden className="animate-spin text-accent-soft" size={34} weight="bold" />
        <h1 className="mt-6 font-display text-4xl text-copy sm:text-5xl">Loading generation run</h1>
        <p className="mt-4 text-base leading-7 text-copy-secondary">
          Reading persisted stage state from the control plane.
        </p>
      </section>
    );
  }

  if (!snapshot) {
    return (
      <section className="mt-10 rounded-panel border border-accent/35 bg-ink-raised p-8 sm:p-10">
        <WarningCircle aria-hidden className="text-accent-soft" size={36} weight="duotone" />
        <h1 className="mt-6 font-display text-4xl text-copy sm:text-5xl">Generation run unavailable</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-copy-secondary">{pollError}</p>
        <Button className="mt-8" onClick={() => window.location.reload()} variant="secondary">
          Try again
        </Button>
      </section>
    );
  }

  const run = snapshot.run;
  const failed = run.status === "retryable_failed" || run.status === "terminal_failed";
  const stopped = failed || run.status === "cancelled" || run.status === "superseded";
  const failingStage = [...snapshot.stages]
    .reverse()
    .find((stage) => stage.status === "retryable_failed" || stage.status === "terminal_failed");

  return (
    <section className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
      <aside className="rounded-panel border border-white/15 bg-ink-raised p-7 sm:p-9">
        <p className="text-xs font-semibold text-copy-muted">Persisted generation run</p>
        <h1 className="mt-5 font-display text-4xl text-copy sm:text-5xl">
          {stopped ? "Manga generation stopped" : "Drawing your manga"}
        </h1>
        <p className="mt-5 text-base leading-7 text-copy-secondary">
          {stopped
            ? "No completed manga will be shown for this run. Accepted intermediate artifacts remain preserved."
            : "This screen follows the real worker stages. You can leave and return with the same run URL."}
        </p>

        <dl className="mt-8 grid gap-4 border-t border-white/15 pt-6 text-sm">
          <div className="flex items-center justify-between gap-5">
            <dt className="text-copy-muted">Run status</dt>
            <dd className="font-semibold capitalize text-copy">{run.status.replaceAll("_", " ")}</dd>
          </div>
          <div className="flex items-center justify-between gap-5">
            <dt className="text-copy-muted">Accepted artifacts</dt>
            <dd className="font-semibold text-copy">{artifacts.length}</dd>
          </div>
          <div className="flex items-center justify-between gap-5">
            <dt className="text-copy-muted">Run ID</dt>
            <dd className="max-w-48 truncate font-mono text-xs text-copy-secondary">{run.run_id}</dd>
          </div>
        </dl>

        {pollError ? <p className="mt-6 text-sm leading-6 text-accent-soft">{pollError}</p> : null}
        {failingStage?.error_code ? (
          <div className="mt-7 rounded-input border border-accent/30 bg-shell/70 p-4">
            <p className="text-sm font-semibold text-accent-soft">{failingStage.error_code}</p>
            {errorDetail(failingStage) ? (
              <p className="mt-2 text-sm leading-6 text-copy-secondary">{errorDetail(failingStage)}</p>
            ) : null}
          </div>
        ) : null}
      </aside>

      <div>
        <h2 className="font-display text-2xl text-copy">Live stages</h2>
        {snapshot.stages.length === 0 ? (
          <div className="mt-6 flex items-start gap-4 rounded-panel border border-white/15 bg-ink/70 p-6">
            <Clock aria-hidden className="mt-0.5 shrink-0 text-accent-soft" size={24} weight="duotone" />
            <div>
              <p className="font-semibold text-copy">Waiting for the generation worker</p>
              <p className="mt-2 text-sm leading-6 text-copy-secondary">
                The run is queued. No creative stage has started yet.
              </p>
            </div>
          </div>
        ) : (
          <ol className="mt-6 grid gap-4">
            {snapshot.stages.map((stage) => {
              const succeeded = stage.status === "succeeded";
              const stageFailed = stage.status === "retryable_failed" || stage.status === "terminal_failed";
              const activeStage = !succeeded && !stageFailed && !terminalRunStates.has(stage.status);
              return (
                <li
                  className={`flex items-start gap-4 rounded-panel border p-5 sm:p-6 ${
                    stageFailed
                      ? "border-accent/35 bg-ink-raised"
                      : succeeded
                        ? "border-white/15 bg-ink/70"
                        : "border-accent-soft/35 bg-ink-raised"
                  }`}
                  key={stage.stage_run_id}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-control border ${
                      succeeded
                        ? "border-accent-deep bg-accent-deep text-paper-high"
                        : stageFailed
                          ? "border-accent/50 text-accent-soft"
                          : "border-white/20 text-accent-soft"
                    }`}
                  >
                    {succeeded ? (
                      <Check aria-hidden size={16} weight="bold" />
                    ) : stageFailed ? (
                      <WarningCircle aria-hidden size={17} weight="bold" />
                    ) : activeStage ? (
                      <SpinnerGap aria-hidden className="animate-spin" size={16} weight="bold" />
                    ) : (
                      <Clock aria-hidden size={16} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold capitalize text-copy">{stageLabel(stage.stage_name)}</p>
                    <p className={`mt-1 text-sm capitalize ${stageFailed ? "text-accent-soft" : "text-copy-muted"}`}>
                      {stageStatusLabel(stage)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {artifacts.length > 0 ? (
          <div className="mt-8">
            <h2 className="font-display text-2xl text-copy">Accepted output</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {artifacts.map((artifact) => (
                <span
                  className="rounded-control border border-white/15 bg-ink-raised px-3 py-2 text-xs font-semibold capitalize text-copy-secondary"
                  key={artifact.artifact_id}
                >
                  {artifact.kind.replaceAll("_", " ")}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
