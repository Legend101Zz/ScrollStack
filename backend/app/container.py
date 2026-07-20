"""Composition root for the FastAPI control plane."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.persistence.protocols import (
    PdfIngestionDispatcher,
    Repositories,
    WorkflowDispatcher,
)
from app.services.domain_tools import MangaDirectorToolService
from app.services.generation_runs import GenerationRunService
from app.services.pdf_ingestion import PdfIngestionService
from app.services.projects import MangaProjectService
from app.services.reels import ReelPlayerService
from app.services.scopes import ScopeService


@dataclass(frozen=True)
class ControlPlaneServices:
    pdf_ingestion: PdfIngestionService
    projects: MangaProjectService
    scopes: ScopeService
    generation_runs: GenerationRunService
    domain_tools: MangaDirectorToolService
    reels: ReelPlayerService


def build_services(
    repositories: Repositories,
    *,
    dispatcher: WorkflowDispatcher | None = None,
    ingestion_dispatcher: PdfIngestionDispatcher | None = None,
    media_root: Path = Path("storage"),
) -> ControlPlaneServices:
    # Runtime adapters implement all five narrow protocols. Keeping the service
    # signatures narrow prevents tests from depending on Mongo or Beanie.
    return ControlPlaneServices(
        pdf_ingestion=PdfIngestionService(
            repositories,
            repositories,
            media_root=media_root,
            dispatcher=ingestion_dispatcher,
        ),
        projects=MangaProjectService(repositories, repositories),
        scopes=ScopeService(repositories, repositories, repositories),
        generation_runs=GenerationRunService(
            repositories,
            repositories,
            repositories,
            repositories,
            dispatcher,
        ),
        domain_tools=MangaDirectorToolService(repositories, repositories),
        reels=ReelPlayerService(
            repositories,
            repositories,
            repositories,
            repositories,
        ),
    )
