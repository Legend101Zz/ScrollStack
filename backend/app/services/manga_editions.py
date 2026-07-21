"""Immutable accepted manga editions and their library projection."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from app.persistence.documents import ArtifactDoc, construct_document, utc_now
from app.persistence.protocols import Repositories

from .errors import ArtifactValidationError, NotFoundError
from .hashing import content_hash


class EditionPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page_index: Annotated[int, Field(ge=0, le=999)]
    page_id: str = Field(min_length=1, max_length=128)
    rendered_page_artifact_id: str = Field(min_length=1, max_length=128)
    raster_asset_id: str = Field(min_length=1, max_length=128)
    content_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    width: Annotated[int, Field(gt=0, le=20_000)]
    height: Annotated[int, Field(gt=0, le=20_000)]


class MangaEdition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["manga-edition.v1"]
    edition_id: str = Field(min_length=1, max_length=128)
    book_id: str = Field(min_length=1, max_length=128)
    project_id: str = Field(min_length=1, max_length=128)
    run_id: str = Field(min_length=1, max_length=128)
    scope_id: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=500)
    status: Literal["accepted"] = "accepted"
    pages: list[EditionPage] = Field(min_length=1, max_length=100)
    cover_asset_id: str = Field(min_length=1, max_length=128)
    plan_artifact_id: str = Field(min_length=1, max_length=128)
    script_artifact_id: str = Field(min_length=1, max_length=128)
    thumbnail_artifact_id: str = Field(min_length=1, max_length=128)
    character_reference_artifact_id: str = Field(min_length=1, max_length=128)
    character_reference_attempt_id: str = Field(min_length=1, max_length=128)
    character_reference_asset_id: str = Field(min_length=1, max_length=128)
    panel_asset_ids: list[str] = Field(min_length=1, max_length=100)
    image_attempt_artifact_ids: list[str] = Field(min_length=1, max_length=200)
    image_asset_artifact_ids: list[str] = Field(min_length=1, max_length=200)
    receipt_artifact_ids: list[str] = Field(min_length=1, max_length=200)
    image_provider: Literal["openrouter"] = "openrouter"
    image_model: str = Field(min_length=1, max_length=256)
    renderer_version: str = Field(min_length=1, max_length=128)
    implementation_version: str = Field(min_length=1, max_length=128)
    parent_edition_id: str | None = Field(default=None, max_length=128)
    text_cost_usd: Annotated[float, Field(ge=0)]
    image_cost_usd: Annotated[float, Field(ge=0)]
    accepted_panel_images: Annotated[int, Field(ge=1)]
    accepted_image_attempts: Annotated[int, Field(ge=0)]
    rejected_image_attempts: Annotated[int, Field(ge=0)]
    created_at: AwareDatetime

    @model_validator(mode="after")
    def validate_page_order(self) -> "MangaEdition":
        if [page.page_index for page in self.pages] != list(range(len(self.pages))):
            raise ValueError("edition pages must be contiguous and ordered from zero")
        if len({page.page_id for page in self.pages}) != len(self.pages):
            raise ValueError("edition page IDs must be unique")
        if self.cover_asset_id != self.pages[0].raster_asset_id:
            raise ValueError("edition cover must be the first accepted page raster")
        if len(self.panel_asset_ids) != self.accepted_panel_images:
            raise ValueError("edition panel asset IDs must cover accepted panel images")
        if len(set(self.panel_asset_ids)) != len(self.panel_asset_ids):
            raise ValueError("edition panel asset IDs must be unique")
        attempt_count = self.accepted_image_attempts + self.rejected_image_attempts
        if len(self.image_attempt_artifact_ids) != attempt_count:
            raise ValueError("edition image attempt lineage must match attempt counts")
        if len(self.image_asset_artifact_ids) != attempt_count:
            raise ValueError("edition image assets must match attempt counts")
        if len(self.receipt_artifact_ids) != attempt_count:
            raise ValueError("edition image receipts must match attempt counts")
        if self.character_reference_attempt_id not in self.image_attempt_artifact_ids:
            raise ValueError("edition Kai attempt must be present in image lineage")
        if self.character_reference_artifact_id not in self.image_asset_artifact_ids:
            raise ValueError("edition Kai artifact must be present in image lineage")
        return self


class EditionPageView(EditionPage):
    url: str


class MangaEditionView(BaseModel):
    model_config = ConfigDict(extra="forbid")

    edition_id: str
    book_id: str
    project_id: str
    run_id: str
    scope_id: str
    title: str
    status: Literal["accepted"]
    page_count: int
    pages: list[EditionPageView]
    cover_url: str
    plan_artifact_id: str
    script_artifact_id: str
    thumbnail_artifact_id: str
    character_reference_artifact_id: str
    character_reference_attempt_id: str
    character_reference_asset_id: str
    panel_asset_ids: list[str]
    image_attempt_artifact_ids: list[str]
    image_asset_artifact_ids: list[str]
    receipt_artifact_ids: list[str]
    image_provider: Literal["openrouter"]
    image_model: str
    renderer_version: str
    implementation_version: str
    parent_edition_id: str | None
    text_cost_usd: float
    image_cost_usd: float
    accepted_panel_images: int
    accepted_image_attempts: int
    rejected_image_attempts: int
    created_at: AwareDatetime


class LibraryEdition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    edition_id: str
    book_id: str
    project_id: str
    title: str
    status: Literal["accepted"]
    page_count: int
    cover_url: str
    created_at: AwareDatetime
    current_edition: bool


class MangaEditionService:
    def __init__(self, repositories: Repositories, *, media_root: Path) -> None:
        self._repositories = repositories
        self._media_root = media_root

    async def persist(
        self,
        edition: MangaEdition,
        *,
        stage_run_id: str,
        parent_artifact_ids: list[str],
        source_refs: list[dict[str, object]],
    ) -> ArtifactDoc:
        payload = edition.model_dump(mode="json")
        digest = content_hash(payload)
        identity_payload = {key: value for key, value in payload.items() if key != "edition_id"}
        if edition.edition_id != f"edition_{content_hash(identity_payload)[:24]}":
            raise ArtifactValidationError("MangaEdition identity does not match its content")
        artifact = construct_document(
            ArtifactDoc,
            artifact_id=edition.edition_id,
            project_id=edition.project_id,
            run_id=edition.run_id,
            stage_run_id=stage_run_id,
            kind="manga_edition",
            schema_version="manga-edition.v1",
            content=payload,
            storage_ref=None,
            content_hash=digest,
            parent_artifact_ids=parent_artifact_ids,
            author="system",
            supersedes_artifact_id=edition.parent_edition_id,
            source_refs=source_refs,
            model_receipt=None,
            validation_status="accepted",
            validation_report={
                "passed": True,
                "issues": [],
                "validator_version": "manga-edition-validator.v1",
            },
            created_at=edition.created_at,
        )
        return await self._repositories.save_artifact(artifact)

    async def get(self, edition_id: str) -> MangaEditionView:
        artifact = await self._repositories.get_artifact(edition_id)
        edition = self._accepted_edition(artifact, edition_id)
        self._verify_page_files(edition)
        return self._view(edition)

    async def list_library(self, *, owner_id: str | None = None) -> list[LibraryEdition]:
        editions: list[MangaEdition] = []
        for book in await self._repositories.list_books(owner_id):
            project_identity = content_hash({"book_id": book.book_id, "owner_id": book.owner_id})
            project_id = f"project_{project_identity[:24]}"
            project = await self._repositories.get_project(project_id)
            if project is None:
                continue
            for run in await self._repositories.list_project_runs(project.project_id):
                for artifact in await self._repositories.list_artifacts(
                    run.run_id,
                    accepted_only=True,
                ):
                    if artifact.kind == "manga_edition":
                        editions.append(self._accepted_edition(artifact, artifact.artifact_id))
        editions.sort(key=lambda item: (item.created_at, item.edition_id), reverse=True)
        current_by_project: dict[str, str] = {}
        for edition in editions:
            current_by_project.setdefault(edition.project_id, edition.edition_id)
        return [
            LibraryEdition(
                edition_id=edition.edition_id,
                book_id=edition.book_id,
                project_id=edition.project_id,
                title=edition.title,
                status=edition.status,
                page_count=len(edition.pages),
                cover_url=self._asset_url(edition.pages[0].content_hash),
                created_at=edition.created_at,
                current_edition=current_by_project[edition.project_id] == edition.edition_id,
            )
            for edition in editions
        ]

    def media_path(self, content_hash_value: str, extension: str) -> Path:
        if len(content_hash_value) != 64 or any(
            character not in "0123456789abcdef" for character in content_hash_value
        ):
            raise NotFoundError("Manga media artifact does not exist")
        if extension not in {"png", "svg"}:
            raise NotFoundError("Manga media artifact does not exist")
        path = self._media_root / f"{content_hash_value}.{extension}"
        if not path.is_file():
            raise NotFoundError("Manga media artifact does not exist")
        return path

    def _accepted_edition(
        self,
        artifact: ArtifactDoc | None,
        edition_id: str,
    ) -> MangaEdition:
        if artifact is None:
            raise NotFoundError(f"Manga edition {edition_id} does not exist")
        if (
            artifact.kind != "manga_edition"
            or artifact.schema_version != "manga-edition.v1"
            or artifact.validation_status != "accepted"
            or artifact.content is None
        ):
            raise ArtifactValidationError(f"Manga edition {edition_id} is not accepted")
        edition = MangaEdition.model_validate(artifact.content)
        if edition.edition_id != edition_id:
            raise ArtifactValidationError("Manga edition identity mismatch")
        return edition

    def _verify_page_files(self, edition: MangaEdition) -> None:
        for page in edition.pages:
            path = self._media_root / f"{page.content_hash}.png"
            if not path.is_file():
                raise ArtifactValidationError(
                    f"Accepted edition page {page.page_id} is missing from artifact storage"
                )

    @staticmethod
    def draft(
        *,
        book_id: str,
        project_id: str,
        run_id: str,
        scope_id: str,
        title: str,
        pages: list[EditionPage],
        plan_artifact_id: str,
        script_artifact_id: str,
        thumbnail_artifact_id: str,
        character_reference_artifact_id: str,
        character_reference_attempt_id: str,
        character_reference_asset_id: str,
        panel_asset_ids: list[str],
        image_attempt_artifact_ids: list[str],
        image_asset_artifact_ids: list[str],
        receipt_artifact_ids: list[str],
        image_provider: Literal["openrouter"],
        image_model: str,
        renderer_version: str,
        implementation_version: str,
        parent_edition_id: str | None,
        text_cost_usd: float,
        image_cost_usd: float,
        accepted_panel_images: int,
        accepted_image_attempts: int,
        rejected_image_attempts: int,
        created_at: datetime | None = None,
    ) -> MangaEdition:
        instant = created_at or utc_now()
        body = {
            "schema_version": "manga-edition.v1",
            "book_id": book_id,
            "project_id": project_id,
            "run_id": run_id,
            "scope_id": scope_id,
            "title": title,
            "status": "accepted",
            "pages": [page.model_dump(mode="json") for page in pages],
            "cover_asset_id": pages[0].raster_asset_id,
            "plan_artifact_id": plan_artifact_id,
            "script_artifact_id": script_artifact_id,
            "thumbnail_artifact_id": thumbnail_artifact_id,
            "character_reference_artifact_id": character_reference_artifact_id,
            "character_reference_attempt_id": character_reference_attempt_id,
            "character_reference_asset_id": character_reference_asset_id,
            "panel_asset_ids": panel_asset_ids,
            "image_attempt_artifact_ids": image_attempt_artifact_ids,
            "image_asset_artifact_ids": image_asset_artifact_ids,
            "receipt_artifact_ids": receipt_artifact_ids,
            "image_provider": image_provider,
            "image_model": image_model,
            "renderer_version": renderer_version,
            "implementation_version": implementation_version,
            "parent_edition_id": parent_edition_id,
            "text_cost_usd": text_cost_usd,
            "image_cost_usd": image_cost_usd,
            "accepted_panel_images": accepted_panel_images,
            "accepted_image_attempts": accepted_image_attempts,
            "rejected_image_attempts": rejected_image_attempts,
            "created_at": instant.isoformat(),
        }
        candidate = MangaEdition.model_validate({**body, "edition_id": "edition_pending"})
        identity_payload = candidate.model_dump(mode="json", exclude={"edition_id"})
        edition_id = f"edition_{content_hash(identity_payload)[:24]}"
        return candidate.model_copy(update={"edition_id": edition_id})

    def _view(self, edition: MangaEdition) -> MangaEditionView:
        pages = [
            EditionPageView(**page.model_dump(), url=self._asset_url(page.content_hash))
            for page in edition.pages
        ]
        return MangaEditionView(
            edition_id=edition.edition_id,
            book_id=edition.book_id,
            project_id=edition.project_id,
            run_id=edition.run_id,
            scope_id=edition.scope_id,
            title=edition.title,
            status=edition.status,
            page_count=len(pages),
            pages=pages,
            cover_url=pages[0].url,
            plan_artifact_id=edition.plan_artifact_id,
            script_artifact_id=edition.script_artifact_id,
            thumbnail_artifact_id=edition.thumbnail_artifact_id,
            character_reference_artifact_id=edition.character_reference_artifact_id,
            character_reference_attempt_id=edition.character_reference_attempt_id,
            character_reference_asset_id=edition.character_reference_asset_id,
            panel_asset_ids=edition.panel_asset_ids,
            image_attempt_artifact_ids=edition.image_attempt_artifact_ids,
            image_asset_artifact_ids=edition.image_asset_artifact_ids,
            receipt_artifact_ids=edition.receipt_artifact_ids,
            image_provider=edition.image_provider,
            image_model=edition.image_model,
            renderer_version=edition.renderer_version,
            implementation_version=edition.implementation_version,
            parent_edition_id=edition.parent_edition_id,
            text_cost_usd=edition.text_cost_usd,
            image_cost_usd=edition.image_cost_usd,
            accepted_panel_images=edition.accepted_panel_images,
            accepted_image_attempts=edition.accepted_image_attempts,
            rejected_image_attempts=edition.rejected_image_attempts,
            created_at=edition.created_at,
        )

    @staticmethod
    def _asset_url(content_hash_value: str) -> str:
        return f"/media/{content_hash_value}.png"
