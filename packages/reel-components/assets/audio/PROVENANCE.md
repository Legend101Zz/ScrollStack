# Reel audio kit provenance

Nothing here is licensed from a third party under terms that could be revoked.
The one-shots are Creative Commons 0 (public domain); the music beds are
synthesized by this repository. Attribution is not required by either, and is
recorded anyway so the rights position can be audited without re-deriving it,
matching how the core lane records art hashes.

## One-shot sound effects

Sounds were fetched from `remotion.media` (the CDN behind the MIT-licensed
`@remotion/sfx` package, peak-normalized to -3 dB by Remotion) and then
resampled here to 48 kHz mono PCM to match `REEL_OUTPUT.audioSampleRate`.
Both hashes are recorded: `upstream` is the file as fetched, `vendored` is the
resampled file committed to this repository.

Reviewed by: Utkarsh — 2026-07-21

| File | Original author | Original source | License | Upstream sha256 | Vendored sha256 |
| --- | --- | --- | --- | --- | --- |
| `whoosh.wav` | 1bob | https://freesound.org/s/831936/ | CC0 | `d98f010fa5f03fd3f4f77418f8ba6a962d36e63357265772771c4ac69c1a63a7` | `44e6e981d87270308bcc9c0f74e7bc9383442b8d6c1341b80add2d5568d347d8` |
| `whip.wav` | JW_Audio | https://freesound.org/s/838766/ | CC0 | `8713e68578c7f579bdfc24ff77fd3e3eefc1a9b5d1232a63c10800b81d0ead5f` | `e106f4225d626ee1d37a57867947fadf773b06094484bd5d8584f0c028414c89` |
| `page-turn.wav` | kenney.nl | https://kenney.nl | CC0 | `72762a9dafd5f9dd4bdf365f373519a35a8786ae975de4e2bc339fcdcf6b5f6d` | `6c9ecf4499ae650a156f5413e1327cb6d6511a72eba1cf9012e78a41847e4617` |
| `shutter-modern.wav` | ristooooo1 | https://freesound.org/s/539136/ | CC0 | `e9edb88765451ff07b247a22582f83048af5c260533d8b2e43613f45a3d1a898` | `4dc8540a8a1700a35e2d2b0a684d1ca28360b9eb27b9384f15dee827dec18da8` |

## Music beds

Synthesized here, not licensed, so the repository owns them outright and there
is no attribution ledger to maintain. `generate-beds.sh` regenerates both from
seeded FFmpeg generators; the decoded signal is deterministic, though MP3
encoding is not guaranteed bit-identical across LAME builds, so these committed
files stay the artifacts of record.

Both are 30 s mono at 48 kHz, peaking near -22 dBFS — far below the one-shots,
because a bed is atmosphere and must never compete with a cut. `ReelComposition`
applies a per-frame volume ramp so a 30 s bed under a shorter reel fades rather
than stopping dead.

| File | Character | Construction | sha256 |
| --- | --- | --- | --- |
| `bed-tension.mp3` | Low and unresolved | A1 root, fifth, octave; brown noise; 0.45 Hz tremolo | `5b09c2551021635b0709318f8679a0ee98b2c7a1466f9997717bb1e1f5161057` |
| `bed-resolve.mp3` | Calmer, a major third up | C2 root, fifth, tenth; softer noise; 0.18 Hz tremolo | `36f09da52db94df016f175b6583398ca71a07cbb65f466a44bfdd87cb9a522c7` |

Selected by the beat a reel *ends* on: `payoff` and `explanation` get
`bed_resolve`, everything still unresolved keeps `bed_tension`.

## Deliberately excluded

- `ding` — Remotion records it as "not explicitly released under a free license".
- The meme half of `@remotion/sfx` (`vineBoom`, `wilhelmScream`, `minecraftHurt`,
  `spongebobFail`, `snapchatNotification`, and similar). Wrong register for a
  grounded manga adaptation, and the rights are not clean.

## Why the files are vendored rather than imported

`@remotion/sfx` ships no audio; every export is an `https://remotion.media/*.wav`
URL. `reel-renderer/src/offline-assets.ts` rejects remote sources outright, and
technical-imp.md §20.1 restricts render-worker network access, so the bytes have
to live in the repository and resolve through content-addressed staging.

## Not included yet

No music bed. `@remotion/sfx` is one-shot effects only, and a licensed or
generated bed is a separate rights decision.
