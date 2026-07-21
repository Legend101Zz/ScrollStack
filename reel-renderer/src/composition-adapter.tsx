import {
  ReelComposition,
  type ReelCompositionProps,
} from "@scrollstack/reel-components";

export const ReelCompositionAdapter = (props: ReelCompositionProps) => {
  return <ReelComposition {...props} />;
};

export const reelMetadataFromProps = (props: ReelCompositionProps) => {
  const { duration_frames, fps, height, width } = props.compiled.spec.format;

  return {
    durationInFrames: duration_frames,
    fps,
    height,
    width,
  };
};
