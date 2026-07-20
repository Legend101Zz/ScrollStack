import { renderStill } from "@remotion/renderer";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { REEL_OUTPUT } from "./constants";
import { assertAbsoluteOutputPath, prepareReelRender } from "./render-common";
import type {
  ReelStillRenderOptions,
  ReelStillRenderResult,
} from "./types";

export async function renderReelStill(
  options: ReelStillRenderOptions,
): Promise<ReelStillRenderResult> {
  assertAbsoluteOutputPath(options.outputLocation);
  if (path.extname(options.outputLocation).toLowerCase() !== ".png") {
    throw new Error("reel still outputLocation must end in .png");
  }
  const prepared = await prepareReelRender(options);
  const frame = options.frame ?? 0;
  if (
    !Number.isInteger(frame) ||
    frame < 0 ||
    frame >= prepared.compiled.spec.format.duration_frames
  ) {
    throw new Error("reel still frame must be an integer inside the reel timeline");
  }
  await mkdir(path.dirname(options.outputLocation), { recursive: true });
  const rendered = await renderStill({
    serveUrl: prepared.bundle.serveUrl,
    composition: prepared.composition,
    inputProps: prepared.inputProps,
    output: options.outputLocation,
    frame,
    imageFormat: "png",
    browserExecutable: options.browserExecutable,
    overwrite: options.overwrite ?? false,
    timeoutInMilliseconds: options.timeoutInMilliseconds,
    logLevel: "warn",
  });

  return Object.freeze({
    outputLocation: options.outputLocation,
    contentType: rendered.contentType,
    frame,
    width: REEL_OUTPUT.width,
    height: REEL_OUTPUT.height,
  });
}
