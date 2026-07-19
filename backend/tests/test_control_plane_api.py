from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.container import build_services
from app.main import create_app
from app.persistence.documents import (
    MangaProjectDoc,
    ProjectMemorySnapshotDoc,
    SourceUnitDoc,
    construct_document,
)
from app.persistence.repositories import InMemoryRepositories
from app.services.hashing import content_hash, estimate_tokens

NOW = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)


def test_scope_and_generation_run_routes() -> None:
    repository = InMemoryRepositories()
    text = "The lighthouse signal crosses the drowned harbor."
    unit = construct_document(
        SourceUnitDoc,
        book_id="book_1",
        source_unit_id="pages_1_10",
        kind="page_window",
        chapter_index=0,
        heading_path=["Opening"],
        page_start=1,
        page_end=10,
        text=text,
        text_hash=content_hash(text),
        token_count=estimate_tokens(text),
        image_refs=[],
        parse_version="parser.v1",
    )
    repository.source_units[(unit.book_id, unit.source_unit_id)] = unit
    repository.projects["project_1"] = construct_document(
        MangaProjectDoc,
        project_id="project_1",
        book_id="book_1",
        owner_id="user_1",
        active_memory_version=0,
        created_at=NOW,
        updated_at=NOW,
    )
    repository.memory_snapshots[("project_1", 0)] = construct_document(
        ProjectMemorySnapshotDoc,
        project_id="project_1",
        memory_version=0,
        parent_version=None,
        book_spine={},
        facts=[],
        character_state=[],
        world_state={},
        continuity={},
        coverage={},
        asset_index=[],
        source_artifact_ids=[],
        content_hash="a" * 64,
        created_at=NOW,
    )
    client = TestClient(create_app(build_services(repository)))

    scope_response = client.post(
        "/books/book_1/scopes",
        json={
            "project_id": "project_1",
            "page_ranges": [{"page_start": 1, "page_end": 10}],
            "selection_label": "Opening",
            "created_by": "user_1",
        },
    )
    assert scope_response.status_code == 201
    scope_id = scope_response.json()["scope_id"]
    assert client.get("/books/book_1/scopes").json()[0]["scope_id"] == scope_id

    run_response = client.post(
        "/manga-projects/project_1/generation-runs",
        json={
            "scope_id": scope_id,
            "requested_outputs": ["manga"],
            "pipeline_version": "manga-pipeline.v1",
            "budget": {
                "max_text_cost_usd": 3,
                "max_image_cost_usd": 8,
                "max_render_minutes": 5,
                "max_agent_steps": 20,
                "max_repair_attempts": 2,
                "max_sprites": 8,
                "max_key_panels": 2,
                "max_reels": 0,
            },
            "created_by": "user_1",
        },
    )
    assert run_response.status_code == 202
    run_id = run_response.json()["run"]["run_id"]
    assert client.get(f"/generation-runs/{run_id}").status_code == 200
    assert client.get(f"/generation-runs/{run_id}/artifacts").json() == []
    assert client.post(f"/generation-runs/{run_id}/cancel").json()["run"]["status"] == ("cancelled")


def test_control_plane_returns_stable_not_found_error() -> None:
    client = TestClient(create_app(build_services(InMemoryRepositories())))

    response = client.get("/generation-runs/missing")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
