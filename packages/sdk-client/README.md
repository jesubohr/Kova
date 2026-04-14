# @onkova/sdk-client

Auto-paying HTTP client for x402-protected APIs on Stellar. Detects HTTP 402 responses, signs a Soroban authorization entry, and retries the request with payment — all transparently.

## Installation

```bash
pnpm add @onkova/sdk-client @stellar/stellar-sdk
```

## Quick Start

```typescript
import { KovaClient } from "@onkova/sdk-client"

const client = new KovaClient({
  stellarSecret: process.env.STELLAR_SECRET!, // S... format
  network: "testnet",
})

const response = await client.fetch("https://api.example.com/protected")
const data = await response.json()
```

## Configuration

### `KovaClientOptions`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `stellarSecret` | `string` | Yes | Stellar secret key (`S...` format) |
| `network` | `"testnet" \| "mainnet"` | Yes | Stellar network |
| `budget` | `BudgetConfig` | No | Spending limits (per-request, hourly, daily) |

### `BudgetConfig`

| Option | Type | Description |
|--------|------|-------------|
| `maxPerRequest` | `string` | Max USDC per single request (e.g. `"0.01"`) |
| `maxPerHour` | `string` | Max USDC per rolling hour (e.g. `"0.50"`) |
| `maxPerDay` | `string` | Max USDC per rolling 24 hours (e.g. `"1.00"`) |
| `onBudgetExceeded` | `(info) => void` | Callback fired before throwing `BudgetExceededError` |

## API Reference

### `new KovaClient(options: KovaClientOptions)`

Creates a new client. Initializes a Stellar wallet from the provided secret key.

### `client.fetch(url: string, options?: RequestInit): Promise<Response>`

Drop-in replacement for `fetch`. On a 402 response:
1. Parses the `PaymentRequirements` from the response body
2. Checks spending against budget limits
3. Signs a Soroban auth entry for `token.transfer`
4. Encodes the signed payload into the `X-PAYMENT` header
5. Retries the original request with the payment header

Returns the final `Response` (the retried response if payment was made).

### `client.fetchAll(urls: string[], options?: RequestInit): Promise<Response[]>`

Fetches multiple URLs concurrently, auto-paying any 402 paywalls. Equivalent to `Promise.all(urls.map(url => client.fetch(url, options)))`.

### `client.getSpending(): SpendingSummary`

Returns a summary of all payments made in this client instance's lifetime.

```typescript
interface SpendingSummary {
  totalSpent: string       // Total USDC spent (decimal string)
  requestsCount: number    // Number of paid requests
  lastPayment: {
    amount: string
    url: string
    timestamp: number
  } | null
}
```

## Error Handling

### `BudgetExceededError`

Thrown when a payment would exceed a configured budget limit.

```typescript
import { KovaClient, BudgetExceededError } from "@onkova/sdk-client"

try {
  const response = await client.fetch("https://api.example.com/protected")
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.error(`Budget exceeded: ${err.limitType} limit is ${err.limit}, requested ${err.requested}`)
  }
}
```

**Properties:**
- `err.limitType` — `"maxPerRequest"` | `"maxPerHour"` | `"maxPerDay"`
- `err.limit` — configured limit value
- `err.requested` — amount that was requested

### `Parse402Error`

Thrown when the 402 response body cannot be parsed as a valid `PaymentRequiredBody`.

## How It Works

```
CLIENT                               SERVER
  │
  ├─ client.fetch(url)
  │   (no X-PAYMENT header)
  │                    ──────────────────>
  │                    Returns 402
  │                    + PaymentRequiredBody
  │   <──────────────────
  │
  ├─ parse 402 body → PaymentRequirements
  ├─ check budget limits
  ├─ wallet.signAuthEntry()
  │   (Soroban auth for token.transfer)
  ├─ buildPaymentPayload()
  ├─ encodePaymentHeader() → base64 JSON
  │
  ├─ fetch(url, { "X-PAYMENT": ... })
  │                    ──────────────────>
  │                    Verifies payment
  │                    Returns 200 + body
  │   <──────────────────
```

The `X-PAYMENT` header contains a base64-encoded JSON payload:
```typescript
{
  scheme: "x402",
  network: "testnet" | "mainnet",
  authEntry: string,  // XDR-encoded Soroban authorization entry
  from: string,       // Payer's Stellar public key (G... format)
}
```

## Full Example

```typescript
import { KovaClient, BudgetExceededError } from "@onkova/sdk-client"

const client = new KovaClient({
  stellarSecret: process.env.STELLAR_SECRET!,
  network: "testnet",
  budget: {
    maxPerRequest: "0.01",   // Max $0.01 per call
    maxPerHour: "0.50",      // Max $0.50/hour
    maxPerDay: "2.00",       // Max $2.00/day
    onBudgetExceeded: ({ limitType, limit, requested }) => {
      console.warn(`Budget limit hit: ${limitType} (limit=${limit}, requested=${requested})`)
    },
  },
})

// Single request
try {
  const res = await client.fetch("https://api.example.com/weather?city=NYC")
  const weather = await res.json()
  console.log(weather)
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.error("Spending limit reached:", err.message)
  } else {
    throw err
  }
}

// Concurrent requests
const responses = await client.fetchAll([
  "https://api.example.com/weather?city=NYC",
  "https://api.example.com/weather?city=LAX",
  "https://api.example.com/weather?city=LHR",
])
const data = await Promise.all(responses.map((r) => r.json()))

// Spending summary
const summary = client.getSpending()
console.log(`Spent ${summary.totalSpent} USDC across ${summary.requestsCount} requests`)
```

## Networks & Assets

The client supports Stellar `testnet` and `mainnet`. Default payment asset is USDC.

| Network | USDC Contract |
|---------|---------------|
| testnet | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| mainnet | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |

The asset used is determined by the server's 402 response — the client pays whatever asset the server requires.

## License

Apache-2.0 — see [LICENSE](../../LICENSE) for details.
