"""Composition root for the FastAPI control plane."""

from __future__ import annotations

from dataclasses import dataclass

from app.persistence.protocols import Repositories, WorkflowDispatcher
from app.services.generation_runs import GenerationRunService
from app.services.scopes import ScopeService


@dataclass(frozen=True)
class ControlPlaneServices:
    scopes: ScopeService
    generation_runs: GenerationRunService


def build_services(
    repositories: Repositories,
    *,
    dispatcher: WorkflowDispatcher | None = None,
) -> ControlPlaneServices:
    # Runtime adapters implement all five narrow protocols. Keeping the service
    # signatures narrow prevents tests from depending on Mongo or Beanie.
    return ControlPlaneServices(
        scopes=ScopeService(repositories, repositories),
        generation_runs=GenerationRunService(
            repositories,
            repositories,
            repositories,
            repositories,
            dispatcher,
        ),
    )
