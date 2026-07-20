"""Authoritative model registry used by deterministic schema generation."""

from __future__ import annotations

from pydantic import BaseModel

from .artifacts import Artifact, ArtifactRef, AssetRef, AssetRequest, ModelReceipt
from .context import AgentGoal, ContextPack, MemoryDelta
from .manga import AdaptationBeat, MangaManifest, MangaPlan, RenderedPage
from .reel import ReelSpec
from .reel_delivery import ReelPlayerPayload, ReelSeries, SeriesProgress, SeriesProgressUpdate
from .runs import GenerationRun, StageRun
from .source import ScopeManifest, SourceRef, SourceUnit


CONTRACT_MODELS: dict[str, type[BaseModel]] = {
    "adaptation_beat.v1": AdaptationBeat,
    "agent_goal.v1": AgentGoal,
    "artifact.v1": Artifact,
    "artifact_ref.v1": ArtifactRef,
    "asset_ref.v1": AssetRef,
    "asset_request.v1": AssetRequest,
    "context_pack.v1": ContextPack,
    "generation_run.v1": GenerationRun,
    "manga_manifest.v1": MangaManifest,
    "manga_plan.v1": MangaPlan,
    "memory_delta.v1": MemoryDelta,
    "model_receipt.v1": ModelReceipt,
    "reel_spec.v1": ReelSpec,
    "reel_player_payload.v1": ReelPlayerPayload,
    "reel_series.v1": ReelSeries,
    "rendered_page.v1": RenderedPage,
    "scope_manifest.v1": ScopeManifest,
    "source_ref.v1": SourceRef,
    "source_unit.v1": SourceUnit,
    "series_progress.v1": SeriesProgress,
    "series_progress_update.v1": SeriesProgressUpdate,
    "stage_run.v1": StageRun,
}
