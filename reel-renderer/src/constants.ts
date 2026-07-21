export const REEL_COMPOSITION_ID = "ScrollStackReel";

/** Bumped with any change that can alter rendered output. Recorded in every RenderReceipt. */
export const REEL_RENDERER_VERSION = "0.1.0";

export const REEL_OUTPUT = Object.freeze({
  width: 1080,
  height: 1920,
  fps: 30,
  codec: "h264" as const,
  audioCodec: "aac" as const,
  pixelFormat: "yuv420p" as const,
  audioSampleRate: 48_000,
});

export const REEL_MEDIA_ENCODING_OPTIONS = Object.freeze({
  codec: REEL_OUTPUT.codec,
  audioCodec: REEL_OUTPUT.audioCodec,
  pixelFormat: REEL_OUTPUT.pixelFormat,
  sampleRate: REEL_OUTPUT.audioSampleRate,
  enforceAudioTrack: true,
  imageFormat: "jpeg" as const,
  colorSpace: "bt709" as const,
  x264Preset: "medium" as const,
});
