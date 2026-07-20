"""Versioned public control-plane routes from technical-imp section 15.1."""

from __future__ import annotations

from fastapi import APIRouter, Response, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

from app.container import ControlPlaneServices
from app.contracts.artifacts import Artifact
from app.contracts.source import PageRange, ScopeManifest
from app.services.generation_runs import (
    GenerationRunView,
    StartGenerationRun,
)
from app.services.manga_reader import MangaReaderPayload


class CreateScopeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    project_id: str = Field(min_length=1, max_length=128)
    page_ranges: list[PageRange] = Field(min_length=1, max_length=1_000)
    selection_label: str = Field(min_length=1, max_length=500)
    created_by: str = Field(min_length=1, max_length=128)


def control_plane_router(services: ControlPlaneServices) -> APIRouter:
    router = APIRouter()

    @router.post(
        "/books/{book_id}/scopes",
        response_model=ScopeManifest,
        status_code=status.HTTP_201_CREATED,
        tags=["scopes"],
    )
    async def create_scope(book_id: str, request: CreateScopeRequest) -> ScopeManifest:
        return await services.scopes.create(
            project_id=request.project_id,
            book_id=book_id,
            page_ranges=request.page_ranges,
            selection_label=request.selection_label,
            created_by=request.created_by,
        )

    @router.get(
        "/books/{book_id}/scopes",
        response_model=list[ScopeManifest],
        tags=["scopes"],
    )
    async def list_scopes(book_id: str) -> list[ScopeManifest]:
        return await services.scopes.list(book_id)

    @router.post(
        "/manga-projects/{project_id}/generation-runs",
        response_model=GenerationRunView,
        status_code=status.HTTP_202_ACCEPTED,
        tags=["generation-runs"],
    )
    async def start_generation_run(
        project_id: str, request: StartGenerationRun
    ) -> GenerationRunView:
        run, _created = await services.generation_runs.start(project_id, request)
        return await services.generation_runs.get(run.run_id)

    @router.get(
        "/generation-runs/{run_id}",
        response_model=GenerationRunView,
        tags=["generation-runs"],
    )
    async def get_generation_run(run_id: str) -> GenerationRunView:
        return await services.generation_runs.get(run_id)

    @router.post(
        "/generation-runs/{run_id}/cancel",
        response_model=GenerationRunView,
        tags=["generation-runs"],
    )
    async def cancel_generation_run(run_id: str) -> GenerationRunView:
        return await services.generation_runs.cancel(run_id)

    @router.get(
        "/generation-runs/{run_id}/artifacts",
        response_model=list[Artifact],
        tags=["generation-runs"],
    )
    async def list_generation_artifacts(run_id: str) -> list[Artifact]:
        return await services.generation_runs.artifacts(run_id)

    @router.get(
        "/books/{book_id}/manga/{project_id}/reader",
        response_model=MangaReaderPayload,
        tags=["manga-reader"],
    )
    async def get_manga_reader(book_id: str, project_id: str) -> MangaReaderPayload:
        return await services.manga_reader.get(book_id, project_id)

    @router.get(
        "/books/{book_id}/manga/{project_id}/assets/{asset_id}",
        response_class=Response,
        tags=["manga-reader"],
    )
    async def get_manga_asset(
        book_id: str,
        project_id: str,
        asset_id: str,
    ) -> Response:
        path, asset = await services.manga_reader.asset(book_id, project_id, asset_id)
        return FileResponse(
            path,
            media_type=asset.mime_type,
            headers={
                "Cache-Control": "public, max-age=31536000, immutable",
                "ETag": f'"{asset.content_hash}"',
                "X-Content-Type-Options": "nosniff",
            },
        )

    return router
