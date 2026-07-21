"""Run a bounded, lineage-preserving OpenRouter image preview experiment."""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from urllib.parse import urlparse

from app.persistence.documents import (
    ArtifactDoc,
    GenerationRunDoc,
    StageRunDoc,
    construct_document,
    utc_now,
)
from app.persistence.mongo import initialize_mongo
from app.persistence.repositories import BeanieRepositories
from app.services.hashing import content_hash
from app.services.image_generation import (
    APPROVED_OPENROUTER_IMAGE_MODEL,
    OpenRouterImageGenerator,
)
from app.services.manga_production import GeneratedAssetSet, MangaProductionService

SOURCE_RUN_ID = "run_ebed09f2e5e514d4c61c21d0"
SOURCE_PLAN_ID = "manga_plan_06df7e114aed01809f8b724c"
SOURCE_SCRIPT_ID = "accepted_page_script_set_3d885fc1000adf4d12f8d221"
SOURCE_THUMBNAIL_ID = "accepted_thumbnail_set_8f7540b3765fbcc3799630a3"
PROJECT_ID = "project_25e6d9eefa7e174f89d88810"
SCOPE_ID = "scope_a93d4dfa9fe9aac6035d7792"
IMAGE_COUNT = 2
IMAGE_BUDGET_USD = 2.0


async def main() -> None:
    mongo_uri = os.environ["MONGODB_URI"]
    database_name = urlparse(mongo_uri).path.lstrip("/") or "scrollstack"
    client = await initialize_mongo(mongo_uri, database_name)
    try:
        repositories = BeanieRepositories()
        source_plan = await repositories.get_artifact(SOURCE_PLAN_ID)
        if (
            source_plan is None
            or source_plan.run_id != SOURCE_RUN_ID
            or source_plan.project_id != PROJECT_ID
            or source_plan.kind != "manga_plan"
            or source_plan.validation_status != "accepted"
            or source_plan.content is None
        ):
            raise RuntimeError("Accepted source MangaPlan is unavailable")

        identity = content_hash(
            {
                "source_plan_id": SOURCE_PLAN_ID,
                "source_plan_hash": source_plan.content_hash,
                "source_script_id": SOURCE_SCRIPT_ID,
                "source_thumbnail_id": SOURCE_THUMBNAIL_ID,
                "model": APPROVED_OPENROUTER_IMAGE_MODEL,
                "image_count": IMAGE_COUNT,
            }
        )
        run_id = f"run_phase2_preview_{identity[:24]}"
        basis_stage_id = f"stage_phase2_basis_{identity[:20]}"
        image_stage_id = f"stage_asset_generation_{identity[:20]}"
        basis_plan_id = f"manga_plan_phase2_basis_{identity[:24]}"
        run = await repositories.get_run(run_id)
        if run is None:
            now = utc_now()
            run = construct_document(
                GenerationRunDoc,
                run_id=run_id,
                project_id=PROJECT_ID,
                scope_id=SCOPE_ID,
                requested_outputs=["manga"],
                pipeline_version="manga-page-dsl.v2-openrouter-preview",
                memory_version=0,
                status="running",
                active_stage="asset_generation",
                budget={
                    "max_text_cost_usd": 0.0,
                    "max_image_cost_usd": IMAGE_BUDGET_USD,
                    "max_render_minutes": 5.0,
                    "max_agent_steps": 0,
                    "max_repair_attempts": 0,
                    "max_sprites": 0,
                    "max_key_panels": IMAGE_COUNT,
                    "max_reels": 0,
                },
                created_by="user-authorized-phase2-preview-20260721",
                idempotency_key=identity,
                created_at=now,
                updated_at=now,
            )
            await repositories.save_run(run)

        basis_plan = await repositories.get_artifact(basis_plan_id)
        if basis_plan is None:
            basis_plan = construct_document(
                ArtifactDoc,
                artifact_id=basis_plan_id,
                project_id=PROJECT_ID,
                run_id=run_id,
                stage_run_id=basis_stage_id,
                kind="manga_plan",
                schema_version="manga-plan.v1",
                content=source_plan.content,
                storage_ref=None,
                content_hash=source_plan.content_hash,
                parent_artifact_ids=[SOURCE_PLAN_ID, SOURCE_SCRIPT_ID, SOURCE_THUMBNAIL_ID],
                author="system",
                supersedes_artifact_id=None,
                source_refs=source_plan.source_refs,
                model_receipt=source_plan.model_receipt,
                validation_status="accepted",
                validation_report={
                    "passed": True,
                    "issues": [],
                    "validator_version": "phase2-preview-basis.v1",
                },
                created_at=utc_now(),
            )
            basis_plan = await repositories.save_artifact(basis_plan)

        basis_stage = await repositories.get_stage(basis_stage_id)
        if basis_stage is None:
            now = utc_now()
            basis_stage = construct_document(
                StageRunDoc,
                stage_run_id=basis_stage_id,
                run_id=run_id,
                stage_name="phase2_basis",
                attempt=1,
                status="succeeded",
                input_artifact_ids=[SOURCE_PLAN_ID, SOURCE_SCRIPT_ID, SOURCE_THUMBNAIL_ID],
                input_hash=source_plan.content_hash,
                output_artifact_ids=[basis_plan_id],
                idempotency_key=content_hash({"identity": identity, "stage": "basis"}),
                agent_session_id=None,
                error_code=None,
                error_detail=None,
                started_at=now,
                ended_at=now,
            )
            await repositories.save_stage(basis_stage)

        image_stage = await repositories.get_stage(image_stage_id)
        if image_stage is None:
            image_stage = construct_document(
                StageRunDoc,
                stage_run_id=image_stage_id,
                run_id=run_id,
                stage_name="asset_generation",
                attempt=1,
                status="running",
                input_artifact_ids=[basis_plan_id],
                input_hash=source_plan.content_hash,
                output_artifact_ids=[],
                idempotency_key=content_hash({"identity": identity, "stage": "images"}),
                agent_session_id=None,
                error_code=None,
                error_detail=None,
                started_at=utc_now(),
                ended_at=None,
            )
            await repositories.save_stage(image_stage)

        if image_stage.status != "succeeded":
            run.status = "running"
            run.active_stage = "asset_generation"
            run.updated_at = utc_now()
            await repositories.save_run(run)
            production = MangaProductionService(
                repositories,
                image_provider=OpenRouterImageGenerator(os.environ["OPENROUTER_API_KEY"]),
                media_root=Path(os.environ.get("MEDIA_ROOT", "/data/media")),
                image_model=APPROVED_OPENROUTER_IMAGE_MODEL,
                max_reserved_cost_per_asset_usd=1.0,
            )
            try:
                asset_set_artifact = await production.generate_assets(
                    run,
                    basis_plan,
                    attempt=image_stage.attempt,
                    stage_run_id=image_stage_id,
                )
            except Exception as error:
                now = utc_now()
                image_stage.status = "retryable_failed"
                image_stage.error_code = str(getattr(error, "code", "image_preview_failed")).upper()
                image_stage.error_detail = {"message": str(error)}
                image_stage.ended_at = now
                run.status = "retryable_failed"
                run.active_stage = None
                run.updated_at = now
                await repositories.save_stage(image_stage)
                await repositories.save_run(run)
                raise
            now = utc_now()
            image_stage.status = "succeeded"
            image_stage.output_artifact_ids = [asset_set_artifact.artifact_id]
            image_stage.error_code = None
            image_stage.error_detail = None
            image_stage.ended_at = now
            run.status = "succeeded"
            run.active_stage = None
            run.updated_at = now
            await repositories.save_stage(image_stage)
            await repositories.save_run(run)

        artifacts = await repositories.list_artifacts(run_id, accepted_only=False)
        asset_sets = [
            artifact
            for artifact in artifacts
            if artifact.schema_version == "asset-set.v1" and artifact.content is not None
        ]
        if len(asset_sets) != 1:
            raise RuntimeError("Expected exactly one accepted Phase 2 preview asset set")
        asset_set = GeneratedAssetSet.model_validate(asset_sets[0].content)
        output = {
            "run_id": run_id,
            "stage_run_id": image_stage_id,
            "basis_plan_artifact_id": basis_plan_id,
            "asset_set_artifact_id": asset_sets[0].artifact_id,
            "source_artifact_ids": [SOURCE_PLAN_ID, SOURCE_SCRIPT_ID, SOURCE_THUMBNAIL_ID],
            "provider": asset_set.image_provider,
            "model": asset_set.image_model,
            "total_cost_usd": asset_set.total_cost_usd,
            "images": [
                {
                    "asset_id": asset.asset_id,
                    "storage_ref": asset.storage_ref,
                    "content_hash": asset.content_hash,
                    "mime_type": asset.mime_type,
                    "width": asset.width,
                    "height": asset.height,
                    "receipt": asset.model_receipt.model_dump(mode="json")
                    if asset.model_receipt is not None
                    else None,
                }
                for asset in asset_set.assets
            ],
        }
        print(json.dumps(output, indent=2))
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
