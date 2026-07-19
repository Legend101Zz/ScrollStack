# ScrollStack reel renderer

Deterministic server-side rendering for the reviewed ScrollStack Remotion
composition. This package accepts data only: a validated `ReelSpec`, its
`MangaManifest`, resolved assets, and captions. It does not call models, load
remote assets, or accept caller-supplied FFmpeg arguments.

Production media is fixed to H.264/AAC MP4 at 1080x1920, 30fps, `yuv420p`, and
48kHz audio. `createReelRender()` returns `{cancel, result}` using Remotion's
cancel signal. Failed or cancelled renders remove output created by that call.

The default test suite is fast and does not launch Chromium:

```sh
pnpm --filter @scrollstack/reel-renderer typecheck
pnpm --filter @scrollstack/reel-renderer test
```

Run the real still and MP4 fixture smoke tests in a render-worker environment
with Chromium/FFmpeg available:

```sh
SCROLLSTACK_RENDER_INTEGRATION=1 \
SCROLLSTACK_BROWSER_EXECUTABLE=/usr/bin/chromium \
pnpm --filter @scrollstack/reel-renderer test
```

`SCROLLSTACK_BROWSER_EXECUTABLE` is optional when Remotion can locate its
supported browser automatically. The media smoke also runs `ffprobe`; override
its executable with `SCROLLSTACK_FFPROBE_EXECUTABLE` when it is not on `PATH`.
