"""Fast, bounded manga edition image generation and deterministic composition."""

from __future__ import annotations

import asyncio
import base64
import html
import re
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Protocol, cast

import pymupdf

from app.contracts.artifacts import AssetRef, ModelReceipt
from app.contracts.manga import (
    CompiledPageLayout,
    ImageAttempt,
    MangaPagePlan,
    PageCanvas,
    PageScript,
    PageScriptSet,
    PanelLayoutNode,
    ReadingEdge,
    RenderedPageV2,
    RenderedPanelV2,
    SplitGutter,
    SplitLayoutNode,
    TextElement,
    ThumbnailSet,
)
from app.persistence.documents import (
    ArtifactDoc,
    BookDoc,
    GenerationRunDoc,
    construct_document,
    utc_now,
)
from app.persistence.protocols import Repositories

from .errors import ArtifactValidationError
from .hashing import binary_content_hash, content_hash
from .image_generation import (
    APPROVED_OPENROUTER_IMAGE_MODEL,
    GeneratedImage,
    ImageBudgetError,
    OpenRouterImageGenerator,
)
from .manga_editions import EditionPage, MangaEdition, MangaEditionService
from .manga_layout import compile_page_layout
from .manga_page_planning import MangaPagePlanningService, ThumbnailPlanningResult

HACKATHON_PAGE_COUNT = 10
HACKATHON_PANEL_COUNT = 20
HACKATHON_IMAGE_PROMPT_VERSION = "hackathon-manga-panel.v1"
HACKATHON_RENDERER_VERSION = "deterministic-svg-letterer.v1"
CHARACTER_DESCRIPTION = (
    "Kai is an androgynous adult essayist in their early thirties, with a slim face, "
    "short wavy black hair, one unmistakable white forelock above the right eyebrow, "
    "round wire-frame glasses, and a dark zip jacket over a plain light crew-neck shirt."
)
STYLE_DESCRIPTION = (
    "Crisp black-and-white manga ink, expressive clean line art, controlled screentone, "
    "high contrast, restrained backgrounds, no gray color cast, consistent anatomy."
)


class ReferenceImageGenerator(Protocol):
    async def generate_with_references(
        self,
        *,
        prompt: str,
        model: str,
        aspect_ratio: str,
        reference_images: list[tuple[bytes, str]],
    ) -> GeneratedImage: ...


@dataclass(frozen=True)
class AcceptedImage:
    asset: AssetRef
    asset_artifact: ArtifactDoc
    attempt_artifact: ArtifactDoc
    content: bytes


@dataclass(frozen=True)
class EditionProductionResult:
    edition_artifact: ArtifactDoc
    edition: MangaEdition
    planning: ThumbnailPlanningResult
    rendered_page_artifacts: tuple[ArtifactDoc, ...]
    image_attempt_artifacts: tuple[ArtifactDoc, ...]


class HackathonMangaService:
    def __init__(
        self,
        repositories: Repositories,
        *,
        image_provider: OpenRouterImageGenerator | ReferenceImageGenerator | None,
        media_root: Path,
        image_model: str = APPROVED_OPENROUTER_IMAGE_MODEL,
    ) -> None:
        self._repositories = repositories
        self._image_provider = image_provider
        self._media_root = media_root
        self._image_model = image_model
        self._planning = MangaPagePlanningService(
            repositories,
            repositories,
            media_root=media_root,
        )
        self._editions = MangaEditionService(repositories, media_root=media_root)

    async def produce(
        self,
        run: GenerationRunDoc,
        *,
        plan_artifact: ArtifactDoc,
        script_artifact: ArtifactDoc,
        thumbnail_stage_run_id: str,
        image_stage_run_id: str,
        composition_stage_run_id: str,
        parent_edition_id: str | None = None,
        expected_page_count: int = HACKATHON_PAGE_COUNT,
        expected_panel_count: int = HACKATHON_PANEL_COUNT,
    ) -> EditionProductionResult:
        if script_artifact.content is None:
            raise ArtifactValidationError("Accepted PageScriptSet has no inline content")
        script_set = PageScriptSet.model_validate(script_artifact.content)
        if len(script_set.pages) != expected_page_count:
            raise ArtifactValidationError(
                f"Edition requires exactly {expected_page_count} pages"
            )
        if sum(len(page.panels) for page in script_set.pages) != expected_panel_count:
            raise ArtifactValidationError(
                f"Edition requires exactly {expected_panel_count} panels"
            )
        thumbnail_set = self._thumbnail_set(script_artifact, script_set)
        planning = await self._planning.submit_thumbnail_set(
            run_id=run.run_id,
            stage_run_id=thumbnail_stage_run_id,
            script_artifact_id=script_artifact.artifact_id,
            thumbnail_set=thumbnail_set,
            author="system",
        )
        if planning.thumbnail_artifact.validation_status != "accepted":
            raise ArtifactValidationError("Deterministic hackathon layouts failed validation")

        reference, reference_attempts = await self._generate_reference(
            run,
            plan_artifact=plan_artifact,
            stage_run_id=image_stage_run_id,
        )
        accepted_images: dict[str, AcceptedImage] = {}
        attempts = list(reference_attempts)
        spent = self._known_cost(attempts)
        image_budget = min(2.0, float(run.budget["max_image_cost_usd"]))
        for page in script_set.pages:
            for panel in page.panels:
                image, panel_attempts = await self._generate_panel(
                    run,
                    plan_artifact=plan_artifact,
                    page=page,
                    panel_id=panel.panel_id,
                    story_beat=panel.story_beat,
                    stage_run_id=image_stage_run_id,
                    reference=reference,
                    already_spent=spent,
                    image_budget=image_budget,
                )
                accepted_images[panel.panel_id] = image
                attempts.extend(panel_attempts)
                spent = self._known_cost(attempts)

        pages, rendered_artifacts = await self._render_pages(
            run,
            planning=planning,
            thumbnail_set=thumbnail_set,
            accepted_images=accepted_images,
            composition_stage_run_id=composition_stage_run_id,
        )
        book = await self._book_for_run(run)
        text_cost = sum(
            float(item.model_receipt.get("cost_usd") or 0)
            for item in (plan_artifact, script_artifact)
            if item.model_receipt is not None
        )
        rejected_count = sum(
            1
            for item in attempts
            if item.content is not None and item.content.get("status") == "rejected"
        )
        accepted_count = sum(
            1
            for item in attempts
            if item.content is not None and item.content.get("status") == "accepted"
        )
        attempt_ids = [item.artifact_id for item in attempts]
        image_asset_artifact_ids = [
            str(item.content["validation_report_ids"][0])
            for item in attempts
            if item.content is not None
            and isinstance(item.content.get("validation_report_ids"), list)
            and len(item.content["validation_report_ids"]) == 1
        ]
        receipt_ids = [
            str(item.content["receipt_id"])
            for item in attempts
            if item.content is not None and isinstance(item.content.get("receipt_id"), str)
        ]
        if len(image_asset_artifact_ids) != len(attempts) or len(receipt_ids) != len(attempts):
            raise ArtifactValidationError("Image attempt lineage is incomplete")
        panel_asset_ids = [
            accepted_images[panel.panel_id].asset.asset_id
            for page in script_set.pages
            for panel in page.panels
        ]
        edition = MangaEditionService.draft(
            book_id=book.book_id,
            project_id=run.project_id,
            run_id=run.run_id,
            scope_id=run.scope_id,
            title=f"{book.title}: Pages 1-15 Demo",
            pages=pages,
            plan_artifact_id=plan_artifact.artifact_id,
            script_artifact_id=script_artifact.artifact_id,
            thumbnail_artifact_id=planning.thumbnail_artifact.artifact_id,
            character_reference_artifact_id=reference.asset_artifact.artifact_id,
            character_reference_attempt_id=reference.attempt_artifact.artifact_id,
            character_reference_asset_id=reference.asset.asset_id,
            panel_asset_ids=panel_asset_ids,
            image_attempt_artifact_ids=attempt_ids,
            image_asset_artifact_ids=image_asset_artifact_ids,
            receipt_artifact_ids=receipt_ids,
            image_provider="openrouter",
            image_model=self._image_model,
            renderer_version=HACKATHON_RENDERER_VERSION,
            implementation_version=str(
                plan_artifact.validation_report.get("implementation_version")
                or "agentic-manga-edition.v1"
            ),
            parent_edition_id=parent_edition_id,
            text_cost_usd=text_cost,
            image_cost_usd=spent,
            accepted_panel_images=len(panel_asset_ids),
            accepted_image_attempts=accepted_count,
            rejected_image_attempts=rejected_count,
        )
        source_refs = self._unique_source_refs(script_artifact.source_refs)
        edition_artifact = await self._editions.persist(
            edition,
            stage_run_id=composition_stage_run_id,
            parent_artifact_ids=self._unique_ids([
                plan_artifact.artifact_id,
                script_artifact.artifact_id,
                planning.thumbnail_artifact.artifact_id,
                reference.asset_artifact.artifact_id,
                reference.attempt_artifact.artifact_id,
                *attempt_ids,
                *image_asset_artifact_ids,
                *receipt_ids,
                *[item.artifact_id for item in rendered_artifacts],
            ]),
            source_refs=source_refs,
        )
        return EditionProductionResult(
            edition_artifact=edition_artifact,
            edition=edition,
            planning=planning,
            rendered_page_artifacts=tuple(rendered_artifacts),
            image_attempt_artifacts=tuple(attempts),
        )

    def _thumbnail_set(
        self,
        script_artifact: ArtifactDoc,
        script_set: PageScriptSet,
    ) -> ThumbnailSet:
        plans: list[MangaPagePlan] = []
        for page in script_set.pages:
            first, second = page.panels
            if page.page_index % 2 == 0:
                layout = SplitLayoutNode(
                    kind="split",
                    node_id=f"split_page_{page.page_index}",
                    axis="y",
                    ratios=[0.58, 0.42] if page.page_index % 4 == 0 else [0.42, 0.58],
                    gutter=SplitGutter(value=0.012),
                    angle_deg=-4 if page.page_index in {2, 6} else 0,
                    children=[
                        PanelLayoutNode(
                            kind="panel",
                            node_id=f"node_{first.panel_id}",
                            panel_id=first.panel_id,
                        ),
                        PanelLayoutNode(
                            kind="panel",
                            node_id=f"node_{second.panel_id}",
                            panel_id=second.panel_id,
                        ),
                    ],
                )
            else:
                layout = SplitLayoutNode(
                    kind="split",
                    node_id=f"split_page_{page.page_index}",
                    axis="x",
                    ratios=[0.46, 0.54] if page.page_index % 4 == 1 else [0.6, 0.4],
                    gutter=SplitGutter(value=0.012),
                    angle_deg=3 if page.page_index in {3, 7} else 0,
                    children=[
                        PanelLayoutNode(
                            kind="panel",
                            node_id=f"node_{second.panel_id}",
                            panel_id=second.panel_id,
                        ),
                        PanelLayoutNode(
                            kind="panel",
                            node_id=f"node_{first.panel_id}",
                            panel_id=first.panel_id,
                        ),
                    ],
                )
            plans.append(
                MangaPagePlan(
                    schema_version="manga-page-plan.v1",
                    page_plan_id=f"page_plan_{page.page_id}",
                    project_id=script_set.project_id,
                    script_set_artifact_id=script_artifact.artifact_id,
                    canvas=PageCanvas(
                        width_px=1200,
                        height_px=1800,
                        trim={"x": 0.03, "y": 0.02, "width": 0.94, "height": 0.96},
                        safe={"x": 0.06, "y": 0.05, "width": 0.88, "height": 0.9},
                        bleed_pct=0.02,
                    ),
                    reading_direction="rtl",
                    page_script=page,
                    layout_root=layout,
                    reading_edges=[
                        ReadingEdge(
                            from_panel_id=first.panel_id,
                            to_panel_id=second.panel_id,
                            reason="question then consequence",
                        )
                    ],
                    source_fact_ids=sorted(
                        {
                            fact_id
                            for panel in page.panels
                            for fact_id in panel.source_fact_ids
                        }
                    ),
                )
            )
        return ThumbnailSet(
            schema_version="thumbnail-set.v1",
            thumbnail_set_id=f"thumbnail_hackathon_{script_artifact.content_hash[:20]}",
            project_id=script_set.project_id,
            script_set_artifact_id=script_artifact.artifact_id,
            page_plans=plans,
        )

    async def _generate_reference(
        self,
        run: GenerationRunDoc,
        *,
        plan_artifact: ArtifactDoc,
        stage_run_id: str,
    ) -> tuple[AcceptedImage, tuple[ArtifactDoc, ...]]:
        prompt = (
            f"Create the immutable character and style reference for a manga adaptation. "
            f"{CHARACTER_DESCRIPTION} {STYLE_DESCRIPTION} Show one waist-up three-quarter "
            "portrait on a plain white background. Neutral thoughtful expression. No border, "
            "no title, no caption, no speech balloon, no symbols, no letters, no numbers, no "
            "watermark, no signature, no typography anywhere."
        )
        return await self._generate_until_text_free(
            run,
            plan_artifact=plan_artifact,
            panel_id="character_kai_reference",
            purpose="character_reference",
            prompt=prompt,
            stage_run_id=stage_run_id,
            reference_images=[],
            reference_asset_ids=[],
            already_spent=0,
            image_budget=min(2.0, float(run.budget["max_image_cost_usd"])),
        )

    async def _generate_panel(
        self,
        run: GenerationRunDoc,
        *,
        plan_artifact: ArtifactDoc,
        page: PageScript,
        panel_id: str,
        story_beat: str,
        stage_run_id: str,
        reference: AcceptedImage,
        already_spent: float,
        image_budget: float,
    ) -> tuple[AcceptedImage, tuple[ArtifactDoc, ...]]:
        panel = next(item for item in page.panels if item.panel_id == panel_id)
        camera = panel.camera
        prompt = (
            f"Use the supplied image as the binding character and ink-style reference. "
            f"Depict this panel: {story_beat}. {CHARACTER_DESCRIPTION} Keep Kai's face, white "
            f"forelock, round glasses, jacket, age, and body proportions identical to the "
            f"reference. Camera: {camera.shot}, {camera.angle} angle, "
            f"{camera.movement or 'static'}. "
            f"{STYLE_DESCRIPTION} Compose a self-contained manga panel with deliberate empty "
            "space near the upper corners for later deterministic lettering. Do not render any "
            "dialogue, caption, heading, SFX, title, logo, sign, UI text, letters, numbers, "
            "watermark, signature, or pseudo-writing. The image layer must contain art only."
        )
        return await self._generate_until_text_free(
            run,
            plan_artifact=plan_artifact,
            panel_id=panel_id,
            purpose="panel",
            prompt=prompt,
            stage_run_id=stage_run_id,
            reference_images=[(reference.content, reference.asset.mime_type)],
            reference_asset_ids=[reference.asset.asset_id],
            already_spent=already_spent,
            image_budget=image_budget,
        )

    async def _generate_until_text_free(
        self,
        run: GenerationRunDoc,
        *,
        plan_artifact: ArtifactDoc,
        panel_id: str,
        purpose: str,
        prompt: str,
        stage_run_id: str,
        reference_images: list[tuple[bytes, str]],
        reference_asset_ids: list[str],
        already_spent: float,
        image_budget: float,
    ) -> tuple[AcceptedImage, tuple[ArtifactDoc, ...]]:
        if self._image_provider is None or not hasattr(
            self._image_provider,
            "generate_with_references",
        ):
            raise ArtifactValidationError(
                "Reference-capable OpenRouter image generation is required"
            )
        attempts = await self._existing_image_attempts(
            run.run_id,
            panel_id=panel_id,
            purpose=purpose,
        )
        accepted_attempt = next(
            (
                item
                for item in attempts
                if item.content is not None and item.content.get("status") == "accepted"
            ),
            None,
        )
        if accepted_attempt is not None:
            return await self._rehydrate_image(accepted_attempt), tuple(attempts)
        max_attempts = 3 if purpose == "character_reference" else 2
        if len(attempts) >= max_attempts:
            raise ArtifactValidationError(
                f"Image {panel_id} exhausted its bounded validation attempts"
            )
        previous_image: tuple[bytes, str] | None = None
        previous_asset_id: str | None = None
        if attempts:
            previous = await self._rehydrate_image(attempts[-1])
            previous_image = (previous.content, previous.asset.mime_type)
            previous_asset_id = previous.asset.asset_id
        for attempt_number in range(len(attempts) + 1, max_attempts + 1):
            if already_spent + self._known_cost(attempts) + 0.08 > image_budget:
                raise ImageBudgetError("The next bounded image attempt may exceed the $2 ceiling")
            attempt_prompt = prompt
            refs = list(reference_images)
            if previous_image is not None:
                attempt_prompt = (
                    f"Edit the second reference to remove every text-like mark while preserving "
                    f"the exact scene and the first reference character. {prompt}"
                )
                refs.append(previous_image)
            attempt_reference_ids = list(reference_asset_ids)
            if previous_asset_id is not None:
                attempt_reference_ids.append(previous_asset_id)
            result = await self._image_provider.generate_with_references(
                prompt=attempt_prompt,
                model=self._image_model,
                aspect_ratio="2:3",
                reference_images=refs,
            )
            if result.provider != "openrouter" or result.model != self._image_model:
                raise ArtifactValidationError(
                    "Image provider returned output outside the pinned OpenRouter model"
                )
            if result.cost_usd is None:
                raise ArtifactValidationError(
                    "OpenRouter image response omitted exact cost provenance"
                )
            normalized = self._normalize_png(result.content)
            ocr_text = await self._ocr(normalized)
            accepted = not self._has_visible_text(ocr_text)
            image = await self._persist_image_attempt(
                run,
                plan_artifact=plan_artifact,
                panel_id=panel_id,
                purpose=purpose,
                prompt=attempt_prompt,
                stage_run_id=stage_run_id,
                attempt_number=attempt_number,
                result=result,
                content=normalized,
                reference_asset_ids=attempt_reference_ids,
                accepted=accepted,
                ocr_text=ocr_text,
            )
            attempts.append(image.attempt_artifact)
            if accepted:
                return image, tuple(attempts)
            previous_image = (normalized, "image/png")
            previous_asset_id = image.asset.asset_id
        raise ArtifactValidationError(
            f"Image {panel_id} still contains generated text after bounded validation"
        )

    async def _persist_image_attempt(
        self,
        run: GenerationRunDoc,
        *,
        plan_artifact: ArtifactDoc,
        panel_id: str,
        purpose: str,
        prompt: str,
        stage_run_id: str,
        attempt_number: int,
        result: GeneratedImage,
        content: bytes,
        reference_asset_ids: list[str],
        accepted: bool,
        ocr_text: str,
    ) -> AcceptedImage:
        file_hash = binary_content_hash(content)
        asset_id = f"asset_{purpose}_{file_hash[:24]}"
        request_hash = content_hash(
            {
                "panel_id": panel_id,
                "purpose": purpose,
                "prompt": prompt,
                "model": result.model,
                "attempt": attempt_number,
                "reference_asset_ids": reference_asset_ids,
            }
        )
        receipt = ModelReceipt(
            provider=result.provider,
            model=result.model,
            purpose=f"{purpose}_image_generation",
            prompt_version=HACKATHON_IMAGE_PROMPT_VERSION,
            skill_hashes=[],
            input_artifact_ids=[plan_artifact.artifact_id],
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            cost_usd=result.cost_usd,
            latency_ms=result.latency_ms,
            attempt=attempt_number,
            created_at=utc_now(),
        )
        receipt_payload = receipt.model_dump(mode="json")
        receipt_digest = content_hash(receipt_payload)
        receipt_id = f"receipt_{receipt_digest[:24]}"
        receipt_artifact = construct_document(
            ArtifactDoc,
            artifact_id=receipt_id,
            project_id=run.project_id,
            run_id=run.run_id,
            stage_run_id=stage_run_id,
            kind="render_receipt",
            schema_version="model-receipt.v1",
            content=receipt_payload,
            storage_ref=None,
            content_hash=receipt_digest,
            parent_artifact_ids=[plan_artifact.artifact_id],
            author="system",
            supersedes_artifact_id=None,
            source_refs=[],
            model_receipt=None,
            validation_status="accepted",
            validation_report={
                "passed": True,
                "issues": [],
                "validator_version": "model-receipt-validator.v1",
            },
            created_at=utc_now(),
        )
        await self._repositories.save_artifact(receipt_artifact)
        storage_ref = f"storage://generated/{run.project_id}/{file_hash}.png"
        self._persist_media(file_hash, "png", content)
        asset = AssetRef(
            asset_id=asset_id,
            project_id=run.project_id,
            asset_type="character_sprite" if purpose == "character_reference" else "key_panel",
            content_hash=file_hash,
            storage_ref=storage_ref,
            mime_type="image/png",
            width=result.width,
            height=result.height,
            duration_ms=None,
            model_receipt=receipt,
        )
        asset_artifact = construct_document(
            ArtifactDoc,
            artifact_id=f"image_asset_{file_hash[:24]}",
            project_id=run.project_id,
            run_id=run.run_id,
            stage_run_id=stage_run_id,
            kind="image_asset",
            schema_version="image-asset.v1",
            content={
                "schema_version": "image-asset.v1",
                "asset": asset.model_dump(mode="json"),
                "panel_id": panel_id,
            },
            storage_ref=None,
            content_hash=content_hash(asset.model_dump(mode="json")),
            parent_artifact_ids=[plan_artifact.artifact_id, receipt_id],
            author="system",
            supersedes_artifact_id=None,
            source_refs=[],
            model_receipt=receipt_payload,
            validation_status="accepted" if accepted else "rejected",
            validation_report={
                "passed": accepted,
                "issues": []
                if accepted
                else [
                    {
                        "code": "image_generated_text",
                        "message": f"OCR found generated text: {ocr_text[:120]}",
                    }
                ],
                "validator_version": "image-text-layer-validator.v1",
            },
            created_at=utc_now(),
        )
        stored_asset = await self._repositories.save_artifact(asset_artifact)
        attempt = ImageAttempt(
            schema_version="image-attempt.v1",
            attempt_id=f"image_attempt_{request_hash[:24]}",
            panel_id=panel_id,
            purpose=cast(
                Literal["panel", "character_reference", "environment", "prop", "texture"],
                purpose,
            ),
            provider=result.provider,
            model=result.model,
            prompt_snapshot=prompt,
            negative_prompt=(
                "text, letters, numbers, headings, dialogue, captions, SFX, logos, watermarks"
            ),
            reference_asset_ids=reference_asset_ids,
            parameters={"aspect_ratio": "2:3", "output_format": "png"},
            seed=None,
            request_hash=request_hash,
            provider_response_id=None,
            output_asset_id=asset_id,
            receipt_id=receipt_id,
            cost_usd=result.cost_usd,
            status="accepted" if accepted else "rejected",
            validation_report_ids=[stored_asset.artifact_id],
            revision_instruction=(
                None if accepted else "Remove all generated text from image layer."
            ),
            created_at=utc_now(),
        )
        attempt_payload = attempt.model_dump(mode="json")
        attempt_artifact = construct_document(
            ArtifactDoc,
            artifact_id=attempt.attempt_id,
            project_id=run.project_id,
            run_id=run.run_id,
            stage_run_id=stage_run_id,
            kind="image_attempt",
            schema_version="image-attempt.v1",
            content=attempt_payload,
            storage_ref=None,
            content_hash=content_hash(attempt_payload),
            parent_artifact_ids=[plan_artifact.artifact_id, stored_asset.artifact_id, receipt_id],
            author="system",
            supersedes_artifact_id=None,
            source_refs=[],
            model_receipt=receipt_payload,
            validation_status="accepted" if accepted else "rejected",
            validation_report=stored_asset.validation_report,
            created_at=utc_now(),
        )
        stored_attempt = await self._repositories.save_artifact(attempt_artifact)
        return AcceptedImage(
            asset=asset,
            asset_artifact=stored_asset,
            attempt_artifact=stored_attempt,
            content=content,
        )

    async def _existing_image_attempts(
        self,
        run_id: str,
        *,
        panel_id: str,
        purpose: str,
    ) -> list[ArtifactDoc]:
        attempts = [
            item
            for item in await self._repositories.list_artifacts(
                run_id,
                accepted_only=False,
            )
            if item.kind == "image_attempt"
            and item.content is not None
            and item.content.get("panel_id") == panel_id
            and item.content.get("purpose") == purpose
        ]
        return sorted(
            attempts,
            key=lambda item: (
                int(item.content.get("attempt", 0))
                if item.content is not None
                else 0,
                item.created_at,
                item.artifact_id,
            ),
        )

    async def _rehydrate_image(self, attempt_artifact: ArtifactDoc) -> AcceptedImage:
        if attempt_artifact.content is None:
            raise ArtifactValidationError("Persisted image attempt has no content")
        validation_ids = attempt_artifact.content.get("validation_report_ids")
        if (
            not isinstance(validation_ids, list)
            or len(validation_ids) != 1
            or not isinstance(validation_ids[0], str)
        ):
            raise ArtifactValidationError("Persisted image attempt has no image asset lineage")
        asset_artifact = await self._repositories.get_artifact(validation_ids[0])
        if asset_artifact is None or asset_artifact.content is None:
            raise ArtifactValidationError("Persisted image attempt asset is unavailable")
        raw_asset = asset_artifact.content.get("asset")
        if not isinstance(raw_asset, dict):
            raise ArtifactValidationError("Persisted image asset content is invalid")
        asset = AssetRef.model_validate(raw_asset)
        media_path = self._media_root / f"{asset.content_hash}.png"
        if not media_path.is_file():
            raise ArtifactValidationError("Persisted accepted image bytes are unavailable")
        content = media_path.read_bytes()
        if binary_content_hash(content) != asset.content_hash:
            raise ArtifactValidationError("Persisted image bytes fail their content hash")
        return AcceptedImage(
            asset=asset,
            asset_artifact=asset_artifact,
            attempt_artifact=attempt_artifact,
            content=content,
        )

    async def _render_pages(
        self,
        run: GenerationRunDoc,
        *,
        planning: ThumbnailPlanningResult,
        thumbnail_set: ThumbnailSet,
        accepted_images: dict[str, AcceptedImage],
        composition_stage_run_id: str,
    ) -> tuple[list[EditionPage], list[ArtifactDoc]]:
        edition_pages: list[EditionPage] = []
        rendered_artifacts: list[ArtifactDoc] = []
        for plan in thumbnail_set.page_plans:
            layout = compile_page_layout(plan)
            svg = self._render_svg(plan, layout, accepted_images)
            svg_bytes = svg.encode("utf-8")
            svg_hash = binary_content_hash(svg_bytes)
            self._persist_media(svg_hash, "svg", svg_bytes)
            svg_asset_id = f"asset_page_svg_{svg_hash[:24]}"
            svg_artifact = self._storage_artifact(
                run,
                artifact_id=svg_asset_id,
                kind="page_composition",
                schema_version="composed-page-svg.v1",
                storage_ref=f"storage://generated/{run.project_id}/{svg_hash}.svg",
                content_hash_value=svg_hash,
                stage_run_id=composition_stage_run_id,
                parents=[planning.thumbnail_artifact.artifact_id],
            )
            await self._repositories.save_artifact(svg_artifact)
            png = self._rasterize(svg_bytes, width=1200, height=1800)
            png_hash = binary_content_hash(png)
            self._persist_media(png_hash, "png", png)
            raster_asset_id = f"asset_page_png_{png_hash[:24]}"
            raster_artifact = self._storage_artifact(
                run,
                artifact_id=raster_asset_id,
                kind="rendered_page",
                schema_version="rendered-page-raster.v1",
                storage_ref=f"storage://generated/{run.project_id}/{png_hash}.png",
                content_hash_value=png_hash,
                stage_run_id=composition_stage_run_id,
                parents=[svg_asset_id],
            )
            await self._repositories.save_artifact(raster_artifact)
            rendered_page = RenderedPageV2(
                schema_version="rendered-page.v2",
                page_plan=plan,
                compiled_layout=layout,
                panels=[
                    RenderedPanelV2(
                        panel_id=panel.panel_id,
                        clip_path=next(
                            geometry.clip_path
                            for geometry in layout.panels
                            if geometry.panel_id == panel.panel_id
                        ),
                        visual_asset_ids=[accepted_images[panel.panel_id].asset.asset_id],
                        text_ids=[
                            item.text_id
                            for item in plan.page_script.text_elements
                            if item.panel_id == panel.panel_id
                        ],
                    )
                    for panel in plan.page_script.panels
                ],
                canonical_svg_asset_id=svg_asset_id,
                raster_asset_ids=[raster_asset_id],
                accessible_text=plan.page_script.text_elements,
            )
            payload = rendered_page.model_dump(mode="json")
            digest = content_hash(payload)
            page_artifact = construct_document(
                ArtifactDoc,
                artifact_id=f"rendered_page_{digest[:24]}",
                project_id=run.project_id,
                run_id=run.run_id,
                stage_run_id=composition_stage_run_id,
                kind="rendered_page",
                schema_version="rendered-page.v2",
                content=payload,
                storage_ref=None,
                content_hash=digest,
                parent_artifact_ids=[
                    planning.thumbnail_artifact.artifact_id,
                    svg_asset_id,
                    raster_asset_id,
                    *[
                        accepted_images[panel.panel_id].attempt_artifact.artifact_id
                        for panel in plan.page_script.panels
                    ],
                ],
                author="system",
                supersedes_artifact_id=None,
                source_refs=self._source_refs_for_page(plan.page_script),
                model_receipt=None,
                validation_status="accepted",
                validation_report={
                    "passed": True,
                    "issues": [],
                    "validator_version": HACKATHON_RENDERER_VERSION,
                },
                created_at=utc_now(),
            )
            stored = await self._repositories.save_artifact(page_artifact)
            rendered_artifacts.append(stored)
            edition_pages.append(
                EditionPage(
                    page_index=plan.page_script.page_index,
                    page_id=plan.page_script.page_id,
                    rendered_page_artifact_id=stored.artifact_id,
                    raster_asset_id=raster_asset_id,
                    content_hash=png_hash,
                    width=1200,
                    height=1800,
                )
            )
        return edition_pages, rendered_artifacts

    def _render_svg(
        self,
        plan: MangaPagePlan,
        layout: CompiledPageLayout,
        accepted_images: dict[str, AcceptedImage],
    ) -> str:
        width, height = 1200, 1800
        parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}">',
            '<rect width="1200" height="1800" fill="#f7f5ef"/>',
            "<defs>",
        ]
        for geometry in layout.panels:
            box = geometry.bbox
            x, y = round(box.x * width), round(box.y * height)
            w, h = round(box.width * width), round(box.height * height)
            parts.append(
                f'<clipPath id="clip-{html.escape(geometry.panel_id)}"><rect '
                f'x="{x}" y="{y}" width="{w}" height="{h}"/></clipPath>'
            )
        parts.append("</defs>")
        for geometry in sorted(layout.panels, key=lambda item: item.z_index):
            box = geometry.bbox
            x, y = round(box.x * width), round(box.y * height)
            w, h = round(box.width * width), round(box.height * height)
            image = accepted_images[geometry.panel_id]
            encoded = base64.b64encode(image.content).decode("ascii")
            parts.append(
                f'<image x="{x}" y="{y}" width="{w}" height="{h}" '
                f'preserveAspectRatio="xMidYMid slice" '
                f'clip-path="url(#clip-{html.escape(geometry.panel_id)})" '
                f'href="data:image/png;base64,{encoded}"/>'
            )
            parts.append(
                f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" '
                'stroke="#171513" stroke-width="12"/>'
            )
        geometry_by_panel = {item.panel_id: item for item in layout.panels}
        for text in plan.page_script.text_elements:
            parts.extend(self._text_svg(text, geometry_by_panel[text.panel_id], width, height))
        parts.append(
            f'<text x="1140" y="1750" text-anchor="end" font-family="Arial,sans-serif" '
            f'font-size="26" font-weight="700" fill="#171513">'
            f'{plan.page_script.page_index + 1}</text>'
        )
        parts.append("</svg>")
        return "".join(parts)

    @staticmethod
    def _text_svg(
        text: TextElement,
        geometry: object,
        width: int,
        height: int,
    ) -> list[str]:
        del geometry
        region = text.preferred_region
        x = round(region.x * width)
        y = round(region.y * height)
        w = max(150, round(region.width * width))
        h = max(90, round(region.height * height))
        font_size = max(28, min(44, int(text.typography.max_px)))
        lines = HackathonMangaService._wrap_text(text.content, max(10, int(w / (font_size * 0.56))))
        line_height = int(font_size * 1.14)
        while len(lines) * line_height > h - 30 and font_size > 24:
            font_size -= 2
            line_height = int(font_size * 1.14)
            lines = HackathonMangaService._wrap_text(
                text.content,
                max(10, int(w / (font_size * 0.56))),
            )
        escaped_lines = [html.escape(line) for line in lines]
        parts: list[str] = []
        if text.kind == "sfx":
            parts.append(
                f'<text x="{x + w // 2}" y="{y + h // 2}" text-anchor="middle" '
                f'font-family="Arial Black,Arial,sans-serif" font-size="{font_size + 14}" '
                'font-weight="900" fill="#171513" stroke="#f7f5ef" stroke-width="7" '
                f'paint-order="stroke">{escaped_lines[0]}</text>'
            )
            return parts
        if text.kind == "narration":
            parts.append(
                f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" '
                'fill="#171513" stroke="#f7f5ef" stroke-width="5"/>'
            )
            color = "#f7f5ef"
        else:
            parts.append(
                f'<ellipse cx="{x + w // 2}" cy="{y + h // 2}" rx="{w // 2}" '
                f'ry="{h // 2}" fill="#fffdf8" stroke="#171513" stroke-width="7"/>'
            )
            color = "#171513"
        total_height = len(escaped_lines) * line_height
        start_y = y + max(font_size, (h - total_height) // 2 + font_size)
        for index, line in enumerate(escaped_lines):
            parts.append(
                f'<text x="{x + w // 2}" y="{start_y + index * line_height}" '
                f'text-anchor="middle" font-family="Arial,sans-serif" font-size="{font_size}" '
                f'font-weight="700" fill="{color}">{line}</text>'
            )
        return parts

    @staticmethod
    def _wrap_text(value: str, limit: int) -> list[str]:
        words = value.split()
        lines: list[str] = []
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if current and len(candidate) > limit:
                lines.append(current)
                current = word
            else:
                current = candidate
        if current:
            lines.append(current)
        return lines or [""]

    @staticmethod
    def _rasterize(svg: bytes, *, width: int, height: int) -> bytes:
        document = pymupdf.open(stream=svg, filetype="svg")
        try:
            page = document[0]
            matrix = pymupdf.Matrix(width / page.rect.width, height / page.rect.height)
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            return cast(bytes, pixmap.tobytes("png"))
        finally:
            document.close()

    @staticmethod
    def _normalize_png(content: bytes) -> bytes:
        pixmap = pymupdf.Pixmap(content)
        return cast(bytes, pixmap.tobytes("png"))

    async def _ocr(self, content: bytes) -> str:
        def run() -> str:
            with tempfile.NamedTemporaryFile(suffix=".png") as image_file:
                image_file.write(content)
                image_file.flush()
                completed = subprocess.run(
                    ["tesseract", image_file.name, "stdout", "--psm", "11"],
                    check=False,
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                return completed.stdout.strip()

        return await asyncio.to_thread(run)

    @staticmethod
    def _has_visible_text(ocr_text: str) -> bool:
        # Manga hatching and glasses routinely make Tesseract emit isolated
        # glyph fragments. A contiguous word-like token is materially stronger
        # evidence than summing unrelated specks across the image.
        return any(len(token) >= 4 for token in re.findall(r"[A-Za-z0-9]+", ocr_text))

    def _persist_media(self, digest: str, extension: str, content: bytes) -> None:
        self._media_root.mkdir(parents=True, exist_ok=True)
        target = self._media_root / f"{digest}.{extension}"
        if target.exists():
            if target.read_bytes() != content:
                raise ArtifactValidationError("Artifact storage hash collision")
            return
        temporary = self._media_root / f".{digest}.{extension}.tmp"
        temporary.write_bytes(content)
        temporary.replace(target)

    @staticmethod
    def _storage_artifact(
        run: GenerationRunDoc,
        *,
        artifact_id: str,
        kind: str,
        schema_version: str,
        storage_ref: str,
        content_hash_value: str,
        stage_run_id: str,
        parents: list[str],
    ) -> ArtifactDoc:
        return construct_document(
            ArtifactDoc,
            artifact_id=artifact_id,
            project_id=run.project_id,
            run_id=run.run_id,
            stage_run_id=stage_run_id,
            kind=kind,
            schema_version=schema_version,
            content=None,
            storage_ref=storage_ref,
            content_hash=content_hash_value,
            parent_artifact_ids=parents,
            author="system",
            supersedes_artifact_id=None,
            source_refs=[],
            model_receipt=None,
            validation_status="accepted",
            validation_report={
                "passed": True,
                "issues": [],
                "validator_version": HACKATHON_RENDERER_VERSION,
            },
            created_at=utc_now(),
        )

    async def _book_for_run(self, run: GenerationRunDoc) -> BookDoc:
        project = await self._repositories.get_project(run.project_id)
        if project is None:
            raise ArtifactValidationError("Edition project is missing")
        book = await self._repositories.get_book(project.book_id)
        if book is None:
            raise ArtifactValidationError("Edition book is missing")
        return book

    @staticmethod
    def _known_cost(attempts: list[ArtifactDoc] | tuple[ArtifactDoc, ...]) -> float:
        return sum(
            float(item.model_receipt.get("cost_usd") or 0)
            for item in attempts
            if item.model_receipt is not None
        )

    @staticmethod
    def _source_refs_for_page(page: PageScript) -> list[dict[str, object]]:
        return HackathonMangaService._unique_source_refs(
            [
                ref.model_dump(mode="json")
                for panel in page.panels
                for ref in panel.source_refs
            ]
        )

    @staticmethod
    def _unique_ids(values: list[str]) -> list[str]:
        return list(dict.fromkeys(values))

    @staticmethod
    def _unique_source_refs(refs: list[dict[str, object]]) -> list[dict[str, object]]:
        unique = {content_hash(ref): ref for ref in refs}
        return [unique[key] for key in sorted(unique)]
