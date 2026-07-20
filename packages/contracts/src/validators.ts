import {
  Ajv2020,
  type AnySchema,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import type {
  AgentGoal,
  ArtifactRef,
  ContextPack,
  MangaManifest,
  MangaPlan,
  ReelPlayerPayload,
  ReelSeries,
  ReelSpec,
  RenderedPage,
  SeriesProgress,
  SeriesProgressUpdate,
} from "./generated/index.js";
import { contractSchemas, type ContractName } from "./schemas.js";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const applyFormats = addFormats as unknown as (instance: Ajv2020) => Ajv2020;
applyFormats(ajv);

function schemaForAjv(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(schemaForAjv);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "discriminator")
      .map(([key, nested]) => [key, schemaForAjv(nested)]),
  );
}

const schemaValidators = Object.fromEntries(
  Object.entries(contractSchemas).map(([name, schema]) => [
    name,
    ajv.compile(schemaForAjv(schema) as AnySchema),
  ]),
) as Record<ContractName, ValidateFunction<unknown>>;

export type ValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: ErrorObject[] };

export function getContractValidator(name: ContractName): ValidateFunction<unknown> {
  return schemaValidators[name];
}

export function validateContract(name: ContractName, value: unknown): ValidationResult {
  const validator = schemaValidators[name];
  const valid = validator(value);
  return valid
    ? { valid: true, errors: [] }
    : { valid: false, errors: validator.errors ? [...validator.errors] : [] };
}

export const isAgentGoal = (value: unknown): value is AgentGoal =>
  validateContract("agent_goal.v1", value).valid;

export const isArtifactRef = (value: unknown): value is ArtifactRef =>
  validateContract("artifact_ref.v1", value).valid;

export const isContextPack = (value: unknown): value is ContextPack =>
  validateContract("context_pack.v1", value).valid;

export const isMangaManifest = (value: unknown): value is MangaManifest =>
  validateContract("manga_manifest.v1", value).valid;

export const isMangaPlan = (value: unknown): value is MangaPlan =>
  validateContract("manga_plan.v1", value).valid;

export const isReelSpec = (value: unknown): value is ReelSpec =>
  validateContract("reel_spec.v1", value).valid;

export const isReelPlayerPayload = (value: unknown): value is ReelPlayerPayload =>
  validateContract("reel_player_payload.v1", value).valid;

export const isReelSeries = (value: unknown): value is ReelSeries =>
  validateContract("reel_series.v1", value).valid;

export const isRenderedPage = (value: unknown): value is RenderedPage =>
  validateContract("rendered_page.v1", value).valid;

export const isSeriesProgress = (value: unknown): value is SeriesProgress =>
  validateContract("series_progress.v1", value).valid;

export const isSeriesProgressUpdate = (value: unknown): value is SeriesProgressUpdate =>
  validateContract("series_progress_update.v1", value).valid;
