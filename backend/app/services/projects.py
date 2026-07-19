"""Manga-project creation with an immutable version-zero memory snapshot."""

from __future__ import annotations

from pydantic import AwareDatetime, BaseModel, ConfigDict

from app.persistence.documents import (
    MangaProjectDoc,
    ProjectMemorySnapshotDoc,
    construct_document,
    utc_now,
)
from app.persistence.protocols import BookRepository, MemoryRepository

from .errors import AuthorizationError, InvalidPdfError, NotFoundError
from .hashing import content_hash


class MangaProjectView(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str
    book_id: str
    owner_id: str
    active_memory_version: int
    created_at: AwareDatetime
    updated_at: AwareDatetime


class MangaProjectService:
    def __init__(self, books: BookRepository, memory: MemoryRepository) -> None:
        self._books = books
        self._memory = memory

    async def create(self, book_id: str, *, owner_id: str) -> tuple[MangaProjectView, bool]:
        book = await self._books.get_book(book_id)
        if book is None:
            raise NotFoundError(f"Book {book_id} does not exist")
        if book.owner_id != owner_id:
            raise AuthorizationError("Book belongs to a different owner")
        if book.status != "parsed":
            raise InvalidPdfError(f"Book {book_id} is not parsed")

        identity = content_hash({"book_id": book_id, "owner_id": owner_id})
        project_id = f"project_{identity[:24]}"
        existing = await self._memory.get_project(project_id)
        if existing is not None:
            return project_view(existing), False

        now = utc_now()
        project = construct_document(
            MangaProjectDoc,
            project_id=project_id,
            book_id=book_id,
            owner_id=owner_id,
            active_memory_version=0,
            created_at=now,
            updated_at=now,
        )
        snapshot_payload = {
            "project_id": project_id,
            "memory_version": 0,
            "parent_version": None,
            "book_spine": {},
            "facts": [],
            "character_state": [],
            "world_state": {},
            "continuity": {},
            "coverage": {},
            "asset_index": [],
            "source_artifact_ids": [],
        }
        snapshot = construct_document(
            ProjectMemorySnapshotDoc,
            **snapshot_payload,
            content_hash=content_hash(snapshot_payload),
            created_at=now,
        )
        stored = await self._memory.save_project(project)
        await self._memory.save_memory_snapshot(snapshot)
        return project_view(stored), True

    async def get(self, project_id: str) -> MangaProjectView:
        project = await self._memory.get_project(project_id)
        if project is None:
            raise NotFoundError(f"Manga project {project_id} does not exist")
        return project_view(project)


def project_view(project: MangaProjectDoc) -> MangaProjectView:
    return MangaProjectView.model_validate(
        {
            "project_id": project.project_id,
            "book_id": project.book_id,
            "owner_id": project.owner_id,
            "active_memory_version": project.active_memory_version,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
        }
    )
