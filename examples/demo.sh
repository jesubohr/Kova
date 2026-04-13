#!/usr/bin/env bash
# Kova Demo — starts all services and runs the agent consumer
# Usage: bash examples/demo.sh
#
# Required env vars:
#   FACILITATOR_STELLAR_SECRET  — Stellar secret for facilitator
#   KOVA_TREASURY_ADDRESS       — Treasury address for fee collection
#   PAY_TO                      — Stellar address to receive payments
#   STELLAR_SECRET              — Stellar secret for agent consumer
#
# Works on: Linux, macOS, Git Bash (Windows), WSL

set -e

# --- Env validation ---
REQUIRED_VARS=(FACILITATOR_STELLAR_SECRET KOVA_TREASURY_ADDRESS PAY_TO STELLAR_SECRET)
MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING+=("$var")
  fi
done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "Error: Missing required env vars: ${MISSING[*]}"
  echo "Copy .env.example and fill in values, then: source .env && bash examples/demo.sh"
  exit 1
fi

# --- Cleanup trap ---
cleanup() {
  echo ""
  echo "=== Cleaning up ==="
  kill "$FACILITATOR_PID" "$WEATHER_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT

# --- Wait for port ---
wait_for_port() {
  local port=$1
  local name=$2
  local retries=20
  while ! (echo >/dev/tcp/localhost/"$port") 2>/dev/null; do
    retries=$((retries - 1))
    if [ "$retries" -le 0 ]; then
      echo "Error: $name did not start on port $port"
      exit 1
    fi
    sleep 0.5
  done
  echo "$name ready on port $port"
}

# --- Start services ---
echo "=== Starting Kova Facilitator ==="
pnpm --filter kova-facilitator dev &
FACILITATOR_PID=$!
wait_for_port 4021 "Facilitator"

echo "=== Starting Weather API (example) ==="
pnpm --filter example-weather-api dev &
WEATHER_PID=$!
wait_for_port 4022 "Weather API"

echo ""
echo "=== Running Agent Consumer ==="
pnpm --filter example-agent-consumer dev

echo ""
echo "=== Demo Complete ==="
