import { previewReelSpec } from "@scrollstack/reel-components";
import type { ReelCompilationInput } from "@scrollstack/reel-components";
import { describe, expect, it } from "vitest";

import { buildValidationReport, hashReelSpec, parseProbe } from "../src/render-receipt";

type ReelSpec = ReelCompilationInput["spec"];

const GOOD_PROBE = JSON.stringify({
  streams: [
    { codec_type: "video", codec_name: "h264", width: 1080, height: 1920, avg_frame_rate: "30/1" },
    { codec_type: "audio", codec_name: "aac", sample_rate: "48000" },
  ],
  format: { duration: "13.000000" },
});

function checkNamed(report: ReturnType<typeof buildValidationReport>, name: string) {
  const found = report.checks.find((item) => item.name === name);
  if (!found) throw new Error(`missing check: ${name}`);
  return found;
}

describe("hashReelSpec", () => {
  it("is stable across key order", () => {
    const reordered = Object.fromEntries(
      Object.entries(previewReelSpec).reverse(),
    ) as unknown as ReelSpec;
    expect(hashReelSpec(reordered)).toBe(hashReelSpec(previewReelSpec));
  });

  it("changes when the timeline changes", () => {
    const edited = {
      ...previewReelSpec,
      format: { ...previewReelSpec.format, duration_frames: previewReelSpec.format.duration_frames + 1 },
    } as ReelSpec;
    expect(hashReelSpec(edited)).not.toBe(hashReelSpec(previewReelSpec));
  });

  it("returns a lowercase sha256", () => {
    expect(hashReelSpec(previewReelSpec)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("parseProbe", () => {
  it("normalizes ffprobe output", () => {
    expect(parseProbe(GOOD_PROBE)).toStrictEqual({
      videoCodec: "h264",
      audioCodec: "aac",
      width: 1080,
      height: 1920,
      fps: 30,
      audioSampleRate: 48_000,
      durationSeconds: 13,
    });
  });

  it("reports missing streams as undefined rather than guessing", () => {
    const probe = parseProbe(JSON.stringify({ streams: [], format: {} }));
    expect(probe.videoCodec).toBeUndefined();
    expect(probe.audioCodec).toBeUndefined();
    expect(probe.durationSeconds).toBeUndefined();
  });
});

describe("buildValidationReport", () => {
  it("passes a conforming render", () => {
    const report = buildValidationReport(parseProbe(GOOD_PROBE), 390, []);
    expect(report.passed).toBe(true);
    expect(report.checks).toHaveLength(7);
  });

  it("fails on a wrong codec", () => {
    const probe = parseProbe(GOOD_PROBE.replace('"h264"', '"vp9"'));
    const report = buildValidationReport(probe, 390, []);
    expect(report.passed).toBe(false);
    expect(checkNamed(report, "video_codec").passed).toBe(false);
  });

  it("fails on wrong dimensions", () => {
    const probe = parseProbe(GOOD_PROBE.replace("1080", "720"));
    expect(checkNamed(buildValidationReport(probe, 390, []), "dimensions").passed).toBe(false);
  });

  it("tolerates AAC priming padding but not a real duration mismatch", () => {
    const nearly = parseProbe(GOOD_PROBE.replace('"13.000000"', '"13.05"'));
    expect(checkNamed(buildValidationReport(nearly, 390, []), "duration").passed).toBe(true);
    const off = parseProbe(GOOD_PROBE.replace('"13.000000"', '"12.0"'));
    expect(checkNamed(buildValidationReport(off, 390, []), "duration").passed).toBe(false);
  });

  it("fails when the spec itself did not validate", () => {
    const report = buildValidationReport(parseProbe(GOOD_PROBE), 390, [
      { code: "invalid_timeline", path: "spec.scenes.0", message: "bad" },
    ]);
    expect(report.passed).toBe(false);
    expect(checkNamed(report, "spec_validates").detail).toContain("spec.scenes.0");
  });

  it("fails a silent-but-absent audio track", () => {
    const probe = parseProbe(JSON.stringify({ streams: [
      { codec_type: "video", codec_name: "h264", width: 1080, height: 1920, avg_frame_rate: "30/1" },
    ], format: { duration: "13.0" } }));
    const report = buildValidationReport(probe, 390, []);
    expect(checkNamed(report, "audio_codec").passed).toBe(false);
  });
});
