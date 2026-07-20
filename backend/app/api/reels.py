"""Browser reel delivery and progress routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.container import ControlPlaneServices
from app.contracts.reel_delivery import (
    ReelPlayerPayload,
    ReelSeries,
    SeriesProgress,
    SeriesProgressUpdate,
)


def reels_router(services: ControlPlaneServices) -> APIRouter:
    router = APIRouter(tags=["reels"])

    @router.get(
        "/manga-projects/{project_id}/reel-series",
        response_model=list[ReelSeries],
    )
    async def list_project_reel_series(project_id: str) -> list[ReelSeries]:
        return await services.reels.list_project_series(project_id)

    @router.get("/reel-series/{series_id}", response_model=ReelSeries)
    async def get_reel_series(series_id: str) -> ReelSeries:
        return await services.reels.get_series(series_id)

    @router.get("/reels/{reel_id}", response_model=ReelPlayerPayload)
    async def get_reel_player_payload(reel_id: str) -> ReelPlayerPayload:
        return await services.reels.get_player_payload(reel_id)

    @router.get("/series/{series_id}/progress", response_model=SeriesProgress)
    async def get_series_progress(series_id: str) -> SeriesProgress:
        return await services.reels.get_progress(series_id)

    @router.put("/series/{series_id}/progress", response_model=SeriesProgress)
    async def put_series_progress(
        series_id: str, update: SeriesProgressUpdate
    ) -> SeriesProgress:
        return await services.reels.put_progress(series_id, update)

    return router
