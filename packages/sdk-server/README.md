# @onkova/sdk-server

x402 paywall middleware for Fastify and Express. Protects API routes with per-request USDC micropayments on Stellar — no subscriptions, no API keys required from callers.

## Installation

```bash
pnpm add @onkova/sdk-server
```

Install the peer dependency for your framework:

```bash
# Fastify
pnpm add fastify

# Express
pnpm add express
```

## Requirements

- A running **Kova Facilitator** service (handles payment verification and on-chain settlement)
- A **Stellar receiving address** (`G...` format) where payments are directed
- Callers must use a compatible x402 client (e.g. `@onkova/sdk-client`)

## Quick Start

### Fastify

```typescript
import Fastify from "fastify"
import { kovaPlugin } from "@onkova/sdk-server"

const app = Fastify()

await app.register(kovaPlugin, {
  facilitatorUrl: "http://localhost:4021",
  payTo: "GABC...XYZ",     // Your Stellar receiving address
  network: "testnet",
  routes: [
    { method: "GET", path: "/api/weather", price: "$0.001" },
  ],
})

app.get("/api/weather", async () => {
  return { city: "NYC", temp: "72°F", condition: "Sunny" }
})

await app.listen({ port: 3000 })
```

### Express

```typescript
import express from "express"
import { kovaMiddleware } from "@onkova/sdk-server"

const app = express()

app.use(
  kovaMiddleware({
    facilitatorUrl: "http://localhost:4021",
    payTo: "GABC...XYZ",
    network: "testnet",
    routes: [
      { method: "GET", path: "/api/weather", price: "$0.001" },
    ],
  })
)

app.get("/api/weather", (req, res) => {
  res.json({ city: "NYC", temp: "72°F", condition: "Sunny" })
})

app.listen(3000)
```

## Configuration

### `KovaServerOptions`

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `facilitatorUrl` | `string` | Yes | — | Facilitator service base URL (e.g. `"http://localhost:4021"`) |
| `payTo` | `string` | Yes | — | Stellar address to receive payments (`G...` format) |
| `network` | `"testnet" \| "mainnet"` | Yes | — | Stellar network |
| `routes` | `RouteConfig[]` | Yes | — | Protected endpoint definitions |
| `asset` | `AssetInfo` | No | USDC | Override the default payment asset |
| `maxLedgerOffset` | `number` | No | `12` | Ledger offset for Soroban auth entry expiry |
| `apiKey` | `string` | No | — | API key forwarded in outbound headers to the facilitator |

### `RouteConfig`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `method` | `string` | Yes | HTTP method (`"GET"`, `"POST"`, etc.) |
| `path` | `string` | Yes | Route path (e.g. `"/api/weather"`) |
| `price` | `string` | Yes | Price as dollar string (e.g. `"$0.001"`) |
| `description` | `string` | No | Human-readable label for the endpoint |

## Default Assets

USDC is used by default. The correct contract is selected automatically based on `network`.

| Network | USDC Issuer | USDC Contract |
|---------|-------------|---------------|
| testnet | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| mainnet | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |

### Custom Asset

Override via the `asset` option:

```typescript
{
  asset: {
    code: "XLM",
    issuer: "",
    contractId: "CXLM...",
  }
}
```

## Payment Flow

```
CLIENT                          SERVER                    FACILITATOR
  │
  ├─ GET /api/weather
  │   (no X-PAYMENT)
  │                ──────────────>
  │                Returns 402
  │                + PaymentRequiredBody
  │   <──────────────
  │
  │  [client signs payment]
  │
  ├─ GET /api/weather
  │   X-PAYMENT: <base64>
  │                ──────────────>
  │                Decodes X-PAYMENT
  │                POST /verify ─────────────────────>
  │                             <─────────────────────
  │                             (verified)
  │                Calls route handler
  │                Returns 200 + body
  │   <──────────────
  │                POST /settle ─────────────────────>
  │                             (fire-and-forget)
```

Unprotected routes (not in `routes` config) pass through without payment checks.

## API Reference

### `kovaPlugin(app, options): FastifyPluginCallback`

Fastify plugin. Register with `app.register()`.

```typescript
import { kovaPlugin } from "@onkova/sdk-server"
await app.register(kovaPlugin, options)
```

Uses Fastify's `onRequest` hook. Compatible with Fastify 5.x. Settlement fires after the response is sent via `reply.then()`.

### `kovaMiddleware(options): express.RequestHandler`

Express middleware. Use with `app.use()` or mount on specific paths.

```typescript
import { kovaMiddleware } from "@onkova/sdk-server"
app.use(kovaMiddleware(options))
```

Settlement fires via `res.on("finish")`.

## Full Examples

### Fastify — Protected Weather API

```typescript
import Fastify from "fastify"
import { kovaPlugin } from "@onkova/sdk-server"

const app = Fastify({ logger: true })

await app.register(kovaPlugin, {
  facilitatorUrl: process.env.FACILITATOR_URL!,
  payTo: process.env.STELLAR_PAY_TO!,
  network: (process.env.STELLAR_NETWORK as "testnet" | "mainnet") ?? "testnet",
  routes: [
    {
      method: "GET",
      path: "/api/weather",
      price: "$0.001",
      description: "Current weather by city",
    },
    {
      method: "GET",
      path: "/api/forecast",
      price: "$0.005",
      description: "7-day forecast",
    },
  ],
})

app.get("/api/weather", async (request) => {
  const { city } = request.query as { city?: string }
  return { city: city ?? "NYC", temp: "72°F", condition: "Sunny" }
})

app.get("/api/forecast", async (request) => {
  const { city } = request.query as { city?: string }
  return { city: city ?? "NYC", days: [] }
})

// Health check — no payment required (not in routes config)
app.get("/health", async () => ({ status: "ok" }))

await app.listen({ port: 3000, host: "0.0.0.0" })
```

### Express — Protected Weather API

```typescript
import express from "express"
import { kovaMiddleware } from "@onkova/sdk-server"

const app = express()
app.use(express.json())

app.use(
  kovaMiddleware({
    facilitatorUrl: process.env.FACILITATOR_URL!,
    payTo: process.env.STELLAR_PAY_TO!,
    network: (process.env.STELLAR_NETWORK as "testnet" | "mainnet") ?? "testnet",
    routes: [
      {
        method: "GET",
        path: "/api/weather",
        price: "$0.001",
        description: "Current weather by city",
      },
    ],
  })
)

app.get("/api/weather", (req, res) => {
  const { city = "NYC" } = req.query as { city?: string }
  res.json({ city, temp: "72°F", condition: "Sunny" })
})

app.get("/health", (req, res) => {
  res.json({ status: "ok" })
})

app.listen(3000)
```

### Environment Variables

```env
FACILITATOR_URL=http://localhost:4021
STELLAR_PAY_TO=GABC...XYZ
STELLAR_NETWORK=testnet
```

## License

MIT
