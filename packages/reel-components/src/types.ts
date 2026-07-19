import type { MangaManifest, ReelSpec } from "@scrollstack/contracts";

export type ReelScene = ReelSpec["scenes"][number];
export type ManifestPanel = MangaManifest["panels"][number];

export type ResolvedReelAsset = Readonly<{
  assetId: string;
  contentHash: string;
  kind: "image" | "audio" | "caption_track";
  src: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationMs?: number;
}>;

export type CaptionCue = Readonly<{
  text: string;
  startFrame: number;
  endFrame: number;
  speakerId?: string;
}>;

export type ReelCompilationInput = Readonly<{
  spec: ReelSpec;
  manga: MangaManifest;
  assets: Readonly<Record<string, ResolvedReelAsset>>;
  captions: readonly CaptionCue[];
}>;

export type ReelComponentId =
  | "panel_focus"
  | "split_panel_reveal"
  | "dialogue_exchange"
  | "impact_cut"
  | "narrator_card"
  | "page_turn"
  | "panel_montage";

export type CompiledScene = Readonly<{
  scene: ReelScene;
  componentId: ReelComponentId;
  componentVersion: string;
  startFrame: number;
  durationFrames: number;
  panelAssetIds: Readonly<Record<string, string>>;
}>;

export type CompiledReel = Readonly<{
  spec: ReelSpec;
  manga: MangaManifest;
  assets: Readonly<Record<string, ResolvedReelAsset>>;
  captions: readonly CaptionCue[];
  scenes: readonly CompiledScene[];
  componentVersions: Readonly<Record<string, string>>;
}>;

export type ReelCompositionProps = Readonly<{
  compiled: CompiledReel;
}>;

export type ReelValidationIssueCode =
  | "invalid_reel_spec"
  | "invalid_manga_manifest"
  | "invalid_style_kit"
  | "invalid_timeline"
  | "invalid_component"
  | "invalid_reference"
  | "invalid_asset"
  | "invalid_caption"
  | "text_overflow";

export type ReelValidationIssue = Readonly<{
  code: ReelValidationIssueCode;
  path: string;
  message: string;
}>;

export class ReelValidationError extends Error {
  readonly issues: readonly ReelValidationIssue[];

  constructor(issues: readonly ReelValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "ReelValidationError";
    this.issues = issues;
  }
}
