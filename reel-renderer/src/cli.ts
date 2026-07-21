import { previewReelCompilationInput } from "@scrollstack/reel-components";
import path from "node:path";
import { parseArgs } from "node:util";

import { createReelRender } from "./render-media";
import { renderReelStill } from "./render-still";

// ponytail: fixture-only inputs. Add a --spec <file> branch once Mrigesh's
// pipeline emits accepted MangaManifest/ReelSpec artifacts.
const { values } = parseArgs({
  options: {
    out: { type: "string" },
    still: { type: "boolean", default: false },
    frame: { type: "string", default: "0" },
  },
});

if (!values.out) {
  throw new Error("usage: render --out <absolute .mp4 or .png path> [--still --frame N]");
}
const outputLocation = path.resolve(values.out);
const browserExecutable = process.env.SCROLLSTACK_BROWSER_EXECUTABLE;

if (values.still) {
  const result = await renderReelStill({
    input: previewReelCompilationInput,
    outputLocation,
    frame: Number(values.frame),
    browserExecutable,
  });
  console.log(`still ${result.width}x${result.height} frame ${result.frame} -> ${outputLocation}`);
} else {
  const controller = createReelRender({
    input: previewReelCompilationInput,
    outputLocation,
    browserExecutable,
  });
  const result = await controller.result;
  console.log(
    `mp4 ${result.width}x${result.height} ${result.durationFrames}f @${result.fps} -> ${outputLocation}`,
  );
}
