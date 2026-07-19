"""Bounded Phase 1 workflow entrypoint.

This task intentionally returns the authoritative plan until the legacy manga
pipeline is connected. It does not pretend that generation succeeded.
"""

from __future__ import annotations

from typing import Any

from .authority import WorkflowAuthority
from .celery_app import celery_app


@celery_app.task(  # type: ignore[misc]
    name="scrollstack.execute_generation_run", bind=True, max_retries=2
)
def execute_generation_run(self: Any, run_id: str) -> dict[str, object]:
    del self
    plan = WorkflowAuthority().plan(run_id)
    return {
        "run_id": plan.run_id,
        "pipeline_version": plan.pipeline_version,
        "planned_stages": list(plan.stages),
        "status": "planned",
    }
