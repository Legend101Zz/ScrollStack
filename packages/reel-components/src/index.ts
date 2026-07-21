export { ReelComposition } from "./ReelComposition";
export {
  REEL_COMPONENTS_VERSION,
  SCROLLSTACK_STYLE_KIT_ID,
  isReelComponentId,
  reelComponentCatalog,
  reelComponentDefinitions,
  supportedStyleKits,
  type ReelComponentDefinition,
  type SafeZonePolicy,
} from "./catalog";
export { compileReel } from "./compile";
export { deriveReelSpecs, type DeriveReelSpecsOptions } from "./derive-reel-specs";
export { previewCompiledReel, previewMangaManifest, previewReelCompilationInput, previewReelSpec } from "./preview-fixture";
export { reelComponentRegistry, type ReelSceneRenderer } from "./registry";
export type { SceneRendererProps } from "./scenes/shared";
export type {
  CaptionCue,
  CompiledReel,
  CompiledScene,
  ManifestPanel,
  ReelCompilationInput,
  ReelComponentId,
  ReelCompositionProps,
  ReelScene,
  ReelValidationIssue,
  ReelValidationIssueCode,
  ResolvedReelAsset,
} from "./types";
export { ReelValidationError } from "./types";
export {
  assertReelCompilationInput,
  collectReelValidationIssues,
  reelTextLimits,
} from "./validation";
