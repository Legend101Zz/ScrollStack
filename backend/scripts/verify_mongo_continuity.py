"""Seed or verify the two-process Mongo continuity proof.

Run ``seed`` and ``verify`` as separate commands against the same empty test
database. The second process reconstructs ContextPack solely from Mongo-backed
source, scope, project, memory, and artifact records.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse

import pymupdf

from app.contracts.context import GenerationConstraints, MemoryDelta
from app.contracts.source import PageRange
from app.persistence.documents import ArtifactDoc, ScopeManifestDoc, construct_document
from app.persistence.mongo import initialize_mongo
from app.persistence.repositories import BeanieRepositories
from app.services.context_compiler import ContextCompiler
from app.services.hashing import content_hash
from app.services.memory import MemoryMergeService
from app.services.pdf_ingestion import PdfIngestionService
from app.services.projects import MangaProjectService
from app.services.scopes import ScopeService

NOW = datetime(2026, 7, 20, 12, 0, tzinfo=UTC)


def golden_pdf() -> bytes:
    document = pymupdf.open()
    for page_number in range(1, 21):
        page = document.new_page()
        if page_number <= 10:
            text = (
                f"Page {page_number}. Mara follows the Wake Light across the drowned harbor. "
                "The observatory stairs appear only at low tide."
            )
        else:
            text = (
                f"Page {page_number}. Mara enters the observatory after hearing three knocks. "
                "The sealed lens room holds the source of the signal."
            )
        page.insert_text((72, 72), text)
    payload = bytes(document.tobytes())
    document.close()
    return payload


async def seed(mongo_uri: str, media_root: Path) -> dict[str, object]:
    parsed_uri = urlparse(mongo_uri)
    client = await initialize_mongo(
        mongo_uri, parsed_uri.path.lstrip("/") or "scrollstack_continuity"
    )
    try:
        repositories = BeanieRepositories()
        uploaded = await PdfIngestionService(
            repositories,
            repositories,
            media_root=media_root,
        ).register_upload(
            filename="scrollstack-golden-continuity.pdf",
            content=golden_pdf(),
            owner_id="golden_user",
        )
        project, _ = await MangaProjectService(repositories, repositories).create(
            uploaded.book.book_id, owner_id="golden_user"
        )
        scopes = ScopeService(repositories, repositories, repositories)
        first = await scopes.create(
            project_id=project.project_id,
            book_id=uploaded.book.book_id,
            page_ranges=[PageRange(page_start=1, page_end=10)],
            selection_label="golden-pages-1-10",
            created_by="golden_user",
            created_at=NOW,
        )
        second = await scopes.create(
            project_id=project.project_id,
            book_id=uploaded.book.book_id,
            page_ranges=[PageRange(page_start=11, page_end=20)],
            selection_label="golden-pages-11-20",
            created_by="golden_user",
            created_at=NOW,
        )
        first_unit_id = first.source_unit_ids[0]
        first_unit = await repositories.get_source_unit(
            uploaded.book.book_id, first_unit_id
        )
        if first_unit is None:
            raise RuntimeError("first source unit was not persisted")
        source_ref = {
            "book_id": first_unit.book_id,
            "source_unit_id": first_unit.source_unit_id,
            "page_start": first_unit.page_start,
            "page_end": first_unit.page_end,
            "text_hash": first_unit.text_hash,
        }
        accepted = construct_document(
            ArtifactDoc,
            artifact_id="golden_accepted_scope_1",
            project_id=project.project_id,
            run_id="golden_run_1",
            kind="manga_plan",
            schema_version="manga-plan.v1",
            content={"accepted": True, "scope_id": first.scope_id},
            storage_ref=None,
            content_hash=content_hash(
                {"accepted": True, "scope_id": first.scope_id}
            ),
            parent_artifact_ids=[],
            source_refs=[source_ref],
            model_receipt=None,
            validation_status="accepted",
            validation_report={
                "passed": True,
                "issues": [],
                "validator_version": "golden-seed.v1",
            },
            created_at=NOW,
        )
        await repositories.save_artifact(accepted)
        delta = MemoryDelta.model_validate(
            {
                "schema_version": "memory-delta.v1",
                "project_id": project.project_id,
                "base_memory_version": 0,
                "new_facts": [
                    {
                        "fact_id": "fact_low_tide",
                        "claim": "The observatory stairs appear only at low tide.",
                        "source_refs": [source_ref],
                        "confidence": 1,
                    }
                ],
                "fact_corrections": [],
                "character_state_updates": [
                    {
                        "character_id": "mara",
                        "state_patch": {
                            "display_name": "Mara",
                            "current_state": "Mara reached the sealed lens-room door.",
                            "visual_asset_ids": [],
                        },
                        "source_refs": [source_ref],
                    }
                ],
                "terminology_updates": [
                    {
                        "term": "wake light",
                        "canonical_form": "Wake Light",
                        "meaning": "The observatory signal above the harbor.",
                        "source_refs": [source_ref],
                    }
                ],
                "continuity_updates": [
                    {
                        "key": "previous_slice_ending",
                        "value": "Mara hears three knocks inside the sealed lens room.",
                        "source_refs": [source_ref],
                    }
                ],
                "coverage_additions": [
                    {
                        "source_unit_id": first_unit.source_unit_id,
                        "beat_ids": ["beat_000"],
                        "coverage_status": "covered",
                    }
                ],
                "unresolved_thread_updates": [
                    {
                        "thread_id": "three_knocks",
                        "summary": "The source of the knocks is unknown.",
                        "status": "open",
                        "source_refs": [source_ref],
                    }
                ],
                "source_artifact_ids": [accepted.artifact_id],
            }
        )
        memory = await MemoryMergeService(
            repositories, repositories, repositories
        ).merge(delta)
        return {
            "phase": "seed",
            "book_id": uploaded.book.book_id,
            "project_id": project.project_id,
            "first_scope_id": first.scope_id,
            "second_scope_id": second.scope_id,
            "memory_version": memory.memory_version,
        }
    finally:
        await client.close()


async def verify(mongo_uri: str) -> dict[str, object]:
    parsed_uri = urlparse(mongo_uri)
    client = await initialize_mongo(
        mongo_uri, parsed_uri.path.lstrip("/") or "scrollstack_continuity"
    )
    try:
        repositories = BeanieRepositories()
        projects = await repositories.list_books("golden_user")
        if len(projects) != 1:
            raise RuntimeError("golden book is missing or duplicated")
        book = projects[0]
        scopes = await repositories.list_scopes(book.book_id)
        second = next(
            item for item in scopes if item.selection_label == "golden-pages-11-20"
        )
        project_id = second.project_id
        project = await repositories.get_project(project_id)
        if project is None or project.active_memory_version != 1:
            raise RuntimeError("active memory version was not durably advanced")
        memory = await repositories.get_memory_snapshot(project_id, 1)
        if memory is None:
            raise RuntimeError("version-one memory snapshot is missing")
        context = ContextCompiler().compile(
            project_id=project_id,
            scope=second,
            memory=memory,
            source_units=await repositories.list_source_units(book.book_id),
            purpose="manga_direction",
            constraints=GenerationConstraints(
                image_mode="budgeted",
                max_pages=10,
                max_panels_per_page=7,
                max_sprites=8,
                max_key_panels=2,
                reading_direction="rtl",
                narration_enabled=False,
            ),
            max_input_tokens=80_000,
            required_fact_ids={"fact_low_tide"},
        )
        if {item.source_ref.page_start for item in context.source_units} != set(
            range(11, 21)
        ):
            raise RuntimeError("second scope did not rebuild the selected source pages")
        if context.continuity.previous_slice_ending != (
            "Mara hears three knocks inside the sealed lens room."
        ):
            raise RuntimeError("previous accepted ending did not survive restart")
        if context.continuity.character_state[0].display_name != "Mara":
            raise RuntimeError("character continuity did not survive restart")
        if context.book_canon.terminology[0].canonical_form != "Wake Light":
            raise RuntimeError("terminology did not survive restart")
        if context.book_canon.facts[0].fact_id != "fact_low_tide":
            raise RuntimeError("grounded fact did not survive restart")
        return {
            "phase": "verify",
            "project_id": project_id,
            "scope_id": second.scope_id,
            "memory_version": context.memory_version,
            "context_pack_id": context.context_pack_id,
            "context_hash": context.content_hash,
            "included_source_ids": context.compilation.included_source_ids,
        }
    finally:
        await client.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=["seed", "verify"])
    parser.add_argument("--mongo-uri", required=True)
    parser.add_argument("--media-root", type=Path, default=Path("storage"))
    args = parser.parse_args()
    if args.phase == "seed":
        result = asyncio.run(seed(args.mongo_uri, args.media_root))
    else:
        result = asyncio.run(verify(args.mongo_uri))
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
