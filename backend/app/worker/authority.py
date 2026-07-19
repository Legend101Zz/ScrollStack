"""Python-owned workflow ordering; workers execute, they do not orchestrate."""

from __future__ import annotations

from dataclasses import dataclass

PHASE_1_MANGA_STAGES: tuple[str, ...] = (
    "source_selection",
    "context_compilation",
    "existing_manga_pipeline",
    "artifact_validation",
    "memory_delta_merge",
)


@dataclass(frozen=True)
class WorkflowPlan:
    run_id: str
    stages: tuple[str, ...]
    pipeline_version: str


class WorkflowAuthority:
    """The only component allowed to decide generation stage order."""

    def plan(self, run_id: str, pipeline_version: str = "manga-pipeline.v1") -> WorkflowPlan:
        return WorkflowPlan(
            run_id=run_id,
            stages=PHASE_1_MANGA_STAGES,
            pipeline_version=pipeline_version,
        )
