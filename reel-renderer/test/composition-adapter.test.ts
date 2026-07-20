import { previewCompiledReel } from "@scrollstack/reel-components";
import { describe, expect, it } from "vitest";

import { reelMetadataFromProps } from "../src/composition-adapter";

describe("reel composition metadata", () => {
  it("derives duration and dimensions from the compiled spec", () => {
    expect(reelMetadataFromProps({ compiled: previewCompiledReel })).toEqual({
      durationInFrames: 390,
      fps: 30,
      height: 1920,
      width: 1080,
    });
  });
});
