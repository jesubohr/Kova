# Examples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the three example deliverables — a Fastify weather API protected by `@onkova/sdk-server`, an agent consumer script that auto-pays via `@onkova/sdk-client`, and a cross-platform demo script.

**Architecture:** `weather-api` is a standalone Fastify server that registers `kovaPlugin` with one protected route (`GET /api/weather`). `agent-consumer` is a CLI script that instantiates `KovaClient` and fetches the weather endpoint, printing the response and spending summary. `demo.sh` orchestrates both plus the facilitator.

**Tech Stack:** Fastify 5, `@onkova/sdk-server` (workspace), `@onkova/sdk-client` (workspace), tsx, tsup, TypeScript 6

---

## File Map

| File | Responsibility |
|------|---------------|
| `examples/weather-api/src/index.ts` | Fastify server with kova plugin protecting `/api/weather` |
| `examples/agent-consumer/src/index.ts` | CLI agent that calls weather API via `KovaClient`, prints result + spending |
| `examples/demo.sh` | Shell script that starts facilitator, weather API, runs agent, cleans up |

---

### Task 1: Weather API Server

**Files:**
- Modify: `examples/weather-api/src/index.ts`

- [ ] **Step 1: Implement the Fastify server with kova plugin**

```typescript
import Fastify from "fastify";
import { kovaPlugin } from "@onkova/sdk-server";

const PORT = parseInt(process.env.PORT ?? "4022", 10);
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:4021";
const PAY_TO = process.env.PAY_TO ?? "";

if (!PAY_TO) {
  console.error("Error: PAY_TO env var required (Stellar G... address)");
  process.exit(1);
}

const app = Fastify({ logger: true });

await app.register(kovaPlugin, {
  facilitatorUrl: FACILITATOR_URL,
  payTo: PAY_TO,
  network: "testnet",
  routes: [
    {
      method: "GET",
      path: "/api/weather",
      price: "$0.001",
      description: "Get current weather data",
    },
  ],
});

app.get("/api/weather", async () => {
  return { weather: "sunny", temp: 72 };
});

app.get("/health", async () => {
  return { status: "ok" };
});

await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(`Weather API running on http://localhost:${PORT}`);
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter example-weather-api build`
Expected: Build succeeds, `dist/index.js` created

- [ ] **Step 3: Commit**

```bash
git add examples/weather-api/src/index.ts
git commit -m "feat(examples): implement weather-api with kova paywall"
```

---

### Task 2: Agent Consumer Script

**Files:**
- Modify: `examples/agent-consumer/src/index.ts`

- [ ] **Step 1: Implement the agent consumer**

```typescript
import { KovaClient } from "@onkova/sdk-client";

const WEATHER_URL =
  process.env.WEATHER_URL ?? "http://localhost:4022/api/weather";
const STELLAR_SECRET = process.env.STELLAR_SECRET ?? "";

if (!STELLAR_SECRET) {
  console.error("Error: STELLAR_SECRET env var required (S... key)");
  process.exit(1);
}

const client = new KovaClient({
  stellarSecret: STELLAR_SECRET,
  network: "testnet",
  budget: {
    maxPerRequest: "0.01",
    maxPerDay: "1.00",
  },
});

console.log("Fetching weather data (will auto-pay x402 paywall)...\n");

const response = await client.fetch(WEATHER_URL);
const data = await response.json();

console.log("Response:", JSON.stringify(data, null, 2));
console.log("\nSpending summary:", client.getSpending());
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter example-agent-consumer build`
Expected: Build succeeds, `dist/index.js` created

- [ ] **Step 3: Commit**

```bash
git add examples/agent-consumer/src/index.ts
git commit -m "feat(examples): implement agent-consumer with auto-pay"
```

---

### Task 3: Demo Script

**Files:**
- Modify: `examples/demo.sh`

The existing `demo.sh` already has the correct structure. Need to add:
- Cross-platform compatibility (trap for cleanup, env var validation)
- Wait-for-ready checks instead of blind `sleep`

- [ ] **Step 1: Update demo.sh with robust startup and cross-platform support**

```bash
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
```

- [ ] **Step 2: Verify script is executable**

Run: `ls -la examples/demo.sh`
Expected: `-rwxr-xr-x` permissions (already set from git)

- [ ] **Step 3: Commit**

```bash
git add examples/demo.sh
git commit -m "feat(examples): improve demo.sh with env validation and port-ready checks"
```

---

### Task 4: Verify Full Build

- [ ] **Step 1: Build all packages from root**

Run: `pnpm build`
Expected: All packages + examples compile successfully

- [ ] **Step 2: Fix any build errors and re-run until clean**

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(examples): resolve build issues"
```
