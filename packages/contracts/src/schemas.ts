import adaptationBeat from "../schema/adaptation_beat.v1.schema.json" with { type: "json" };
import agentGoal from "../schema/agent_goal.v1.schema.json" with { type: "json" };
import artifact from "../schema/artifact.v1.schema.json" with { type: "json" };
import artifactRef from "../schema/artifact_ref.v1.schema.json" with { type: "json" };
import assetRef from "../schema/asset_ref.v1.schema.json" with { type: "json" };
import assetRequest from "../schema/asset_request.v1.schema.json" with { type: "json" };
import contextPack from "../schema/context_pack.v1.schema.json" with { type: "json" };
import generationRun from "../schema/generation_run.v1.schema.json" with { type: "json" };
import mangaManifest from "../schema/manga_manifest.v1.schema.json" with { type: "json" };
import mangaPlan from "../schema/manga_plan.v1.schema.json" with { type: "json" };
import memoryDelta from "../schema/memory_delta.v1.schema.json" with { type: "json" };
import modelReceipt from "../schema/model_receipt.v1.schema.json" with { type: "json" };
import reelSpec from "../schema/reel_spec.v1.schema.json" with { type: "json" };
import renderedPage from "../schema/rendered_page.v1.schema.json" with { type: "json" };
import scopeManifest from "../schema/scope_manifest.v1.schema.json" with { type: "json" };
import sourceRef from "../schema/source_ref.v1.schema.json" with { type: "json" };
import sourceUnit from "../schema/source_unit.v1.schema.json" with { type: "json" };
import stageRun from "../schema/stage_run.v1.schema.json" with { type: "json" };

export const contractSchemas = {
  "adaptation_beat.v1": adaptationBeat,
  "agent_goal.v1": agentGoal,
  "artifact.v1": artifact,
  "artifact_ref.v1": artifactRef,
  "asset_ref.v1": assetRef,
  "asset_request.v1": assetRequest,
  "context_pack.v1": contextPack,
  "generation_run.v1": generationRun,
  "manga_manifest.v1": mangaManifest,
  "manga_plan.v1": mangaPlan,
  "memory_delta.v1": memoryDelta,
  "model_receipt.v1": modelReceipt,
  "reel_spec.v1": reelSpec,
  "rendered_page.v1": renderedPage,
  "scope_manifest.v1": scopeManifest,
  "source_ref.v1": sourceRef,
  "source_unit.v1": sourceUnit,
  "stage_run.v1": stageRun,
} as const;

export type ContractName = keyof typeof contractSchemas;
