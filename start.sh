#!/bin/zsh
set -euo pipefail

cd "${0:A:h}"

if [[ ! -f .env ]]; then
  cp .env.example .env
  print "Created .env from .env.example. Add provider keys before agent or image generation."
fi

docker compose up -d
