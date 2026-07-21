/**
 * Reviewed, rights-cleared one-shot sounds. Registered exactly like the
 * component catalog: a fixed reviewed set, versioned, never fetched at run time.
 * Provenance and licenses are recorded in `assets/audio/PROVENANCE.md`.
 */
export const REEL_AUDIO_KIT_VERSION = "1.0.0";

export type ReelAudioKitSoundId =
  | "sfx_whoosh"
  | "sfx_whip"
  | "sfx_page_turn"
  | "sfx_shutter";

export type ReelAudioKitSound = Readonly<{
  soundId: ReelAudioKitSoundId;
  fileName: string;
  /** sha256 of the vendored file; the staged path must match it. */
  contentHash: string;
  durationMs: number;
  mimeType: string;
  license: "CC0";
}>;

function sound(value: ReelAudioKitSound): ReelAudioKitSound {
  return Object.freeze(value);
}

export const reelAudioKit: readonly ReelAudioKitSound[] = Object.freeze([
  sound({
    soundId: "sfx_whoosh",
    fileName: "whoosh.wav",
    contentHash: "44e6e981d87270308bcc9c0f74e7bc9383442b8d6c1341b80add2d5568d347d8",
    durationMs: 154,
    mimeType: "audio/wav",
    license: "CC0",
  }),
  sound({
    soundId: "sfx_whip",
    fileName: "whip.wav",
    contentHash: "e106f4225d626ee1d37a57867947fadf773b06094484bd5d8584f0c028414c89",
    durationMs: 173,
    mimeType: "audio/wav",
    license: "CC0",
  }),
  sound({
    soundId: "sfx_page_turn",
    fileName: "page-turn.wav",
    contentHash: "6c9ecf4499ae650a156f5413e1327cb6d6511a72eba1cf9012e78a41847e4617",
    durationMs: 400,
    mimeType: "audio/wav",
    license: "CC0",
  }),
  sound({
    soundId: "sfx_shutter",
    fileName: "shutter-modern.wav",
    contentHash: "4dc8540a8a1700a35e2d2b0a684d1ca28360b9eb27b9384f15dee827dec18da8",
    durationMs: 489,
    mimeType: "audio/wav",
    license: "CC0",
  }),
]);

export const reelAudioKitSounds: Readonly<Record<ReelAudioKitSoundId, ReelAudioKitSound>> =
  Object.freeze(
    Object.fromEntries(reelAudioKit.map((item) => [item.soundId, item])) as Record<
      ReelAudioKitSoundId,
      ReelAudioKitSound
    >,
  );

export function isReelAudioKitSoundId(value: string): value is ReelAudioKitSoundId {
  return Object.hasOwn(reelAudioKitSounds, value);
}
