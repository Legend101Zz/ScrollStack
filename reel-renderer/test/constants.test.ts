import { describe, expect, it } from "vitest";

import {
  REEL_MEDIA_ENCODING_OPTIONS,
  REEL_OUTPUT,
} from "../src/constants";

describe("reel output contract", () => {
  it("pins the production video and audio format", () => {
    expect(REEL_OUTPUT).toEqual({
      width: 1080,
      height: 1920,
      fps: 30,
      codec: "h264",
      audioCodec: "aac",
      pixelFormat: "yuv420p",
      audioSampleRate: 48_000,
    });
    expect(REEL_MEDIA_ENCODING_OPTIONS).toMatchObject({
      codec: "h264",
      audioCodec: "aac",
      pixelFormat: "yuv420p",
      sampleRate: 48_000,
      enforceAudioTrack: true,
    });
    expect(REEL_MEDIA_ENCODING_OPTIONS).not.toHaveProperty("ffmpegOverride");
  });
});
