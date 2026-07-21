"use client";

import {
  Player,
  type CallbackListener,
  type ErrorFallback,
  type PlayerRef,
  type RenderLoading,
  type RenderPoster,
} from "@remotion/player";
import {
  ReelComposition,
  type CaptionCue,
  type CompiledReel,
} from "@scrollstack/reel-components";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from "react";

import { ReelCaptions } from "./ReelCaptions";
import { ReelControls } from "./ReelControls";

type ReelPlayerProps = {
  canGoDown: boolean;
  canGoLeft: boolean;
  canGoRight: boolean;
  canGoUp: boolean;
  compiled: CompiledReel;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  onNavigateHorizontal: (direction: -1 | 1) => void;
  onNavigateVertical: (direction: -1 | 1) => void;
  onPlayingChange: (playing: boolean) => void;
  onRuntimeError: (error: Error) => void;
  playing: boolean;
  showControls: boolean;
};

const renderLoading: RenderLoading = () => (
  <div
    style={{
      alignItems: "center",
      background: "#100c09",
      color: "#e6d6bb",
      display: "flex",
      fontFamily: "sans-serif",
      fontSize: "clamp(18px, 5vw, 28px)",
      height: "100%",
      justifyContent: "center",
      width: "100%",
    }}
  >
    Inking frames…
  </div>
);

const renderBufferingPoster: RenderPoster = ({ isBuffering }) =>
  isBuffering ? (
    <div
      style={{
        alignItems: "center",
        background: "rgba(16, 12, 9, 0.9)",
        color: "#e6d6bb",
        display: "flex",
        fontFamily: "sans-serif",
        fontSize: "clamp(18px, 5vw, 28px)",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      Catching up…
    </div>
  ) : null;

const errorFallback: ErrorFallback = ({ error }) => (
  <div
    style={{
      alignItems: "center",
      background: "#100c09",
      color: "#e6d6bb",
      display: "flex",
      flexDirection: "column",
      fontFamily: "sans-serif",
      fontSize: "clamp(18px, 5vw, 28px)",
      height: "100%",
      justifyContent: "center",
      padding: "clamp(24px, 8vw, 64px)",
      textAlign: "center",
      width: "100%",
    }}
  >
    <strong>This reel stopped drawing.</strong>
    <span style={{ fontSize: "clamp(14px, 3vw, 18px)", marginTop: 20, opacity: 0.7 }}>
      {error.message}
    </span>
  </div>
);

type ReelPlayerSurfaceProps = {
  compiled: CompiledReel;
  initiallyMuted: boolean;
  playerRef: RefObject<PlayerRef | null>;
};

/**
 * Keep the expensive Player subtree out of frame-progress renders. Controls and
 * captions update every frame; the composition itself only needs stable props.
 */
const ReelPlayerSurface = memo(function ReelPlayerSurface({
  compiled,
  initiallyMuted,
  playerRef,
}: ReelPlayerSurfaceProps) {
  const { duration_frames: durationInFrames, fps, height, width } = compiled.spec.format;
  const inputProps = useMemo(() => ({ compiled }), [compiled]);

  return (
    <Player
      acknowledgeRemotionLicense
      autoPlay
      component={ReelComposition}
      compositionHeight={height}
      compositionWidth={width}
      controls={false}
      durationInFrames={durationInFrames}
      errorFallback={errorFallback}
      fps={fps}
      initiallyMuted={initiallyMuted}
      inputProps={inputProps}
      loop
      ref={playerRef}
      renderLoading={renderLoading}
      renderPoster={renderBufferingPoster}
      showPosterWhenBuffering
      showPosterWhenBufferingAndPaused
      style={{ height: "100%", width: "100%" }}
    />
  );
});

export function ReelPlayer({
  canGoDown,
  canGoLeft,
  canGoRight,
  canGoUp,
  compiled,
  muted,
  onMutedChange,
  onNavigateHorizontal,
  onNavigateVertical,
  onPlayingChange,
  onRuntimeError,
  playing,
  showControls,
}: ReelPlayerProps) {
  const playerRef = useRef<PlayerRef>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const { duration_frames: durationInFrames } = compiled.spec.format;

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrameUpdate: CallbackListener<"frameupdate"> = (event) => setCurrentFrame(event.detail.frame);
    const onPlay: CallbackListener<"play"> = () => onPlayingChange(true);
    const onPause: CallbackListener<"pause"> = () => onPlayingChange(false);
    const onMuteChange: CallbackListener<"mutechange"> = (event) => onMutedChange(event.detail.isMuted);
    const onError: CallbackListener<"error"> = (event) => onRuntimeError(event.detail.error);
    player.addEventListener("frameupdate", onFrameUpdate);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("mutechange", onMuteChange);
    player.addEventListener("error", onError);
    return () => {
      player.removeEventListener("frameupdate", onFrameUpdate);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("mutechange", onMuteChange);
      player.removeEventListener("error", onError);
      player.pause();
    };
  }, [onMutedChange, onPlayingChange, onRuntimeError]);

  const togglePlaying = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) player.pause();
    else player.play(event);
  }, []);

  const toggleMute = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    // This stays in the click call stack so browser audio policy sees a direct gesture.
    if (player.isMuted()) player.unmute();
    else player.mute();
  }, []);

  const seek = useCallback((frame: number) => playerRef.current?.seekTo(frame), []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-panel bg-black shadow-panel">
      <ReelPlayerSurface compiled={compiled} initiallyMuted={muted} playerRef={playerRef} />
      <ReelCaptions captions={compiled.captions as readonly CaptionCue[]} currentFrame={currentFrame} />
      {showControls ? (
        <ReelControls
          canGoDown={canGoDown}
          canGoLeft={canGoLeft}
          canGoRight={canGoRight}
          canGoUp={canGoUp}
          currentFrame={currentFrame}
          durationInFrames={durationInFrames}
          muted={muted}
          onNavigateHorizontal={onNavigateHorizontal}
          onNavigateVertical={onNavigateVertical}
          onSeek={seek}
          onToggleMute={toggleMute}
          onTogglePlaying={togglePlaying}
          playing={playing}
        />
      ) : null}
    </div>
  );
}
