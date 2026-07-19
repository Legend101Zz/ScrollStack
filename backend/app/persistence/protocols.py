"""Narrow repository protocols for testable control-plane services."""

from __future__ import annotations

from typing import Protocol

from .documents import (
    ArtifactDoc,
    GenerationRunDoc,
    MangaProjectDoc,
    ProjectMemorySnapshotDoc,
    ScopeManifestDoc,
    SourceUnitDoc,
    StageRunDoc,
)


class SourceUnitRepository(Protocol):
    async def save_source_units(self, units: list[SourceUnitDoc]) -> None: ...

    async def list_source_units(self, book_id: str) -> list[SourceUnitDoc]: ...

    async def get_source_unit(self, book_id: str, source_unit_id: str) -> SourceUnitDoc | None: ...


class ScopeRepository(Protocol):
    async def create_scope(self, scope: ScopeManifestDoc) -> ScopeManifestDoc: ...

    async def get_scope(self, scope_id: str) -> ScopeManifestDoc | None: ...

    async def list_scopes(self, book_id: str) -> list[ScopeManifestDoc]: ...


class MemoryRepository(Protocol):
    async def get_project(self, project_id: str) -> MangaProjectDoc | None: ...

    async def save_project(self, project: MangaProjectDoc) -> MangaProjectDoc: ...

    async def get_memory_snapshot(
        self, project_id: str, memory_version: int
    ) -> ProjectMemorySnapshotDoc | None: ...

    async def advance_memory(
        self,
        project_id: str,
        expected_version: int,
        snapshot: ProjectMemorySnapshotDoc,
    ) -> bool: ...


class ArtifactRepository(Protocol):
    async def list_artifacts(self, run_id: str, *, accepted_only: bool) -> list[ArtifactDoc]: ...


class RunRepository(Protocol):
    async def create_run_if_absent(
        self, run: GenerationRunDoc
    ) -> tuple[GenerationRunDoc, bool]: ...

    async def get_run(self, run_id: str) -> GenerationRunDoc | None: ...

    async def save_run(self, run: GenerationRunDoc) -> GenerationRunDoc: ...

    async def list_stages(self, run_id: str) -> list[StageRunDoc]: ...

    async def save_stage(self, stage: StageRunDoc) -> StageRunDoc: ...


class WorkflowDispatcher(Protocol):
    def enqueue_generation_run(self, run_id: str) -> None: ...


class Repositories(
    SourceUnitRepository,
    ScopeRepository,
    MemoryRepository,
    ArtifactRepository,
    RunRepository,
    Protocol,
):
    """Aggregate adapter contract used only by the composition root."""
