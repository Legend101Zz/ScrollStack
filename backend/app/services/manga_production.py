"""Deterministic post-MangaPlan asset, page, and memory production."""

from __future__ import annotations

import os
import tempfile
from collections import defaultdict
from pathlib import Path, PurePosixPath
from typing import Annotated, Literal

import pymupdf
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.contracts.artifacts import AssetRef, ModelReceipt
from app.contracts.context import ContinuityUpdate, MemoryDelta, SourceCoverage
from app.contracts.manga import (
    AdaptationBeat,
    LayoutBoxPct,
    MangaPlan,
    PageComposition,
    PanelPlacement,
    PanelRenderArtifact,
    RenderedPage,
    StoryboardPage,
    StoryboardPanel,
)
from app.persistence.documents import ArtifactDoc, GenerationRunDoc, construct_document, utc_now
from app.persistence.protocols import Repositories

from .errors import ArtifactValidationError
from .hashing import binary_content_hash, content_hash
from .image_generation import (
    APPROVED_OPENROUTER_IMAGE_MODEL,
    OPENROUTER_IMAGE_PROMPT_VERSION,
    ImageBudgetError,
    ImageGenerationGateway,
    MissingImageCredentialError,
)

MANGA_COMPOSER_VERSION = "deterministic-manga-composer.v1"
RENDERED_PAGE_VALIDATOR_VERSION = "rendered-page-validator.v1"
ASSET_SET_SCHEMA_VERSION = "asset-set.v1"
RENDERED_PAGE_SET_SCHEMA_VERSION = "rendered-page-set.v1"
MEMORY_DELTA_DERIVER_VERSION = "accepted-manga-memory-delta.v1"


class AssetBinding(BaseModel):
    model_config = ConfigDict(extra="forbid")

    beat_id: str = Field(min_length=1, max_length=128)
    asset_id: str = Field(min_length=1, max_length=128)


class GeneratedAssetSet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["asset-set.v1"]
    project_id: str = Field(min_length=1, max_length=128)
    run_id: str = Field(min_length=1, max_length=128)
    manga_plan_artifact_id: str = Field(min_length=1, max_length=128)
    image_provider: Literal["openrouter"]
    image_model: str = Field(min_length=1, max_length=500)
    prompt_version: str = Field(min_length=1, max_length=500)
    assets: list[AssetRef] = Field(min_length=1, max_length=100)
    bindings: list[AssetBinding] = Field(min_length=1, max_length=100)
    total_cost_usd: Annotated[float, Field(ge=0)] | None = None


class RenderedPageSet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["rendered-page-set.v1"]
    project_id: str = Field(min_length=1, max_length=128)
    run_id: str = Field(min_length=1, max_length=128)
    scope_id: str = Field(min_length=1, max_length=128)
    manga_plan_artifact_id: str = Field(min_length=1, max_length=128)
    asset_set_artifact_id: str = Field(min_length=1, max_length=128)
    rendered_page_artifact_ids: list[str] = Field(min_length=1, max_length=100)
    page_count: Annotated[int, Field(ge=1, le=100)]
    panel_count: Annotated[int, Field(ge=1, le=700)]
    reading_direction: Literal["rtl", "ltr"]


class MangaProductionService:
    def __init__(
        self,
        repositories: Repositories,
        *,
        image_provider: ImageGenerationGateway | None,
        media_root: Path,
        image_model: str = APPROVED_OPENROUTER_IMAGE_MODEL,
        max_reserved_cost_per_asset_usd: float = 1.0,
    ) -> None:
        self._repositories = repositories
        self._image_provider = image_provider
        self._media_root = media_root
        self._image_model = image_model
        self._max_reserved_cost_per_asset_usd = max_reserved_cost_per_asset_usd

    async def generate_assets(
        self,
        run: GenerationRunDoc,
        manga_plan_artifact: ArtifactDoc,
        *,
        attempt: int,
    ) -> ArtifactDoc:
        plan = self._accepted_plan(run, manga_plan_artifact)
        max_assets = min(int(run.budget["max_key_panels"]), len(plan.beats))
        if max_assets < 1:
            raise ImageBudgetError(
                "At least one key panel is required for a real manga output; max_key_panels is zero"
            )
        image_budget = float(run.budget["max_image_cost_usd"])
        if self._max_reserved_cost_per_asset_usd <= 0:
            raise ImageBudgetError("Reserved image cost per asset must be greater than zero")
        affordable = int(image_budget // self._max_reserved_cost_per_asset_usd)
        requested_count = min(max_assets, affordable)
        if requested_count < 1:
            raise ImageBudgetError("Image budget is below the bounded per-asset reservation")

        selected_beats = self._distributed_beats(plan, requested_count)
        assets: list[AssetRef] = []
        bindings: list[AssetBinding] = []
        image_artifact_ids: list[str] = []
        known_cost = 0.0
        all_costs_known = True
        for beat in selected_beats:
            prompt = self._asset_prompt(plan, beat.beat_id)
            request_identity = content_hash(
                {
                    "project_id": run.project_id,
                    "run_id": run.run_id,
                    "manga_plan_hash": manga_plan_artifact.content_hash,
                    "beat_id": beat.beat_id,
                    "provider": "openrouter",
                    "model": self._image_model,
                    "prompt": prompt,
                    "prompt_version": OPENROUTER_IMAGE_PROMPT_VERSION,
                    "aspect_ratio": "2:3",
                }
            )
            asset_id = f"asset_key_panel_{request_identity[:24]}"
            artifact_id = f"image_asset_{request_identity[:24]}"
            existing = await self._repositories.get_artifact(artifact_id)
            if existing is not None:
                asset = self._accepted_image_asset(existing, run, manga_plan_artifact)
                self._verify_asset_file(asset)
                image_artifact_ids.append(existing.artifact_id)
            else:
                if self._image_provider is None:
                    raise MissingImageCredentialError(
                        "OPENROUTER_API_KEY is missing; no accepted image asset can be reused"
                    )
                if known_cost + self._max_reserved_cost_per_asset_usd > image_budget:
                    raise ImageBudgetError("The next image call exceeds max_image_cost_usd")
                result = await self._image_provider.generate(
                    prompt=prompt,
                    model=self._image_model,
                    aspect_ratio="2:3",
                )
                if result.provider != "openrouter" or result.model != self._image_model:
                    raise ArtifactValidationError(
                        "Image provider returned provenance for an unexpected provider/model"
                    )
                if result.cost_usd is not None and known_cost + result.cost_usd > image_budget:
                    raise ImageBudgetError(
                        "Returned image-provider cost exceeds max_image_cost_usd"
                    )
                file_hash = binary_content_hash(result.content)
                extension = {
                    "image/png": "png",
                    "image/jpeg": "jpg",
                    "image/webp": "webp",
                }.get(result.mime_type)
                if extension is None:
                    raise ArtifactValidationError(
                        f"Image provider returned unsupported MIME type {result.mime_type!r}"
                    )
                storage_ref = f"storage://generated/{run.project_id}/{asset_id}.{extension}"
                receipt = ModelReceipt(
                    provider=result.provider,
                    model=result.model,
                    purpose="image_generation",
                    prompt_version=OPENROUTER_IMAGE_PROMPT_VERSION,
                    skill_hashes=[],
                    input_artifact_ids=[manga_plan_artifact.artifact_id],
                    input_tokens=result.input_tokens,
                    output_tokens=result.output_tokens,
                    cost_usd=result.cost_usd,
                    latency_ms=result.latency_ms,
                    attempt=attempt,
                    created_at=utc_now(),
                )
                asset = AssetRef(
                    asset_id=asset_id,
                    project_id=run.project_id,
                    asset_type="key_panel",
                    content_hash=file_hash,
                    storage_ref=storage_ref,
                    mime_type=result.mime_type,
                    width=result.width,
                    height=result.height,
                    duration_ms=None,
                    model_receipt=receipt,
                )
                self._persist_immutable_asset(asset, result.content)
                asset_payload = {
                    "schema_version": "image-asset.v1",
                    "asset": asset.model_dump(mode="json"),
                    "beat_id": beat.beat_id,
                    "prompt_hash": content_hash(prompt),
                    "prompt_version": OPENROUTER_IMAGE_PROMPT_VERSION,
                }
                image_artifact = construct_document(
                    ArtifactDoc,
                    artifact_id=artifact_id,
                    project_id=run.project_id,
                    run_id=run.run_id,
                    kind="asset_request_set",
                    schema_version="image-asset.v1",
                    content=asset_payload,
                    storage_ref=None,
                    content_hash=content_hash(asset_payload),
                    parent_artifact_ids=[manga_plan_artifact.artifact_id],
                    source_refs=self._source_refs_for_beat(plan, beat.beat_id),
                    model_receipt=receipt.model_dump(mode="json"),
                    validation_status="accepted",
                    validation_report={
                        "passed": True,
                        "issues": [],
                        "validator_version": "generated-image-validator.v1",
                    },
                    created_at=utc_now(),
                )
                stored_image_artifact = await self._repositories.save_artifact(image_artifact)
                image_artifact_ids.append(stored_image_artifact.artifact_id)
            assets.append(asset)
            bindings.append(AssetBinding(beat_id=beat.beat_id, asset_id=asset.asset_id))
            if asset.model_receipt is None or asset.model_receipt.cost_usd is None:
                all_costs_known = False
            else:
                known_cost += asset.model_receipt.cost_usd
                if known_cost > image_budget:
                    raise ImageBudgetError(
                        "Returned image-provider cost exceeds max_image_cost_usd"
                    )

        asset_set = GeneratedAssetSet(
            schema_version=ASSET_SET_SCHEMA_VERSION,
            project_id=run.project_id,
            run_id=run.run_id,
            manga_plan_artifact_id=manga_plan_artifact.artifact_id,
            image_provider="openrouter",
            image_model=self._image_model,
            prompt_version=OPENROUTER_IMAGE_PROMPT_VERSION,
            assets=assets,
            bindings=bindings,
            total_cost_usd=known_cost if all_costs_known else None,
        )
        payload = asset_set.model_dump(mode="json")
        digest = content_hash(payload)
        artifact = construct_document(
            ArtifactDoc,
            artifact_id=f"asset_set_{digest[:24]}",
            project_id=run.project_id,
            run_id=run.run_id,
            kind="asset_request_set",
            schema_version=ASSET_SET_SCHEMA_VERSION,
            content=payload,
            storage_ref=None,
            content_hash=digest,
            parent_artifact_ids=[
                manga_plan_artifact.artifact_id,
                *image_artifact_ids,
            ],
            source_refs=self._unique_source_refs(plan),
            model_receipt=None,
            validation_status="accepted",
            validation_report={
                "passed": True,
                "issues": [],
                "validator_version": "asset-set-validator.v1",
            },
            created_at=utc_now(),
        )
        return await self._repositories.save_artifact(artifact)

    async def compose_rendered_pages(
        self,
        run: GenerationRunDoc,
        manga_plan_artifact: ArtifactDoc,
        asset_set_artifact: ArtifactDoc,
    ) -> ArtifactDoc:
        plan = self._accepted_plan(run, manga_plan_artifact)
        asset_set = self._accepted_asset_set(run, manga_plan_artifact, asset_set_artifact)
        asset_lookup = {item.asset_id: item for item in asset_set.assets}
        for asset in asset_set.assets:
            self._verify_asset_file(asset)
        binding_lookup = {item.beat_id: item.asset_id for item in asset_set.bindings}
        if plan.target_page_count > len(plan.beats):
            raise ArtifactValidationError(
                "MangaPlan target_page_count cannot exceed its renderable beat count"
            )
        if len(plan.beats) > plan.target_page_count * 7:
            raise ArtifactValidationError(
                "MangaPlan beat count exceeds the RenderedPage panel budget"
            )
        page_count = plan.target_page_count
        if page_count < 1:
            raise ArtifactValidationError("MangaPlan produced no renderable pages")
        pages: list[RenderedPage] = []
        page_artifacts: list[ArtifactDoc] = []
        for page_index in range(page_count):
            start = page_index * len(plan.beats) // page_count
            end = (page_index + 1) * len(plan.beats) // page_count
            page_beats = plan.beats[start:end]
            panels: list[StoryboardPanel] = []
            panel_artifacts: dict[str, PanelRenderArtifact] = {}
            for beat in page_beats:
                if len(beat.book_essence) > 1_000:
                    raise ArtifactValidationError(
                        f"MangaPlan beat {beat.beat_id} exceeds the reader text bound"
                    )
                panel_id = (
                    f"panel_{content_hash({'plan': plan.plan_id, 'beat': beat.beat_id})[:24]}"
                )
                asset_id = binding_lookup.get(beat.beat_id)
                visual_asset_ids = [asset_id] if asset_id is not None else []
                panels.append(
                    StoryboardPanel(
                        panel_id=panel_id,
                        scene_id=f"scene_{content_hash(beat.beat_id)[:24]}",
                        beat_ids=[beat.beat_id],
                        purpose=self._panel_purpose(beat.narrative_purpose),
                        shot_type=self._shot_type(beat.sequence),
                        composition="; ".join(beat.visual_intent),
                        action=beat.dramatization,
                        dialogue=[],
                        narration=[beat.book_essence],
                        source_refs=beat.source_refs,
                        source_fact_ids=beat.required_fact_ids,
                        character_ids=[item.character_id for item in beat.character_intent],
                        visual_asset_ids=visual_asset_ids,
                        emotional_tone=(
                            beat.character_intent[0].emotional_state
                            if beat.character_intent
                            else "reflective"
                        ),
                    )
                )
                panel_artifacts[panel_id] = PanelRenderArtifact(
                    asset_id=asset_id,
                    aspect_ratio="2:3" if asset_id is not None else None,
                    used_reference_asset_ids=[],
                    requested_character_count=len(beat.character_intent),
                    render_status="rendered" if asset_id is not None else "not_requested",
                    error_code=None,
                )
            page_id = f"page_{content_hash({'plan': plan.plan_id, 'index': page_index})[:24]}"
            storyboard = StoryboardPage(
                page_id=page_id,
                page_index=page_index,
                panels=panels,
                page_turn_hook=plan.ending_state[:1_000] if page_index == page_count - 1 else "",
                reading_flow="top-right to bottom-left",
            )
            composition = self._page_composition(page_index, panels)
            page = RenderedPage(
                schema_version="rendered-page.v1",
                storyboard_page=storyboard,
                composition=composition,
                panel_artifacts=panel_artifacts,
            )
            self._validate_page(page, plan, asset_lookup)
            page_payload = page.model_dump(mode="json")
            page_digest = content_hash(
                {
                    "page": page_payload,
                    "parents": [
                        manga_plan_artifact.artifact_id,
                        asset_set_artifact.artifact_id,
                    ],
                }
            )
            page_artifact = construct_document(
                ArtifactDoc,
                artifact_id=f"rendered_page_{page_digest[:24]}",
                project_id=run.project_id,
                run_id=run.run_id,
                kind="rendered_page_set",
                schema_version="rendered-page.v1",
                content=page_payload,
                storage_ref=None,
                content_hash=content_hash(page_payload),
                parent_artifact_ids=[
                    manga_plan_artifact.artifact_id,
                    asset_set_artifact.artifact_id,
                ],
                source_refs=self._unique_source_refs_for_panels(panels),
                model_receipt=None,
                validation_status="accepted",
                validation_report={
                    "passed": True,
                    "issues": [],
                    "validator_version": RENDERED_PAGE_VALIDATOR_VERSION,
                },
                created_at=utc_now(),
            )
            page_artifacts.append(await self._repositories.save_artifact(page_artifact))
            pages.append(page)

        scope = await self._repositories.get_scope(run.scope_id)
        if scope is None or scope.project_id != run.project_id:
            raise ArtifactValidationError("RenderedPage validation could not load its scope")
        self._validate_page_set(plan, pages, asset_lookup, set(scope.source_unit_ids))
        page_set = RenderedPageSet(
            schema_version=RENDERED_PAGE_SET_SCHEMA_VERSION,
            project_id=run.project_id,
            run_id=run.run_id,
            scope_id=run.scope_id,
            manga_plan_artifact_id=manga_plan_artifact.artifact_id,
            asset_set_artifact_id=asset_set_artifact.artifact_id,
            rendered_page_artifact_ids=[item.artifact_id for item in page_artifacts],
            page_count=len(pages),
            panel_count=sum(len(item.storyboard_page.panels) for item in pages),
            reading_direction="rtl",
        )
        payload = page_set.model_dump(mode="json")
        digest = content_hash(payload)
        artifact = construct_document(
            ArtifactDoc,
            artifact_id=f"rendered_page_set_{digest[:24]}",
            project_id=run.project_id,
            run_id=run.run_id,
            kind="rendered_page_set",
            schema_version=RENDERED_PAGE_SET_SCHEMA_VERSION,
            content=payload,
            storage_ref=None,
            content_hash=digest,
            parent_artifact_ids=[
                manga_plan_artifact.artifact_id,
                asset_set_artifact.artifact_id,
                *[item.artifact_id for item in page_artifacts],
            ],
            source_refs=self._unique_source_refs(plan),
            model_receipt=None,
            validation_status="accepted",
            validation_report={
                "passed": True,
                "issues": [],
                "validator_version": RENDERED_PAGE_VALIDATOR_VERSION,
            },
            created_at=utc_now(),
        )
        return await self._repositories.save_artifact(artifact)

    def derive_memory_delta(
        self,
        run: GenerationRunDoc,
        manga_plan_artifact: ArtifactDoc,
        asset_set_artifact: ArtifactDoc,
        rendered_page_set_artifact: ArtifactDoc,
    ) -> MemoryDelta:
        plan = self._accepted_plan(run, manga_plan_artifact)
        self._accepted_asset_set(run, manga_plan_artifact, asset_set_artifact)
        self._accepted_page_set(
            run,
            manga_plan_artifact,
            asset_set_artifact,
            rendered_page_set_artifact,
        )
        coverage: dict[str, list[str]] = defaultdict(list)
        all_refs = []
        for beat in plan.beats:
            for ref in beat.source_refs:
                coverage[ref.source_unit_id].append(beat.beat_id)
                all_refs.append(ref)
        unique_refs = {content_hash(item.model_dump(mode="json")): item for item in all_refs}
        continuity_updates = [
            ContinuityUpdate(
                key="previous_slice_ending",
                value=plan.ending_state,
                source_refs=[unique_refs[key] for key in sorted(unique_refs)][:128],
            )
        ]
        return MemoryDelta(
            schema_version="memory-delta.v1",
            project_id=run.project_id,
            base_memory_version=run.memory_version,
            new_facts=plan.new_facts,
            fact_corrections=[],
            character_state_updates=plan.character_state_updates,
            terminology_updates=plan.terminology_updates,
            continuity_updates=continuity_updates,
            coverage_additions=[
                SourceCoverage(
                    source_unit_id=source_unit_id,
                    beat_ids=sorted(set(beat_ids)),
                    coverage_status="covered",
                )
                for source_unit_id, beat_ids in sorted(coverage.items())
            ],
            unresolved_thread_updates=plan.unresolved_thread_updates,
            source_artifact_ids=[
                manga_plan_artifact.artifact_id,
                asset_set_artifact.artifact_id,
                rendered_page_set_artifact.artifact_id,
            ],
        )

    async def persist_memory_delta(
        self,
        run: GenerationRunDoc,
        delta: MemoryDelta,
    ) -> ArtifactDoc:
        payload = delta.model_dump(mode="json")
        digest = content_hash(payload)
        source_refs: dict[str, dict[str, object]] = {}
        for parent_id in delta.source_artifact_ids:
            parent = await self._repositories.get_artifact(parent_id)
            if (
                parent is None
                or parent.project_id != run.project_id
                or parent.validation_status != "accepted"
            ):
                raise ArtifactValidationError(
                    f"MemoryDelta parent artifact is not accepted: {parent_id}"
                )
            for source_ref in parent.source_refs:
                source_refs[content_hash(source_ref)] = source_ref
        artifact = construct_document(
            ArtifactDoc,
            artifact_id=f"memory_delta_{digest[:24]}",
            project_id=run.project_id,
            run_id=run.run_id,
            kind="memory_delta",
            schema_version="memory-delta.v1",
            content=payload,
            storage_ref=None,
            content_hash=digest,
            parent_artifact_ids=list(delta.source_artifact_ids),
            source_refs=[source_refs[key] for key in sorted(source_refs)],
            model_receipt=None,
            validation_status="accepted",
            validation_report={
                "passed": True,
                "issues": [],
                "validator_version": MEMORY_DELTA_DERIVER_VERSION,
            },
            created_at=utc_now(),
        )
        return await self._repositories.save_artifact(artifact)

    def _accepted_plan(self, run: GenerationRunDoc, artifact: ArtifactDoc) -> MangaPlan:
        if (
            artifact.project_id != run.project_id
            or artifact.run_id != run.run_id
            or artifact.kind != "manga_plan"
            or artifact.schema_version != "manga-plan.v1"
            or artifact.validation_status != "accepted"
            or artifact.content is None
        ):
            raise ArtifactValidationError("Composition requires this run's accepted MangaPlan")
        try:
            plan = MangaPlan.model_validate(artifact.content)
        except ValidationError as error:
            raise ArtifactValidationError("Accepted MangaPlan payload is invalid") from error
        if (
            plan.project_id != run.project_id
            or plan.scope_id != run.scope_id
            or plan.memory_version != run.memory_version
        ):
            raise ArtifactValidationError("Accepted MangaPlan identity does not match the run")
        return plan

    def _accepted_asset_set(
        self,
        run: GenerationRunDoc,
        plan: ArtifactDoc,
        artifact: ArtifactDoc,
    ) -> GeneratedAssetSet:
        if (
            artifact.project_id != run.project_id
            or artifact.run_id != run.run_id
            or artifact.kind != "asset_request_set"
            or artifact.schema_version != ASSET_SET_SCHEMA_VERSION
            or artifact.validation_status != "accepted"
            or artifact.content is None
            or plan.artifact_id not in artifact.parent_artifact_ids
        ):
            raise ArtifactValidationError("Composition requires an accepted generated asset set")
        try:
            asset_set = GeneratedAssetSet.model_validate(artifact.content)
        except ValidationError as error:
            raise ArtifactValidationError("Accepted generated asset set is invalid") from error
        if (
            asset_set.project_id != run.project_id
            or asset_set.run_id != run.run_id
            or asset_set.manga_plan_artifact_id != plan.artifact_id
            or asset_set.image_provider != "openrouter"
            or asset_set.image_model != self._image_model
        ):
            raise ArtifactValidationError("Generated asset set provenance does not match the run")
        return asset_set

    def _accepted_page_set(
        self,
        run: GenerationRunDoc,
        plan: ArtifactDoc,
        asset_set: ArtifactDoc,
        artifact: ArtifactDoc,
    ) -> RenderedPageSet:
        if (
            artifact.project_id != run.project_id
            or artifact.run_id != run.run_id
            or artifact.kind != "rendered_page_set"
            or artifact.schema_version != RENDERED_PAGE_SET_SCHEMA_VERSION
            or artifact.validation_status != "accepted"
            or artifact.content is None
            or plan.artifact_id not in artifact.parent_artifact_ids
            or asset_set.artifact_id not in artifact.parent_artifact_ids
        ):
            raise ArtifactValidationError("Memory derivation requires accepted RenderedPages")
        try:
            page_set = RenderedPageSet.model_validate(artifact.content)
        except ValidationError as error:
            raise ArtifactValidationError("Accepted RenderedPage set is invalid") from error
        if (
            page_set.project_id != run.project_id
            or page_set.run_id != run.run_id
            or page_set.scope_id != run.scope_id
        ):
            raise ArtifactValidationError("RenderedPage set identity does not match the run")
        return page_set

    def _accepted_image_asset(
        self,
        artifact: ArtifactDoc,
        run: GenerationRunDoc,
        plan: ArtifactDoc,
    ) -> AssetRef:
        if (
            artifact.project_id != run.project_id
            or artifact.run_id != run.run_id
            or artifact.schema_version != "image-asset.v1"
            or artifact.validation_status != "accepted"
            or artifact.content is None
            or plan.artifact_id not in artifact.parent_artifact_ids
        ):
            raise ArtifactValidationError("Existing image asset is not accepted for this run")
        raw_asset = artifact.content.get("asset")
        try:
            asset = AssetRef.model_validate(raw_asset)
        except ValidationError as error:
            raise ArtifactValidationError("Existing image asset metadata is invalid") from error
        if (
            asset.project_id != run.project_id
            or asset.model_receipt is None
            or asset.model_receipt.provider != "openrouter"
            or asset.model_receipt.model != self._image_model
        ):
            raise ArtifactValidationError("Existing image asset has invalid provenance")
        return asset

    def _persist_immutable_asset(self, asset: AssetRef, payload: bytes) -> None:
        path = self.resolve_storage_path(asset.storage_ref)
        if path.exists():
            raise ArtifactValidationError(
                "Immutable asset path already exists without an accepted artifact: "
                f"{asset.asset_id}"
            )
        path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
            temporary_path = Path(handle.name)
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
        self._verify_asset_file(asset)

    def _verify_asset_file(self, asset: AssetRef) -> None:
        path = self.resolve_storage_path(asset.storage_ref)
        if not path.is_file():
            raise ArtifactValidationError(f"Accepted asset file is missing: {asset.asset_id}")
        payload = path.read_bytes()
        if binary_content_hash(payload) != asset.content_hash:
            raise ArtifactValidationError(f"Accepted asset hash mismatch: {asset.asset_id}")
        try:
            pixmap = pymupdf.Pixmap(payload)
        except Exception as error:
            raise ArtifactValidationError(
                f"Accepted asset is not a readable raster image: {asset.asset_id}"
            ) from error
        if pixmap.width != asset.width or pixmap.height != asset.height:
            raise ArtifactValidationError(
                f"Accepted asset dimensions do not match metadata: {asset.asset_id}"
            )

    def resolve_storage_path(self, storage_ref: str) -> Path:
        prefix = "storage://"
        if not storage_ref.startswith(prefix):
            raise ArtifactValidationError("Asset storage reference is not local immutable storage")
        relative = PurePosixPath(storage_ref[len(prefix) :])
        if relative.is_absolute() or ".." in relative.parts:
            raise ArtifactValidationError("Asset storage reference is unsafe")
        root = self._media_root.resolve()
        path = (root / Path(*relative.parts)).resolve()
        if not path.is_relative_to(root):
            raise ArtifactValidationError("Asset storage reference escapes MEDIA_ROOT")
        return path

    @staticmethod
    def _distributed_beats(plan: MangaPlan, count: int) -> list[AdaptationBeat]:
        if count >= len(plan.beats):
            return list(plan.beats)
        return [
            plan.beats[min(len(plan.beats) - 1, ((index * 2 + 1) * len(plan.beats)) // (count * 2))]
            for index in range(count)
        ]

    @staticmethod
    def _asset_prompt(plan: MangaPlan, beat_id: str) -> str:
        beat = next(item for item in plan.beats if item.beat_id == beat_id)
        characters = (
            ", ".join(
                f"{item.character_id}: {item.emotional_state}" for item in beat.character_intent
            )
            or "no named character required"
        )
        return (
            "Create one original black-and-white manga key panel with clean ink lines, "
            "legible silhouettes, cinematic lighting, and no embedded text, logos, signatures, "
            "watermarks, or imitation of a named living artist. "
            f"Story title: {plan.title}. Scene: {beat.dramatization}. "
            f"Visual intent: {'; '.join(beat.visual_intent)}. Characters: {characters}. "
            "Use only this supplied description; do not retrieve or copy external images."
        )[:1_500]

    @staticmethod
    def _source_refs_for_beat(plan: MangaPlan, beat_id: str) -> list[dict[str, object]]:
        beat = next(item for item in plan.beats if item.beat_id == beat_id)
        return [item.model_dump(mode="json") for item in beat.source_refs]

    @staticmethod
    def _unique_source_refs(plan: MangaPlan) -> list[dict[str, object]]:
        refs = {
            content_hash(ref.model_dump(mode="json")): ref.model_dump(mode="json")
            for beat in plan.beats
            for ref in beat.source_refs
        }
        return [refs[key] for key in sorted(refs)]

    @staticmethod
    def _unique_source_refs_for_panels(
        panels: list[StoryboardPanel],
    ) -> list[dict[str, object]]:
        refs = {
            content_hash(ref.model_dump(mode="json")): ref.model_dump(mode="json")
            for panel in panels
            for ref in panel.source_refs
        }
        return [refs[key] for key in sorted(refs)]

    @staticmethod
    def _panel_purpose(purpose: str) -> str:
        return {
            "hook": "establishing",
            "setup": "establishing",
            "conflict": "action",
            "explanation": "explanation",
            "reveal": "reveal",
            "payoff": "reveal",
            "cliffhanger": "transition",
        }[purpose]

    @staticmethod
    def _shot_type(sequence: int) -> str:
        return ("wide", "medium", "close_up", "over_shoulder")[sequence % 4]

    @staticmethod
    def _page_composition(
        page_index: int,
        panels: list[StoryboardPanel],
    ) -> PageComposition:
        gutter = 2.0 if len(panels) > 1 else 0.0
        panel_height = (100.0 - gutter * (len(panels) - 1)) / len(panels)
        placements: dict[str, PanelPlacement] = {}
        for index, panel in enumerate(panels):
            y_pct = index * (panel_height + gutter)
            height_pct = 100.0 - y_pct if index == len(panels) - 1 else panel_height
            placements[panel.panel_id] = PanelPlacement(
                bbox_pct=LayoutBoxPct(
                    x_pct=0,
                    y_pct=y_pct,
                    width_pct=100,
                    height_pct=height_pct,
                )
            )
        return PageComposition(
            page_index=page_index,
            panel_order=[item.panel_id for item in panels],
            panel_placements=placements,
            sprite_layers={},
            bubble_placements={},
            page_turn_panel_id=panels[-1].panel_id,
            gutter_px=6,
            composition_notes="Deterministic vertical rhythm with RTL panel ordering.",
        )

    def _validate_page(
        self,
        page: RenderedPage,
        plan: MangaPlan,
        assets: dict[str, AssetRef],
    ) -> None:
        beat_lookup = {item.beat_id: item for item in plan.beats}
        seen_boxes: list[tuple[float, float]] = []
        if page.composition is None:
            raise ArtifactValidationError("RenderedPage requires a persisted composition")
        for panel in page.storyboard_page.panels:
            if len(panel.beat_ids) != 1 or panel.beat_ids[0] not in beat_lookup:
                raise ArtifactValidationError("Rendered panel references an unknown MangaPlan beat")
            beat = beat_lookup[panel.beat_ids[0]]
            if panel.source_refs != beat.source_refs:
                raise ArtifactValidationError(
                    "Rendered panel source grounding differs from MangaPlan"
                )
            expected_characters = [item.character_id for item in beat.character_intent]
            if panel.character_ids != expected_characters:
                raise ArtifactValidationError(
                    "Rendered panel character continuity differs from MangaPlan"
                )
            reader_text_length = sum(len(item.text) for item in panel.dialogue) + sum(
                len(item) for item in panel.narration
            )
            if reader_text_length > 1_000:
                raise ArtifactValidationError("Rendered panel text exceeds the v1 overflow bound")
            displayed_scene_length = len(panel.action or "") + len(panel.composition)
            if displayed_scene_length > 2_000:
                raise ArtifactValidationError(
                    "Rendered panel scene description exceeds the v1 overflow bound"
                )
            artifact = page.panel_artifacts[panel.panel_id]
            if artifact.render_status == "rendered":
                if (
                    artifact.asset_id not in assets
                    or artifact.asset_id not in panel.visual_asset_ids
                ):
                    raise ArtifactValidationError("Rendered panel references a missing asset")
                self._verify_asset_file(assets[artifact.asset_id])
            placement = page.composition.panel_placements[panel.panel_id].bbox_pct
            interval = (placement.y_pct, placement.y_pct + placement.height_pct)
            if any(
                interval[0] < existing[1] and existing[0] < interval[1] for existing in seen_boxes
            ):
                raise ArtifactValidationError("RenderedPage panel geometry overlaps")
            seen_boxes.append(interval)

    @staticmethod
    def _validate_page_set(
        plan: MangaPlan,
        pages: list[RenderedPage],
        assets: dict[str, AssetRef],
        expected_source_unit_ids: set[str],
    ) -> None:
        if [item.storyboard_page.page_index for item in pages] != list(range(len(pages))):
            raise ArtifactValidationError("RenderedPage indices must be contiguous")
        panels = [panel for page in pages for panel in page.storyboard_page.panels]
        if len(panels) != len(plan.beats):
            raise ArtifactValidationError(
                "RenderedPage panel count must cover every MangaPlan beat"
            )
        panel_ids = [item.panel_id for item in panels]
        if len(panel_ids) != len(set(panel_ids)):
            raise ArtifactValidationError("RenderedPage panel IDs must be globally unique")
        covered_refs = {
            (ref.book_id, ref.source_unit_id, ref.text_hash)
            for panel in panels
            for ref in panel.source_refs
        }
        expected_refs = {
            (ref.book_id, ref.source_unit_id, ref.text_hash)
            for beat in plan.beats
            for ref in beat.source_refs
        }
        if covered_refs != expected_refs:
            raise ArtifactValidationError("RenderedPage source coverage differs from MangaPlan")
        if {item[1] for item in covered_refs} != expected_source_unit_ids:
            raise ArtifactValidationError(
                "RenderedPage source coverage must include every selected source unit"
            )
        referenced_assets = {asset_id for panel in panels for asset_id in panel.visual_asset_ids}
        if referenced_assets != set(assets):
            raise ArtifactValidationError("Every generated asset must be used by a RenderedPage")
