from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Coroutine, TypeVar

import pymupdf
from fastapi.testclient import TestClient

from app.container import build_services
from app.contracts.context import GenerationConstraints, MemoryDelta
from app.contracts.source import PageRange
from app.main import create_app
from app.persistence.documents import (
    ArtifactDoc,
    GenerationRunDoc,
    StageRunDoc,
    construct_document,
)
from app.persistence.repositories import InMemoryRepositories
from app.services.agent_worker import AgentExecutionResult
from app.services.context_compiler import ContextCompiler
from app.services.domain_tools import DomainToolRequest, MangaDirectorToolService
from app.services.generation_workflow import GenerationWorkflowService
from app.services.memory import MemoryMergeService
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
    first = context.source_units[0].source_ref.model_dump(mode="json")
    return {
        "schema_version": "manga-plan.v1",
        "plan_id": f"plan_{context.scope_id}",
        "project_id": context.project_id,
        "scope_id": context.scope_id,
        "context_pack_id": context.context_pack_id,
        "memory_version": context.memory_version,
        "title": "The Last Observatory",
        "summary": "Mara follows the signal into the sealed observatory.",
        "target_page_count": 8,
        "beats": [
            {
                "beat_id": "beat_000",
                "sequence": 0,
                "source_refs": [first],
                "required_fact_ids": [
                    fact.fact_id for fact in context.book_canon.facts
                ],
                "narrative_purpose": "reveal",
                "book_essence": "The observatory signal is grounded in the selected pages.",
                "dramatization": "Mara opens the lens-room door after the third knock.",
                "character_intent": [
                    {
                        "character_id": "mara",
                        "intent": "Identify the source of the signal.",
                        "emotional_state": "resolute",
                    }
                ],
                "visual_intent": ["Hold on the sealed door before the reveal."],
                "must_preserve": ["The observatory evidence remains source-grounded."],
                "may_compress": [],
                "confidence": 1,
            }
        ],
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
        MangaProjectService(repository, repository).create(
            uploaded.book.book_id, owner_id="user_1"
        )
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


def test_two_scope_context_rebuilds_accepted_continuity_without_chat(
    tmp_path: Path,
) -> None:
    repository = InMemoryRepositories()
    book_id, project_id, first_scope_id, second_scope_id = seed_pdf_project(
        repository, tmp_path
    )
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
    assert {unit.source_ref.page_start for unit in context.source_units} == set(
        range(11, 21)
    )
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
                "provider": "openai",
                "model": "configured-test-model",
                "skill_hash": "d" * 64,
                "tokens": {"input": 200, "output": 100, "total": 300},
                "cost_usd": 0.01,
                "latency_ms": 50,
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


def test_workflow_persists_context_and_broker_validated_plan_without_false_success(
    tmp_path: Path,
) -> None:
    repository = InMemoryRepositories()
    _book_id, project_id, first_scope_id, _second_scope_id = seed_pdf_project(
        repository, tmp_path
    )
    run = generation_run(repository, project_id, first_scope_id)
    agent = BrokeredFakeAgent(MangaDirectorToolService(repository, repository))
    workflow = GenerationWorkflowService(
        repository,
        agent_worker=agent,
        agentic_enabled=True,
    )

    result = resolve(workflow.execute(run.run_id))
    repeated = resolve(workflow.execute(run.run_id))
    stages = resolve(repository.list_stages(run.run_id))
    accepted = resolve(repository.list_artifacts(run.run_id, accepted_only=True))

    assert result.status == "terminal_failed"
    assert result.error_code == "MANGA_PIPELINE_NOT_CONNECTED"
    assert repeated == result
    assert agent.calls == 1
    assert {item.kind for item in accepted} == {"context_pack", "manga_plan"}
    assert any(
        item.stage_name == "context_compilation" and item.status == "succeeded"
        for item in stages
    )
    assert any(
        item.stage_name == "manga_direction" and item.status == "succeeded"
        for item in stages
    )
    assert any(
        item.stage_name == "existing_manga_pipeline"
        and item.error_code == "MANGA_PIPELINE_NOT_CONNECTED"
        for item in stages
    )
    plan = next(item for item in accepted if item.kind == "manga_plan")
    assert plan.model_receipt is not None
    assert plan.model_receipt["provider"] == "openai"
    assert plan.parent_artifact_ids[1].startswith("candidate_manga_plan_")


def test_domain_tools_require_service_auth_and_reject_cross_project_scope(
    tmp_path: Path, monkeypatch: Any
) -> None:
    repository = InMemoryRepositories()
    _book_id, project_id, first_scope_id, _second_scope_id = seed_pdf_project(
        repository, tmp_path
    )
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
        source_refs=[
            item.source_ref.model_dump(mode="json") for item in context.source_units
        ],
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
    accepted = client.post(
        "/internal/v1/agent-tools/submit_manga_plan",
        headers={"authorization": "Bearer test-domain-token-123456"},
        json=body,
    )

    assert denied.status_code == 403
    assert accepted.status_code == 200
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
    assert len(client.get(f"/books/{book_id}/source-units").json()) == 2
    assert client.get(f"/books/{book_id}/pages/2").status_code == 200

    project = client.post(
        f"/books/{book_id}/manga-projects", json={"owner_id": "user_1"}
    )
    assert project.status_code == 201
    project_id = project.json()["project_id"]
    assert client.get(f"/manga-projects/{project_id}").status_code == 200
