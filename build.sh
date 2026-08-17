#!/bin/bash
set -euo pipefail

# Automatically retrieve the latest commit hash
COMMIT_HASH="$(git rev-parse --short=7 HEAD)"
export COMMIT_HASH

# Ensure sqlite bind-mount file exists on host before container start.
if [[ ! -e players.db ]]; then
  touch players.db
fi

if [[ ! -e afflicted-events.txt ]]; then
  touch afflicted-events.txt
fi

docker network inspect adcom-sites >/dev/null 2>&1 || docker network create adcom-sites

# Run Docker Compose with the build argument
docker compose up --build -d
