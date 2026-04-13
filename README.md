# Kova (onkova.com) — Technical Specification

![Kova Logo](docs/kova-logo-long.png)

### The Platform for Protecting APIs from AI Agents Behind x402 Paywalls on Stellar

**Version:** 1.0 — April 2026\
**Purpose:** Construction guide for Claude Code to build all Kova packages\
**Stack:** Next.js · Node/Fastify · PostgreSQL · Stellar/Soroban · x402 Protocol

---

## 1. Executive Summary

Kova is a developer platform — analogous to Stripe but for AI agent payments — that lets any developer protect their API endpoints behind an x402 paywall settled on the Stellar network. Developers integrate Kova's server SDK (`@onkova/sdk-server`), configure pricing and endpoints via a dashboard, and earn USDC/stablecoin revenue every time an AI agent (or any HTTP client) pays to access their service. Kova charges a small per-transaction fee on each settlement.

### The Problem

AI agents are increasingly calling APIs at high frequency — thousands of requests per second — for inference, data retrieval, scraping, and orchestration. Traditional API monetization (API keys + subscription tiers + Stripe billing) was designed for humans. It fails for agents because:

- Agents can't fill out checkout forms or complete KYC
- Subscription tiers don't map to unpredictable, bursty agent usage
- Credit card minimum fees (~$0.30) make micropayments impossible
- No native way for agents to autonomously discover price and pay in-band

### The Solution

Kova wraps the x402 protocol (HTTP 402 Payment Required) with a full developer platform experience:

1. **Server SDK** — One-line middleware that makes any endpoint paid
2. **Client SDK** — Fetch wrapper that lets agents auto-pay x402 paywalls
3. **Dashboard** — Configure endpoints, set prices, view analytics, manage API keys
4. **Self-Hosted Facilitator** — Verify and settle payments on Stellar
5. **Landing Page** — Marketing site explaining the platform

All settled on Stellar: ~5-second finality, ~$0.00001 transaction fees, native USDC support.

### Revenue Model

Kova takes a **per-transaction fee** on each settled payment. Suggested: **1-2%** of the payment amount (configurable, with a minimum floor of $0.0001 to cover operational costs). This mirrors the model used by most Stellar-based payment infrastructure projects.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         KOVA PLATFORM                               │
│                                                                     │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────────────┐   │
│  │ Landing Page │   │    Dashboard     │   │   Facilitator      │   │
│  │  (Next.js)   │   │    (Next.js)     │   │   (Fastify)        │   │
│  │              │   │                  │   │                    │   │
│  │  - Hero      │   │  - Auth (login)  │   │  POST /verify      │   │
│  │  - How it    │   │  - Endpoints cfg │   │  POST /settle      │   │
│  │    works     │   │  - API keys      │   │  GET  /supported   │   │
│  │  - Pricing   │   │  - Tx log        │   │                    │   │
│  │  - Docs link │   │  - Revenue chart │   │  Stellar/Soroban   │   │
│  └──────────────┘   │  - Wallet setup  │   │  interaction       │   │
│                     └──────────────────┘   └────────────────────┘   │
│                              │                       ▲              │
│                              │ reads/writes          │              │
│                              ▼                       │              │
│                     ┌──────────────────┐             │              │
│                     │   PostgreSQL     │             │              │
│                     │                  │             │              │
│                     │  - users         │             │              │
│                     │  - api_keys      │             │              │
│                     │  - endpoints     │             │              │
│                     │  - transactions  │             │              │
│                     │  - wallets       │             │              │
│                     └──────────────────┘             │              │
│                                                      │              │
│  ┌──────────────────────┐   ┌────────────────────────┘              │
│  │  @onkova/sdk-server  │   │                                       │
│  │  (npm package)       │───┘                                       │
│  │                      │                                           │
│  │  Fastify/Express     │   ┌──────────────────────┐                │
│  │  middleware          │   │  @onkova/sdk-client  │                │
│  │                      │   │  (npm package)       │                │
│  │  Returns 402 +       │◄──│                      │                │
│  │  payment details     │   │  Fetch wrapper that  │                │
│  │  if no payment       │   │  auto-handles 402    │                │
│  │                      │   │  responses + pays    │                │
│  └──────────────────────┘   └──────────────────────┘                │
└─────────────────────────────────────────────────────────────────────┘

PAYMENT FLOW:
─────────────
1. Agent calls protected endpoint (no payment header)
2. @onkova/sdk-server middleware returns HTTP 402 + payment requirements
3. Agent's @onkova/sdk-client reads 402 response
4. Client signs a Stellar auth entry (Soroban authorization) for USDC transfer
5. Client retries request with X-PAYMENT header containing signed payload
6. Server middleware sends payload to Kova Facilitator /verify
7. Facilitator simulates the Soroban transaction to verify validity
8. Server performs the work (API response)
9. Server sends payload to Kova Facilitator /settle
10. Facilitator submits the Soroban transaction to Stellar network
11. USDC transfers: Agent → Developer wallet (minus Kova fee → Kova treasury)
12. Facilitator returns settlement receipt to server
13. Transaction logged in Kova PostgreSQL
```

---

## 3. Package Specifications

### 3.1 `kova-web` — Landing Page + Dashboard (Next.js)

**Monorepo structure** using Next.js App Router with route groups:

```
kova-web/
├── src/
│   ├── app/
│   │   ├── (marketing)/          # Landing page (public)
│   │   │   ├── page.tsx          # Hero, how-it-works, pricing, CTA
│   │   │   ├── docs/page.tsx     # Quick-start docs
│   │   │   └── layout.tsx        # Marketing layout (navbar, footer)
│   │   │
│   │   ├── (dashboard)/          # Dashboard (authenticated)
│   │   │   ├── layout.tsx        # Sidebar layout + auth guard
│   │   │   ├── overview/page.tsx # Revenue chart, recent txs, stats
│   │   │   ├── endpoints/page.tsx# Configure protected routes + pricing
│   │   │   ├── transactions/page.tsx # Full tx log with filters
│   │   │   ├── api-keys/page.tsx # Manage API keys
│   │   │   ├── wallet/page.tsx   # Stellar wallet config (payTo address)
│   │   │   └── settings/page.tsx # Account settings
│   │   │
│   │   ├── api/                  # Next.js API routes (BFF)
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── endpoints/route.ts
│   │   │   ├── api-keys/route.ts
│   │   │   ├── transactions/route.ts
│   │   │   └── wallet/route.ts
│   │   │
│   │   └── layout.tsx            # Root layout
│   │
│   ├── components/
│   │   ├── landing/              # Hero, HowItWorks, PricingCard, etc.
│   │   ├── dashboard/            # Charts, tables, forms
│   │   └── ui/                   # Shared primitives (shadcn/ui)
│   │
│   ├── lib/
│   │   ├── db.ts                 # Database (Drizzle ORM with Supabase)
│   │   ├── auth.ts               # Auth config (BetterAuth)
│   │   └── stellar.ts            # Stellar SDK helpers
│   │
│   └── styles/
│       └── globals.css
│
├── drizzle/           # Schema definitions
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── .env.example
```

#### 3.1.1 Landing Page Content Structure

The landing page must communicate three things clearly:

**Section 1: Hero**

- Headline: Something conveying "Monetize your API for the agent economy"
- Subheadline: x402 + Stellar, one line of code, sub-cent micropayments
- CTA: "Get Started" → Dashboard signup
- Code snippet preview showing how simple integration is:

```typescript
import { kovaMiddleware } from '@onkova/sdk-server';

app.use(kovaMiddleware({
  routes: {
    'GET /api/weather': {
      price: '$0.001',
      description: 'Weather data endpoint'
    }
  }
}));
// That's it. Any unpaid request returns 402.
```

**Section 2: How It Works**
Three-step visual flow:

1. **Protect** — Add middleware, set price per endpoint
2. **Pay** — Agents pay in USDC on Stellar, verified in ~5 seconds
3. **Earn** — Revenue streams to your Stellar wallet, viewable in dashboard

**Section 3: Revenue Model for Developers**

- Pay-per-request: charge exactly what your API is worth
- No subscriptions, no API key management, no billing infrastructure
- Sub-cent pricing viable: Stellar fees ~$0.00001, Kova fee 1-2%
- Real-time settlement to your wallet

**Section 4: Why Stellar**

- ~5-second finality
- ~$0.00001 transaction fees
- Native USDC, PYUSD, USDY support
- 99.99% uptime since launch
- Fee-bump transactions (facilitator sponsors gas)

**Section 5: Footer**

- Links to docs, GitHub, dashboard
- "Built on Stellar" badge

#### 3.1.2 Dashboard Features (Demo Scope)

**Auth:**

- Email/password signup + login (keep simple for demo)
- Session-based or JWT — let Claude Code decide best approach

**Overview Page:**

- Total revenue (all time + last 30 days)
- Total transactions (all time + last 30 days)
- Revenue chart (line chart, daily granularity, last 30 days)
- Recent transactions table (last 10)

**Endpoints Page:**

- Table of configured endpoints: method, path, price, description, status (active/paused)
- Add/edit/delete endpoint configuration
- Each endpoint config:
  - HTTP method (GET, POST, PUT, DELETE)
  - Path pattern (e.g., `/api/weather`)
  - Price in USD (e.g., `$0.001`)
  - Description (shown in 402 response)
  - Status toggle (active/paused)

**Transactions Page:**

- Paginated table: timestamp, endpoint, amount, payer address (truncated), tx hash (link to Stellar explorer), status (verified/settled/failed)
- Filters: date range, endpoint, status
- Export CSV

**API Keys Page:**

- Generate API key (used by SDK to authenticate with Kova backend/facilitator)
- List active keys with created date, last used
- Revoke keys

**Wallet Page:**

- Set Stellar public address (payTo address for receiving payments)
- Display current balance (read from Stellar network)
- Link to Stellar explorer for the address

#### 3.1.3 Database Schema

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  stellar_address VARCHAR(56),           -- G... public key
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- API Keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL,        -- hashed API key
  key_prefix VARCHAR(8) NOT NULL,        -- first 8 chars for display (e.g., "kova_sk_")
  name VARCHAR(100),
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP
);

-- Protected Endpoints Configuration
CREATE TABLE endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  method VARCHAR(10) NOT NULL,           -- GET, POST, etc.
  path VARCHAR(500) NOT NULL,            -- /api/weather
  price_usd DECIMAL(20, 10) NOT NULL,   -- 0.001 = $0.001
  description VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, method, path)
);

-- Transaction Log
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  endpoint_id UUID REFERENCES endpoints(id),
  amount_usd DECIMAL(20, 10) NOT NULL,
  kova_fee_usd DECIMAL(20, 10) NOT NULL,
  payer_address VARCHAR(56),             -- Agent's Stellar address
  payee_address VARCHAR(56),             -- Developer's Stellar address
  stellar_tx_hash VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, verified, settled, failed
  payment_payload JSONB,                 -- Raw x402 payment payload for debugging
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  settled_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_endpoints_user_id ON endpoints(user_id);
```

---

### 3.2 `@onkova/sdk-server` — Server SDK (npm package)

**Purpose:** Fastify/Express-compatible middleware that protects API endpoints behind x402 paywalls.

```
onkova-sdk-server/
├── src/
│   ├── index.ts              # Main export
│   ├── middleware/
│   │   ├── fastify.ts        # Fastify plugin
│   │   └── express.ts        # Express middleware (compatibility)
│   ├── x402/
│   │   ├── payment-required.ts   # Build 402 response
│   │   ├── verify.ts             # Call facilitator /verify
│   │   ├── settle.ts             # Call facilitator /settle
│   │   └── types.ts              # x402 payload types
│   ├── config.ts             # SDK config types
│   └── utils.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts            # Build config (or similar — let Claude Code decide)
└── README.md
```

#### SDK Server API Design

```typescript
// --- Installation ---
// npm install @onkova/sdk-server

// --- Usage with Fastify ---
import Fastify from 'fastify';
import { kovaPlugin } from '@onkova/sdk-server';

const app = Fastify();

app.register(kovaPlugin, {
  apiKey: process.env.KOVA_API_KEY,       // From Kova dashboard
  facilitatorUrl: process.env.KOVA_FACILITATOR_URL, // Kova facilitator
  payTo: process.env.STELLAR_ADDRESS,     // Developer's Stellar address
  network: 'stellar:pubnet',              // or 'stellar:testnet'
  routes: {
    '/api/weather': {
      method: 'GET',
      price: '$0.001',                    // USD amount
      description: 'Real-time weather data',
    },
    '/api/inference': {
      method: 'POST',
      price: '$0.01',
      description: 'AI model inference',
    },
  },
});

app.get('/api/weather', async (req, reply) => {
  // This only executes if payment was verified
  return { weather: 'sunny', temp: 72 };
});

app.listen({ port: 3000 });

// --- Usage with Express ---
import express from 'express';
import { kovaMiddleware } from '@onkova/sdk-server';

const app = express();

app.use(kovaMiddleware({
  apiKey: process.env.KOVA_API_KEY,
  facilitatorUrl: process.env.KOVA_FACILITATOR_URL,
  payTo: process.env.STELLAR_ADDRESS,
  network: 'stellar:pubnet',
  routes: {
    '/api/weather': {
      method: 'GET',
      price: '$0.001',
      description: 'Real-time weather data',
    },
  },
}));

app.get('/api/weather', (req, res) => {
  res.json({ weather: 'sunny', temp: 72 });
});

app.listen(3000);
```

#### Middleware Logic (pseudocode)

```
ON INCOMING REQUEST:
  1. Match request (method + path) against configured routes
  2. If no match → pass through (not protected)
  3. If match but route is paused → pass through
  4. Check for X-PAYMENT header
  5. If no header:
     → Return HTTP 402 with JSON body:
       {
         "x402Version": 2,
         "accepts": [{
           "scheme": "exact",
           "network": "stellar:pubnet",
           "price": "$0.001",
           "payTo": "<developer_stellar_address>",
           "asset": "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
           "facilitator": "<kova_facilitator_url>",
           "extra": {
             "name": "Weather API",
             "description": "Real-time weather data"
           }
         }],
         "error": "X-PAYMENT header is required"
       }
  6. If header present:
     a. Base64-decode the X-PAYMENT header → PaymentPayload
     b. POST PaymentPayload + PaymentRequirements to facilitator /verify
     c. If verification fails → Return 402 with error details
     d. If verification succeeds → Execute the route handler
     e. After response sent → POST to facilitator /settle (async, non-blocking)
     f. Log transaction to Kova backend (async POST to dashboard API)
```

---

### 3.3 `@onkova/sdk-client` — Client SDK (npm package)

**Purpose:** Fetch wrapper that automatically handles x402 402 responses — discovers price, signs payment, retries.

```
onkova-sdk-client/
├── src/
│   ├── index.ts              # Main export
│   ├── client.ts             # KovaClient class
│   ├── wallet/
│   │   ├── stellar.ts        # Stellar wallet/signing logic
│   │   └── types.ts
│   ├── x402/
│   │   ├── parse-402.ts      # Parse 402 response
│   │   ├── build-payment.ts  # Build payment payload
│   │   └── types.ts
│   └── utils.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

#### SDK Client API Design

```typescript
// --- Installation ---
// npm install @onkova/sdk-client

// --- Usage ---
import { KovaClient } from '@onkova/sdk-client';

const client = new KovaClient({
  stellarSecret: process.env.STELLAR_SECRET_KEY, // Agent's Stellar secret
  network: 'stellar:pubnet',                      // or 'stellar:testnet'
  maxPaymentPerRequest: '$1.00',                   // Safety cap per request
  maxPaymentPerMinute: '$10.00',                   // Rate limit safety
});

// Automatic payment handling — if the server returns 402,
// the client pays and retries transparently
const response = await client.fetch('https://api.example.com/api/weather');
const data = await response.json();
console.log(data); // { weather: 'sunny', temp: 72 }

// Check spending
const spending = client.getSpending();
console.log(spending);
// {
//   totalSpent: '$0.045',
//   requestsCount: 45,
//   lastPayment: { amount: '$0.001', to: 'G...', at: '2026-04-11T...' }
// }

// --- Advanced: Batch requests ---
const results = await client.fetchAll([
  'https://api.example.com/api/weather?city=NYC',
  'https://api.example.com/api/weather?city=LA',
  'https://api.example.com/api/weather?city=CHI',
]);

// --- Advanced: Budget control ---
const budgetedClient = new KovaClient({
  stellarSecret: process.env.STELLAR_SECRET_KEY,
  network: 'stellar:pubnet',
  budget: {
    maxPerRequest: '$0.01',
    maxPerHour: '$5.00',
    maxPerDay: '$50.00',
    onBudgetExceeded: 'throw', // or 'skip' or callback
  },
});
```

#### Client Logic (pseudocode)

```
ON client.fetch(url, options):
  1. Make standard HTTP request to url
  2. If response.status !== 402 → return response as-is
  3. If 402:
     a. Parse response body → PaymentRequirements
     b. Extract: scheme, network, price, payTo, asset, facilitator
     c. Validate price against budget limits
     d. If over budget → throw BudgetExceededError
     e. Build Soroban auth entry:
        - Token contract: USDC on Stellar
        - Function: transfer(from=agent, to=payTo, amount=price)
        - Set max_ledger expiration (~12 ledgers ≈ 60 seconds)
        - Sign with agent's Stellar keypair
     f. Encode PaymentPayload as Base64
     g. Retry original request with X-PAYMENT header
     h. If retry succeeds → track spending, return response
     i. If retry fails with 402 again → throw PaymentFailedError
```

---

### 3.4 `kova-facilitator` — Self-Hosted Facilitator (Fastify)

**Purpose:** Minimal facilitator service that verifies and settles x402 payments on Stellar. This is the critical infrastructure piece that bridges HTTP payments to on-chain settlement.

```
kova-facilitator/
├── src/
│   ├── index.ts              # Fastify server entry
│   ├── routes/
│   │   ├── verify.ts         # POST /verify
│   │   ├── settle.ts         # POST /settle
│   │   └── supported.ts      # GET /supported
│   ├── stellar/
│   │   ├── client.ts         # Stellar SDK / Horizon / Soroban RPC client
│   │   ├── verify-auth.ts    # Verify Soroban auth entry signatures
│   │   ├── submit-tx.ts      # Build + submit + fee-bump Soroban transaction
│   │   └── tokens.ts         # Token contract addresses (USDC, etc.)
│   ├── fee/
│   │   └── calculator.ts     # Calculate Kova fee (1-2% of payment)
│   ├── config.ts
│   └── types.ts
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

#### Facilitator API

**`GET /supported`**

Returns supported networks and payment schemes.

```json
{
  "x402Version": 2,
  "networks": [
    {
      "network": "stellar:pubnet",
      "schemes": ["exact"],
      "assets": [
        {
          "symbol": "USDC",
          "contract": "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI5",
          "decimals": 7
        }
      ]
    },
    {
      "network": "stellar:testnet",
      "schemes": ["exact"],
      "assets": [
        {
          "symbol": "USDC",
          "contract": "<testnet_usdc_contract>",
          "decimals": 7
        }
      ]
    }
  ]
}
```

**`POST /verify`**

Verifies a payment payload is valid without executing it.

```
Request Body:
{
  "paymentPayload": "<base64-encoded PaymentPayload>",
  "paymentRequirements": { ... }  // The 402 response requirements
}

Logic:
1. Decode paymentPayload
2. Validate scheme matches ("exact")
3. Validate network matches ("stellar:pubnet" or "stellar:testnet")
4. Validate the auth entry:
   a. Correct token contract (USDC)
   b. Correct function (transfer)
   c. Correct parameters (from, to, amount)
   d. Amount matches price + Kova fee
   e. Auth entry not expired (check max_ledger)
5. Simulate the Soroban transaction via Soroban RPC simulateTransaction
6. If simulation succeeds → payment is valid

Response (success):
{ "valid": true }

Response (failure):
{ "valid": false, "error": "Insufficient USDC balance" }
```

**`POST /settle`**

Executes the payment on Stellar.

```
Request Body:
{
  "paymentPayload": "<base64-encoded PaymentPayload>",
  "paymentRequirements": { ... }
}

Logic:
1. Decode and re-verify paymentPayload
2. Build the Soroban transaction:
   a. Source account: Kova facilitator account (pays gas via fee-bump)
   b. Operation: invokeHostFunction for token.transfer()
   c. Include the client's signed auth entry
3. Simulate to get resource fees
4. Sign with facilitator's keypair
5. Submit to Stellar network via Soroban RPC sendTransaction
6. Poll getTransaction until confirmed or failed
7. On success:
   a. Extract Stellar tx hash
   b. Calculate Kova fee
   c. Submit a second transaction: transfer Kova fee from payTo → Kova treasury
      (OR: modify the original contract call to split payment — preferred approach)
8. Return settlement receipt

Response (success):
{
  "settled": true,
  "txHash": "abc123...",
  "network": "stellar:pubnet",
  "ledger": 12345678
}

Response (failure):
{
  "settled": false,
  "error": "Transaction submission failed",
  "details": "..."
}
```

#### Fee Collection Strategy

**Preferred approach (single transaction):**

Instead of a simple `transfer(agent → developer)`, the facilitator constructs a Soroban transaction with **two** token operations:

1. `transfer(agent → developer, amount - kovaFee)`
2. `transfer(agent → kovaTreasury, kovaFee)`

Both are authorized by the same agent auth entry (which authorizes the total amount). This requires the payment contract or the facilitator to handle the split. For the demo, the simplest approach:

**Demo approach (post-settlement fee):**

1. Agent pays full amount to developer
2. Facilitator logs the Kova fee owed
3. Kova collects fees in batches (daily settlement from developer wallets via a separate agreement/transaction)

For MVP, use the demo approach and iterate to the preferred approach later.

#### Facilitator Stellar Account Requirements

The facilitator needs its own Stellar account with:

- Minimum XLM balance for transaction fees (fee-bumping client transactions)
- The facilitator pays gas so agents and developers don't need XLM
- For testnet: use Friendbot to fund (`https://friendbot.stellar.org?addr=<address>`)
- For mainnet: fund with ~10 XLM (covers ~1M+ transactions at current fee rates)

#### Key Stellar/Soroban Dependencies

```json
{
  "dependencies": {
    "@stellar/stellar-sdk": "latest",
    "fastify": "latest"
  }
}
```

The `@stellar/stellar-sdk` package provides:

- `Keypair` — Key generation and signing
- `SorobanRpc.Server` — Soroban RPC client (simulateTransaction, sendTransaction, getTransaction)
- `TransactionBuilder` — Build Soroban transactions
- `Contract` — Interact with Soroban contracts (USDC token)
- `nativeToScVal` / `scValToNative` — Convert between JS and Soroban types
- `authorizeEntry` — Sign Soroban auth entries

---

## 4. x402 Protocol Implementation Details

### 4.1 Payment Flow (Stellar-specific)

The x402 V2 protocol on Stellar uses Soroban authorization entries instead of EVM signatures. Key differences from EVM:

| Aspect            | EVM (for reference)       | Stellar/Soroban                             |
| ----------------- | ------------------------- | ------------------------------------------- |
| Signing           | EIP-712 typed data        | Soroban auth entry signing                  |
| Replay protection | Nonce                     | `max_ledger` expiration (~12 ledgers ≈ 60s) |
| Token standard    | ERC-20 (EIP-3009/Permit2) | SEP-41                                      |
| Gas sponsorship   | Meta-transactions         | Fee-bump transactions                       |
| Finality          | ~2-12s (chain dependent)  | ~5s                                         |
| Fee               | Variable ($0.001-$1+)     | ~$0.00001                                   |

### 4.2 x402 Header Format (V2)

**Request (from client to server):**

```
X-PAYMENT: <base64-encoded PaymentPayload>
```

**PaymentPayload structure (Stellar):**

```json
{
  "x402Version": 2,
  "scheme": "exact",
  "network": "stellar:pubnet",
  "payload": {
    "authEntries": ["<base64-encoded Soroban SorobanAuthorizationEntry>"],
    "senderAddress": "GABC...XYZ",
    "asset": "USDC:CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI5",
    "amount": "1000",
    "destination": "GDEF...UVW"
  }
}
```

### 4.3 402 Response Format (V2)

```json
{
  "x402Version": 2,
  "accepts": [
    {
      "scheme": "exact",
      "network": "stellar:pubnet",
      "price": "1000",
      "asset": "USDC:CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI5",
      "payTo": "GDEF...UVW",
      "facilitator": "https://facilitator.onkova.com",
      "extra": {
        "name": "Weather API",
        "description": "Real-time weather data"
      }
    }
  ]
}
```

Note: `price` in the Stellar x402 implementation is typically in the token's smallest unit (for USDC with 7 decimals on Stellar, "1000" = 0.0001 USDC). The SDK abstracts this so developers can write `'$0.001'`.

---

## 5. Development & Deployment Plan

### 5.1 Package Build Order

Build in this order (each depends on the previous):

1. **`kova-facilitator`** — Core infrastructure, must work first
2. **`@onkova/sdk-server`** — Depends on facilitator being available
3. **`@onkova/sdk-client`** — Depends on server SDK to test against
4. **`kova-web`** — Dashboard + landing page (can be built in parallel with SDKs)

### 5.2 Monorepo Structure (Recommended)

```
kova/
├── packages/
│   ├── facilitator/          # kova-facilitator
│   ├── sdk-server/           # @onkova/sdk-server
│   ├── sdk-client/           # @onkova/sdk-client
│   └── web/                  # kova-web (Next.js)
├── examples/
│   ├── weather-api/          # Example: protected weather API
│   └── agent-consumer/       # Example: agent consuming the API
├── package.json              # Workspace root
├── turbo.json                # Turborepo config (or similar — let Claude Code decide)
├── .env.example
└── README.md
```

### 5.3 Environment Variables

```bash
# --- Shared ---
DATABASE_URL=postgresql://user:pass@localhost:5432/kova
STELLAR_NETWORK=testnet                          # testnet or pubnet

# --- Facilitator ---
FACILITATOR_STELLAR_SECRET=S...                  # Facilitator's Stellar secret key
FACILITATOR_PORT=4021
KOVA_FEE_PERCENT=1.5                            # 1.5% per transaction
KOVA_TREASURY_ADDRESS=G...                       # Kova's Stellar address for fee collection

# --- Web (Dashboard) ---
NEXTAUTH_SECRET=...
NEXT_PUBLIC_FACILITATOR_URL=http://localhost:4021

# --- SDK Server (used by developers) ---
KOVA_API_KEY=kova_sk_...                         # From dashboard
KOVA_FACILITATOR_URL=http://localhost:4021
STELLAR_ADDRESS=G...                             # Developer's payTo address

# --- SDK Client (used by agents) ---
STELLAR_SECRET_KEY=S...                          # Agent's Stellar secret
```

### 5.4 Testing Strategy

**Testnet-first:** All development uses `stellar:testnet`.

- Get testnet XLM: `https://friendbot.stellar.org?addr=<address>`
- Get testnet USDC: Use Circle's testnet faucet or deploy a test SEP-41 token
- Soroban RPC (testnet): `https://soroban-testnet.stellar.org`
- Horizon (testnet): `https://horizon-testnet.stellar.org`

**Demo flow to test end-to-end:**

1. Start facilitator on port 4021
2. Start example weather API (using `@onkova/sdk-server`) on port 3000
3. Run example agent script (using `@onkova/sdk-client`) that calls the weather API
4. Observe: agent gets 402 → pays → gets weather data
5. Check dashboard: transaction appears in log, revenue chart updates

### 5.5 Deployment (Demo)

For the demo, keep it simple:

- **Facilitator:** Deploy to any VPS or cloud function — let Claude Code suggest options (e.g., Railway, Fly.io, Render)
- **Web:** Deploy Next.js to Vercel (easiest)
- **PostgreSQL:** Use a managed instance — let Claude Code suggest (e.g., Supabase, Neon, Railway)
- **SDKs:** Publish to npm under `@onkova` scope

---

## 6. Security Considerations

### 6.1 For MVP / Demo

- **API key hashing:** Store only hashed API keys in database (bcrypt or SHA-256)
- **Auth entry expiration:** Enforce max_ledger bounds (reject expired auth entries)
- **Amount validation:** Server SDK must verify the payment amount matches the configured price
- **Replay protection:** Soroban auth entries have built-in nonce/ledger-based replay protection
- **HTTPS:** All facilitator endpoints must be HTTPS in production
- **Rate limiting:** Apply rate limits on facilitator endpoints to prevent abuse
- **Budget caps:** Client SDK enforces spending limits client-side

---

## 8. Key References

- **x402 Protocol Spec:** https://github.com/coinbase/x402
- **x402 V2 Announcement:** https://www.x402.org/writing/x402-v2-launch
- **x402 on Stellar (Stellar Docs):** https://developers.stellar.org/docs/build/apps/x402
- **Built on Stellar Facilitator:** https://developers.stellar.org/docs/build/apps/x402/built-on-stellar
- **x402 Stellar npm package:** `@x402/stellar`
- **Stellar SDK:** `@stellar/stellar-sdk`
- **Soroban RPC Docs:** https://developers.stellar.org/docs/data/rpc
- **USDC on Stellar:** Issued by Circle, contract address varies by network
- **x402 Ecosystem Directory:** https://www.x402.org/ecosystem
- **Stellar Fee Model:** https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering

---

## 9. Instructions for Claude Code

When building this project, follow this order and these guidelines:

### General Rules

- Use TypeScript everywhere
- Use `pnpm` as package manager with workspaces
- Prefer functional patterns over classes (except where classes make the API cleaner, like `KovaClient`)
- Every package must have a clear README.md with usage examples
- Use environment variables for all configuration — never hardcode secrets
- For any decision marked "let Claude Code decide," evaluate 2-3 options and present them to the user before proceeding

### Package 1: `kova-facilitator`

- Start here. This is the foundation.
- Use Fastify with TypeScript
- Implement `/verify`, `/settle`, `/supported` endpoints
- Use `@stellar/stellar-sdk` for all Stellar interactions
- Test with Stellar testnet
- Use the `@x402/stellar` package if it simplifies auth entry handling; otherwise implement from the x402 spec directly
- The facilitator must have its own funded Stellar account for fee-bumping

### Package 2: `@onkova/sdk-server`

- Build as an npm-publishable package
- Provide both Fastify plugin and Express middleware exports
- The middleware must be configurable via a single options object
- Price should accept human-readable strings like `'$0.001'` and convert internally
- All facilitator communication is async where possible (settle after response)

### Package 3: `@onkova/sdk-client`

- Build as an npm-publishable package
- The `fetch` method must be a drop-in replacement for native `fetch`
- Implement spending tracking and budget enforcement
- Handle the full x402 flow: detect 402 → parse requirements → sign auth entry → retry
- Must work in Node.js environments (agents are typically server-side)

### Package 4: `kova-web`

- Next.js 14+ with App Router
- Use Tailwind CSS + shadcn/ui for components
- Landing page must be visually polished — this is a demo presentation
- Dashboard must show real data from Supabase
- Use server components where possible, client components only for interactivity
- Charts: use Recharts or similar — let Claude Code decide
- Auth: keep simple for demo (email/password with session)

### Package 5: `examples/`

- Create a `weather-api` example that protects a weather endpoint
- Create an `agent-consumer` example that calls the weather API and pays
- Both should be runnable with `pnpm dev` and demonstrate the full flow
- Include a `demo.sh` script that starts everything in order. Install whatever necessary to execute it within Windows.

---

*End of Technical Specification*
