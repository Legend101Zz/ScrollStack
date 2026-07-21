"""Durable context and Manga Director vertical-slice stage execution."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, ValidationError

from app.contracts.artifacts import ArtifactRef, ModelReceipt
from app.contracts.context import (
    AcceptanceTestRef,
    AgentBudget,
    AgentGoal,
    AgentGoalType,
    ContextPack,
    GenerationConstraints,
)
from app.contracts.manga import MangaPlan
from app.persistence.documents import (
    ArtifactDoc,
    GenerationRunDoc,
    StageRunDoc,
    construct_document,
    utc_now,
)
from app.persistence.protocols import Repositories

from .agent_worker import AgentWorkerError, AgentWorkerGateway
from .context_compiler import ContextCompiler
from .errors import ArtifactValidationError, NotFoundError
from .hashing import content_hash
from .image_generation import APPROVED_OPENROUTER_IMAGE_MODEL, ImageGenerationGateway
from .manga_production import MangaProductionService
from .memory import MemoryMergeService

REQUIRED_MANGA_DIRECTOR_PROVIDER = "minimax"
REQUIRED_MANGA_DIRECTOR_MODEL = "MiniMax-M3"


class StageRetryExhaustedError(Exception):
    code = "stage_retry_exhausted"
    retryable = False


class RenderBudgetTimeoutError(Exception):
    code = "render_time_budget_exceeded"
    retryable = True


class WorkflowExecutionResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str
    status: str
    accepted_artifact_ids: list[str]
    error_code: str | None = None


class GenerationWorkflowService:
    def __init__(
        self,
        repositories: Repositories,
        *,
        agent_worker: AgentWorkerGateway | None,
        agentic_enabled: bool,
        compiler: ContextCompiler | None = None,
        image_provider: ImageGenerationGateway | None = None,
        media_root: Path = Path("storage"),
        image_model: str = APPROVED_OPENROUTER_IMAGE_MODEL,
        max_reserved_cost_per_asset_usd: float = 1.0,
    ) -> None:
        self._repositories = repositories
        self._agent_worker = agent_worker
        self._agentic_enabled = agentic_enabled
        self._compiler = compiler or ContextCompiler()
        self._image_model = image_model
        self._production = MangaProductionService(
            repositories,
            image_provider=image_provider,
            media_root=media_root,
            image_model=image_model,
            max_reserved_cost_per_asset_usd=max_reserved_cost_per_asset_usd,
        )

    async def execute(self, run_id: str) -> WorkflowExecutionResult:
        run = await self._repositories.get_run(run_id)
        if run is None:
            raise NotFoundError(f"Generation run {run_id} does not exist")
        if run.status in {"cancelled", "superseded", "terminal_failed", "succeeded"}:
            stages = await self._repositories.list_stages(run_id)
            error_code = next(
                (item.error_code for item in reversed(stages) if item.error_code is not None),
                None,
            )
            return WorkflowExecutionResult(
                run_id=run.run_id,
                status=run.status,
                accepted_artifact_ids=[
                    item.artifact_id
                    for item in await self._repositories.list_artifacts(run_id, accepted_only=True)
                ],
                error_code=error_code,
            )

        run.status = "running"
        run.active_stage = "context_compilation"
        run.updated_at = utc_now()
        await self._repositories.save_run(run)

        try:
            context_artifact, context = await self._compile_context(run)
        except Exception as error:
            return await self._fail_without_stage(
                run,
                stage_name="context_compilation",
                error=error,
            )

        if not self._agentic_enabled or self._agent_worker is None:
            return await self._fail_without_stage(
                run,
                stage_name="manga_direction",
                error=AgentWorkerError(
                    "AGENTIC_MANGA_PIPELINE_V1 is disabled or no agent worker is configured"
                ),
                input_artifact_ids=[context_artifact.artifact_id],
            )

        try:
            manga_plan_artifact = await self._run_manga_direction(run, context_artifact, context)
        except Exception as error:
            return await self._fail_without_stage(
                run,
                stage_name="manga_direction",
                error=error,
                input_artifact_ids=[context_artifact.artifact_id],
            )

        try:
            asset_set_artifact = await self._generate_assets(run, manga_plan_artifact)
        except Exception as error:
            return await self._fail_without_stage(
                run,
                stage_name="asset_generation",
                error=error,
                input_artifact_ids=[manga_plan_artifact.artifact_id],
            )
        try:
            rendered_page_set_artifact = await self._compose_rendered_pages(
                run,
                manga_plan_artifact,
                asset_set_artifact,
            )
        except Exception as error:
            return await self._fail_without_stage(
                run,
                stage_name="manga_composition",
                error=error,
                input_artifact_ids=[
                    manga_plan_artifact.artifact_id,
                    asset_set_artifact.artifact_id,
                ],
            )
        try:
            await self._merge_memory(
                run,
                manga_plan_artifact,
                asset_set_artifact,
                rendered_page_set_artifact,
            )
        except Exception as error:
            return await self._fail_without_stage(
                run,
                stage_name="memory_delta_merge",
                error=error,
                input_artifact_ids=[
                    manga_plan_artifact.artifact_id,
                    asset_set_artifact.artifact_id,
                    rendered_page_set_artifact.artifact_id,
                ],
            )
        return await self._succeed_run(run)

    async def _compile_context(self, run: GenerationRunDoc) -> tuple[ArtifactDoc, ContextPack]:
        scope = await self._repositories.get_scope(run.scope_id)
        if scope is None or scope.project_id != run.project_id:
            raise NotFoundError(f"Scope {run.scope_id} is unavailable for run {run.run_id}")
        project = await self._repositories.get_project(run.project_id)
        if project is None:
            raise NotFoundError(f"Manga project {run.project_id} does not exist")
        memory = await self._repositories.get_memory_snapshot(run.project_id, run.memory_version)
        if memory is None:
            raise NotFoundError(
                f"Memory snapshot {run.project_id}@{run.memory_version} does not exist"
            )
        units = await self._repositories.list_source_units(project.book_id)
        constraints = GenerationConstraints(
            image_mode="budgeted",
            max_pages=10,
            max_panels_per_page=7,
            max_sprites=int(run.budget["max_sprites"]),
            max_key_panels=int(run.budget["max_key_panels"]),
            reading_direction="rtl",
            narration_enabled=False,
        )
        required_fact_ids = {
            str(item["fact_id"]) for item in memory.facts if isinstance(item.get("fact_id"), str)
        }
        compile_input_hash = content_hash(
            {
                "scope_hash": scope.scope_hash,
                "memory_hash": memory.content_hash,
                "source_hashes": {
                    item.source_unit_id: item.text_hash
                    for item in units
                    if item.source_unit_id in scope.source_unit_ids
                },
                "constraints": constraints.model_dump(mode="json"),
                "required_fact_ids": sorted(required_fact_ids),
            }
        )
        stage = await self._start_stage(
            run,
            "context_compilation",
            input_artifact_ids=[],
            input_hash=compile_input_hash,
            schema_version="context-pack.v1",
            prompt_version=self._compiler.compiler_version,
        )
        if stage.status == "succeeded" and stage.output_artifact_ids:
            existing = await self._repositories.get_artifact(stage.output_artifact_ids[0])
            if existing is not None and existing.content is not None:
                return existing, ContextPack.model_validate(existing.content)
        context = self._compiler.compile(
            project_id=run.project_id,
            scope=scope,
            memory=memory,
            source_units=units,
            purpose="manga_direction",
            constraints=constraints,
            max_input_tokens=80_000,
            required_fact_ids=required_fact_ids,
        )
        payload = context.model_dump(mode="json")
        source_refs = [
            excerpt.source_ref.model_dump(mode="json") for excerpt in context.source_units
        ]
        artifact = construct_document(
            ArtifactDoc,
            artifact_id=context.context_pack_id,
            project_id=run.project_id,
            run_id=run.run_id,
            kind="context_pack",
            schema_version="context-pack.v1",
            content=payload,
            storage_ref=None,
            content_hash=context.content_hash,
            parent_artifact_ids=[],
            source_refs=source_refs,
            model_receipt=None,
            validation_status="accepted",
            validation_report={
                "passed": True,
                "issues": [],
                "validator_version": self._compiler.compiler_version,
            },
            created_at=utc_now(),
        )
        stored = await self._repositories.save_artifact(artifact)
        await self._succeed_stage(run, stage, [stored.artifact_id])
        return stored, context

    async def _run_manga_direction(
        self,
        run: GenerationRunDoc,
        context_artifact: ArtifactDoc,
        context: ContextPack,
    ) -> ArtifactDoc:
        stage = await self._start_stage(
            run,
            "manga_direction",
            input_artifact_ids=[context_artifact.artifact_id],
            input_hash=context_artifact.content_hash,
            schema_version="manga-plan.v1",
            prompt_version="manga-direction.v1",
        )
        if stage.status == "succeeded" and stage.output_artifact_ids:
            existing = await self._repositories.get_artifact(stage.output_artifact_ids[0])
            existing_receipt = existing.model_receipt if existing is not None else None
            if (
                existing is not None
                and existing_receipt is not None
                and existing_receipt.get("provider") == REQUIRED_MANGA_DIRECTOR_PROVIDER
                and existing_receipt.get("model") == REQUIRED_MANGA_DIRECTOR_MODEL
            ):
                return existing
            raise ArtifactValidationError(
                "Succeeded Manga Director stage lacks the required MiniMax M3 receipt"
            )

        goal = AgentGoal(
            goal_id=f"goal_{stage.idempotency_key[:20]}_{stage.attempt}",
            run_id=run.run_id,
            stage_run_id=stage.stage_run_id,
            goal_type=AgentGoalType.MANGA_DIRECTION,
            output_schema="manga-plan.v1",
            schema_version="manga-plan.v1",
            input_artifact_refs=[
                ArtifactRef(
                    artifact_id=context_artifact.artifact_id,
                    kind="context_pack",
                    schema_version=context_artifact.schema_version,
                    content_hash=context_artifact.content_hash,
                )
            ],
            constraints={
                "max_pages": context.constraints.max_pages,
                "max_sprites": context.constraints.max_sprites,
                "max_key_panels": context.constraints.max_key_panels,
                "reading_direction": context.constraints.reading_direction,
            },
            acceptance_tests=[
                AcceptanceTestRef(
                    test_id="manga_plan_schema",
                    description="Candidate validates as MangaPlan v1.",
                ),
                AcceptanceTestRef(
                    test_id="source_grounding",
                    description="Every plan claim cites persisted source evidence.",
                ),
            ],
            allowed_tools=[
                "get_source_excerpt",
                "get_canon_entity",
                "list_relevant_assets",
                "submit_manga_plan",
                "report_source_conflict",
            ],
            budget=AgentBudget(
                max_steps=int(run.budget["max_agent_steps"]),
                max_tool_calls=max(4, int(run.budget["max_agent_steps"]) * 2),
                max_input_tokens=80_000,
                max_output_tokens=16_000,
                max_repair_attempts=int(run.budget["max_repair_attempts"]),
                max_cost_usd=float(run.budget["max_text_cost_usd"]),
            ),
        )
        if self._agent_worker is None:
            raise AgentWorkerError("Agent worker is not configured")
        result = await self._agent_worker.run(
            goal,
            context,
            instructions=(
                "Produce only the grounded MangaPlan vertical slice. Do not request images "
                "or compose RenderedPage output in this run."
            ),
        )
        try:
            plan = MangaPlan.model_validate(result.candidate)
        except ValidationError as error:
            raise ArtifactValidationError(
                f"Agent worker candidate failed MangaPlan validation: {error}"
            ) from error
        payload = plan.model_dump(mode="json")
        digest = content_hash(payload)
        candidate_id = f"candidate_manga_plan_{digest[:24]}"
        candidate = await self._repositories.get_artifact(candidate_id)
        if (
            candidate is None
            or candidate.run_id != run.run_id
            or candidate.project_id != run.project_id
            or candidate.validation_status != "valid"
            or candidate.content_hash != digest
        ):
            raise ArtifactValidationError(
                "MangaPlan submission was not durably validated by the domain-tool broker"
            )

        trace = result.trace
        provider = trace.get("provider")
        model = trace.get("model")
        skill_hash = trace.get("skill_hash")
        tokens = trace.get("tokens")
        if (
            not isinstance(provider, str)
            or not provider
            or not isinstance(model, str)
            or not model
            or not isinstance(skill_hash, str)
            or not isinstance(tokens, dict)
        ):
            raise ArtifactValidationError("Agent trace omitted model provenance")
        if provider != REQUIRED_MANGA_DIRECTOR_PROVIDER or model != REQUIRED_MANGA_DIRECTOR_MODEL:
            raise ArtifactValidationError(
                "Manga Director must use provider=minimax and model=MiniMax-M3"
            )
        latency_ms = self._optional_int(trace.get("latency_ms"))
        if latency_ms is None:
            raise ArtifactValidationError("Agent trace omitted measured latency_ms")
        receipt = ModelReceipt(
            provider=provider,
            model=model,
            purpose="manga_direction",
            prompt_version="manga-direction.v1",
            skill_hashes=[skill_hash],
            input_artifact_ids=[context_artifact.artifact_id],
            input_tokens=self._optional_int(tokens.get("input")),
            output_tokens=self._optional_int(tokens.get("output")),
            cost_usd=self._optional_float(trace.get("cost_usd")),
            latency_ms=latency_ms,
            attempt=stage.attempt,
            created_at=utc_now(),
        )
        accepted = construct_document(
            ArtifactDoc,
            artifact_id=f"manga_plan_{digest[:24]}",
            project_id=run.project_id,
            run_id=run.run_id,
            kind="manga_plan",
            schema_version="manga-plan.v1",
            content=payload,
            storage_ref=None,
            content_hash=digest,
            parent_artifact_ids=[context_artifact.artifact_id, candidate.artifact_id],
            source_refs=candidate.source_refs,
            model_receipt=receipt.model_dump(mode="json"),
            validation_status="accepted",
            validation_report={
                "passed": True,
                "issues": [],
                "validator_version": "manga-plan-validator.v1",
            },
            created_at=utc_now(),
        )
        stored = await self._repositories.save_artifact(accepted)
        stage.agent_session_id = str(trace.get("session_id") or "") or None
        await self._succeed_stage(run, stage, [stored.artifact_id])
        return stored

    async def _generate_assets(
        self,
        run: GenerationRunDoc,
        manga_plan: ArtifactDoc,
    ) -> ArtifactDoc:
        stage = await self._start_stage(
            run,
            "asset_generation",
            input_artifact_ids=[manga_plan.artifact_id],
            input_hash=content_hash(
                {
                    "manga_plan_hash": manga_plan.content_hash,
                    "max_image_cost_usd": run.budget["max_image_cost_usd"],
                    "max_key_panels": run.budget["max_key_panels"],
                    "image_model": self._image_model,
                }
            ),
            schema_version="asset-set.v1",
            prompt_version="manga-key-panel.v1",
        )
        if stage.status == "succeeded" and stage.output_artifact_ids:
            existing = await self._repositories.get_artifact(stage.output_artifact_ids[0])
            if existing is not None:
                return existing
        timeout_seconds = float(run.budget["max_render_minutes"]) * 60
        if timeout_seconds <= 0:
            raise RenderBudgetTimeoutError(
                "Image generation cannot start because max_render_minutes is zero"
            )
        try:
            async with asyncio.timeout(timeout_seconds):
                artifact = await self._production.generate_assets(
                    run,
                    manga_plan,
                    attempt=stage.attempt,
                )
        except TimeoutError as error:
            raise RenderBudgetTimeoutError(
                "Image generation exceeded max_render_minutes"
            ) from error
        await self._succeed_stage(run, stage, [artifact.artifact_id])
        return artifact

    async def _compose_rendered_pages(
        self,
        run: GenerationRunDoc,
        manga_plan: ArtifactDoc,
        asset_set: ArtifactDoc,
    ) -> ArtifactDoc:
        stage = await self._start_stage(
            run,
            "manga_composition",
            input_artifact_ids=[manga_plan.artifact_id, asset_set.artifact_id],
            input_hash=content_hash(
                {
                    "manga_plan_hash": manga_plan.content_hash,
                    "asset_set_hash": asset_set.content_hash,
                }
            ),
            schema_version="rendered-page-set.v1",
            prompt_version="deterministic-manga-composer.v1",
        )
        if stage.status == "succeeded" and stage.output_artifact_ids:
            existing = await self._repositories.get_artifact(stage.output_artifact_ids[0])
            if existing is not None:
                return existing
        artifact = await self._production.compose_rendered_pages(
            run,
            manga_plan,
            asset_set,
        )
        await self._succeed_stage(run, stage, [artifact.artifact_id])
        return artifact

    async def _merge_memory(
        self,
        run: GenerationRunDoc,
        manga_plan: ArtifactDoc,
        asset_set: ArtifactDoc,
        rendered_page_set: ArtifactDoc,
    ) -> ArtifactDoc:
        inputs = [
            manga_plan.artifact_id,
            asset_set.artifact_id,
            rendered_page_set.artifact_id,
        ]
        stage = await self._start_stage(
            run,
            "memory_delta_merge",
            input_artifact_ids=inputs,
            input_hash=content_hash(
                {
                    "manga_plan_hash": manga_plan.content_hash,
                    "asset_set_hash": asset_set.content_hash,
                    "rendered_page_set_hash": rendered_page_set.content_hash,
                    "base_memory_version": run.memory_version,
                }
            ),
            schema_version="memory-delta.v1",
            prompt_version="accepted-manga-memory-delta.v1",
        )
        if stage.status == "succeeded" and stage.output_artifact_ids:
            existing = await self._repositories.get_artifact(stage.output_artifact_ids[0])
            if existing is not None:
                return existing
        delta = self._production.derive_memory_delta(
            run,
            manga_plan,
            asset_set,
            rendered_page_set,
        )
        artifact = await self._production.persist_memory_delta(run, delta)
        project = await self._repositories.get_project(run.project_id)
        if project is None:
            raise NotFoundError(f"Manga project {run.project_id} does not exist")
        if project.active_memory_version == run.memory_version:
            await MemoryMergeService(
                self._repositories,
                self._repositories,
                self._repositories,
            ).merge(delta)
        elif project.active_memory_version == run.memory_version + 1:
            snapshot = await self._repositories.get_memory_snapshot(
                run.project_id,
                project.active_memory_version,
            )
            if snapshot is None or not set(inputs).issubset(snapshot.source_artifact_ids):
                raise ArtifactValidationError(
                    "Active memory advanced without this accepted manga lineage"
                )
        else:
            raise ArtifactValidationError(
                "Active memory version is incompatible with this generation run"
            )
        await self._succeed_stage(run, stage, [artifact.artifact_id])
        return artifact

    async def _succeed_run(self, run: GenerationRunDoc) -> WorkflowExecutionResult:
        now = utc_now()
        run.status = "succeeded"
        run.active_stage = None
        run.updated_at = now
        await self._repositories.save_run(run)
        accepted = await self._repositories.list_artifacts(run.run_id, accepted_only=True)
        return WorkflowExecutionResult(
            run_id=run.run_id,
            status=run.status,
            accepted_artifact_ids=[item.artifact_id for item in accepted],
            error_code=None,
        )

    async def _start_stage(
        self,
        run: GenerationRunDoc,
        stage_name: str,
        *,
        input_artifact_ids: list[str],
        input_hash: str,
        schema_version: str,
        prompt_version: str,
    ) -> StageRunDoc:
        identity = content_hash(
            {
                "project_id": run.project_id,
                "scope_id": run.scope_id,
                "memory_version": run.memory_version,
                "pipeline_version": run.pipeline_version,
                "stage_name": stage_name,
                "input_hash": input_hash,
                "schema_version": schema_version,
                "prompt_version": prompt_version,
            }
        )
        stage_run_id = f"stage_{stage_name}_{identity[:20]}"
        existing = await self._repositories.get_stage(stage_run_id)
        if existing is not None:
            if existing.status == "retryable_failed":
                max_attempts = int(run.budget["max_repair_attempts"]) + 1
                if existing.attempt < max_attempts:
                    now = utc_now()
                    existing.attempt += 1
                    existing.status = "running"
                    existing.output_artifact_ids = []
                    existing.agent_session_id = None
                    existing.error_code = None
                    existing.error_detail = None
                    existing.started_at = now
                    existing.ended_at = None
                    run.status = "running"
                    run.active_stage = stage_name
                    run.updated_at = now
                    await self._repositories.save_run(run)
                    return await self._repositories.save_stage(existing)
                raise StageRetryExhaustedError(
                    f"Stage {stage_name} exhausted {max_attempts} bounded attempts"
                )
            return existing
        now = utc_now()
        stage = construct_document(
            StageRunDoc,
            stage_run_id=stage_run_id,
            run_id=run.run_id,
            stage_name=stage_name,
            attempt=1,
            status="running",
            input_artifact_ids=input_artifact_ids,
            input_hash=input_hash,
            output_artifact_ids=[],
            idempotency_key=identity,
            agent_session_id=None,
            error_code=None,
            error_detail=None,
            started_at=now,
            ended_at=None,
        )
        run.status = "running"
        run.active_stage = stage_name
        run.updated_at = now
        await self._repositories.save_run(run)
        return await self._repositories.save_stage(stage)

    async def _succeed_stage(
        self, run: GenerationRunDoc, stage: StageRunDoc, output_ids: list[str]
    ) -> None:
        now = utc_now()
        stage.status = "succeeded"
        stage.output_artifact_ids = output_ids
        stage.error_code = None
        stage.error_detail = None
        stage.ended_at = now
        await self._repositories.save_stage(stage)
        run.updated_at = now
        await self._repositories.save_run(run)

    async def _fail_without_stage(
        self,
        run: GenerationRunDoc,
        *,
        stage_name: str,
        error: Exception,
        input_artifact_ids: list[str] | None = None,
    ) -> WorkflowExecutionResult:
        error_code = str(getattr(error, "code", "stage_execution_failed")).upper()
        existing_stages = await self._repositories.list_stages(run.run_id)
        stage = next(
            (
                item
                for item in reversed(existing_stages)
                if item.stage_name == stage_name and item.status != "succeeded"
            ),
            None,
        )
        if stage is None:
            input_hash = content_hash(input_artifact_ids or [run.run_id, stage_name])
            stage = await self._start_stage(
                run,
                stage_name,
                input_artifact_ids=input_artifact_ids or [],
                input_hash=input_hash,
                schema_version="failure.v1",
                prompt_version="none",
            )
        now = utc_now()
        failure_status = (
            "retryable_failed" if bool(getattr(error, "retryable", True)) else "terminal_failed"
        )
        if stage.status != "succeeded":
            stage.status = failure_status
            stage.error_code = error_code[:128]
            stage.error_detail = {"message": str(error)[:2_000]}
            stage.ended_at = now
            await self._repositories.save_stage(stage)
        run.status = failure_status
        run.active_stage = None
        run.updated_at = now
        await self._repositories.save_run(run)
        accepted = await self._repositories.list_artifacts(run.run_id, accepted_only=True)
        return WorkflowExecutionResult(
            run_id=run.run_id,
            status=run.status,
            accepted_artifact_ids=[item.artifact_id for item in accepted],
            error_code=error_code,
        )

    @staticmethod
    def _optional_int(value: Any) -> int | None:
        return value if isinstance(value, int) and value >= 0 else None

    @staticmethod
    def _optional_float(value: Any) -> float | None:
        if isinstance(value, (int, float)) and value >= 0:
            return float(value)
        return None
