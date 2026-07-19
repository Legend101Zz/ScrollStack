"""FastAPI control-plane entry point."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.api.books import books_router
from app.api.control_plane import control_plane_router
from app.api.internal_tools import internal_tools_router
from app.container import ControlPlaneServices, build_services
from app.persistence.mongo import initialize_mongo
from app.persistence.repositories import BeanieRepositories, InMemoryRepositories
from app.services.errors import (
    AuthorizationError,
    ContextBudgetError,
    ControlPlaneError,
    InvalidPdfError,
    InvalidRunStateError,
    InvalidScopeError,
    MemoryConflictError,
    NotFoundError,
    PdfLimitError,
    StaleMemoryDeltaError,
    UnsupportedSourceError,
)
from app.worker.celery_app import CeleryPdfIngestionDispatcher, CeleryWorkflowDispatcher


def create_app(services: ControlPlaneServices | None = None) -> FastAPI:
    mongo_uri = os.getenv("MONGODB_URI") if services is None else None
    if services is None:
        if mongo_uri:
            services = build_services(
                BeanieRepositories(),
                dispatcher=CeleryWorkflowDispatcher(),
                ingestion_dispatcher=CeleryPdfIngestionDispatcher(),
                media_root=Path(os.getenv("MEDIA_ROOT", "/data/media")),
            )
        else:
            services = build_services(InMemoryRepositories())

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        client = None
        if mongo_uri:
            parsed = urlparse(mongo_uri)
            database_name = parsed.path.lstrip("/") or "scrollstack"
            client = await initialize_mongo(mongo_uri, database_name)
        yield
        if client is not None:
            await client.close()

    application = FastAPI(
        title="ScrollStack Control Plane",
        version="0.1.0",
        docs_url="/docs",
        redoc_url=None,
        lifespan=lifespan,
    )

    @application.exception_handler(ControlPlaneError)
    async def control_plane_error(_: Request, error: ControlPlaneError) -> JSONResponse:
        error_status = status.HTTP_422_UNPROCESSABLE_ENTITY
        if isinstance(error, AuthorizationError):
            error_status = status.HTTP_403_FORBIDDEN
        elif isinstance(error, NotFoundError):
            error_status = status.HTTP_404_NOT_FOUND
        elif isinstance(
            error,
            (StaleMemoryDeltaError, MemoryConflictError, InvalidRunStateError),
        ):
            error_status = status.HTTP_409_CONFLICT
        elif isinstance(
            error,
            (InvalidScopeError, UnsupportedSourceError, ContextBudgetError, InvalidPdfError),
        ):
            error_status = status.HTTP_422_UNPROCESSABLE_ENTITY
        elif isinstance(error, PdfLimitError):
            error_status = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        return JSONResponse(
            status_code=error_status,
            content={"error": {"code": error.code, "message": str(error)}},
        )

    @application.get("/healthz", tags=["system"])
    async def healthz() -> dict[str, str]:
        return {"status": "ok", "service": "scrollstack-backend"}

    @application.get("/readyz", tags=["system"])
    async def readyz() -> dict[str, str]:
        return {"status": "ready", "service": "scrollstack-backend"}

    application.include_router(books_router(services))
    application.include_router(control_plane_router(services))
    application.include_router(
        internal_tools_router(
            services,
            service_token=os.getenv(
                "DOMAIN_TOOL_BROKER_TOKEN", "local-domain-tool-token-change-me"
            ),
        )
    )

    return application


app = create_app()
