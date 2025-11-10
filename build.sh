#!/bin/bash

# Automatically retrieve the latest commit hash
export COMMIT_HASH=$(git rev-parse --short=8 HEAD)

# Run Docker Compose with the build argument
docker compose up --build -d