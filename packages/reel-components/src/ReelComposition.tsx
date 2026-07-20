import { Audio } from "@remotion/media";
import { colors } from "@scrollstack/design-tokens";
import { AbsoluteFill, Sequence } from "remotion";

import { CaptionTrack } from "./primitives/CaptionTrack";
import { reelComponentRegistry } from "./registry";
import type { CompiledReel, ReelCompositionProps, ResolvedReelAsset } from "./types";

function requiredAudioAsset(compiled: CompiledReel, assetId: string): ResolvedReelAsset {
  const asset = compiled.assets[assetId];
  if (!asset || asset.kind !== "audio") {
    throw new Error(`compiled reel is missing resolved audio asset ${assetId}`);
  }
  return asset;
}

function durationForAudio(
  asset: ResolvedReelAsset,
  from: number,
  durationFrames: number,
  fps: number,
): number {
  const remaining = Math.max(1, durationFrames - from);
  if (asset.durationMs === undefined) return remaining;
  return Math.max(1, Math.min(remaining, Math.ceil((asset.durationMs / 1_000) * fps)));
}

function AudioTracks({ compiled }: Readonly<{ compiled: CompiledReel }>) {
  const { audio } = compiled.spec;
  const { duration_frames: durationFrames, fps } = compiled.spec.format;
  const music = audio.music_asset_id ? requiredAudioAsset(compiled, audio.music_asset_id) : undefined;
  const narration = audio.narration_asset_id
    ? requiredAudioAsset(compiled, audio.narration_asset_id)
    : undefined;

  return (
    <>
      {music ? (
        <Audio
          src={music.src}
          durationInFrames={durationForAudio(music, 0, durationFrames, fps)}
          volume={0.22}
          name="Music"
          onError={() => "fail"}
        />
      ) : null}
      {narration ? (
        <Audio
          src={narration.src}
          durationInFrames={durationForAudio(narration, 0, durationFrames, fps)}
          volume={1}
          name="Narration"
          onError={() => "fail"}
        />
      ) : null}
      {(audio.sfx_cues ?? []).map((cue, index) => {
        const asset = requiredAudioAsset(compiled, cue.asset_id);
        return (
          <Audio
            key={`${cue.asset_id}-${cue.frame}-${index}`}
            src={asset.src}
            from={cue.frame}
            durationInFrames={durationForAudio(asset, cue.frame, durationFrames, fps)}
            volume={cue.gain ?? 1}
            name={`SFX: ${cue.asset_id}`}
            onError={() => "fail"}
          />
        );
      })}
    </>
  );
}

export function ReelComposition({ compiled }: ReelCompositionProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.shell }}>
      {compiled.scenes.map((compiledScene) => {
        const Renderer = reelComponentRegistry[compiledScene.componentId];
        return (
          <Sequence
            key={compiledScene.scene.scene_id}
            from={compiledScene.startFrame}
            durationInFrames={compiledScene.durationFrames}
            premountFor={compiled.spec.format.fps}
            name={`${compiledScene.componentId}@${compiledScene.componentVersion}`}
          >
            <Renderer compiled={compiled} compiledScene={compiledScene} />
          </Sequence>
        );
      })}
      <AudioTracks compiled={compiled} />
      <CaptionTrack captions={compiled.captions} />
    </AbsoluteFill>
  );
}
