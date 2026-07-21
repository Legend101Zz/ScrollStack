"""Read-only reel delivery and owner-scoped series progress."""

from __future__ import annotations

from collections import defaultdict

from pydantic import ValidationError

from app.contracts.artifacts import AssetRef
from app.contracts.manga import MangaManifest
from app.contracts.reel import (
    DialogueExchangeScene,
    ImpactCutScene,
    MontageScene,
    NarratorCardScene,
    PageTurnScene,
    PanelFocusScene,
    ReelSpec,
    SplitPanelScene,
)
from app.contracts.reel_delivery import (
    ReelPlayerPayload,
    ReelSeries,
    ReelSummary,
    ResolvedReelAsset,
    SeriesProgress,
    SeriesProgressUpdate,
)
from app.persistence.documents import (
    ArtifactDoc,
    MangaProjectDoc,
    ProjectMemorySnapshotDoc,
    SeriesProgressDoc,
    construct_document,
    utc_now,
)
from app.persistence.protocols import (
    ArtifactRepository,
    MemoryRepository,
    ReelReadRepository,
    SeriesProgressRepository,
)

from .errors import ArtifactValidationError, InvalidProgressError, NotFoundError


class ReelPlayerService:
    def __init__(
        self,
        reels: ReelReadRepository,
        progress: SeriesProgressRepository,
        artifacts: ArtifactRepository,
        memory: MemoryRepository,
    ) -> None:
        self._reels = reels
        self._progress = progress
        self._artifacts = artifacts
        self._memory = memory

    async def list_project_series(self, project_id: str) -> list[ReelSeries]:
        project = await self._memory.get_project(project_id)
        if project is None:
            raise NotFoundError(f"Manga project {project_id} does not exist")
        artifacts = await self._reels.list_accepted_reel_specs(project_id)
        grouped: dict[str, list[ArtifactDoc]] = defaultdict(list)
        for artifact in artifacts:
            spec = self._validate_reel_spec_artifact(artifact)
            grouped[spec.series_id].append(artifact)
        series: list[ReelSeries] = []
        for series_id in sorted(grouped):
            all_series_artifacts = await self._reels.list_accepted_reel_specs_for_series(
                series_id
            )
            item, _specs, _manifest, _project = await self._build_series_state(
                all_series_artifacts,
                expected_series_id=series_id,
                project=project,
            )
            series.append(item)
        return series

    async def get_series(self, series_id: str) -> ReelSeries:
        series, _specs, _manifest, _project = await self._load_series_state(series_id)
        return series

    async def get_player_payload(self, reel_id: str) -> ReelPlayerPayload:
        artifact = await self._reels.get_accepted_reel_spec(reel_id)
        if artifact is None:
            raise NotFoundError(f"Reel {reel_id} does not exist")
        requested_spec = self._validate_reel_spec_artifact(artifact)
        if requested_spec.reel_id != reel_id:
            raise ArtifactValidationError(
                f"Reel artifact {artifact.artifact_id} does not match reel {reel_id}"
            )
        series, specs, manifest, project = await self._load_series_state(
            requested_spec.series_id
        )
        matching = [item for item in specs if item[1].reel_id == reel_id]
        if len(matching) != 1:
            raise ArtifactValidationError(
                f"Series {series.series_id} does not contain exactly one accepted reel {reel_id}"
            )
        reel_artifact, reel_spec = matching[0]
        snapshot = await self._memory.get_memory_snapshot(
            project.project_id, manifest.memory_version
        )
        if snapshot is None:
            raise ArtifactValidationError(
                "Reel delivery requires the MangaManifest memory snapshot "
                f"{project.project_id}@{manifest.memory_version}"
            )
        assets = self._resolve_assets(reel_spec, manifest, snapshot, project.project_id)
        try:
            return ReelPlayerPayload(
                schema_version="reel-player-payload.v1",
                book_id=project.book_id,
                project_id=project.project_id,
                series_id=series.series_id,
                manga_manifest_artifact_id=series.manga_manifest_artifact_id,
                reel_spec_artifact_id=reel_artifact.artifact_id,
                reel_spec=reel_spec,
                manga_manifest=manifest,
                assets=assets,
                captions=[],
                poster_url=None,
                rendered_mp4_url=None,
            )
        except ValidationError as error:
            raise ArtifactValidationError(
                f"Reel {reel_id} cannot be delivered: {error}"
            ) from error

    async def get_progress(self, series_id: str) -> SeriesProgress:
        _series, specs, _manifest, project = await self._load_series_state(series_id)
        progress = await self._progress.get_series_progress(project.owner_id, series_id)
        if progress is None:
            raise NotFoundError(f"Progress for reel series {series_id} does not exist")
        self._validate_progress_membership(
            series_id,
            {spec.reel_id for _, spec in specs},
            progress.last_reel_id,
            progress.viewed_reel_ids,
        )
        return self._progress_contract(progress)

    async def put_progress(
        self, series_id: str, update: SeriesProgressUpdate
    ) -> SeriesProgress:
        _series, specs, _manifest, project = await self._load_series_state(series_id)
        reel_ids = {spec.reel_id for _, spec in specs}
        self._validate_progress_membership(
            series_id,
            reel_ids,
            update.last_reel_id,
            update.viewed_reel_ids,
        )
        viewed_ids = set(update.viewed_reel_ids)
        ordered_viewed_ids = [
            spec.reel_id for _, spec in specs if spec.reel_id in viewed_ids
        ]
        progress = construct_document(
            SeriesProgressDoc,
            user_id=project.owner_id,
            series_id=series_id,
            last_manga_page=update.last_manga_page,
            last_reel_id=update.last_reel_id,
            viewed_reel_ids=ordered_viewed_ids,
            updated_at=utc_now(),
        )
        stored = await self._progress.save_series_progress(progress)
        return self._progress_contract(stored)

    async def _load_series_state(
        self, series_id: str
    ) -> tuple[
        ReelSeries,
        list[tuple[ArtifactDoc, ReelSpec]],
        MangaManifest,
        MangaProjectDoc,
    ]:
        artifacts = await self._reels.list_accepted_reel_specs_for_series(series_id)
        if not artifacts:
            raise NotFoundError(f"Reel series {series_id} does not exist")
        return await self._build_series_state(artifacts, expected_series_id=series_id)

    async def _build_series_state(
        self,
        artifacts: list[ArtifactDoc],
        *,
        expected_series_id: str | None = None,
        project: MangaProjectDoc | None = None,
    ) -> tuple[
        ReelSeries,
        list[tuple[ArtifactDoc, ReelSpec]],
        MangaManifest,
        MangaProjectDoc,
    ]:
        if not artifacts:
            raise ArtifactValidationError("A reel series must contain at least one reel")
        specs = [(artifact, self._validate_reel_spec_artifact(artifact)) for artifact in artifacts]
        series_ids = {spec.series_id for _, spec in specs}
        if len(series_ids) != 1:
            raise ArtifactValidationError("Accepted reel series artifacts disagree on series_id")
        series_id = next(iter(series_ids))
        if expected_series_id is not None and series_id != expected_series_id:
            raise ArtifactValidationError(
                f"Accepted reel artifacts do not match series {expected_series_id}"
            )
        project_ids = {artifact.project_id for artifact, _ in specs}
        if len(project_ids) != 1:
            raise ArtifactValidationError(f"Reel series {series_id} spans multiple projects")
        project_id = next(iter(project_ids))
        if project is None:
            project = await self._memory.get_project(project_id)
        if project is None:
            raise ArtifactValidationError(
                f"Reel series {series_id} references missing project {project_id}"
            )
        if project.project_id != project_id:
            raise ArtifactValidationError(f"Reel series {series_id} belongs to another project")
        manifest_ids = {spec.manga_manifest_id for _, spec in specs}
        if len(manifest_ids) != 1:
            raise ArtifactValidationError(
                f"Reel series {series_id} references multiple manga manifests"
            )
        manifest_id = next(iter(manifest_ids))
        manifest = await self._load_manifest(manifest_id, project_id)
        ordered = sorted(specs, key=lambda item: (item[1].sequence, item[1].reel_id))
        try:
            series = ReelSeries(
                schema_version="reel-series.v1",
                book_id=project.book_id,
                project_id=project_id,
                series_id=series_id,
                manga_manifest_artifact_id=manifest_id,
                reels=[
                    ReelSummary(
                        reel_id=spec.reel_id,
                        reel_spec_artifact_id=artifact.artifact_id,
                        sequence=spec.sequence,
                        duration_frames=spec.format.duration_frames,
                    )
                    for artifact, spec in ordered
                ],
            )
        except ValidationError as error:
            raise ArtifactValidationError(
                f"Reel series {series_id} is inconsistent: {error}"
            ) from error
        return series, ordered, manifest, project

    async def _load_manifest(self, artifact_id: str, project_id: str) -> MangaManifest:
        artifact = await self._artifacts.get_artifact(artifact_id)
        if (
            artifact is None
            or artifact.project_id != project_id
            or artifact.kind != "manga_manifest"
            or artifact.schema_version != "manga-manifest.v1"
            or artifact.validation_status != "accepted"
            or artifact.validation_report.get("passed") is not True
            or artifact.content is None
        ):
            raise ArtifactValidationError(
                f"Accepted MangaManifest artifact {artifact_id} is unavailable"
            )
        try:
            manifest = MangaManifest.model_validate(artifact.content)
        except ValidationError as error:
            raise ArtifactValidationError(
                f"MangaManifest artifact {artifact_id} is invalid: {error}"
            ) from error
        if manifest.project_id != project_id:
            raise ArtifactValidationError(
                f"MangaManifest artifact {artifact_id} belongs to another project"
            )
        return manifest

    @staticmethod
    def _validate_reel_spec_artifact(artifact: ArtifactDoc) -> ReelSpec:
        if (
            artifact.kind != "reel_spec"
            or artifact.schema_version != "reel-spec.v1"
            or artifact.validation_status != "accepted"
            or artifact.validation_report.get("passed") is not True
            or artifact.content is None
        ):
            raise ArtifactValidationError(
                f"Accepted ReelSpec artifact {artifact.artifact_id} is unavailable"
            )
        try:
            return ReelSpec.model_validate(artifact.content)
        except ValidationError as error:
            raise ArtifactValidationError(
                f"ReelSpec artifact {artifact.artifact_id} is invalid: {error}"
            ) from error

    @staticmethod
    def _resolve_assets(
        reel_spec: ReelSpec,
        manifest: MangaManifest,
        snapshot: ProjectMemorySnapshotDoc,
        project_id: str,
    ) -> dict[str, ResolvedReelAsset]:
        required_image_ids: set[str] = set()
        panels = {panel.panel_id: panel for panel in manifest.panels}
        panel_ids: set[str] = set()
        for scene in reel_spec.scenes:
            if isinstance(scene, (PanelFocusScene, DialogueExchangeScene, ImpactCutScene)):
                panel_ids.add(scene.panel_id)
            elif isinstance(scene, (SplitPanelScene, MontageScene)):
                panel_ids.update(scene.panel_ids)
            elif isinstance(scene, PageTurnScene):
                panel_ids.update((scene.from_panel_id, scene.to_panel_id))
        for panel_id in panel_ids:
            panel = panels.get(panel_id)
            if panel is None:
                raise ArtifactValidationError(
                    f"Reel references missing MangaManifest panel {panel_id}"
                )
            if not panel.visual_asset_ids:
                raise ArtifactValidationError(
                    f"MangaManifest panel {panel_id} has no compiler-ready visual asset"
                )
            required_image_ids.add(panel.visual_asset_ids[0])
        for scene in reel_spec.scenes:
            if isinstance(scene, PanelFocusScene) and scene.asset_id is not None:
                required_image_ids.add(scene.asset_id)
            elif isinstance(scene, NarratorCardScene) and scene.background_asset_id is not None:
                required_image_ids.add(scene.background_asset_id)

        required_audio_ids = {
            asset_id
            for asset_id in (
                reel_spec.audio.narration_asset_id,
                reel_spec.audio.music_asset_id,
            )
            if asset_id is not None
        }
        required_audio_ids.update(cue.asset_id for cue in reel_spec.audio.sfx_cues)
        required_caption_ids = (
            {reel_spec.audio.caption_track_id}
            if reel_spec.audio.caption_track_id is not None
            else set()
        )
        required_ids = required_image_ids | required_audio_ids | required_caption_ids

        indexed: dict[str, AssetRef] = {}
        try:
            for item in snapshot.asset_index:
                asset = AssetRef.model_validate(item)
                if asset.project_id != project_id:
                    raise ArtifactValidationError(
                        f"Asset {asset.asset_id} belongs to another project"
                    )
                if asset.asset_id in indexed:
                    raise ArtifactValidationError(
                        f"Memory snapshot contains duplicate asset {asset.asset_id}"
                    )
                indexed[asset.asset_id] = asset
        except ValidationError as error:
            raise ArtifactValidationError(
                f"Memory snapshot {project_id}@{snapshot.memory_version} "
                f"has invalid assets: {error}"
            ) from error

        missing = required_ids - set(indexed)
        if missing:
            raise ArtifactValidationError(
                f"Reel references assets missing from its memory snapshot: "
                f"{', '.join(sorted(missing))}"
            )

        resolved: dict[str, ResolvedReelAsset] = {}
        for asset_id in sorted(required_ids):
            asset = indexed[asset_id]
            if not asset.storage_ref.startswith("public/"):
                raise ArtifactValidationError(
                    f"Asset {asset_id} is not available through a public browser path"
                )
            kind = "image"
            if asset.asset_type == "audio":
                kind = "audio"
            elif asset.asset_type == "caption_track":
                kind = "caption_track"
            try:
                resolved[asset_id] = ResolvedReelAsset(
                    asset_id=asset_id,
                    kind=kind,
                    content_hash=asset.content_hash,
                    mime_type=asset.mime_type,
                    url=f"/{asset.storage_ref.removeprefix('public/')}",
                    url_expires_at=None,
                    width=asset.width,
                    height=asset.height,
                    duration_ms=asset.duration_ms,
                )
            except ValidationError as error:
                raise ArtifactValidationError(
                    f"Asset {asset_id} cannot be delivered: {error}"
                ) from error
        return resolved

    @staticmethod
    def _progress_contract(progress: SeriesProgressDoc) -> SeriesProgress:
        try:
            return SeriesProgress(
                schema_version="series-progress.v1",
                series_id=progress.series_id,
                last_manga_page=progress.last_manga_page,
                last_reel_id=progress.last_reel_id,
                viewed_reel_ids=list(progress.viewed_reel_ids),
                updated_at=progress.updated_at,
            )
        except ValidationError as error:
            raise InvalidProgressError(
                f"Stored progress for reel series {progress.series_id} is invalid: {error}"
            ) from error

    @staticmethod
    def _validate_progress_membership(
        series_id: str,
        reel_ids: set[str],
        last_reel_id: str | None,
        viewed_reel_ids: list[str],
    ) -> None:
        supplied_ids = set(viewed_reel_ids)
        if last_reel_id is not None:
            supplied_ids.add(last_reel_id)
        unknown_ids = supplied_ids - reel_ids
        if unknown_ids:
            raise InvalidProgressError(
                f"Progress references reels outside series {series_id}: "
                f"{', '.join(sorted(unknown_ids))}"
            )
