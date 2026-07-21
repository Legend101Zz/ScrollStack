/**
 * Generates reel panel art through OpenRouter and renders a reel from it.
 *
 * This is a demo/evidence tool for the reel lane, not a second pipeline. The
 * control plane owns production image generation in
 * `backend/app/services/image_generation.py`; this mirrors that request shape so
 * the two cannot drift, and exists so the reel lane can be seen working on real
 * art before the manga lane emits accepted artifacts (issue #8).
 *
 * Output is written outside the repository. Generated art is not committed.
 *
 * Usage:
 *   corepack pnpm --filter @scrollstack/reel-renderer generate-panels
 *   corepack pnpm --filter @scrollstack/reel-renderer generate-panels --reuse
 */
import { compileReel, previewReelCompilationInput, previewReelSpec } from "@scrollstack/reel-components";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { localReelAssetStager } from "../src/asset-staging";
import { reelAudioKitRoot, reelAudioKitSources } from "../src/audio-kit-sources";
import { getOrCreateReelBundle } from "../src/remotion-bundle";
import { renderReelWithReceipt } from "../src/render-receipt";
import type { LocalReelAssetSource } from "../src/types";

const OUTPUT_ROOT = "/home/utkarsh/Pictures/ScrollStack/panels";
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

// Original descriptions of genre conventions. Deliberately not "in the style
// of" any specific artist or series, and no on-image text, which would fight
// the caption layer.
const NO_TEXT = "no text, no lettering, no speech bubbles, no watermark, no signature";
const PANEL_PROMPTS: readonly { assetId: string; prompt: string }[] = [
  {
    assetId: "asset_panel_preview_1",
    prompt: `Black and white manga panel, wide establishing shot of a jagged mountain ridgeline beneath a thin crescent moon, deep ink blacks, screentone gradient sky, high contrast, dramatic vertical composition, ${NO_TEXT}`,
  },
  {
    assetId: "asset_panel_preview_2",
    prompt: `Black and white manga panel, a lone hooded figure seen from behind standing at a cliff edge, coat caught in wind, heavy ink silhouette against a pale screentone sky, ${NO_TEXT}`,
  },
  {
    assetId: "asset_panel_preview_3",
    prompt: `Black and white manga panel, dramatic close-up of a hand slamming a rolled map onto a wooden table, radiating speed lines, ink impact burst, extreme contrast, ${NO_TEXT}`,
  },
  {
    assetId: "asset_panel_preview_4",
    prompt: `Black and white manga panel, tight close-up of determined narrowed eyes in deep shadow, sharp ink cross-hatching, screentone shading, ominous mood, ${NO_TEXT}`,
  },
];

function readEnv(name: string): string {
  const raw = process.env[name];
  if (raw?.trim()) return raw.trim();
  // The key lives only in the gitignored .env; never log its value.
  const file = path.join(REPO_ROOT, ".env");
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.startsWith(`${name}=`)) continue;
    const value = line.slice(name.length + 1).trim();
    if (value) return value;
  }
  throw new Error(`${name} is not set in the environment or .env`);
}

type GeneratedPanel = Readonly<{ assetId: string; filePath: string; bytes: number; latencyMs: number }>;

function findImageDataUrl(body: unknown): string {
  const choices = (body as { choices?: unknown[] }).choices ?? [];
  for (const choice of choices) {
    const message = (choice as { message?: Record<string, unknown> }).message;
    if (!message) continue;
    for (const image of (message.images as unknown[]) ?? []) {
      const url = (image as { image_url?: { url?: string } }).image_url?.url;
      if (typeof url === "string") return url;
    }
    const content = message.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const url = (part as { image_url?: { url?: string } }).image_url?.url;
      if (typeof url === "string") return url;
    }
  }
  throw new Error("OpenRouter response contained no image");
}

async function generatePanel(
  apiKey: string,
  model: string,
  entry: (typeof PANEL_PROMPTS)[number],
): Promise<GeneratedPanel> {
  const started = Date.now();
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://scrollstack.local",
      "X-Title": "ScrollStack",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: entry.prompt.slice(0, 1_500) }],
      modalities: ["image", "text"],
      image_config: { aspect_ratio: "9:16" },
    }),
  });
  if (!response.ok) {
    // Never echo the body wholesale; it can contain request context.
    throw new Error(`OpenRouter returned HTTP ${response.status} for ${entry.assetId}`);
  }
  const dataUrl = findImageDataUrl(await response.json());
  const [, encoded] = dataUrl.split(",", 2);
  if (!encoded) throw new Error(`malformed data URL for ${entry.assetId}`);
  const bytes = Buffer.from(encoded, "base64");
  const extension = dataUrl.startsWith("data:image/jpeg") ? ".jpg" : ".png";
  const filePath = path.join(OUTPUT_ROOT, `${entry.assetId}${extension}`);
  await writeFile(filePath, bytes);
  return { assetId: entry.assetId, filePath, bytes: bytes.length, latencyMs: Date.now() - started };
}

async function sourceFor(assetId: string, filePath: string): Promise<LocalReelAssetSource> {
  const bytes = await readFile(filePath);
  return {
    assetId,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    kind: "image" as const,
    mimeType: filePath.endsWith(".jpg") ? "image/jpeg" : "image/png",
    localPath: filePath,
  };
}

const { values } = parseArgs({
  options: {
    reuse: { type: "boolean", default: false },
    out: { type: "string" },
  },
});
await mkdir(OUTPUT_ROOT, { recursive: true });

const model = process.env.IMAGE_MODEL?.trim() || readEnv("IMAGE_MODEL");
if (!values.reuse) {
  const apiKey = readEnv("OPENROUTER_API_KEY");
  console.log(`generating ${PANEL_PROMPTS.length} panels with ${model}`);
  for (const entry of PANEL_PROMPTS) {
    const panel = await generatePanel(apiKey, model, entry);
    console.log(`  ${panel.assetId}  ${(panel.bytes / 1024).toFixed(0)} KB  ${panel.latencyMs} ms`);
  }
} else {
  console.log("reusing panels already on disk");
}

const sources = await Promise.all(
  PANEL_PROMPTS.map(async (entry) => {
    const png = path.join(OUTPUT_ROOT, `${entry.assetId}.png`);
    const jpg = path.join(OUTPUT_ROOT, `${entry.assetId}.jpg`);
    const exists = await readFile(png).then(() => true).catch(() => false);
    return sourceFor(entry.assetId, exists ? png : jpg);
  }),
);

const bundle = await getOrCreateReelBundle();
const panels = await localReelAssetStager.stage({
  bundle,
  namespace: "generated",
  allowedSourceRoot: OUTPUT_ROOT,
  sources,
});
const audio = await localReelAssetStager.stage({
  bundle,
  namespace: "audiokit",
  allowedSourceRoot: reelAudioKitRoot(),
  sources: reelAudioKitSources(),
});

const soundFor = (type: string) =>
  type === "page_turn" ? "sfx_page_turn"
  : type === "impact_cut" ? "sfx_whip"
  : type === "narrator_card" ? "sfx_shutter"
  : "sfx_whoosh";
const spec = {
  ...previewReelSpec,
  audio: {
    music_asset_id: "bed_tension",
    sfx_cues: previewReelSpec.scenes.map((scene, index) => ({
      asset_id: soundFor(scene.scene_type),
      frame: scene.start_frame,
      gain: index === 0 ? 0.7 : 0.5,
    })),
  },
};
const input = {
  ...previewReelCompilationInput,
  spec: spec as typeof previewReelSpec,
  assets: { ...panels, ...audio },
  captions: [],
};
compileReel(input);

const { receipt } = await renderReelWithReceipt({
  input,
  bundle,
  outputLocation: values.out ? path.resolve(values.out) : "/home/utkarsh/Pictures/ScrollStack/REEL-generated.mp4",
  browserExecutable: process.env.SCROLLSTACK_BROWSER_EXECUTABLE,
  overwrite: true,
});
console.log(`rendered ${receipt.outputStorageRef}`);
console.log(`validation ${receipt.validationReport.passed ? "passed" : "FAILED"}`);
