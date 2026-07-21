import { previewCompiledReel } from "@scrollstack/reel-components";
import { Composition } from "remotion";

import {
  ReelCompositionAdapter,
  reelMetadataFromProps,
} from "./composition-adapter";
import { REEL_COMPOSITION_ID, REEL_OUTPUT } from "./constants";

export const ScrollStackReelRoot = () => {
  return (
    <Composition
      id={REEL_COMPOSITION_ID}
      component={ReelCompositionAdapter}
      durationInFrames={1}
      fps={REEL_OUTPUT.fps}
      width={REEL_OUTPUT.width}
      height={REEL_OUTPUT.height}
      defaultProps={{ compiled: previewCompiledReel }}
      calculateMetadata={({ props }) => reelMetadataFromProps(props)}
    />
  );
};
