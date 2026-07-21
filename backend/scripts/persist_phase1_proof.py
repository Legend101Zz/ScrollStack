"""Persist the zero-image Phase 1 proof against the accepted locality MangaPlan."""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from urllib.parse import urlparse

from app.contracts.manga import MangaPagePlan, MangaPlan, PageScriptSet, ThumbnailSet
from app.persistence.documents import (
    ArtifactDoc,
    GenerationRunDoc,
    StageRunDoc,
    construct_document,
    utc_now,
)
from app.persistence.mongo import initialize_mongo
from app.persistence.repositories import BeanieRepositories
from app.services.hashing import binary_content_hash, content_hash
from app.services.manga_page_planning import MangaPagePlanningService

PROJECT_ID = "project_de1f684e5e17fea3ebaadfef"
SOURCE_PLAN_ID = "manga_plan_e7d7053c31186f72dbd9e4b6"
PIPELINE_VERSION = "manga-page-dsl-phase1-proof.v4"


def panel(
    *,
    panel_id: str,
    purpose: str,
    story_beat: str,
    importance: str,
    tempo: str,
    shot: str,
    angle: str,
    source_ref: dict[str, object],
    blocking: list[dict[str, object]] | None = None,
    focal_regions: list[dict[str, object]] | None = None,
    avoid_text_regions: list[dict[str, object]] | None = None,
    props: list[str] | None = None,
    effects: list[str] | None = None,
) -> dict[str, object]:
    return {
        "panel_id": panel_id,
        "purpose": purpose,
        "story_beat": story_beat,
        "importance": importance,
        "tempo": tempo,
        "camera": {"shot": shot, "angle": angle, "movement": "static"},
        "blocking": blocking or [],
        "prop_refs": props or [],
        "focal_regions": focal_regions or [],
        "avoid_text_regions": avoid_text_regions or [],
        "motion": {"effects": effects or []},
        "source_refs": [source_ref],
        "source_fact_ids": [],
    }


def typography(token: str, *, weight: int = 600) -> dict[str, object]:
    return {
        "font_token": token,
        "weight": weight,
        "min_px": 20,
        "max_px": 44,
        "emphasis": "normal",
    }


def proof_contracts(
    plan: MangaPlan,
    *,
    plan_artifact_id: str,
    script_artifact_id: str | None = None,
) -> tuple[PageScriptSet, list[MangaPagePlan]]:
    beats = {beat.beat_id: beat for beat in plan.beats}
    required = {
        "beat_3_tradeoff_framing",
        "beat_4_woodstock_global",
        "beat_5_singapore_inversion",
        "beat_6_local_exhaustion",
        "beat_7_im_not_local",
    }
    if not required.issubset(beats):
        raise RuntimeError("Accepted MangaPlan no longer contains the Phase 1 locality beats")

    def ref(beat_id: str) -> dict[str, object]:
        return beats[beat_id].source_refs[0].model_dump(mode="json")

    page_a = {
        "page_id": "page_locality_a",
        "page_index": 0,
        "page_kind": "standard",
        "entry_state": "The local-versus-global trade-off is still abstract.",
        "exit_state": "Woodstock proves global reach can coexist with local absence.",
        "page_turn_panel_id": "locality_a4",
        "panels": [
            panel(
                panel_id="locality_a1",
                purpose="setup",
                story_beat="A divided map makes the local and global focus trade-off visible.",
                importance="medium",
                tempo="hold",
                shot="extreme_wide",
                angle="high",
                source_ref=ref("beat_3_tradeoff_framing"),
                blocking=[
                    {
                        "subject_ref": "local_global_map",
                        "pose": "split between near and far networks",
                        "expression": "neutral",
                        "anchor": {"x": 0.28, "y": 0.15},
                        "scale": 0.75,
                        "facing": "front",
                        "depth": "midground",
                    }
                ],
                focal_regions=[{"x": 0.14, "y": 0.07, "width": 0.28, "height": 0.13}],
                avoid_text_regions=[{"x": 0.2, "y": 0.1, "width": 0.16, "height": 0.1}],
                props=["prop_split_map"],
            ),
            panel(
                panel_id="locality_a2",
                purpose="transition",
                story_beat="A Woodstock cabin contains a company operating entirely online.",
                importance="medium",
                tempo="normal",
                shot="wide",
                angle="eye",
                source_ref=ref("beat_4_woodstock_global"),
                blocking=[
                    {
                        "subject_ref": "online_company",
                        "pose": "working from a small Woodstock cabin",
                        "expression": "focused",
                        "anchor": {"x": 0.23, "y": 0.46},
                        "scale": 0.7,
                        "facing": "right",
                        "depth": "midground",
                    }
                ],
                focal_regions=[{"x": 0.13, "y": 0.37, "width": 0.2, "height": 0.18}],
                props=["prop_laptop"],
            ),
            panel(
                panel_id="locality_a3",
                purpose="reaction",
                story_beat="The nearby street stays empty because no local relationships formed.",
                importance="medium",
                tempo="hold",
                shot="medium",
                angle="eye",
                source_ref=ref("beat_4_woodstock_global"),
                blocking=[
                    {
                        "subject_ref": "empty_local_street",
                        "pose": "no local relationships present",
                        "expression": "neutral",
                        "anchor": {"x": 0.72, "y": 0.47},
                        "scale": 0.68,
                        "facing": "away",
                        "depth": "background",
                    }
                ],
                focal_regions=[{"x": 0.62, "y": 0.38, "width": 0.2, "height": 0.18}],
            ),
            panel(
                panel_id="locality_a4",
                purpose="reveal",
                story_beat="Global attention and company growth rise beyond the quiet town.",
                importance="page_turn",
                tempo="impact",
                shot="wide",
                angle="low",
                source_ref=ref("beat_4_woodstock_global"),
                blocking=[
                    {
                        "subject_ref": "global_network",
                        "pose": "expanding beyond the quiet town",
                        "expression": "neutral",
                        "anchor": {"x": 0.7, "y": 0.8},
                        "scale": 0.9,
                        "facing": "front",
                        "depth": "foreground",
                    }
                ],
                focal_regions=[{"x": 0.6, "y": 0.7, "width": 0.22, "height": 0.18}],
                avoid_text_regions=[{"x": 0.63, "y": 0.72, "width": 0.16, "height": 0.15}],
                props=["prop_growth_chart"],
                effects=["network_arcs"],
            ),
        ],
        "text_elements": [
            {
                "text_id": "locality_text_a1",
                "panel_id": "locality_a1",
                "kind": "narration",
                "content": "Time can be focused locally or globally—not fully both.",
                "shape": "caption",
                "preferred_region": {"x": 0.67, "y": 0.06, "width": 0.25, "height": 0.1},
                "typography": typography("manga_narration"),
            },
            {
                "text_id": "locality_text_a4",
                "panel_id": "locality_a4",
                "kind": "sfx",
                "content": "GROW",
                "shape": "free_sfx",
                "preferred_region": {"x": 0.09, "y": 0.82, "width": 0.22, "height": 0.1},
                "typography": typography("manga_sfx", weight=800),
                "overflow": "fit",
            },
        ],
    }
    page_b = {
        "page_id": "page_locality_b",
        "page_index": 1,
        "page_kind": "standard",
        "entry_state": "Singapore deliberately reverses the earlier global habit.",
        "exit_state": "The narrator names the trade-off: I am not local.",
        "page_turn_panel_id": "locality_b3",
        "panels": [
            panel(
                panel_id="locality_b1",
                purpose="setup",
                story_beat="An open Singapore doorway fills with meetings and local requests.",
                importance="medium",
                tempo="quick",
                shot="wide",
                angle="eye",
                source_ref=ref("beat_5_singapore_inversion"),
                blocking=[
                    {
                        "subject_ref": "open_singapore_door",
                        "pose": "receiving local meetings and requests",
                        "expression": "welcoming",
                        "anchor": {"x": 0.76, "y": 0.27},
                        "scale": 0.76,
                        "facing": "left",
                        "depth": "midground",
                    }
                ],
                focal_regions=[{"x": 0.67, "y": 0.2, "width": 0.2, "height": 0.15}],
                avoid_text_regions=[{"x": 0.69, "y": 0.21, "width": 0.15, "height": 0.13}],
                props=["prop_open_door"],
            ),
            panel(
                panel_id="locality_b2",
                purpose="reaction",
                story_beat="Exhaustion leaves a globally useful sketch unfinished after local meetings.",
                importance="high",
                tempo="hold",
                shot="close_up",
                angle="high",
                source_ref=ref("beat_6_local_exhaustion"),
                blocking=[
                    {
                        "subject_ref": "narrator",
                        "pose": "slumped beside an unfinished sketch",
                        "expression": "exhausted",
                        "anchor": {"x": 0.24, "y": 0.29},
                        "scale": 0.72,
                        "facing": "right",
                        "depth": "midground",
                    }
                ],
                focal_regions=[{"x": 0.16, "y": 0.27, "width": 0.2, "height": 0.15}],
                avoid_text_regions=[{"x": 0.16, "y": 0.28, "width": 0.16, "height": 0.12}],
                props=["prop_clock", "prop_unfinished_sketch"],
            ),
            panel(
                panel_id="locality_b3",
                purpose="payoff",
                story_beat="Worldwide readers ask about the silence as the narrator admits the preference.",
                importance="page_turn",
                tempo="impact",
                shot="medium",
                angle="low",
                source_ref=ref("beat_7_im_not_local"),
                blocking=[
                    {
                        "subject_ref": "narrator",
                        "pose": "typing the admission",
                        "expression": "resolved",
                        "anchor": {"x": 0.72, "y": 0.76},
                        "scale": 0.82,
                        "facing": "left",
                        "depth": "midground",
                    }
                ],
                focal_regions=[{"x": 0.62, "y": 0.69, "width": 0.2, "height": 0.17}],
                avoid_text_regions=[{"x": 0.64, "y": 0.71, "width": 0.15, "height": 0.13}],
                props=["prop_inbox"],
            ),
        ],
        "text_elements": [
            {
                "text_id": "locality_text_b1",
                "panel_id": "locality_b1",
                "kind": "narration",
                "content": "Then the door stayed open to every local request.",
                "shape": "caption",
                "preferred_region": {"x": 0.7, "y": 0.07, "width": 0.22, "height": 0.1},
                "typography": typography("manga_narration"),
            },
            {
                "text_id": "locality_text_b2",
                "panel_id": "locality_b2",
                "kind": "sfx",
                "content": "2 HOURS",
                "shape": "free_sfx",
                "preferred_region": {"x": 0.34, "y": 0.25, "width": 0.16, "height": 0.09},
                "typography": typography("manga_sfx", weight=800),
                "overflow": "fit",
            },
            {
                "text_id": "locality_text_b3",
                "panel_id": "locality_b3",
                "kind": "dialogue",
                "content": "I'm not local.",
                "speaker_ref": "narrator",
                "shape": "oval",
                "preferred_region": {"x": 0.1, "y": 0.69, "width": 0.28, "height": 0.12},
                "tail_target": {
                    "subject_ref": "narrator",
                    "point": {"x": 0.72, "y": 0.76},
                },
                "typography": typography("manga_dialogue", weight=700),
            },
        ],
    }
    script_set = PageScriptSet.model_validate(
        {
            "schema_version": "page-script-set.v1",
            "script_set_id": "script_set_locality_phase1",
            "project_id": PROJECT_ID,
            "plan_artifact_id": plan_artifact_id,
            "context_pack_id": plan.context_pack_id,
            "pages": [page_a, page_b],
        }
    )
    script_ref = script_artifact_id or "pending_page_script_artifact"
    canvas = {
        "width_px": 1600,
        "height_px": 2400,
        "trim": {"x": 0.03, "y": 0.02, "width": 0.94, "height": 0.96},
        "safe": {"x": 0.06, "y": 0.05, "width": 0.88, "height": 0.9},
        "bleed_pct": 0.02,
    }
    page_plan_a = MangaPagePlan.model_validate(
        {
            "schema_version": "manga-page-plan.v1",
            "page_plan_id": "page_plan_locality_a",
            "project_id": PROJECT_ID,
            "script_set_artifact_id": script_ref,
            "canvas": canvas,
            "reading_direction": "rtl",
            "page_script": script_set.pages[0].model_dump(mode="json"),
            "layout_root": {
                "kind": "split",
                "node_id": "locality_a_root",
                "axis": "y",
                "ratios": [0.24, 0.38, 0.38],
                "gutter": {"value": 0.012, "unit": "page_pct"},
                "children": [
                    {"kind": "panel", "node_id": "locality_a_n1", "panel_id": "locality_a1"},
                    {
                        "kind": "split",
                        "node_id": "locality_a_middle",
                        "axis": "x",
                        "ratios": [0.44, 0.56],
                        "gutter": {"value": 0.012, "unit": "page_pct"},
                        "children": [
                            {
                                "kind": "panel",
                                "node_id": "locality_a_n2",
                                "panel_id": "locality_a2",
                            },
                            {
                                "kind": "panel",
                                "node_id": "locality_a_n3",
                                "panel_id": "locality_a3",
                            },
                        ],
                    },
                    {"kind": "panel", "node_id": "locality_a_n4", "panel_id": "locality_a4"},
                ],
            },
            "reading_edges": [
                {
                    "from_panel_id": "locality_a1",
                    "to_panel_id": "locality_a2",
                    "reason": "trade-off to remote work",
                },
                {
                    "from_panel_id": "locality_a2",
                    "to_panel_id": "locality_a3",
                    "reason": "online work to local absence",
                },
                {
                    "from_panel_id": "locality_a3",
                    "to_panel_id": "locality_a4",
                    "reason": "absence to global growth",
                },
            ],
            "source_fact_ids": [],
        }
    )
    page_plan_b = MangaPagePlan.model_validate(
        {
            "schema_version": "manga-page-plan.v1",
            "page_plan_id": "page_plan_locality_b",
            "project_id": PROJECT_ID,
            "script_set_artifact_id": script_ref,
            "canvas": canvas,
            "reading_direction": "rtl",
            "page_script": script_set.pages[1].model_dump(mode="json"),
            "layout_root": {
                "kind": "split",
                "node_id": "locality_b_root",
                "axis": "y",
                "ratios": [0.38, 0.62],
                "gutter": {"value": 0.014, "unit": "page_pct"},
                "angle_deg": -6,
                "children": [
                    {
                        "kind": "split",
                        "node_id": "locality_b_top",
                        "axis": "x",
                        "ratios": [0.46, 0.54],
                        "gutter": {"value": 0.012, "unit": "page_pct"},
                        "children": [
                            {
                                "kind": "panel",
                                "node_id": "locality_b_n2",
                                "panel_id": "locality_b2",
                            },
                            {
                                "kind": "panel",
                                "node_id": "locality_b_n1",
                                "panel_id": "locality_b1",
                            },
                        ],
                    },
                    {"kind": "panel", "node_id": "locality_b_n3", "panel_id": "locality_b3"},
                ],
            },
            "reading_edges": [
                {
                    "from_panel_id": "locality_b1",
                    "to_panel_id": "locality_b2",
                    "reason": "local openness to exhaustion",
                },
                {
                    "from_panel_id": "locality_b2",
                    "to_panel_id": "locality_b3",
                    "reason": "exhaustion to the named payoff",
                },
            ],
            "source_fact_ids": [],
        }
    )
    return script_set, [page_plan_a, page_plan_b]


async def persist() -> dict[str, object]:
    uri = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017/scrollstack")
    database_name = urlparse(uri).path.lstrip("/") or "scrollstack"
    client = await initialize_mongo(uri, database_name)
    repository = BeanieRepositories()
    media_root = Path(os.getenv("MEDIA_ROOT", "/data/media"))
    try:
        source_plan_artifact = await repository.get_artifact(SOURCE_PLAN_ID)
        if (
            source_plan_artifact is None
            or source_plan_artifact.project_id != PROJECT_ID
            or source_plan_artifact.validation_status != "accepted"
            or source_plan_artifact.content is None
        ):
            raise RuntimeError("Accepted source MangaPlan is unavailable")
        plan = MangaPlan.model_validate(source_plan_artifact.content)
        identity = {
            "project_id": PROJECT_ID,
            "source_plan_id": SOURCE_PLAN_ID,
            "source_plan_hash": source_plan_artifact.content_hash,
            "pipeline_version": PIPELINE_VERSION,
        }
        proof_hash = content_hash(identity)
        run_id = f"run_phase1_{proof_hash[:24]}"
        plan_artifact_id = f"manga_plan_phase1_basis_{proof_hash[:24]}"
        existing_run = await repository.get_run(run_id)
        if existing_run is not None and existing_run.status == "succeeded":
            artifacts = await repository.list_artifacts(run_id, accepted_only=True)
            thumbnail = next(item for item in artifacts if item.kind == "thumbnail_set")
            previews = await MangaPagePlanningService(
                BeanieRepositories(),
                BeanieRepositories(),
                media_root=media_root,
            ).reconstruct_previews(thumbnail.artifact_id)
            return summary(run_id, artifacts, previews, media_root)

        run = construct_document(
            GenerationRunDoc,
            run_id=run_id,
            project_id=PROJECT_ID,
            scope_id=plan.scope_id,
            requested_outputs=["manga"],
            pipeline_version=PIPELINE_VERSION,
            memory_version=plan.memory_version,
            status="running",
            active_stage="manga_page_writing",
            budget={
                "max_text_cost_usd": 0,
                "max_image_cost_usd": 0,
                "max_render_minutes": 0,
                "max_agent_steps": 1,
                "max_repair_attempts": 0,
                "max_sprites": 0,
                "max_key_panels": 0,
                "max_reels": 0,
            },
            created_by="system_phase1_zero_image_proof",
            idempotency_key=f"phase1-proof:{proof_hash}",
            created_at=utc_now(),
            updated_at=utc_now(),
        )
        if existing_run is None:
            run, _ = await repository.create_run_if_absent(run)
        else:
            run = existing_run
            run.status = "running"
            run.active_stage = "manga_page_writing"
            run.updated_at = utc_now()
            await repository.save_run(run)

        basis = construct_document(
            ArtifactDoc,
            artifact_id=plan_artifact_id,
            project_id=PROJECT_ID,
            run_id=run_id,
            stage_run_id=None,
            kind="manga_plan",
            schema_version="manga-plan.v1",
            content=source_plan_artifact.content,
            storage_ref=None,
            content_hash=source_plan_artifact.content_hash,
            parent_artifact_ids=[SOURCE_PLAN_ID],
            author="system",
            supersedes_artifact_id=None,
            source_refs=source_plan_artifact.source_refs,
            model_receipt=None,
            validation_status="accepted",
            validation_report={
                "passed": True,
                "issues": [],
                "validator_version": "phase1-plan-lineage.v1",
            },
            created_at=utc_now(),
        )
        await repository.save_artifact(basis)
        script_set, _ = proof_contracts(plan, plan_artifact_id=plan_artifact_id)
        page_stage_id = f"stage_phase1_page_writing_{proof_hash[:24]}"
        page_stage = construct_document(
            StageRunDoc,
            stage_run_id=page_stage_id,
            run_id=run_id,
            stage_name="manga_page_writing",
            attempt=1,
            status="running",
            input_artifact_ids=[plan_artifact_id],
            input_hash=source_plan_artifact.content_hash,
            output_artifact_ids=[],
            idempotency_key=f"phase1-page-writing:{proof_hash}",
            started_at=utc_now(),
            ended_at=None,
        )
        await repository.save_stage(page_stage)
        planning = MangaPagePlanningService(repository, repository, media_root=media_root)
        script_artifact = await planning.submit_page_script_set(
            run_id=run_id,
            stage_run_id=page_stage_id,
            plan_artifact_id=plan_artifact_id,
            script_set=script_set,
            author="human",
        )
        page_stage.status = "succeeded"
        page_stage.output_artifact_ids = [script_artifact.artifact_id]
        page_stage.ended_at = utc_now()
        await repository.save_stage(page_stage)

        run.active_stage = "manga_thumbnail"
        run.updated_at = utc_now()
        await repository.save_run(run)
        _, page_plans = proof_contracts(
            plan,
            plan_artifact_id=plan_artifact_id,
            script_artifact_id=script_artifact.artifact_id,
        )
        thumbnail_set = ThumbnailSet(
            schema_version="thumbnail-set.v1",
            thumbnail_set_id="thumbnail_set_locality_phase1",
            project_id=PROJECT_ID,
            script_set_artifact_id=script_artifact.artifact_id,
            page_plans=page_plans,
        )
        thumbnail_stage_id = f"stage_phase1_thumbnail_{proof_hash[:24]}"
        thumbnail_stage = construct_document(
            StageRunDoc,
            stage_run_id=thumbnail_stage_id,
            run_id=run_id,
            stage_name="manga_thumbnail",
            attempt=1,
            status="running",
            input_artifact_ids=[script_artifact.artifact_id],
            input_hash=script_artifact.content_hash,
            output_artifact_ids=[],
            idempotency_key=f"phase1-thumbnail:{proof_hash}",
            started_at=utc_now(),
            ended_at=None,
        )
        await repository.save_stage(thumbnail_stage)
        result = await planning.submit_thumbnail_set(
            run_id=run_id,
            stage_run_id=thumbnail_stage_id,
            script_artifact_id=script_artifact.artifact_id,
            thumbnail_set=thumbnail_set,
            author="human",
        )
        if result.thumbnail_artifact.validation_status != "accepted":
            raise RuntimeError(f"Phase 1 thumbnail proof failed: {result.report_artifact.content}")
        thumbnail_stage.status = "succeeded"
        thumbnail_stage.output_artifact_ids = [
            result.thumbnail_artifact.artifact_id,
            result.report_artifact.artifact_id,
            *[item.artifact_id for item in result.compiled_artifacts],
            *[item.artifact_id for item in result.preview_artifacts],
        ]
        thumbnail_stage.ended_at = utc_now()
        await repository.save_stage(thumbnail_stage)
        run.status = "succeeded"
        run.active_stage = None
        run.updated_at = utc_now()
        await repository.save_run(run)

        fresh_planning = MangaPagePlanningService(
            BeanieRepositories(),
            BeanieRepositories(),
            media_root=media_root,
        )
        previews = await fresh_planning.reconstruct_previews(result.thumbnail_artifact.artifact_id)
        artifacts = await repository.list_artifacts(run_id, accepted_only=True)
        return summary(run_id, artifacts, previews, media_root)
    finally:
        await client.close()


def summary(
    run_id: str,
    artifacts: list[ArtifactDoc],
    previews: tuple[str, ...],
    media_root: Path,
) -> dict[str, object]:
    preview_artifacts = [item for item in artifacts if item.kind == "thumbnail_preview"]
    stored_hashes = []
    for artifact in preview_artifacts:
        if artifact.storage_ref is None:
            raise RuntimeError("Accepted preview is missing storage_ref")
        path = media_root / artifact.storage_ref.removeprefix("storage://")
        stored_hashes.append(binary_content_hash(path.read_bytes()))
    rebuilt_hashes = [binary_content_hash(preview.encode("utf-8")) for preview in previews]
    if stored_hashes != rebuilt_hashes:
        raise RuntimeError("Fresh-process preview reconstruction differs from stored bytes")
    image_artifacts = [
        item.artifact_id
        for item in artifacts
        if item.kind in {"image_attempt", "asset_request_set"}
    ]
    if image_artifacts:
        raise RuntimeError(
            f"Phase 1 proof unexpectedly contains image artifacts: {image_artifacts}"
        )
    if any(item.model_receipt is not None for item in artifacts if item.kind != "manga_plan"):
        raise RuntimeError("Phase 1 proof unexpectedly contains a model receipt")
    return {
        "run_id": run_id,
        "project_id": PROJECT_ID,
        "status": "succeeded",
        "source_plan_artifact_id": SOURCE_PLAN_ID,
        "artifact_ids": [item.artifact_id for item in artifacts],
        "compiled_layout_hashes": [
            item.content_hash for item in artifacts if item.kind == "compiled_layout"
        ],
        "preview_artifact_ids": [item.artifact_id for item in preview_artifacts],
        "preview_hashes": rebuilt_hashes,
        "validation_report_ids": [
            item.artifact_id for item in artifacts if item.kind == "validation_report"
        ],
        "model_receipt": None,
        "image_cost_usd": 0,
        "fresh_process_reconstruction": "passed",
    }


def main() -> int:
    print(json.dumps(asyncio.run(persist()), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
