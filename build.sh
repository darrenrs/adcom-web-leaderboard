#!/bin/bash

# Automatically retrieve the latest commit hash
export COMMIT_HASH=$(git rev-parse --short=8 HEAD)

# Ensure sqlite bind-mount file exists on host before container start.
touch players.db
touch afflicted-events.txt

# Run Docker Compose with the build argument
docker compose up --build -d
