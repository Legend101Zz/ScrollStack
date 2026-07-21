from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Coroutine, TypeVar

import pymupdf
import pytest
from fastapi.testclient import TestClient

from app.container import build_services
from app.contracts.context import AgentGoalType, GenerationConstraints, MemoryDelta
from app.contracts.manga import MangaPagePlan, PageScriptSet, ThumbnailSet
from app.contracts.source import PageRange
from app.main import create_app
from app.persistence.documents import (
    ArtifactDoc,
    GenerationRunDoc,
    StageRunDoc,
    construct_document,
)
from app.persistence.repositories import InMemoryRepositories
from app.services.agent_worker import AgentExecutionResult, AgentWorkerError
from app.services.context_compiler import ContextCompiler
from app.services.domain_tools import DomainToolRequest, MangaDirectorToolService
from app.services.errors import InvalidPdfError, InvalidScopeError, NotFoundError, PdfLimitError
from app.services.generation_workflow import GenerationWorkflowService
from app.services.image_generation import GeneratedImage, ImageGenerationError
from app.services.memory import MemoryMergeService
from app.services.page_domain_tools import MangaDomainToolService
from app.services.pdf_ingestion import PdfIngestionService
from app.services.projects import MangaProjectService
from app.services.scopes import ScopeService

T = TypeVar("T")
NOW = datetime(2026, 7, 20, 12, 0, tzinfo=UTC)


def resolve(coroutine: Coroutine[Any, Any, T]) -> T:
    return asyncio.run(coroutine)


def golden_pdf(page_count: int = 20) -> bytes:
    document = pymupdf.open()
    for page_number in range(1, page_count + 1):
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
    payload = document.tobytes()
    document.close()
    return bytes(payload)


def golden_png() -> bytes:
    document = pymupdf.open()
    page = document.new_page(width=400, height=600)
    page.draw_rect((20, 20, 380, 580), color=(0, 0, 0), width=8)
    page.insert_text((60, 280), "ORIGINAL MANGA PANEL", fontsize=20)
    payload = page.get_pixmap().tobytes("png")
    document.close()
    return bytes(payload)


def encrypted_pdf() -> bytes:
    document = pymupdf.open()
    page = document.new_page()
    page.insert_text((72, 72), "encrypted source")
    payload = document.tobytes(
        encryption=pymupdf.PDF_ENCRYPT_AES_256,
        owner_pw="owner-secret",
        user_pw="reader-secret",
    )
    document.close()
    return bytes(payload)


def constraints() -> GenerationConstraints:
    return GenerationConstraints(
        image_mode="budgeted",
        max_pages=10,
        max_panels_per_page=7,
        max_sprites=8,
        max_key_panels=2,
        reading_direction="rtl",
        narration_enabled=False,
    )


def plan_for(context: Any) -> dict[str, Any]:
    beats = []
    required_fact_ids = [fact.fact_id for fact in context.book_canon.facts]
    for sequence, source_unit in enumerate(context.source_units):
        source_ref = source_unit.source_ref.model_dump(mode="json")
        beats.append(
            {
                "beat_id": f"beat_{sequence:03d}",
                "sequence": sequence,
                "source_refs": [source_ref],
                "required_fact_ids": required_fact_ids if sequence == 0 else [],
                "narrative_purpose": "reveal"
                if sequence == len(context.source_units) - 1
                else "setup",
                "book_essence": (
                    f"Selected page {source_ref['page_start']} advances the observatory signal."
                ),
                "dramatization": (
                    f"Mara follows page {source_ref['page_start']} toward the lens room."
                ),
                "character_intent": [
                    {
                        "character_id": "mara",
                        "intent": "Identify the source of the signal.",
                        "emotional_state": "resolute",
                    }
                ],
                "visual_intent": ["Hold on the clue before the reveal."],
                "must_preserve": ["The observatory evidence remains source-grounded."],
                "may_compress": [],
                "confidence": 1,
            }
        )
    return {
        "schema_version": "manga-plan.v1",
        "plan_id": f"plan_{context.scope_id}",
        "project_id": context.project_id,
        "scope_id": context.scope_id,
        "context_pack_id": context.context_pack_id,
        "memory_version": context.memory_version,
        "title": "The Last Observatory",
        "summary": "Mara follows the signal into the sealed observatory.",
        "target_page_count": min(8, len(beats)),
        "beats": beats,
        "character_state_updates": [],
        "terminology_updates": [],
        "new_facts": [],
        "ending_state": "Mara opens the sealed lens-room door.",
        "unresolved_thread_updates": [],
    }


def seed_pdf_project(
    repository: InMemoryRepositories, media_root: Path
) -> tuple[str, str, str, str]:
    ingestion = PdfIngestionService(
        repository,
        repository,
        media_root=media_root,
    )
    uploaded = resolve(
        ingestion.register_upload(
            filename="last-observatory.pdf",
            content=golden_pdf(),
            owner_id="user_1",
        )
    )
    project, created = resolve(
        MangaProjectService(repository, repository).create(uploaded.book.book_id, owner_id="user_1")
    )
    assert created is True
    scopes = ScopeService(repository, repository, repository)
    first = resolve(
        scopes.create(
            project_id=project.project_id,
            book_id=uploaded.book.book_id,
            page_ranges=[PageRange(page_start=1, page_end=10)],
            selection_label="Pages 1-10",
            created_by="user_1",
            created_at=NOW,
        )
    )
    second = resolve(
        scopes.create(
            project_id=project.project_id,
            book_id=uploaded.book.book_id,
            page_ranges=[PageRange(page_start=11, page_end=20)],
            selection_label="Pages 11-20",
            created_by="user_1",
            created_at=NOW,
        )
    )
    return uploaded.book.book_id, project.project_id, first.scope_id, second.scope_id


def test_pdf_ingestion_is_hash_idempotent_and_exposes_stable_page_units(
    tmp_path: Path,
) -> None:
    repository = InMemoryRepositories()
    service = PdfIngestionService(repository, repository, media_root=tmp_path)
    payload = golden_pdf()

    first = resolve(
        service.register_upload(
            filename="../Last_Observatory.pdf",
            content=payload,
            owner_id="user_1",
        )
    )
    second = resolve(
        service.register_upload(
            filename="renamed.pdf",
            content=payload,
            owner_id="user_1",
        )
    )
    units = resolve(service.list_source_units(first.book.book_id))

    assert first.book.status == "parsed"
    assert first.book.total_pages == 20
    assert first.book.original_filename == "Last_Observatory.pdf"
    assert second.is_cached is True
    assert second.book.book_id == first.book.book_id
    assert len(units) == 20
    assert units[0].source_unit_id.startswith("page_00001_")
    assert units[-1].page_start == 20
    assert (tmp_path / "books" / first.book.book_id / "source.pdf").read_bytes() == payload


def test_pdf_ingestion_rejects_non_pdf_malformed_encrypted_and_oversized_input(
    tmp_path: Path,
) -> None:
    repository = InMemoryRepositories()
    service = PdfIngestionService(
        repository,
        repository,
        media_root=tmp_path,
        max_upload_bytes=128,
    )

    with pytest.raises(InvalidPdfError, match="Only PDF files"):
        resolve(
            service.register_upload(
                filename="notes.txt",
                content=b"plain text",
                owner_id="user_1",
            )
        )
    with pytest.raises(InvalidPdfError, match="malformed or unsupported"):
        resolve(
            service.register_upload(
                filename="malformed.pdf",
                content=b"%PDF-1.7\nnot-a-real-pdf",
                owner_id="user_1",
            )
        )
    encrypted = encrypted_pdf()
    with pytest.raises(PdfLimitError, match="maximum is 128"):
        resolve(
            service.register_upload(
                filename="encrypted.pdf",
                content=encrypted,
                owner_id="user_1",
            )
        )

    encrypted_service = PdfIngestionService(
        repository,
        repository,
        media_root=tmp_path,
        max_upload_bytes=len(encrypted) + 1,
    )
    with pytest.raises(InvalidPdfError, match="Encrypted PDFs"):
        resolve(
            encrypted_service.register_upload(
                filename="encrypted.pdf",
                content=encrypted,
                owner_id="user_1",
            )
        )


def test_scope_rejects_page_range_outside_parsed_source(tmp_path: Path) -> None:
    repository = InMemoryRepositories()
    book_id, project_id, _first_scope_id, _second_scope_id = seed_pdf_project(
        repository,
        tmp_path,
    )

    with pytest.raises(InvalidScopeError, match="overlap"):
        resolve(
            ScopeService(repository, repository, repository).create(
                project_id=project_id,
                book_id=book_id,
                page_ranges=[PageRange(page_start=21, page_end=25)],
                selection_label="Outside book",
                created_by="user_1",
            )
        )


def test_two_scope_context_rebuilds_accepted_continuity_without_chat(
    tmp_path: Path,
) -> None:
    repository = InMemoryRepositories()
    book_id, project_id, first_scope_id, second_scope_id = seed_pdf_project(repository, tmp_path)
    first_unit = resolve(repository.list_source_units(book_id))[0]
    source_ref = {
        "book_id": book_id,
        "source_unit_id": first_unit.source_unit_id,
        "page_start": first_unit.page_start,
        "page_end": first_unit.page_end,
        "text_hash": first_unit.text_hash,
    }
    repository.artifacts["accepted_scope_1"] = construct_document(
        ArtifactDoc,
        artifact_id="accepted_scope_1",
        project_id=project_id,
        run_id="run_scope_1",
        kind="manga_plan",
        schema_version="manga-plan.v1",
        content={"accepted": True},
        storage_ref=None,
        content_hash="c" * 64,
        parent_artifact_ids=[],
        source_refs=[source_ref],
        model_receipt=None,
        validation_status="accepted",
        validation_report={"passed": True, "issues": [], "validator_version": "test.v1"},
        created_at=NOW,
    )
    delta = MemoryDelta.model_validate(
        {
            "schema_version": "memory-delta.v1",
            "project_id": project_id,
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
                        "current_state": "Mara has reached the sealed lens-room door.",
                        "visual_asset_ids": [],
                    },
                    "source_refs": [source_ref],
                }
            ],
            "terminology_updates": [
                {
                    "term": "wake light",
                    "canonical_form": "Wake Light",
                    "meaning": "The observatory signal visible above the harbor.",
                    "source_refs": [source_ref],
                }
            ],
            "continuity_updates": [
                {
                    "key": "previous_slice_ending",
                    "value": "Mara hears three knocks from inside the sealed lens room.",
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
                    "summary": "The source of the knocks remains unknown.",
                    "status": "open",
                    "source_refs": [source_ref],
                }
            ],
            "source_artifact_ids": ["accepted_scope_1"],
        }
    )
    merged = resolve(MemoryMergeService(repository, repository, repository).merge(delta))

    fresh = InMemoryRepositories()
    fresh.source_units = {
        key: value.model_copy(deep=True) for key, value in repository.source_units.items()
    }
    fresh.scopes[second_scope_id] = repository.scopes[second_scope_id].model_copy(deep=True)
    fresh.projects[project_id] = repository.projects[project_id].model_copy(deep=True)
    fresh.memory_snapshots[(project_id, 1)] = merged.model_copy(deep=True)

    context = ContextCompiler().compile(
        project_id=project_id,
        scope=fresh.scopes[second_scope_id],
        memory=fresh.memory_snapshots[(project_id, 1)],
        source_units=resolve(fresh.list_source_units(book_id)),
        purpose="manga_direction",
        constraints=constraints(),
        max_input_tokens=80_000,
        required_fact_ids={"fact_low_tide"},
    )

    assert first_scope_id != second_scope_id
    assert {unit.source_ref.page_start for unit in context.source_units} == set(range(11, 21))
    assert context.continuity.previous_slice_ending == (
        "Mara hears three knocks from inside the sealed lens room."
    )
    assert context.continuity.character_state[0].display_name == "Mara"
    assert context.book_canon.terminology[0].canonical_form == "Wake Light"
    assert context.book_canon.facts[0].fact_id == "fact_low_tide"
    assert context.memory_version == 1


class BrokeredFakeAgent:
    def __init__(self, tools: MangaDirectorToolService) -> None:
        self.tools = tools
        self.calls = 0

    async def run(
        self,
        goal: Any,
        context: Any,
        *,
        instructions: str | None = None,
    ) -> AgentExecutionResult:
        del instructions
        self.calls += 1
        plan = plan_for(context)
        await self.tools.execute(
            "submit_manga_plan",
            DomainToolRequest.model_validate(
                {
                    "arguments": {"plan": plan},
                    "scope": {
                        "correlation_id": goal.goal_id,
                        "goal_id": goal.goal_id,
                        "run_id": goal.run_id,
                        "stage_run_id": goal.stage_run_id,
                        "context_pack_id": context.context_pack_id,
                        "project_id": context.project_id,
                    },
                }
            ),
        )
        return AgentExecutionResult(
            candidate=plan,
            trace={
                "session_id": "session_1",
                "provider": "minimax",
                "model": "MiniMax-M2.7-highspeed",
                "skill_hash": "d" * 64,
                "tokens": {"input": 200, "output": 100, "total": 300},
                "cost_usd": 0.01,
                "latency_ms": 50,
            },
        )


class BrokeredV2FakeAgent:
    def __init__(
        self,
        repository: InMemoryRepositories,
        *,
        media_root: Path,
        fail_thumbnail_once: bool = False,
    ) -> None:
        self.repository = repository
        self.tools = MangaDomainToolService(repository, repository, media_root=media_root)
        self.fail_thumbnail_once = fail_thumbnail_once
        self.goal_calls: list[AgentGoalType] = []

    async def run(
        self,
        goal: Any,
        context: Any,
        *,
        instructions: str | None = None,
    ) -> AgentExecutionResult:
        del instructions
        self.goal_calls.append(goal.goal_type)
        if goal.goal_type == AgentGoalType.MANGA_DIRECTION:
            candidate = plan_for(context)
            tool_name = "submit_manga_plan"
            arguments = {"plan": candidate}
        elif goal.goal_type == AgentGoalType.MANGA_PAGE_WRITING:
            plan_ref = next(
                item for item in context.parent_artifacts if item.kind.value == "manga_plan"
            )
            plan_artifact = await self.repository.get_artifact(plan_ref.artifact_id)
            assert plan_artifact is not None and plan_artifact.content is not None
            candidate = self._script_candidate(
                plan_artifact.content,
                plan_artifact_id=plan_artifact.artifact_id,
                context_pack_id=context.context_pack_id,
            )
            tool_name = "submit_page_script_set"
            arguments = {"script_set": candidate}
        elif goal.goal_type == AgentGoalType.MANGA_THUMBNAIL:
            if self.fail_thumbnail_once:
                self.fail_thumbnail_once = False
                raise AgentWorkerError("synthetic thumbnail worker interruption")
            script_ref = next(
                item for item in context.parent_artifacts if item.kind.value == "page_script_set"
            )
            script_artifact = await self.repository.get_artifact(script_ref.artifact_id)
            assert script_artifact is not None and script_artifact.content is not None
            candidate = self._thumbnail_candidate(
                script_artifact.content,
                script_artifact_id=script_artifact.artifact_id,
            )
            tool_name = "submit_thumbnail_set"
            arguments = {"thumbnail_set": candidate}
        else:
            raise AssertionError(f"Unexpected goal type: {goal.goal_type}")

        await self.tools.execute(
            tool_name,
            DomainToolRequest.model_validate(
                {
                    "arguments": arguments,
                    "scope": {
                        "correlation_id": goal.goal_id,
                        "goal_id": goal.goal_id,
                        "run_id": goal.run_id,
                        "stage_run_id": goal.stage_run_id,
                        "context_pack_id": context.context_pack_id,
                        "project_id": context.project_id,
                    },
                }
            ),
        )
        call_index = len(self.goal_calls)
        return AgentExecutionResult(
            candidate=candidate,
            trace={
                "session_id": f"session_v2_{call_index}",
                "provider": "minimax",
                "model": "MiniMax-M2.7-highspeed",
                "skill_hash": str(call_index) * 64,
                "tokens": {
                    "input": 200 + call_index,
                    "output": 100 + call_index,
                    "total": 300 + 2 * call_index,
                },
                "cost_usd": 0.01 * call_index,
                "latency_ms": 50 + call_index,
            },
        )

    @staticmethod
    def _script_candidate(
        plan_payload: dict[str, Any],
        *,
        plan_artifact_id: str,
        context_pack_id: str,
    ) -> dict[str, Any]:
        beats = plan_payload["beats"][:4]
        pages: list[dict[str, Any]] = []
        for page_index in range(2):
            panels: list[dict[str, Any]] = []
            for panel_index in range(2):
                beat = beats[page_index * 2 + panel_index]
                panel_id = f"v2_p{page_index}_{panel_index}"
                panels.append(
                    {
                        "panel_id": panel_id,
                        "purpose": "setup" if panel_index == 0 else "payoff",
                        "story_beat": beat["dramatization"],
                        "importance": "medium" if panel_index == 0 else "page_turn",
                        "tempo": "hold" if page_index == 0 else "impact",
                        "camera": {
                            "shot": "wide" if panel_index == 0 else "close_up",
                            "angle": "eye" if page_index == 0 else "low",
                            "movement": "static",
                        },
                        "blocking": [],
                        "prop_refs": [],
                        "focal_regions": [],
                        "avoid_text_regions": [],
                        "motion": {"effects": []},
                        "source_refs": beat["source_refs"],
                        "source_fact_ids": beat["required_fact_ids"],
                    }
                )
            pages.append(
                {
                    "page_id": f"v2_page_{page_index}",
                    "page_index": page_index,
                    "page_kind": "standard",
                    "entry_state": f"Page {page_index} enters the selected source beat.",
                    "exit_state": f"Page {page_index} resolves into its page-turn beat.",
                    "page_turn_panel_id": panels[-1]["panel_id"],
                    "panels": panels,
                    "text_elements": [],
                }
            )
        return PageScriptSet.model_validate(
            {
                "schema_version": "page-script-set.v1",
                "script_set_id": "script_v2_test",
                "project_id": plan_payload["project_id"],
                "plan_artifact_id": plan_artifact_id,
                "context_pack_id": context_pack_id,
                "pages": pages,
            }
        ).model_dump(mode="json")

    @staticmethod
    def _thumbnail_candidate(
        script_payload: dict[str, Any],
        *,
        script_artifact_id: str,
    ) -> dict[str, Any]:
        script = PageScriptSet.model_validate(script_payload)
        canvas = {
            "width_px": 1600,
            "height_px": 2400,
            "trim": {"x": 0.03, "y": 0.02, "width": 0.94, "height": 0.96},
            "safe": {"x": 0.06, "y": 0.05, "width": 0.88, "height": 0.9},
            "bleed_pct": 0.02,
        }
        page_plans: list[MangaPagePlan] = []
        for page in script.pages:
            first, second = (panel.panel_id for panel in page.panels)
            layout_root: dict[str, Any]
            if page.page_index == 0:
                layout_root = {
                    "kind": "split",
                    "node_id": "v2_vertical_root",
                    "axis": "y",
                    "ratios": [0.4, 0.6],
                    "gutter": {"value": 0.012, "unit": "page_pct"},
                    "children": [
                        {"kind": "panel", "node_id": "v2_top", "panel_id": first},
                        {"kind": "panel", "node_id": "v2_bottom", "panel_id": second},
                    ],
                }
            else:
                layout_root = {
                    "kind": "split",
                    "node_id": "v2_horizontal_root",
                    "axis": "x",
                    "ratios": [0.45, 0.55],
                    "gutter": {"value": 0.012, "unit": "page_pct"},
                    "angle_deg": -6,
                    "children": [
                        {"kind": "panel", "node_id": "v2_left", "panel_id": second},
                        {"kind": "panel", "node_id": "v2_right", "panel_id": first},
                    ],
                }
            page_plans.append(
                MangaPagePlan.model_validate(
                    {
                        "schema_version": "manga-page-plan.v1",
                        "page_plan_id": f"v2_plan_{page.page_index}",
                        "project_id": script.project_id,
                        "script_set_artifact_id": script_artifact_id,
                        "canvas": canvas,
                        "reading_direction": "rtl",
                        "page_script": page.model_dump(mode="json"),
                        "layout_root": layout_root,
                        "reading_edges": [
                            {
                                "from_panel_id": first,
                                "to_panel_id": second,
                                "reason": "setup to page-turn payoff",
                            }
                        ],
                        "source_fact_ids": sorted(
                            {
                                fact_id
                                for panel in page.panels
                                for fact_id in panel.source_fact_ids
                            }
                        ),
                    }
                )
            )
        return ThumbnailSet(
            schema_version="thumbnail-set.v1",
            thumbnail_set_id="thumbnail_v2_test",
            project_id=script.project_id,
            script_set_artifact_id=script_artifact_id,
            page_plans=page_plans,
        ).model_dump(mode="json")


class FakeImageProvider:
    def __init__(self, *, fail: bool = False, cost_usd: float | None = 0.02) -> None:
        self.calls = 0
        self.fail = fail
        self.cost_usd = cost_usd

    async def generate(
        self,
        *,
        prompt: str,
        model: str,
        aspect_ratio: str,
    ) -> GeneratedImage:
        assert prompt
        assert model == "google/gemini-2.5-flash-image"
        assert aspect_ratio == "2:3"
        self.calls += 1
        if self.fail:
            raise ImageGenerationError("OpenRouter returned HTTP 503")
        return GeneratedImage(
            content=golden_png(),
            mime_type="image/png",
            width=400,
            height=600,
            provider="openrouter",
            model=model,
            input_tokens=120,
            output_tokens=80,
            cost_usd=self.cost_usd,
            latency_ms=75,
        )


class InvalidCandidateAgent:
    def __init__(self) -> None:
        self.calls = 0

    async def run(
        self,
        goal: Any,
        context: Any,
        *,
        instructions: str | None = None,
    ) -> AgentExecutionResult:
        del goal, context, instructions
        self.calls += 1
        return AgentExecutionResult(
            candidate={"schema_version": "manga-plan.v1", "unexpected": True},
            trace={
                "provider": "minimax",
                "model": "MiniMax-M2.7-highspeed",
                "skill_hash": "d" * 64,
                "tokens": {},
                "latency_ms": 10,
            },
        )


def generation_run(
    repository: InMemoryRepositories, project_id: str, scope_id: str
) -> GenerationRunDoc:
    run = construct_document(
        GenerationRunDoc,
        run_id="run_vertical_slice",
        project_id=project_id,
        scope_id=scope_id,
        requested_outputs=["manga"],
        pipeline_version="manga-pipeline.v1",
        memory_version=0,
        status="queued",
        active_stage=None,
        budget={
            "max_text_cost_usd": 3,
            "max_image_cost_usd": 8,
            "max_render_minutes": 5,
            "max_agent_steps": 20,
            "max_repair_attempts": 2,
            "max_sprites": 8,
            "max_key_panels": 2,
            "max_reels": 0,
        },
        created_by="user_1",
        idempotency_key="f" * 64,
        created_at=NOW,
        updated_at=NOW,
    )
    repository.runs[run.run_id] = run
    return run


def test_workflow_completes_accepted_pages_memory_and_is_idempotent(
    tmp_path: Path,
) -> None:
    repository = InMemoryRepositories()
    _book_id, project_id, first_scope_id, second_scope_id = seed_pdf_project(repository, tmp_path)
    run = generation_run(repository, project_id, first_scope_id)
    agent = BrokeredFakeAgent(MangaDirectorToolService(repository, repository))
    image_provider = FakeImageProvider()
    workflow = GenerationWorkflowService(
        repository,
        agent_worker=agent,
        agentic_enabled=True,
        image_provider=image_provider,
        media_root=tmp_path,
    )

    result = resolve(workflow.execute(run.run_id))
    repeated = resolve(workflow.execute(run.run_id))
    stages = resolve(repository.list_stages(run.run_id))
    accepted = resolve(repository.list_artifacts(run.run_id, accepted_only=True))

    assert result.status == "succeeded"
    assert result.error_code is None
    assert repeated == result
    assert agent.calls == 1
    assert image_provider.calls == 2
    assert {
        "context-pack.v1",
        "manga-plan.v1",
        "image-asset.v1",
        "asset-set.v1",
        "rendered-page.v1",
        "rendered-page-set.v1",
        "memory-delta.v1",
    }.issubset({item.schema_version for item in accepted})
    assert any(
        item.stage_name == "context_compilation" and item.status == "succeeded" for item in stages
    )
    assert any(
        item.stage_name == "manga_direction" and item.status == "succeeded" for item in stages
    )
    assert all(item.status == "succeeded" for item in stages)
    plan = next(item for item in accepted if item.kind == "manga_plan")
    assert plan.model_receipt is not None
    assert plan.model_receipt["provider"] == "minimax"
    assert plan.model_receipt["model"] == "MiniMax-M2.7-highspeed"
    assert plan.model_receipt["latency_ms"] == 50
    assert plan.model_receipt["attempt"] == 1
    assert plan.parent_artifact_ids[1].startswith("candidate_manga_plan_")
    assert repository.projects[project_id].active_memory_version == 1
    memory = repository.memory_snapshots[(project_id, 1)]
    assert len(memory.asset_index) == 2
    assert memory.continuity["previous_slice_ending"] == ("Mara opens the sealed lens-room door.")
    memory_delta_artifact = next(
        item for item in accepted if item.schema_version == "memory-delta.v1"
    )
    assert memory_delta_artifact.source_refs
    assert set(memory_delta_artifact.parent_artifact_ids).issubset(set(memory.source_artifact_ids))

    fresh = InMemoryRepositories()
    fresh.source_units = {
        key: value.model_copy(deep=True) for key, value in repository.source_units.items()
    }
    fresh.scopes[second_scope_id] = repository.scopes[second_scope_id].model_copy(deep=True)
    fresh.projects[project_id] = repository.projects[project_id].model_copy(deep=True)
    fresh.memory_snapshots[(project_id, 1)] = memory.model_copy(deep=True)
    continued_context = ContextCompiler().compile(
        project_id=project_id,
        scope=fresh.scopes[second_scope_id],
        memory=fresh.memory_snapshots[(project_id, 1)],
        source_units=resolve(fresh.list_source_units(_book_id)),
        purpose="manga_direction",
        constraints=constraints(),
        max_input_tokens=80_000,
    )
    assert continued_context.memory_version == 1
    assert continued_context.continuity.previous_slice_ending == (
        "Mara opens the sealed lens-room door."
    )
    assert len(continued_context.assets) == 2
    assert {item.source_ref.page_start for item in continued_context.source_units} == set(
        range(11, 21)
    )

    reader = resolve(
        build_services(repository, media_root=tmp_path).manga_reader.get(
            _book_id,
            project_id,
        )
    )
    assert reader.run_id == run.run_id
    assert reader.pages[0].schema_version == "rendered-page.v1"
    assert reader.assets[0].model_receipt is not None
    assert reader.assets[0].model_receipt.provider == "openrouter"

    client = TestClient(create_app(build_services(repository, media_root=tmp_path)))
    response = client.get(f"/books/{_book_id}/manga/{project_id}/reader")
    assert response.status_code == 200
    assert response.json()["schema_version"] == "manga-reader.v1"
    asset_url = response.json()["assets"][0]["url"]
    asset_response = client.get(asset_url)
    assert asset_response.status_code == 200
    assert asset_response.headers["cache-control"].endswith("immutable")
    assert asset_response.content == golden_png()

    rendered_page_artifact = next(
        item for item in repository.artifacts.values() if item.schema_version == "rendered-page.v1"
    )
    assert rendered_page_artifact.content is not None
    rendered_page_artifact.content["schema_version"] = "tampered-rendered-page.v1"
    corrupt_reader = client.get(f"/books/{_book_id}/manga/{project_id}/reader")
    assert corrupt_reader.status_code == 422
    assert corrupt_reader.json()["error"]["code"] == "artifact_validation_failed"


def test_v2_workflow_resumes_through_accepted_svg_previews_without_images(
    tmp_path: Path,
) -> None:
    repository = InMemoryRepositories()
    _book_id, project_id, scope_id, _ = seed_pdf_project(repository, tmp_path)
    run = generation_run(repository, project_id, scope_id)
    run.pipeline_version = "manga-page-dsl.v2"
    repository.runs[run.run_id] = run
    image_provider = FakeImageProvider()
    interrupted_agent = BrokeredV2FakeAgent(
        repository,
        media_root=tmp_path,
        fail_thumbnail_once=True,
    )

    first = resolve(
        GenerationWorkflowService(
            repository,
            agent_worker=interrupted_agent,
            agentic_enabled=True,
            image_provider=image_provider,
            media_root=tmp_path,
        ).execute(run.run_id)
    )

    assert first.status == "retryable_failed"
    assert first.error_code == "AGENT_WORKER_FAILED"
    assert interrupted_agent.goal_calls == [
        AgentGoalType.MANGA_DIRECTION,
        AgentGoalType.MANGA_PAGE_WRITING,
        AgentGoalType.MANGA_THUMBNAIL,
    ]

    resumed_agent = BrokeredV2FakeAgent(repository, media_root=tmp_path)
    fresh_workflow = GenerationWorkflowService(
        repository,
        agent_worker=resumed_agent,
        agentic_enabled=True,
        image_provider=image_provider,
        media_root=tmp_path,
    )
    resumed = resolve(fresh_workflow.execute(run.run_id))
    repeated = resolve(fresh_workflow.execute(run.run_id))
    artifacts = resolve(repository.list_artifacts(run.run_id, accepted_only=False))
    stages = resolve(repository.list_stages(run.run_id))

    assert resumed.status == "succeeded"
    assert repeated == resumed
    assert resumed_agent.goal_calls == [AgentGoalType.MANGA_THUMBNAIL]
    assert image_provider.calls == 0
    assert not any(
        artifact.kind in {"asset_request_set", "image_attempt", "image_asset", "asset_set"}
        for artifact in artifacts
    )
    contexts = [artifact for artifact in artifacts if artifact.kind == "context_pack"]
    context_purposes = {
        artifact.content["purpose"]
        for artifact in contexts
        if artifact.content is not None
    }
    assert context_purposes == {
        "manga_direction",
        "manga_page_writing",
        "manga_thumbnail",
    }
    planning_contexts = [
        artifact
        for artifact in contexts
        if artifact.content is not None
        and artifact.content["purpose"] in {"manga_page_writing", "manga_thumbnail"}
    ]
    assert all(artifact.parent_artifact_ids for artifact in planning_contexts)
    assert sum(artifact.kind == "compiled_layout" for artifact in artifacts) == 2
    assert sum(artifact.kind == "thumbnail_preview" for artifact in artifacts) == 2
    assert sum(artifact.kind == "validation_report" for artifact in artifacts) == 1
    accepted_script = next(
        artifact
        for artifact in artifacts
        if artifact.artifact_id.startswith("accepted_page_script_set_")
    )
    accepted_thumbnail = next(
        artifact
        for artifact in artifacts
        if artifact.artifact_id.startswith("accepted_thumbnail_set_")
    )
    assert accepted_script.model_receipt is not None
    assert accepted_thumbnail.model_receipt is not None
    assert accepted_script.model_receipt["model"] == "MiniMax-M2.7-highspeed"
    assert accepted_thumbnail.model_receipt["model"] == "MiniMax-M2.7-highspeed"
    assert all(
        stage.status == "succeeded"
        for stage in stages
        if stage.stage_name != "manga_thumbnail" or stage.attempt == 2
    )
    thumbnail_stage = next(stage for stage in stages if stage.stage_name == "manga_thumbnail")
    assert thumbnail_stage.status == "succeeded"
    assert thumbnail_stage.attempt == 2


def test_missing_image_credential_is_retryable_and_does_not_replay_manga_direction(
    tmp_path: Path,
) -> None:
    repository = InMemoryRepositories()
    book_id, project_id, scope_id, _ = seed_pdf_project(repository, tmp_path)
    run = generation_run(repository, project_id, scope_id)
    agent = BrokeredFakeAgent(MangaDirectorToolService(repository, repository))
    workflow = GenerationWorkflowService(
        repository,
        agent_worker=agent,
        agentic_enabled=True,
        image_provider=None,
        media_root=tmp_path,
    )

    first = resolve(workflow.execute(run.run_id))
    second = resolve(workflow.execute(run.run_id))

    assert first.status == second.status == "retryable_failed"
    assert first.error_code == second.error_code == "OPENROUTER_API_KEY_MISSING"
    assert agent.calls == 1
    assert not any(
        item.schema_version.startswith("rendered-page")
        for item in resolve(repository.list_artifacts(run.run_id, accepted_only=True))
    )
    with pytest.raises(NotFoundError, match="No accepted completed manga"):
        resolve(
            build_services(repository, media_root=tmp_path).manga_reader.get(
                book_id,
                project_id,
            )
        )


def test_image_provider_failure_is_typed_retryable(tmp_path: Path) -> None:
    repository = InMemoryRepositories()
    _book_id, project_id, scope_id, _ = seed_pdf_project(repository, tmp_path)
    run = generation_run(repository, project_id, scope_id)
    agent = BrokeredFakeAgent(MangaDirectorToolService(repository, repository))
    image_provider = FakeImageProvider(fail=True)

    workflow = GenerationWorkflowService(
        repository,
        agent_worker=agent,
        agentic_enabled=True,
        image_provider=image_provider,
        media_root=tmp_path,
    )
    first = resolve(workflow.execute(run.run_id))
    resolve(workflow.execute(run.run_id))
    third = resolve(workflow.execute(run.run_id))
    exhausted = resolve(workflow.execute(run.run_id))

    assert first.status == third.status == "retryable_failed"
    assert first.error_code == third.error_code == "IMAGE_PROVIDER_FAILED"
    assert exhausted.status == "terminal_failed"
    assert exhausted.error_code == "STAGE_RETRY_EXHAUSTED"
    assert agent.calls == 1
    assert image_provider.calls == 3


def test_image_generation_enforces_render_time_budget(tmp_path: Path) -> None:
    repository = InMemoryRepositories()
    _book_id, project_id, scope_id, _ = seed_pdf_project(repository, tmp_path)
    run = generation_run(repository, project_id, scope_id)
    run.budget["max_render_minutes"] = 0
    repository.runs[run.run_id] = run
    image_provider = FakeImageProvider()

    result = resolve(
        GenerationWorkflowService(
            repository,
            agent_worker=BrokeredFakeAgent(MangaDirectorToolService(repository, repository)),
            agentic_enabled=True,
            image_provider=image_provider,
            media_root=tmp_path,
        ).execute(run.run_id)
    )

    assert result.status == "retryable_failed"
    assert result.error_code == "RENDER_TIME_BUDGET_EXCEEDED"
    assert image_provider.calls == 0


def test_returned_image_cost_is_checked_before_asset_acceptance(tmp_path: Path) -> None:
    repository = InMemoryRepositories()
    _book_id, project_id, scope_id, _ = seed_pdf_project(repository, tmp_path)
    run = generation_run(repository, project_id, scope_id)
    run.budget["max_image_cost_usd"] = 2
    repository.runs[run.run_id] = run

    result = resolve(
        GenerationWorkflowService(
            repository,
            agent_worker=BrokeredFakeAgent(MangaDirectorToolService(repository, repository)),
            agentic_enabled=True,
            image_provider=FakeImageProvider(cost_usd=3),
            media_root=tmp_path,
        ).execute(run.run_id)
    )

    assert result.status == "terminal_failed"
    assert result.error_code == "IMAGE_BUDGET_EXCEEDED"
    assert not any(
        item.schema_version in {"image-asset.v1", "asset-set.v1"}
        for item in repository.artifacts.values()
    )


def test_invalid_manga_plan_is_never_accepted(tmp_path: Path) -> None:
    repository = InMemoryRepositories()
    _book_id, project_id, scope_id, _ = seed_pdf_project(repository, tmp_path)
    run = generation_run(repository, project_id, scope_id)
    agent = InvalidCandidateAgent()

    result = resolve(
        GenerationWorkflowService(
            repository,
            agent_worker=agent,
            agentic_enabled=True,
            image_provider=FakeImageProvider(),
            media_root=tmp_path,
        ).execute(run.run_id)
    )

    assert result.status == "retryable_failed"
    assert result.error_code == "ARTIFACT_VALIDATION_FAILED"
    assert agent.calls == 1
    assert not any(
        item.kind == "manga_plan" and item.validation_status == "accepted"
        for item in repository.artifacts.values()
    )


def test_missing_asset_prevents_rendered_page_acceptance(
    tmp_path: Path,
    monkeypatch: Any,
) -> None:
    repository = InMemoryRepositories()
    _book_id, project_id, scope_id, _ = seed_pdf_project(repository, tmp_path)
    run = generation_run(repository, project_id, scope_id)
    workflow = GenerationWorkflowService(
        repository,
        agent_worker=BrokeredFakeAgent(MangaDirectorToolService(repository, repository)),
        agentic_enabled=True,
        image_provider=FakeImageProvider(),
        media_root=tmp_path,
    )
    original = workflow._production._persist_immutable_asset

    def persist_then_remove(asset: Any, payload: bytes) -> None:
        original(asset, payload)
        workflow._production.resolve_storage_path(asset.storage_ref).unlink()

    monkeypatch.setattr(workflow._production, "_persist_immutable_asset", persist_then_remove)

    result = resolve(workflow.execute(run.run_id))

    assert result.status == "retryable_failed"
    assert result.error_code == "ARTIFACT_VALIDATION_FAILED"
    assert not any(
        item.schema_version.startswith("rendered-page") and item.validation_status == "accepted"
        for item in repository.artifacts.values()
    )


def test_domain_tools_require_service_auth_and_reject_cross_project_scope(
    tmp_path: Path, monkeypatch: Any
) -> None:
    repository = InMemoryRepositories()
    _book_id, project_id, first_scope_id, _second_scope_id = seed_pdf_project(repository, tmp_path)
    run = generation_run(repository, project_id, first_scope_id)
    run.status = "running"
    run.active_stage = "manga_direction"
    repository.runs[run.run_id] = run
    scope = repository.scopes[first_scope_id]
    memory = repository.memory_snapshots[(project_id, 0)]
    context = ContextCompiler().compile(
        project_id=project_id,
        scope=scope,
        memory=memory,
        source_units=resolve(repository.list_source_units(scope.book_id)),
        purpose="manga_direction",
        constraints=constraints(),
        max_input_tokens=80_000,
    )
    context_artifact = construct_document(
        ArtifactDoc,
        artifact_id=context.context_pack_id,
        project_id=project_id,
        run_id=run.run_id,
        kind="context_pack",
        schema_version="context-pack.v1",
        content=context.model_dump(mode="json"),
        storage_ref=None,
        content_hash=context.content_hash,
        parent_artifact_ids=[],
        source_refs=[item.source_ref.model_dump(mode="json") for item in context.source_units],
        model_receipt=None,
        validation_status="accepted",
        validation_report={
            "passed": True,
            "issues": [],
            "validator_version": "context-compiler.v1",
        },
        created_at=NOW,
    )
    repository.artifacts[context_artifact.artifact_id] = context_artifact
    stage = construct_document(
        StageRunDoc,
        stage_run_id="stage_manga_direction",
        run_id=run.run_id,
        stage_name="manga_direction",
        attempt=1,
        status="running",
        input_artifact_ids=[context_artifact.artifact_id],
        input_hash=context.content_hash,
        output_artifact_ids=[],
        idempotency_key="e" * 64,
        started_at=NOW,
    )
    repository.stages[stage.stage_run_id] = stage
    monkeypatch.setenv("DOMAIN_TOOL_BROKER_TOKEN", "test-domain-token-123456")
    client = TestClient(create_app(build_services(repository, media_root=tmp_path)))
    body = {
        "arguments": {"plan": plan_for(context)},
        "scope": {
            "correlation_id": "correlation_1",
            "goal_id": "goal_1",
            "run_id": run.run_id,
            "stage_run_id": stage.stage_run_id,
            "context_pack_id": context.context_pack_id,
            "project_id": project_id,
        },
    }

    assert client.post("/internal/v1/agent-tools/submit_manga_plan", json=body).status_code == 401
    cross_project = {**body, "scope": {**body["scope"], "project_id": "project_other"}}
    denied = client.post(
        "/internal/v1/agent-tools/submit_manga_plan",
        headers={"authorization": "Bearer test-domain-token-123456"},
        json=cross_project,
    )
    missing_source_plan = plan_for(context)
    missing_source_plan["beats"] = missing_source_plan["beats"][:-1]
    missing_source = client.post(
        "/internal/v1/agent-tools/submit_manga_plan",
        headers={"authorization": "Bearer test-domain-token-123456"},
        json={**body, "arguments": {"plan": missing_source_plan}},
    )
    unknown_fact_plan = plan_for(context)
    unknown_fact_plan["beats"][0]["required_fact_ids"] = ["fact_not_in_context"]
    unknown_fact = client.post(
        "/internal/v1/agent-tools/submit_manga_plan",
        headers={"authorization": "Bearer test-domain-token-123456"},
        json={**body, "arguments": {"plan": unknown_fact_plan}},
    )
    accepted = client.post(
        "/internal/v1/agent-tools/submit_manga_plan",
        headers={"authorization": "Bearer test-domain-token-123456"},
        json=body,
    )
    repository.stages[stage.stage_run_id].status = "succeeded"
    inactive = client.post(
        "/internal/v1/agent-tools/submit_manga_plan",
        headers={"authorization": "Bearer test-domain-token-123456"},
        json=body,
    )

    assert denied.status_code == 403
    assert missing_source.status_code == 422
    assert unknown_fact.status_code == 422
    assert accepted.status_code == 200
    assert inactive.status_code == 403
    candidate_id = accepted.json()["data"]["artifact_id"]
    assert repository.artifacts[candidate_id].validation_status == "valid"


def test_upload_and_project_http_path_is_live(tmp_path: Path) -> None:
    repository = InMemoryRepositories()
    client = TestClient(create_app(build_services(repository, media_root=tmp_path)))

    upload = client.post(
        "/upload",
        data={"owner_id": "user_1"},
        files={"file": ("golden.pdf", golden_pdf(2), "application/pdf")},
    )
    assert upload.status_code == 202
    book_id = upload.json()["book"]["book_id"]
    assert upload.json()["book"]["status"] == "parsed"
    metadata = client.get(f"/books/{book_id}/source-units").json()
    assert len(metadata) == 2
    assert "text" not in metadata[0]
    assert "text_storage_ref" not in metadata[0]
    assert client.get(f"/books/{book_id}/pages/2").status_code == 200

    project = client.post(f"/books/{book_id}/manga-projects", json={"owner_id": "user_1"})
    assert project.status_code == 201
    project_id = project.json()["project_id"]
    assert client.get(f"/manga-projects/{project_id}").status_code == 200

    preflight = client.options(
        "/upload",
        headers={
            "Origin": "http://127.0.0.1:3000",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"
