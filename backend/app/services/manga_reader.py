"""Accepted-only reader projection and immutable asset lookup."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, ValidationError

from app.contracts.artifacts import AssetRef, ModelReceipt
from app.contracts.manga import RenderedPage
from app.persistence.documents import ArtifactDoc
from app.persistence.protocols import Repositories

from .errors import ArtifactValidationError, NotFoundError
from .hashing import binary_content_hash, content_hash
from .manga_production import (
    ASSET_SET_SCHEMA_VERSION,
    RENDERED_PAGE_SET_SCHEMA_VERSION,
    GeneratedAssetSet,
    MangaProductionService,
    RenderedPageSet,
)


class ReaderBook(BaseModel):
    model_config = ConfigDict(extra="forbid")

    book_id: str
    title: str
    author: str | None
    total_pages: int


class ReaderProject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str
    active_memory_version: int


class ReaderAsset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_id: str
    asset_type: Literal["character_sprite", "expression", "key_panel", "background"]
    content_hash: str
    mime_type: str
    width: int | None
    height: int | None
    model_receipt: ModelReceipt | None
    url: str


class MangaReaderPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["manga-reader.v1"]
    book: ReaderBook
    project: ReaderProject
    run_id: str
    scope_id: str
    pages: list[RenderedPage] = Field(min_length=1, max_length=100)
    assets: list[ReaderAsset] = Field(min_length=1, max_length=100)
    generated_at: AwareDatetime


class MangaReaderService:
    def __init__(
        self,
        repositories: Repositories,
        *,
        media_root: Path,
    ) -> None:
        self._repositories = repositories
        self._media_root = media_root

    async def get(self, book_id: str, project_id: str) -> MangaReaderPayload:
        book = await self._repositories.get_book(book_id)
        project = await self._repositories.get_project(project_id)
        if book is None or project is None or project.book_id != book_id:
            raise NotFoundError("Manga reader project does not exist for this book")
        for run in await self._repositories.list_project_runs(project_id):
            if run.status != "succeeded":
                continue
            artifacts = await self._repositories.list_artifacts(
                run.run_id,
                accepted_only=True,
            )
            try:
                page_set_artifact = self._single_artifact(
                    artifacts,
                    RENDERED_PAGE_SET_SCHEMA_VERSION,
                )
                asset_set_artifact = self._single_artifact(
                    artifacts,
                    ASSET_SET_SCHEMA_VERSION,
                )
                page_set = RenderedPageSet.model_validate(page_set_artifact.content)
                asset_set = GeneratedAssetSet.model_validate(asset_set_artifact.content)
                self._validate_sets(
                    run_id=run.run_id,
                    project_id=project_id,
                    scope_id=run.scope_id,
                    page_set_artifact=page_set_artifact,
                    page_set=page_set,
                    asset_set_artifact=asset_set_artifact,
                    asset_set=asset_set,
                )
                pages = await self._load_pages(
                    run.run_id,
                    page_set,
                    page_set_artifact,
                    asset_set_artifact,
                )
                assets = [
                    self._reader_asset(book_id, project_id, item) for item in asset_set.assets
                ]
                for asset in asset_set.assets:
                    self._resolve_asset_path(asset)
            except ValidationError as error:
                raise ArtifactValidationError(
                    "Succeeded manga artifacts no longer validate for the reader"
                ) from error
            return MangaReaderPayload(
                schema_version="manga-reader.v1",
                book=ReaderBook(
                    book_id=book.book_id,
                    title=book.title,
                    author=book.author,
                    total_pages=book.total_pages,
                ),
                project=ReaderProject(
                    project_id=project.project_id,
                    active_memory_version=project.active_memory_version,
                ),
                run_id=run.run_id,
                scope_id=run.scope_id,
                pages=pages,
                assets=assets,
                generated_at=run.updated_at,
            )
        raise NotFoundError("No accepted completed manga is available for this project")

    async def asset(
        self,
        book_id: str,
        project_id: str,
        asset_id: str,
    ) -> tuple[Path, ReaderAsset]:
        payload = await self.get(book_id, project_id)
        reader_asset = next((item for item in payload.assets if item.asset_id == asset_id), None)
        if reader_asset is None:
            raise NotFoundError(f"Accepted manga asset {asset_id} does not exist")
        run_artifacts = await self._repositories.list_artifacts(
            payload.run_id,
            accepted_only=True,
        )
        asset_set_artifact = self._single_artifact(
            run_artifacts,
            ASSET_SET_SCHEMA_VERSION,
        )
        asset_set = GeneratedAssetSet.model_validate(asset_set_artifact.content)
        asset = next(item for item in asset_set.assets if item.asset_id == asset_id)
        return self._resolve_asset_path(asset), reader_asset

    async def _load_pages(
        self,
        run_id: str,
        page_set: RenderedPageSet,
        page_set_artifact: ArtifactDoc,
        asset_set_artifact: ArtifactDoc,
    ) -> list[RenderedPage]:
        pages: list[RenderedPage] = []
        for artifact_id in page_set.rendered_page_artifact_ids:
            artifact = await self._repositories.get_artifact(artifact_id)
            if (
                artifact is None
                or artifact.run_id != run_id
                or artifact.validation_status != "accepted"
                or artifact.schema_version != "rendered-page.v1"
                or artifact.content is None
                or page_set.manga_plan_artifact_id not in artifact.parent_artifact_ids
                or asset_set_artifact.artifact_id not in artifact.parent_artifact_ids
                or artifact.artifact_id not in page_set_artifact.parent_artifact_ids
            ):
                raise ArtifactValidationError("RenderedPage lineage is incomplete")
            if content_hash(artifact.content) != artifact.content_hash:
                raise ArtifactValidationError("RenderedPage content hash does not match")
            pages.append(RenderedPage.model_validate(artifact.content))
        pages.sort(key=lambda item: item.storyboard_page.page_index)
        if len(pages) != page_set.page_count:
            raise ArtifactValidationError("RenderedPage count differs from the accepted set")
        if sum(len(item.storyboard_page.panels) for item in pages) != page_set.panel_count:
            raise ArtifactValidationError("RenderedPage panel count differs from the accepted set")
        expected_flow = (
            "top-right to bottom-left"
            if page_set.reading_direction == "rtl"
            else "top-left to bottom-right"
        )
        if any(item.storyboard_page.reading_flow != expected_flow for item in pages):
            raise ArtifactValidationError("RenderedPage reading direction differs from its set")
        known_assets = {
            item.asset_id
            for item in GeneratedAssetSet.model_validate(asset_set_artifact.content).assets
        }
        rendered_assets = {
            render.asset_id
            for page in pages
            for render in page.panel_artifacts.values()
            if render.render_status == "rendered" and render.asset_id is not None
        }
        if rendered_assets != known_assets:
            raise ArtifactValidationError(
                "RenderedPage asset use differs from the accepted asset set"
            )
        return pages

    @staticmethod
    def _validate_sets(
        *,
        run_id: str,
        project_id: str,
        scope_id: str,
        page_set_artifact: ArtifactDoc,
        page_set: RenderedPageSet,
        asset_set_artifact: ArtifactDoc,
        asset_set: GeneratedAssetSet,
    ) -> None:
        if (
            page_set_artifact.project_id != project_id
            or page_set_artifact.run_id != run_id
            or page_set_artifact.kind != "rendered_page_set"
            or page_set_artifact.validation_status != "accepted"
            or page_set_artifact.content is None
            or content_hash(page_set_artifact.content) != page_set_artifact.content_hash
        ):
            raise ArtifactValidationError("RenderedPage set identity or hash is invalid")
        if (
            asset_set_artifact.project_id != project_id
            or asset_set_artifact.run_id != run_id
            or asset_set_artifact.kind != "asset_request_set"
            or asset_set_artifact.validation_status != "accepted"
            or asset_set_artifact.content is None
            or content_hash(asset_set_artifact.content) != asset_set_artifact.content_hash
        ):
            raise ArtifactValidationError("Generated asset set identity or hash is invalid")
        if (
            page_set.project_id != project_id
            or page_set.run_id != run_id
            or page_set.scope_id != scope_id
            or page_set.asset_set_artifact_id != asset_set_artifact.artifact_id
            or page_set.manga_plan_artifact_id != asset_set.manga_plan_artifact_id
            or asset_set.project_id != project_id
            or asset_set.run_id != run_id
        ):
            raise ArtifactValidationError("Reader artifact-set lineage is inconsistent")
        required_page_parents = {
            page_set.manga_plan_artifact_id,
            asset_set_artifact.artifact_id,
            *page_set.rendered_page_artifact_ids,
        }
        if not required_page_parents.issubset(set(page_set_artifact.parent_artifact_ids)):
            raise ArtifactValidationError("RenderedPage set parent lineage is incomplete")
        if page_set.manga_plan_artifact_id not in asset_set_artifact.parent_artifact_ids:
            raise ArtifactValidationError("Generated asset set parent lineage is incomplete")
        if any(asset.project_id != project_id for asset in asset_set.assets):
            raise ArtifactValidationError("Generated asset belongs to another project")

    @staticmethod
    def _single_artifact(
        artifacts: list[ArtifactDoc],
        schema_version: str,
    ) -> ArtifactDoc:
        matches = [item for item in artifacts if item.schema_version == schema_version]
        if (
            len(matches) != 1
            or matches[0].content is None
            or matches[0].validation_status != "accepted"
        ):
            raise ArtifactValidationError(
                f"Succeeded run requires one accepted {schema_version} artifact"
            )
        return matches[0]

    @staticmethod
    def _reader_asset(book_id: str, project_id: str, asset: AssetRef) -> ReaderAsset:
        return ReaderAsset(
            asset_id=asset.asset_id,
            asset_type=asset.asset_type,
            content_hash=asset.content_hash,
            mime_type=asset.mime_type,
            width=asset.width,
            height=asset.height,
            model_receipt=asset.model_receipt,
            url=f"/books/{book_id}/manga/{project_id}/assets/{asset.asset_id}",
        )

    def _resolve_asset_path(self, asset: AssetRef) -> Path:
        path = MangaProductionService(
            self._repositories,
            image_provider=None,
            media_root=self._media_root,
        ).resolve_storage_path(asset.storage_ref)
        if not path.is_file():
            raise ArtifactValidationError(f"Accepted asset file is missing: {asset.asset_id}")
        if binary_content_hash(path.read_bytes()) != asset.content_hash:
            raise ArtifactValidationError(f"Accepted asset hash mismatch: {asset.asset_id}")
        return path
