# Artifacts

Rendered output kept for review and demos. Everything here is reproducible from
the repository; nothing here is an input to a build.

## `scrollstack-reel.mp4`

A complete reel rendered through the production Remotion path.

| | |
| --- | --- |
| Format | 1080x1920, 30 fps, H.264 / AAC |
| Duration | 13.06 s |
| Size | 18 MB |
| Audio | peaks at -6.2 dBFS; SFX cues over a synthesized music bed |
| Receipt validation | passed all seven checks |

`scrollstack-reel-poster.png` is the poster frame the renderer selects from the
opening quarter.

### Provenance

- **Panel art** — generated through OpenRouter (`google/gemini-2.5-flash-image`)
  from prompts describing genre conventions. Original output; not derived from
  any existing manga. Prompts live in
  `reel-renderer/scripts/generate-panels.ts`.
- **Sound effects** — CC0, vendored and hashed in
  `packages/reel-components/assets/audio/PROVENANCE.md`.
- **Music bed** — synthesized by `assets/audio/generate-beds.sh`; this
  repository owns it outright.
- **Scene grammar and timing** — the reviewed Remotion component registry.

### Honest caveats

- The reel is still built on the **preview fixture** spec, not on a manga
  generated from a real PDF. The manga lane does not yet emit `manga_manifest`
  (issue #8), so nothing joins an accepted manga to a reel automatically. The
  projection needed to close that gap is demonstrated in
  `reel-renderer/scripts/manifest-bridge-spike.ts`.
- One generated panel came back with a baked-in page border and margins, which
  reads as a frame inside the reel frame. Prompt-side fix, not yet applied.
- 18 MB is large for version control. It is committed because a reviewer should
  be able to watch the current output without a render, but if this directory
  grows, move it to Git LFS or drop the media and keep the poster.

### Regenerating

Re-render from panels already on disk, no provider calls:

```bash
SCROLLSTACK_BROWSER_EXECUTABLE=/usr/bin/chromium \
corepack pnpm --filter @scrollstack/reel-renderer generate-panels \
  --reuse --out artifacts/scrollstack-reel.mp4
```

Drop `--reuse` to regenerate the panel art, which makes billed image calls.
