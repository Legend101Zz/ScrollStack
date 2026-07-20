"""PDF, parsed-source, and manga-project API surfaces."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Form, Query, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field

from app.container import ControlPlaneServices
from app.contracts.source import SourceUnit
from app.services.pdf_ingestion import (
    DEFAULT_MAX_UPLOAD_BYTES,
    BookView,
    UploadResult,
)
from app.services.projects import MangaProjectView


class CreateMangaProjectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    owner_id: str = Field(min_length=1, max_length=128)


def books_router(services: ControlPlaneServices) -> APIRouter:
    router = APIRouter()

    @router.post(
        "/upload",
        response_model=UploadResult,
        status_code=status.HTTP_202_ACCEPTED,
        tags=["books"],
    )
    async def upload_pdf(
        file: Annotated[UploadFile, File()],
        owner_id: Annotated[str, Form(min_length=1, max_length=128)],
    ) -> UploadResult:
        content = await file.read(DEFAULT_MAX_UPLOAD_BYTES + 1)
        return await services.pdf_ingestion.register_upload(
            filename=file.filename or "upload.pdf",
            content=content,
            owner_id=owner_id,
        )

    @router.get("/books", response_model=list[BookView], tags=["books"])
    async def list_books(
        owner_id: str | None = Query(default=None, min_length=1, max_length=128),
    ) -> list[BookView]:
        return await services.pdf_ingestion.list_books(owner_id)

    @router.get("/books/{book_id}", response_model=BookView, tags=["books"])
    async def get_book(book_id: str) -> BookView:
        return await services.pdf_ingestion.get(book_id)

    @router.get(
        "/books/{book_id}/source-units",
        response_model=list[SourceUnit],
        tags=["books"],
    )
    async def list_source_units(book_id: str) -> list[SourceUnit]:
        return await services.pdf_ingestion.list_source_units(book_id)

    @router.get(
        "/books/{book_id}/pages/{page_number}",
        response_model=SourceUnit,
        tags=["books"],
    )
    async def get_parsed_page(book_id: str, page_number: int) -> SourceUnit:
        return await services.pdf_ingestion.get_page(book_id, page_number)

    @router.post(
        "/books/{book_id}/manga-projects",
        response_model=MangaProjectView,
        status_code=status.HTTP_201_CREATED,
        tags=["manga-projects"],
    )
    async def create_manga_project(
        book_id: str, request: CreateMangaProjectRequest
    ) -> MangaProjectView:
        project, _created = await services.projects.create(
            book_id, owner_id=request.owner_id
        )
        return project

    @router.get(
        "/manga-projects/{project_id}",
        response_model=MangaProjectView,
        tags=["manga-projects"],
    )
    async def get_manga_project(project_id: str) -> MangaProjectView:
        return await services.projects.get(project_id)

    return router
