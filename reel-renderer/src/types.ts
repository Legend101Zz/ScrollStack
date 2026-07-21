import type {
  ReelCompilationInput,
  ResolvedReelAsset,
} from "@scrollstack/reel-components";

export type ReelBundle = Readonly<{
  serveUrl: string;
  assetRoot: string;
  entryPoint: string;
}>;

export type ReelBundleOptions = Readonly<{
  entryPoint?: string;
  outDir?: string;
  publicDir?: string | null;
  onProgress?: (progress: number) => void;
}>;

export type ReelRenderProgress = Readonly<{
  progress: number;
  renderedFrames: number;
  encodedFrames: number;
  stitchStage: "encoding" | "muxing";
}>;

export type ReelMediaRenderOptions = Readonly<{
  input: ReelCompilationInput;
  outputLocation: string;
  bundle?: ReelBundle;
  browserExecutable?: string;
  concurrency?: 1 | 2;
  overwrite?: boolean;
  timeoutInMilliseconds?: number;
  onProgress?: (progress: ReelRenderProgress) => void;
}>;

export type ReelRenderResult = Readonly<{
  outputLocation: string;
  contentType: string;
  width: 1080;
  height: 1920;
  fps: 30;
  durationFrames: number;
  codec: "h264";
  audioCodec: "aac";
  pixelFormat: "yuv420p";
  audioSampleRate: 48_000;
  componentVersions: Readonly<Record<string, string>>;
}>;

export type ReelRenderController<T = ReelRenderResult> = Readonly<{
  cancel: () => void;
  result: Promise<T>;
}>;

export type ReelStillRenderOptions = Readonly<{
  input: ReelCompilationInput;
  outputLocation: string;
  frame?: number;
  bundle?: ReelBundle;
  browserExecutable?: string;
  overwrite?: boolean;
  timeoutInMilliseconds?: number;
}>;

export type ReelStillRenderResult = Readonly<{
  outputLocation: string;
  contentType: string;
  frame: number;
  width: 1080;
  height: 1920;
}>;

export type ProbedMedia = Readonly<{
  videoCodec?: string;
  audioCodec?: string;
  width?: number;
  height?: number;
  fps?: number;
  audioSampleRate?: number;
  durationSeconds?: number;
}>;

export type RenderValidationCheck = Readonly<{
  name: string;
  passed: boolean;
  detail: string;
}>;

export type RenderValidationReport = Readonly<{
  passed: boolean;
  checks: readonly RenderValidationCheck[];
}>;

// ponytail: local shape until the canonical Pydantic RenderReceipt lands. Field
// names match technical-imp.md 13.6 so the contract can adopt them verbatim.
export type RenderReceipt = Readonly<{
  renderId: string;
  reelId: string;
  reelSpecHash: string;
  rendererVersion: string;
  componentVersions: Readonly<Record<string, string>>;
  outputStorageRef: string;
  thumbnailStorageRef: string;
  codec: string;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  outputBytes: number;
  renderTimeMs: number;
  validationReport: RenderValidationReport;
}>;

export type ReelReceiptRenderOptions = ReelMediaRenderOptions &
  Readonly<{
    thumbnailLocation?: string;
    posterFrame?: number;
    ffprobeExecutable?: string;
    renderId?: string;
  }>;

export type ReelReceiptRenderResult = Readonly<{
  receipt: RenderReceipt;
  media: ReelRenderResult;
  still: ReelStillRenderResult;
  probe: ProbedMedia;
}>;

export type LocalReelAssetSource = Readonly<{
  assetId: string;
  contentHash: string;
  kind: ResolvedReelAsset["kind"];
  mimeType: string;
  localPath: string;
  width?: number;
  height?: number;
  durationMs?: number;
}>;

export type StageReelAssetsOptions = Readonly<{
  bundle: ReelBundle;
  namespace: string;
  allowedSourceRoot: string;
  sources: readonly LocalReelAssetSource[];
}>;

export interface ReelAssetStager {
  stage(
    options: StageReelAssetsOptions,
  ): Promise<Readonly<Record<string, ResolvedReelAsset>>>;
  cleanup(bundle: ReelBundle, namespace: string): Promise<void>;
}
