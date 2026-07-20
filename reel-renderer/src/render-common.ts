import { selectComposition } from "@remotion/renderer";
import {
  compileReel,
  type CompiledReel,
  type ReelCompilationInput,
  type ReelCompositionProps,
} from "@scrollstack/reel-components";
import path from "node:path";
import type { VideoConfig } from "remotion/no-react";

import { REEL_COMPOSITION_ID, REEL_OUTPUT } from "./constants";
import { assertOfflineAssetSources } from "./offline-assets";
import { getOrCreateReelBundle } from "./remotion-bundle";
import type { ReelBundle } from "./types";

export type PreparedReelRender = Readonly<{
  bundle: ReelBundle;
  compiled: CompiledReel;
  inputProps: Record<string, unknown>;
  composition: VideoConfig;
}>;

export function assertAbsoluteOutputPath(outputLocation: string): void {
  if (!path.isAbsolute(outputLocation)) {
    throw new Error("reel render outputLocation must be an absolute path");
  }
}

function assertFixedOutput(compiled: CompiledReel): void {
  const format = compiled.spec.format;
  if (
    format.width !== REEL_OUTPUT.width ||
    format.height !== REEL_OUTPUT.height ||
    format.fps !== REEL_OUTPUT.fps
  ) {
    throw new Error("reel renderer only accepts 1080x1920 video at 30fps");
  }
}

function assertCompositionMetadata(
  composition: VideoConfig,
  compiled: CompiledReel,
): void {
  if (
    composition.width !== REEL_OUTPUT.width ||
    composition.height !== REEL_OUTPUT.height ||
    composition.fps !== REEL_OUTPUT.fps ||
    composition.durationInFrames !== compiled.spec.format.duration_frames
  ) {
    throw new Error("selected Remotion composition metadata does not match ReelSpec");
  }
}

export async function prepareReelRender(options: {
  input: ReelCompilationInput;
  bundle?: ReelBundle;
  browserExecutable?: string;
  timeoutInMilliseconds?: number;
}): Promise<PreparedReelRender> {
  const compiled = compileReel(options.input);
  assertFixedOutput(compiled);
  assertOfflineAssetSources(compiled);
  const compositionProps: ReelCompositionProps = { compiled };
  const inputProps: Record<string, unknown> = { ...compositionProps };
  const reelBundle = options.bundle ?? (await getOrCreateReelBundle());
  const composition = await selectComposition({
    serveUrl: reelBundle.serveUrl,
    id: REEL_COMPOSITION_ID,
    inputProps,
    browserExecutable: options.browserExecutable,
    timeoutInMilliseconds: options.timeoutInMilliseconds,
    logLevel: "warn",
  });
  assertCompositionMetadata(composition, compiled);
  return Object.freeze({
    bundle: reelBundle,
    compiled,
    inputProps,
    composition,
  });
}
