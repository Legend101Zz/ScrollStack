import {
  makeCancelSignal,
  renderMedia,
  type CancelSignal,
} from "@remotion/renderer";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import { REEL_MEDIA_ENCODING_OPTIONS, REEL_OUTPUT } from "./constants";
import { assertAbsoluteOutputPath, prepareReelRender } from "./render-common";
import type {
  ReelMediaRenderOptions,
  ReelRenderController,
  ReelRenderResult,
} from "./types";

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function runReelMediaRender(
  options: ReelMediaRenderOptions,
  cancelSignal: CancelSignal,
): Promise<ReelRenderResult> {
  assertAbsoluteOutputPath(options.outputLocation);
  if (path.extname(options.outputLocation).toLowerCase() !== ".mp4") {
    throw new Error("reel media outputLocation must end in .mp4");
  }
  if (options.concurrency !== undefined && ![1, 2].includes(options.concurrency)) {
    throw new Error("reel render concurrency must be 1 or 2");
  }

  const outputExisted = await exists(options.outputLocation);
  await mkdir(path.dirname(options.outputLocation), { recursive: true });
  try {
    const prepared = await prepareReelRender(options);
    const rendered = await renderMedia({
      ...REEL_MEDIA_ENCODING_OPTIONS,
      serveUrl: prepared.bundle.serveUrl,
      composition: prepared.composition,
      inputProps: prepared.inputProps,
      outputLocation: options.outputLocation,
      browserExecutable: options.browserExecutable,
      concurrency: options.concurrency ?? 1,
      overwrite: options.overwrite ?? false,
      timeoutInMilliseconds: options.timeoutInMilliseconds,
      cancelSignal,
      logLevel: "warn",
      onProgress: ({
        progress,
        renderedFrames,
        encodedFrames,
        stitchStage,
      }) =>
        options.onProgress?.({
          progress,
          renderedFrames,
          encodedFrames,
          stitchStage,
        }),
    });

    return Object.freeze({
      outputLocation: options.outputLocation,
      contentType: rendered.contentType,
      width: REEL_OUTPUT.width,
      height: REEL_OUTPUT.height,
      fps: REEL_OUTPUT.fps,
      durationFrames: prepared.compiled.spec.format.duration_frames,
      codec: REEL_OUTPUT.codec,
      audioCodec: REEL_OUTPUT.audioCodec,
      pixelFormat: REEL_OUTPUT.pixelFormat,
      audioSampleRate: REEL_OUTPUT.audioSampleRate,
      componentVersions: prepared.compiled.componentVersions,
    });
  } catch (error) {
    if (!outputExisted) await rm(options.outputLocation, { force: true });
    throw error;
  }
}

export function createReelRender(
  options: ReelMediaRenderOptions,
): ReelRenderController {
  const { cancel, cancelSignal } = makeCancelSignal();
  return Object.freeze({
    cancel,
    result: runReelMediaRender(options, cancelSignal),
  });
}
