import { collectReelValidationIssues } from "@scrollstack/reel-components";
import type { ReelCompilationInput } from "@scrollstack/reel-components";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { REEL_OUTPUT, REEL_RENDERER_VERSION } from "./constants";
import { createReelRender } from "./render-media";
import { renderReelStill } from "./render-still";
import type {
  ProbedMedia,
  RenderReceipt,
  RenderValidationCheck,
  RenderValidationReport,
  ReelReceiptRenderOptions,
  ReelReceiptRenderResult,
} from "./types";

type ReelSpec = ReelCompilationInput["spec"];

const execFileAsync = promisify(execFile);
const DURATION_TOLERANCE_SECONDS = 0.1;

/**
 * Canonical JSON so the same spec always hashes the same way regardless of key
 * order or how it travelled through the control plane.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function hashReelSpec(spec: ReelSpec): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(spec))).digest("hex");
}

type RawProbe = Readonly<{
  streams?: readonly Readonly<Record<string, unknown>>[];
  format?: Readonly<Record<string, unknown>>;
}>;

export function parseProbe(stdout: string): ProbedMedia {
  const probe = JSON.parse(stdout) as RawProbe;
  const streams = probe.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.find((stream) => stream.codec_type === "audio");
  const [numerator, denominator] = String(video?.avg_frame_rate ?? "0/1").split("/");
  const fpsDenominator = Number(denominator);
  return Object.freeze({
    videoCodec: video?.codec_name === undefined ? undefined : String(video.codec_name),
    audioCodec: audio?.codec_name === undefined ? undefined : String(audio.codec_name),
    width: video?.width === undefined ? undefined : Number(video.width),
    height: video?.height === undefined ? undefined : Number(video.height),
    fps: fpsDenominator ? Number(numerator) / fpsDenominator : undefined,
    audioSampleRate: audio?.sample_rate === undefined ? undefined : Number(audio.sample_rate),
    durationSeconds: probe.format?.duration === undefined ? undefined : Number(probe.format.duration),
  });
}

function check(name: string, passed: boolean, detail: string): RenderValidationCheck {
  return Object.freeze({ name, passed, detail });
}

export function buildValidationReport(
  probe: ProbedMedia,
  expectedDurationFrames: number,
  specIssues: readonly { code: string; path: string; message: string }[],
): RenderValidationReport {
  const expectedSeconds = expectedDurationFrames / REEL_OUTPUT.fps;
  const checks: RenderValidationCheck[] = [
    check("spec_validates", specIssues.length === 0, specIssues.map((i) => `${i.path}: ${i.message}`).join("; ") || "no issues"),
    check("video_codec", probe.videoCodec === REEL_OUTPUT.codec, `expected ${REEL_OUTPUT.codec}, got ${probe.videoCodec}`),
    check("audio_codec", probe.audioCodec === REEL_OUTPUT.audioCodec, `expected ${REEL_OUTPUT.audioCodec}, got ${probe.audioCodec}`),
    check(
      "dimensions",
      probe.width === REEL_OUTPUT.width && probe.height === REEL_OUTPUT.height,
      `expected ${REEL_OUTPUT.width}x${REEL_OUTPUT.height}, got ${probe.width}x${probe.height}`,
    ),
    check("frame_rate", probe.fps === REEL_OUTPUT.fps, `expected ${REEL_OUTPUT.fps}, got ${probe.fps}`),
    check(
      "audio_sample_rate",
      probe.audioSampleRate === REEL_OUTPUT.audioSampleRate,
      `expected ${REEL_OUTPUT.audioSampleRate}, got ${probe.audioSampleRate}`,
    ),
    check(
      "duration",
      // The MP4 container may carry a few AAC priming samples past the video timeline.
      probe.durationSeconds !== undefined &&
        Math.abs(probe.durationSeconds - expectedSeconds) <= DURATION_TOLERANCE_SECONDS,
      `expected ~${expectedSeconds.toFixed(3)}s, got ${probe.durationSeconds}s`,
    ),
  ];
  return Object.freeze({
    passed: checks.every((item) => item.passed),
    checks: Object.freeze(checks),
  });
}

async function probeMedia(filePath: string, ffprobeExecutable: string): Promise<ProbedMedia> {
  const { stdout } = await execFileAsync(ffprobeExecutable, [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    filePath,
  ]);
  return parseProbe(stdout);
}

/**
 * Renders the MP4, a poster frame, and the RenderReceipt that technical-imp.md
 * 13.6 requires. Storage refs are local paths here; the control plane rewrites
 * them when it uploads the media and persists the receipt as an artifact.
 */
export async function renderReelWithReceipt(
  options: ReelReceiptRenderOptions,
): Promise<ReelReceiptRenderResult> {
  const outputLocation = options.outputLocation;
  const thumbnailLocation =
    options.thumbnailLocation ??
    path.join(path.dirname(outputLocation), `${path.basename(outputLocation, ".mp4")}-poster.png`);
  const ffprobeExecutable =
    options.ffprobeExecutable ?? process.env.SCROLLSTACK_FFPROBE_EXECUTABLE ?? "ffprobe";

  const spec = options.input.spec;
  const durationFrames = spec.format.duration_frames;
  // A poster frame from the opening quarter shows real content, not a fade-in.
  const posterFrame = options.posterFrame ?? Math.min(durationFrames - 1, Math.floor(durationFrames / 4));

  const startedAt = Date.now();
  const media = await createReelRender({
    input: options.input,
    outputLocation,
    bundle: options.bundle,
    browserExecutable: options.browserExecutable,
    concurrency: options.concurrency,
    overwrite: options.overwrite,
    timeoutInMilliseconds: options.timeoutInMilliseconds,
    onProgress: options.onProgress,
  }).result;
  const still = await renderReelStill({
    input: options.input,
    outputLocation: thumbnailLocation,
    frame: posterFrame,
    bundle: options.bundle,
    browserExecutable: options.browserExecutable,
    overwrite: options.overwrite,
    timeoutInMilliseconds: options.timeoutInMilliseconds,
  });
  const renderTimeMs = Date.now() - startedAt;

  const probe = await probeMedia(outputLocation, ffprobeExecutable);
  const receipt: RenderReceipt = Object.freeze({
    renderId: options.renderId ?? `render_${randomUUID().replaceAll("-", "")}`,
    reelId: spec.reel_id,
    reelSpecHash: hashReelSpec(spec),
    rendererVersion: REEL_RENDERER_VERSION,
    componentVersions: media.componentVersions,
    outputStorageRef: outputLocation,
    thumbnailStorageRef: still.outputLocation,
    codec: REEL_OUTPUT.codec,
    width: REEL_OUTPUT.width,
    height: REEL_OUTPUT.height,
    fps: REEL_OUTPUT.fps,
    durationMs: Math.round((durationFrames / REEL_OUTPUT.fps) * 1000),
    outputBytes: (await stat(outputLocation)).size,
    renderTimeMs,
    validationReport: buildValidationReport(
      probe,
      durationFrames,
      collectReelValidationIssues(options.input),
    ),
  });

  return Object.freeze({ receipt, media, still, probe });
}
