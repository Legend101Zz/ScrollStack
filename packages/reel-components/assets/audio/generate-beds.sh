#!/usr/bin/env bash
# Regenerates the two music beds from scratch. They are synthesized here rather
# than licensed, so the repository owns them outright and the rights position
# needs no attribution ledger.
#
# Every source is a seeded FFmpeg generator, so the decoded signal is
# deterministic. MP3 encoding is not guaranteed bit-identical across LAME
# builds, so the committed files remain the artifacts of record and
# audio-kit.ts pins their hashes.
#
# Usage: ./generate-beds.sh [output-dir]
set -euo pipefail
out="${1:-$(dirname "$0")}"

# Low, unresolved: root, fifth, octave, plus filtered brown noise for air. The
# slow tremolo reads as an unsettled pulse under a scene that has not landed.
ffmpeg -v error -y \
  -f lavfi -i "sine=frequency=55:duration=30:sample_rate=48000" \
  -f lavfi -i "sine=frequency=82.41:duration=30:sample_rate=48000" \
  -f lavfi -i "sine=frequency=110:duration=30:sample_rate=48000" \
  -f lavfi -i "anoisesrc=duration=30:color=brown:sample_rate=48000:amplitude=0.3:seed=1071" \
  -filter_complex "[0]volume=0.55[a];[1]volume=0.22[b];[2]volume=0.12[c];[3]lowpass=f=600,volume=0.10[d];[a][b][c][d]amix=inputs=4:normalize=0,tremolo=f=0.45:d=0.35,lowpass=f=1400,afade=t=in:st=0:d=3,volume=-3dB" \
  -ac 1 -ar 48000 -c:a libmp3lame -b:a 96k "$out/bed-tension.mp3"

# Same construction a major third up and far calmer: slower tremolo, softer
# noise, longer fade. Sits under payoff and resolution without pushing.
ffmpeg -v error -y \
  -f lavfi -i "sine=frequency=65.41:duration=30:sample_rate=48000" \
  -f lavfi -i "sine=frequency=98:duration=30:sample_rate=48000" \
  -f lavfi -i "sine=frequency=164.81:duration=30:sample_rate=48000" \
  -f lavfi -i "anoisesrc=duration=30:color=brown:sample_rate=48000:amplitude=0.3:seed=2140" \
  -filter_complex "[0]volume=0.5[a];[1]volume=0.2[b];[2]volume=0.09[c];[3]lowpass=f=500,volume=0.08[d];[a][b][c][d]amix=inputs=4:normalize=0,tremolo=f=0.18:d=0.25,lowpass=f=1600,afade=t=in:st=0:d=4,volume=-3dB" \
  -ac 1 -ar 48000 -c:a libmp3lame -b:a 96k "$out/bed-resolve.mp3"

printf 'regenerated beds in %s\n' "$out"
sha256sum "$out"/bed-*.mp3
