import { previewReelCompilationInput } from "@scrollstack/reel-components";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { createReelRender } from "./render-media";
import { renderReelWithReceipt } from "./render-receipt";
import { renderReelStill } from "./render-still";

// ponytail: fixture-only inputs. Add a --spec <file> branch once Mrigesh's
// pipeline emits accepted MangaManifest/ReelSpec artifacts.
const { values } = parseArgs({
  options: {
    out: { type: "string" },
    still: { type: "boolean", default: false },
    frame: { type: "string", default: "0" },
    receipt: { type: "boolean", default: false },
  },
});

if (!values.out) {
  throw new Error(
    "usage: render --out <absolute .mp4 or .png path> [--still --frame N] [--receipt]",
  );
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
} else if (values.receipt) {
  const { receipt } = await renderReelWithReceipt({
    input: previewReelCompilationInput,
    outputLocation,
    browserExecutable,
  });
  const receiptLocation = `${outputLocation.slice(0, -4)}-receipt.json`;
  await writeFile(receiptLocation, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(
    `mp4 ${receipt.width}x${receipt.height} ${receipt.durationMs}ms ${receipt.outputBytes}B in ${receipt.renderTimeMs}ms`,
  );
  console.log(`poster -> ${receipt.thumbnailStorageRef}`);
  console.log(`receipt (validation ${receipt.validationReport.passed ? "passed" : "FAILED"}) -> ${receiptLocation}`);
  if (!receipt.validationReport.passed) {
    for (const item of receipt.validationReport.checks.filter((c) => !c.passed)) {
      console.error(`  ${item.name}: ${item.detail}`);
    }
    process.exitCode = 1;
  }
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
