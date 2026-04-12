#!/usr/bin/env bash
# Kova Demo — starts all services and runs the agent consumer
# Usage: bash examples/demo.sh

set -e

echo "=== Starting Kova Facilitator ==="
pnpm --filter kova-facilitator dev &
FACILITATOR_PID=$!
sleep 3

echo "=== Starting Weather API (example) ==="
pnpm --filter example-weather-api dev &
WEATHER_PID=$!
sleep 3

echo "=== Running Agent Consumer ==="
pnpm --filter example-agent-consumer dev

echo "=== Cleaning up ==="
kill $FACILITATOR_PID $WEATHER_PID 2>/dev/null
echo "Done."
