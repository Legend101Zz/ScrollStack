from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.container import build_services
from app.main import create_app
from app.persistence.documents import (
    ArtifactDoc,
    MangaProjectDoc,
    ProjectMemorySnapshotDoc,
    construct_document,
)
from app.persistence.repositories import InMemoryRepositories

NOW = datetime(2026, 7, 20, 12, 0, tzinfo=UTC)
SOURCE_REF = {
    "book_id": "book_1",
    "source_unit_id": "page_00001",
    "page_start": 1,
    "page_end": 1,
    "text_hash": "a" * 64,
}


def manifest_payload(*, project_id: str = "project_1") -> dict[str, Any]:
    beat = {
        "beat_id": "beat_0",
        "sequence": 0,
        "source_refs": [SOURCE_REF],
        "required_fact_ids": [],
        "narrative_purpose": "hook",
        "book_essence": "Mara follows the signal.",
        "dramatization": "The signal flashes across the harbor.",
        "character_intent": [],
        "visual_intent": ["Hold on the signal."],
        "must_preserve": ["The signal crosses the harbor."],
        "may_compress": [],
        "confidence": 1,
    }
    return {
        "schema_version": "manga-manifest.v1",
        "manga_id": "manga_1",
        "project_id": project_id,
        "scope_id": "scope_1",
        "memory_version": 3,
        "rendered_page_artifact_ids": ["rendered_page_0"],
        "beats": [beat],
        "panels": [
            {
                "panel_id": "panel_0",
                "page_id": "page_0",
                "sequence": 0,
                "beat_ids": ["beat_0"],
                "panel_type": "establishing",
                "dialogue": [],
                "narration": ["The Wake Light crosses the harbor."],
                "visual_asset_ids": ["asset_panel_0"],
                "crop_hints": [],
                "emotional_tone": "ominous",
                "source_refs": [SOURCE_REF],
            }
        ],
        "character_asset_ids": [],
        "art_direction_artifact_id": "art_direction_1",
        "content_hash": "b" * 64,
    }


def reel_spec_payload(
    sequence: int,
    *,
    reel_id: str | None = None,
    series_id: str = "series_1",
    manifest_id: str = "manifest_1",
) -> dict[str, Any]:
    resolved_reel_id = reel_id or f"reel_{sequence}"
    return {
        "schema_version": "reel-spec.v1",
        "reel_id": resolved_reel_id,
        "series_id": series_id,
        "sequence": sequence,
        "manga_manifest_id": manifest_id,
        "beat_ids": ["beat_0"],
        "format": {
            "width": 1080,
            "height": 1920,
            "fps": 30,
            "duration_frames": 60,
        },
        "style_kit_id": "style_1",
        "audio": {
            "narration_asset_id": None,
            "music_asset_id": None,
            "sfx_cues": [],
            "caption_track_id": None,
        },
        "scenes": [
            {
                "scene_id": f"scene_{sequence}",
                "scene_type": "panel_focus",
                "component_id": "panel_focus",
                "start_frame": 0,
                "duration_frames": 60,
                "beat_ids": ["beat_0"],
                "panel_id": "panel_0",
                "asset_id": "asset_panel_0",
                "focus_box_pct": None,
                "motion_preset": "push_in",
                "caption": "Follow the signal.",
            }
        ],
        "interaction_map": [
            {"beat_id": "beat_0", "start_frame": 0, "end_frame": 60}
        ],
        "source_refs": [SOURCE_REF],
    }


def artifact(
    artifact_id: str,
    *,
    kind: str,
    schema_version: str,
    content: dict[str, Any],
    project_id: str = "project_1",
    validation_status: str = "accepted",
    created_at: datetime = NOW,
) -> ArtifactDoc:
    return construct_document(
        ArtifactDoc,
        artifact_id=artifact_id,
        project_id=project_id,
        run_id="run_1",
        kind=kind,
        schema_version=schema_version,
        content=content,
        storage_ref=None,
        content_hash="c" * 64,
        parent_artifact_ids=[],
        source_refs=[],
        model_receipt=None,
        validation_status=validation_status,
        validation_report={
            "passed": validation_status == "accepted",
            "issues": [],
            "validator_version": "test.v1",
        },
        created_at=created_at,
    )


def seed_catalog(
    repository: InMemoryRepositories,
    *,
    sequences: tuple[int, ...] = (0, 1),
    storage_ref: str = "public/art/panel-0.png",
) -> None:
    repository.projects["project_1"] = construct_document(
        MangaProjectDoc,
        project_id="project_1",
        book_id="book_1",
        owner_id="owner_1",
        active_memory_version=4,
        created_at=NOW,
        updated_at=NOW,
    )
    repository.memory_snapshots[("project_1", 3)] = construct_document(
        ProjectMemorySnapshotDoc,
        project_id="project_1",
        memory_version=3,
        parent_version=2,
        book_spine={},
        facts=[],
        character_state=[],
        world_state={},
        continuity={},
        coverage={},
        asset_index=[
            {
                "asset_id": "asset_panel_0",
                "project_id": "project_1",
                "asset_type": "key_panel",
                "content_hash": "d" * 64,
                "storage_ref": storage_ref,
                "mime_type": "image/png",
                "width": 1080,
                "height": 1920,
                "duration_ms": None,
                "model_receipt": None,
            }
        ],
        source_artifact_ids=["manifest_1"],
        content_hash="e" * 64,
        created_at=NOW,
    )
    repository.artifacts["manifest_1"] = artifact(
        "manifest_1",
        kind="manga_manifest",
        schema_version="manga-manifest.v1",
        content=manifest_payload(),
    )
    for index, sequence in enumerate(sequences):
        reel_id = f"reel_{index}"
        reel_artifact = artifact(
            f"reel_spec_{index}",
            kind="reel_spec",
            schema_version="reel-spec.v1",
            content=reel_spec_payload(sequence, reel_id=reel_id),
            created_at=NOW + timedelta(seconds=index + 1),
        )
        repository.artifacts[reel_artifact.artifact_id] = reel_artifact


def client_for(repository: InMemoryRepositories) -> TestClient:
    return TestClient(create_app(build_services(repository)))


def test_reel_catalog_and_player_payload_are_contract_valid() -> None:
    repository = InMemoryRepositories()
    seed_catalog(repository)
    client = client_for(repository)

    discovery = client.get("/manga-projects/project_1/reel-series")
    series = client.get("/reel-series/series_1")
    payload = client.get("/reels/reel_0")

    assert discovery.status_code == 200
    assert discovery.json() == [series.json()]
    assert series.status_code == 200
    assert [item["sequence"] for item in series.json()["reels"]] == [0, 1]
    assert series.json()["manga_manifest_artifact_id"] == "manifest_1"
    assert payload.status_code == 200
    assert payload.json()["reel_spec_artifact_id"] == "reel_spec_0"
    assert payload.json()["manga_manifest"]["memory_version"] == 3
    assert payload.json()["assets"] == {
        "asset_panel_0": {
            "asset_id": "asset_panel_0",
            "kind": "image",
            "content_hash": "d" * 64,
            "mime_type": "image/png",
            "url": "/art/panel-0.png",
            "url_expires_at": None,
            "width": 1080,
            "height": 1920,
            "duration_ms": None,
        }
    }
    assert payload.json()["captions"] == []
    assert payload.json()["poster_url"] is None
    assert payload.json()["rendered_mp4_url"] is None


def test_rejected_specs_are_not_catalogued_and_invalid_accepted_specs_fail_cleanly() -> None:
    repository = InMemoryRepositories()
    seed_catalog(repository, sequences=(0,))
    rejected = artifact(
        "rejected_spec",
        kind="reel_spec",
        schema_version="reel-spec.v1",
        content={"not": "a reel"},
        validation_status="rejected",
    )
    repository.artifacts[rejected.artifact_id] = rejected
    client = client_for(repository)

    assert len(client.get("/reel-series/series_1").json()["reels"]) == 1

    invalid = artifact(
        "invalid_accepted_spec",
        kind="reel_spec",
        schema_version="reel-spec.v1",
        content={**reel_spec_payload(1, reel_id="reel_bad"), "sequence": "bad"},
    )
    repository.artifacts[invalid.artifact_id] = invalid
    response = client.get("/manga-projects/project_1/reel-series")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "artifact_validation_failed"


@pytest.mark.parametrize(
    ("sequences", "second_manifest"),
    [((0, 2), False), ((0, 1), True)],
)
def test_series_rejects_non_contiguous_sequences_or_multiple_manifests(
    sequences: tuple[int, ...], second_manifest: bool
) -> None:
    repository = InMemoryRepositories()
    seed_catalog(repository, sequences=sequences)
    if second_manifest:
        repository.artifacts["manifest_2"] = artifact(
            "manifest_2",
            kind="manga_manifest",
            schema_version="manga-manifest.v1",
            content=manifest_payload(),
        )
        repository.artifacts["reel_spec_1"].content = reel_spec_payload(
            1, reel_id="reel_1", manifest_id="manifest_2"
        )
    response = client_for(repository).get("/reel-series/series_1")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "artifact_validation_failed"


@pytest.mark.parametrize(
    "asset_index",
    [
        [],
        [
            {
                "asset_id": "asset_panel_0",
                "project_id": "project_1",
                "asset_type": "key_panel",
                "content_hash": "d" * 64,
                "storage_ref": "storage://private/panel-0.png",
                "mime_type": "image/png",
                "width": 1080,
                "height": 1920,
                "duration_ms": None,
                "model_receipt": None,
            }
        ],
    ],
)
def test_player_rejects_missing_or_private_snapshot_assets(
    asset_index: list[dict[str, Any]],
) -> None:
    repository = InMemoryRepositories()
    seed_catalog(repository, sequences=(0,))
    repository.memory_snapshots[("project_1", 3)].asset_index = asset_index

    response = client_for(repository).get("/reels/reel_0")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "artifact_validation_failed"


def test_progress_is_owner_derived_validated_and_idempotent() -> None:
    repository = InMemoryRepositories()
    seed_catalog(repository)
    client = client_for(repository)
    update = {
        "schema_version": "series-progress-update.v1",
        "last_manga_page": 1,
        "last_reel_id": "reel_0",
        "viewed_reel_ids": ["reel_1", "reel_0"],
    }

    missing = client.get("/series/series_1/progress")
    first = client.put("/series/series_1/progress", json=update)
    repeated = client.put("/series/series_1/progress", json=update)
    fetched = client.get("/series/series_1/progress")

    assert missing.status_code == 404
    assert first.status_code == 200
    assert first.json() == repeated.json() == fetched.json()
    assert first.json()["schema_version"] == "series-progress.v1"
    assert first.json()["viewed_reel_ids"] == ["reel_0", "reel_1"]
    assert "user_id" not in first.json()
    assert ("owner_1", "series_1") in repository.series_progress
    assert len(repository.series_progress) == 1

    invalid = client.put(
        "/series/series_1/progress",
        json={
            **update,
            "last_reel_id": "reel_elsewhere",
            "viewed_reel_ids": ["reel_elsewhere"],
        },
    )
    user_supplied = client.put(
        "/series/series_1/progress",
        json={**update, "user_id": "attacker"},
    )

    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "invalid_progress"
    assert user_supplied.status_code == 422
