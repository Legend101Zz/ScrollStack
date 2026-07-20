import { previewReelCompilationInput } from "@scrollstack/reel-components";
import { execFile } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getOrCreateReelBundle } from "../src/remotion-bundle";
import { createReelRender } from "../src/render-media";
import { renderReelStill } from "../src/render-still";

const runIntegration = process.env.SCROLLSTACK_RENDER_INTEGRATION === "1";
const browserExecutable = process.env.SCROLLSTACK_BROWSER_EXECUTABLE;
const ffprobeExecutable = process.env.SCROLLSTACK_FFPROBE_EXECUTABLE ?? "ffprobe";
const execFileAsync = promisify(execFile);

type ProbedStream = Readonly<{
  codec_name?: string;
  codec_type?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  sample_rate?: string;
}>;

type ProbedFormat = Readonly<{
  duration?: string;
}>;

describe.skipIf(!runIntegration)("Remotion reel rendering", () => {
  let outputRoot = "";

  beforeAll(async () => {
    outputRoot = await mkdtemp(path.join(tmpdir(), "scrollstack-reel-render-"));
    await getOrCreateReelBundle();
  }, 120_000);

  afterAll(async () => {
    if (outputRoot) await rm(outputRoot, { recursive: true, force: true });
  });

  it("renders a deterministic representative still", async () => {
    const outputLocation = path.join(outputRoot, "preview.png");
    const result = await renderReelStill({
      input: previewReelCompilationInput,
      outputLocation,
      frame: 195,
      browserExecutable,
    });

    expect(result).toMatchObject({
      contentType: "image/png",
      frame: 195,
      width: 1080,
      height: 1920,
    });
    expect((await stat(outputLocation)).size).toBeGreaterThan(0);
  }, 120_000);

  it("renders one complete fixture as H.264/AAC MP4", async () => {
    const outputLocation = path.join(outputRoot, "preview.mp4");
    const controller = createReelRender({
      input: previewReelCompilationInput,
      outputLocation,
      concurrency: 1,
      browserExecutable,
    });
    const result = await controller.result;

    expect(result).toMatchObject({
      outputLocation,
      codec: "h264",
      audioCodec: "aac",
      pixelFormat: "yuv420p",
      audioSampleRate: 48_000,
      width: 1080,
      height: 1920,
      fps: 30,
      durationFrames: 390,
    });
    expect((await stat(outputLocation)).size).toBeGreaterThan(0);

    const { stdout } = await execFileAsync(ffprobeExecutable, [
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      outputLocation,
    ]);
    const probe = JSON.parse(stdout) as {
      streams: ProbedStream[];
      format?: ProbedFormat;
    };
    const video = probe.streams.find((stream) => stream.codec_type === "video");
    const audio = probe.streams.find((stream) => stream.codec_type === "audio");
    expect(video).toMatchObject({
      codec_name: "h264",
      width: 1080,
      height: 1920,
      avg_frame_rate: "30/1",
    });
    expect(audio).toMatchObject({
      codec_name: "aac",
      sample_rate: "48000",
    });
    const expectedDurationSeconds = result.durationFrames / result.fps;
    const encodedDurationSeconds = Number(probe.format?.duration);
    expect(Number.isFinite(encodedDurationSeconds)).toBe(true);
    // The MP4 container may include a few AAC priming/padding samples beyond
    // the exact 390-frame video timeline.
    expect(Math.abs(encodedDurationSeconds - expectedDurationSeconds)).toBeLessThanOrEqual(0.1);
  }, 300_000);
});
