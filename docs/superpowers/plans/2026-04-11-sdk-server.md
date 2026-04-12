# `@onkova/sdk-server` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `@onkova/sdk-server` package — Fastify plugin and Express middleware that protect API routes behind x402 paywalls on Stellar, communicating with the Kova facilitator for payment verification and settlement.

**Architecture:** Requests hit the middleware, which checks if the route is protected. If protected and no valid `X-PAYMENT` header is present, it returns HTTP 402 with `PaymentRequirements`. If payment is present, it verifies via the facilitator's `/verify` endpoint, passes the request through on success, then fires off settlement to `/settle` asynchronously. Types mirror the facilitator's contracts.

**Tech Stack:** TypeScript, tsup (ESM build), vitest (tests), Fastify v5, Express v4/v5, native `fetch` for HTTP calls to facilitator.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/x402/types.ts` | x402 protocol types (PaymentRequirements, PaymentPayload, 402 response shape) |
| `src/config.ts` | `KovaServerOptions` and `RouteConfig` interfaces |
| `src/utils.ts` | `parsePriceToDollars()` price parser, `matchRoute()` route matcher |
| `src/x402/payment-required.ts` | Build the JSON body for HTTP 402 responses |
| `src/x402/verify.ts` | POST to facilitator `/verify` |
| `src/x402/settle.ts` | POST to facilitator `/settle` (fire-and-forget) |
| `src/middleware/fastify.ts` | Fastify plugin (`kovaPlugin`) |
| `src/middleware/express.ts` | Express middleware (`kovaMiddleware`) |
| `src/index.ts` | Public exports |
| `src/tests/utils.test.ts` | Tests for price parser and route matcher |
| `src/tests/payment-required.test.ts` | Tests for 402 body builder |
| `src/tests/verify.test.ts` | Tests for verify caller |
| `src/tests/settle.test.ts` | Tests for settle caller |
| `src/tests/fastify.test.ts` | Tests for Fastify plugin |
| `src/tests/express.test.ts` | Tests for Express middleware |

---

## Reusable Patterns from Facilitator

- **Type contracts:** `packages/facilitator/src/types.ts` — `PaymentRequirements`, `PaymentPayload`, `VerifyRequest`, `VerifyResponse`, `SettleRequest`, `SettleResponse` interfaces. The sdk-server will define its own copies (no cross-package import since facilitator is private).
- **Test patterns:** `packages/facilitator/src/tests/verify-route.test.ts` — vitest + `vi.mock()` + Fastify `app.inject()` pattern.
- **Price conversion:** `packages/facilitator/src/utils.ts:1-9` — `decimalToStroops()` for reference on 7-decimal Stellar math.
- **Token addresses:** `packages/facilitator/src/stellar/tokens.ts` — USDC contract IDs per network.

---

## Task 0: Test Infrastructure Setup

**Files:**
- Modify: `packages/sdk-server/package.json`

- [ ] **Step 1: Add vitest and cross-env to devDependencies and test script**

```jsonc
// In package.json, add to devDependencies:
"vitest": "4.1.4",
"cross-env": "10.1.0"

// Add to scripts:
"test": "vitest run"
```

Run: `cd packages/sdk-server && pnpm install`

- [ ] **Step 2: Verify test runner works**

Run: `cd packages/sdk-server && pnpm test`
Expected: vitest runs, finds no tests, exits 0.

- [ ] **Step 3: Commit**

```bash
git add packages/sdk-server/package.json packages/sdk-server/pnpm-lock.yaml
git commit -m "chore(sdk-server): add vitest test infrastructure"
```

---

## Task 1: x402 Types

**Files:**
- Modify: `packages/sdk-server/src/x402/types.ts`
- Test: `packages/sdk-server/src/tests/types.test.ts` (type-level only, no runtime test needed)

- [ ] **Step 1: Write the types**

Replace `packages/sdk-server/src/x402/types.ts` with:

```typescript
/** Network identifier */
export type StellarNetwork = 'testnet' | 'mainnet';

/** Scheme identifier */
export type PaymentScheme = 'x402';

/** Asset descriptor */
export interface AssetInfo {
  code: string;
  issuer: string;
  contractId: string;
}

/**
 * PaymentRequirements — included in HTTP 402 response body.
 * Tells the client what to sign and where to send payment.
 */
export interface PaymentRequirements {
  scheme: PaymentScheme;
  network: StellarNetwork;
  maxAmountRequired: string;
  asset: AssetInfo;
  payTo: string;
  facilitatorUrl: string;
  maxLedgerOffset: number;
}

/**
 * PaymentPayload — decoded from the X-PAYMENT header (base64 JSON).
 */
export interface PaymentPayload {
  scheme: PaymentScheme;
  network: StellarNetwork;
  authEntry: string;
  from: string;
}

/** Body sent to facilitator POST /verify */
export interface VerifyRequest {
  payload: PaymentPayload;
  requirements: PaymentRequirements;
}

/** Response from facilitator POST /verify */
export interface VerifyResponse {
  valid: boolean;
  error?: string;
}

/** Body sent to facilitator POST /settle */
export interface SettleRequest {
  payload: PaymentPayload;
  requirements: PaymentRequirements;
}

/** Response from facilitator POST /settle */
export interface SettleResponse {
  success: boolean;
  receipt?: {
    txHash: string;
    network: StellarNetwork;
    settledAt: string;
    amount: string;
    fee: string;
  };
  error?: string;
}

/** The full HTTP 402 response body shape */
export interface PaymentRequiredBody {
  error: 'payment_required';
  requirements: PaymentRequirements;
}
```

- [ ] **Step 2: Verify build**

Run: `cd packages/sdk-server && pnpm lint`
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/sdk-server/src/x402/types.ts
git commit -m "feat(sdk-server): define x402 protocol types"
```

---

## Task 2: Config Types

**Files:**
- Modify: `packages/sdk-server/src/config.ts`

- [ ] **Step 1: Write the config interfaces**

Replace `packages/sdk-server/src/config.ts` with:

```typescript
import type { StellarNetwork, AssetInfo } from './x402/types.js';

/** Configuration for a single protected route */
export interface RouteConfig {
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Route path pattern (e.g. '/api/weather') */
  path: string;
  /** Price as dollar string (e.g. '$0.001') */
  price: string;
  /** Human-readable description of the endpoint */
  description?: string;
}

/** Options passed to kovaPlugin / kovaMiddleware */
export interface KovaServerOptions {
  /** API key for authenticating with the Kova dashboard (unused by middleware, forwarded in headers) */
  apiKey?: string;
  /** Facilitator service URL (e.g. 'http://localhost:4021') */
  facilitatorUrl: string;
  /** Stellar address to receive payments (G... format) */
  payTo: string;
  /** Stellar network to use */
  network: StellarNetwork;
  /** Protected routes configuration */
  routes: RouteConfig[];
  /** Asset to accept — defaults to USDC on the chosen network */
  asset?: AssetInfo;
  /** Max ledger offset for auth entry expiry — defaults to 12 */
  maxLedgerOffset?: number;
}
```

- [ ] **Step 2: Verify build**

Run: `cd packages/sdk-server && pnpm lint`
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/sdk-server/src/config.ts
git commit -m "feat(sdk-server): define KovaServerOptions and RouteConfig interfaces"
```

---

## Task 3: Utility Functions (Price Parser + Route Matcher)

**Files:**
- Modify: `packages/sdk-server/src/utils.ts`
- Create: `packages/sdk-server/src/tests/utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/sdk-server/src/tests/utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parsePriceToDollars, matchRoute } from '../utils.js';
import type { RouteConfig } from '../config.js';

describe('parsePriceToDollars', () => {
  it('parses $0.001 to "0.001"', () => {
    expect(parsePriceToDollars('$0.001')).toBe('0.001');
  });

  it('parses $1 to "1"', () => {
    expect(parsePriceToDollars('$1')).toBe('1');
  });

  it('parses $0.50 to "0.50"', () => {
    expect(parsePriceToDollars('$0.50')).toBe('0.50');
  });

  it('parses plain "0.001" without $ sign to "0.001"', () => {
    expect(parsePriceToDollars('0.001')).toBe('0.001');
  });

  it('throws on empty string', () => {
    expect(() => parsePriceToDollars('')).toThrow();
  });

  it('throws on non-numeric string', () => {
    expect(() => parsePriceToDollars('$abc')).toThrow();
  });
});

describe('matchRoute', () => {
  const routes: RouteConfig[] = [
    { method: 'GET', path: '/api/weather', price: '$0.001' },
    { method: 'POST', path: '/api/data', price: '$0.01' },
  ];

  it('matches exact method and path', () => {
    const match = matchRoute('GET', '/api/weather', routes);
    expect(match).toEqual(routes[0]);
  });

  it('matches case-insensitively on method', () => {
    const match = matchRoute('get', '/api/weather', routes);
    expect(match).toEqual(routes[0]);
  });

  it('returns undefined for non-matching path', () => {
    const match = matchRoute('GET', '/api/unknown', routes);
    expect(match).toBeUndefined();
  });

  it('returns undefined for non-matching method', () => {
    const match = matchRoute('DELETE', '/api/weather', routes);
    expect(match).toBeUndefined();
  });

  it('returns undefined for empty routes', () => {
    const match = matchRoute('GET', '/api/weather', []);
    expect(match).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/sdk-server && pnpm test`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Write implementation**

Replace `packages/sdk-server/src/utils.ts` with:

```typescript
import type { RouteConfig } from './config.js';

/**
 * Parse a price string like '$0.001' or '0.001' to a plain decimal string.
 * Strips the leading '$' if present, validates the result is a finite number.
 */
export function parsePriceToDollars(price: string): string {
  const stripped = price.startsWith('$') ? price.slice(1) : price;
  if (stripped === '' || isNaN(Number(stripped)) || !isFinite(Number(stripped))) {
    throw new Error(`Invalid price: "${price}"`);
  }
  return stripped;
}

/**
 * Find the RouteConfig matching a request's method and path.
 * Returns undefined if no route matches (request is not protected).
 */
export function matchRoute(
  method: string,
  path: string,
  routes: RouteConfig[],
): RouteConfig | undefined {
  const upperMethod = method.toUpperCase();
  return routes.find(
    (r) => r.method.toUpperCase() === upperMethod && r.path === path,
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/sdk-server && pnpm test`
Expected: all 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk-server/src/utils.ts packages/sdk-server/src/tests/utils.test.ts
git commit -m "feat(sdk-server): implement price parser and route matcher"
```

---

## Task 4: 402 Response Builder

**Files:**
- Modify: `packages/sdk-server/src/x402/payment-required.ts`
- Create: `packages/sdk-server/src/tests/payment-required.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/sdk-server/src/tests/payment-required.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildPaymentRequired } from '../x402/payment-required.js';
import type { KovaServerOptions, RouteConfig } from '../config.js';

const DEFAULT_OPTIONS: KovaServerOptions = {
  facilitatorUrl: 'http://localhost:4021',
  payTo: 'GPAY1234567890123456789012345678901234567890123456789012',
  network: 'testnet',
  routes: [],
};

const ROUTE: RouteConfig = {
  method: 'GET',
  path: '/api/weather',
  price: '$0.001',
};

describe('buildPaymentRequired', () => {
  it('returns correct 402 body with USDC testnet defaults', () => {
    const body = buildPaymentRequired(ROUTE, DEFAULT_OPTIONS);

    expect(body.error).toBe('payment_required');
    expect(body.requirements.scheme).toBe('x402');
    expect(body.requirements.network).toBe('testnet');
    expect(body.requirements.maxAmountRequired).toBe('0.001');
    expect(body.requirements.payTo).toBe(DEFAULT_OPTIONS.payTo);
    expect(body.requirements.facilitatorUrl).toBe('http://localhost:4021');
    expect(body.requirements.maxLedgerOffset).toBe(12);
    expect(body.requirements.asset.code).toBe('USDC');
    expect(body.requirements.asset.contractId).toBe(
      'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    );
  });

  it('uses custom asset when provided', () => {
    const customAsset = { code: 'XLM', issuer: '', contractId: 'CXLM...' };
    const body = buildPaymentRequired(ROUTE, { ...DEFAULT_OPTIONS, asset: customAsset });

    expect(body.requirements.asset).toEqual(customAsset);
  });

  it('uses custom maxLedgerOffset when provided', () => {
    const body = buildPaymentRequired(ROUTE, { ...DEFAULT_OPTIONS, maxLedgerOffset: 24 });

    expect(body.requirements.maxLedgerOffset).toBe(24);
  });

  it('uses mainnet USDC for mainnet network', () => {
    const body = buildPaymentRequired(ROUTE, { ...DEFAULT_OPTIONS, network: 'mainnet' });

    expect(body.requirements.network).toBe('mainnet');
    expect(body.requirements.asset.contractId).toBe(
      'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/sdk-server && pnpm test`
Expected: FAIL — `buildPaymentRequired` not exported.

- [ ] **Step 3: Write implementation**

Replace `packages/sdk-server/src/x402/payment-required.ts` with:

```typescript
import type { KovaServerOptions, RouteConfig } from '../config.js';
import type { AssetInfo, PaymentRequiredBody } from './types.js';
import { parsePriceToDollars } from '../utils.js';

/** Default USDC addresses per network (mirrors facilitator/tokens.ts) */
const USDC_ASSETS: Record<string, AssetInfo> = {
  testnet: {
    code: 'USDC',
    issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    contractId: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  },
  mainnet: {
    code: 'USDC',
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    contractId: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
  },
};

const DEFAULT_MAX_LEDGER_OFFSET = 12;

/**
 * Build the HTTP 402 response body for a protected route.
 */
export function buildPaymentRequired(
  route: RouteConfig,
  options: KovaServerOptions,
): PaymentRequiredBody {
  const asset = options.asset ?? USDC_ASSETS[options.network];
  const maxLedgerOffset = options.maxLedgerOffset ?? DEFAULT_MAX_LEDGER_OFFSET;

  return {
    error: 'payment_required',
    requirements: {
      scheme: 'x402',
      network: options.network,
      maxAmountRequired: parsePriceToDollars(route.price),
      asset,
      payTo: options.payTo,
      facilitatorUrl: options.facilitatorUrl,
      maxLedgerOffset,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/sdk-server && pnpm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk-server/src/x402/payment-required.ts packages/sdk-server/src/tests/payment-required.test.ts
git commit -m "feat(sdk-server): implement 402 response body builder"
```

---

## Task 5: Verify Caller

**Files:**
- Modify: `packages/sdk-server/src/x402/verify.ts`
- Create: `packages/sdk-server/src/tests/verify.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/sdk-server/src/tests/verify.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyPayment } from '../x402/verify.js';
import type { PaymentPayload, PaymentRequirements } from '../x402/types.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const PAYLOAD: PaymentPayload = {
  scheme: 'x402',
  network: 'testnet',
  authEntry: 'base64xdr==',
  from: 'GABC1234567890123456789012345678901234567890123456789012',
};

const REQUIREMENTS: PaymentRequirements = {
  scheme: 'x402',
  network: 'testnet',
  maxAmountRequired: '0.001',
  asset: {
    code: 'USDC',
    issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    contractId: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  },
  payTo: 'GPAY1234567890123456789012345678901234567890123456789012',
  facilitatorUrl: 'http://localhost:4021',
  maxLedgerOffset: 12,
};

describe('verifyPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns valid=true when facilitator confirms', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ valid: true }),
    });

    const result = await verifyPayment(PAYLOAD, REQUIREMENTS);

    expect(result).toEqual({ valid: true });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4021/verify',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: PAYLOAD, requirements: REQUIREMENTS }),
      }),
    );
  });

  it('returns valid=false with error from facilitator', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ valid: false, error: 'Amount too low' }),
    });

    const result = await verifyPayment(PAYLOAD, REQUIREMENTS);

    expect(result).toEqual({ valid: false, error: 'Amount too low' });
  });

  it('returns valid=false when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await verifyPayment(PAYLOAD, REQUIREMENTS);

    expect(result).toEqual({ valid: false, error: 'Verification failed: Network error' });
  });

  it('returns valid=false when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const result = await verifyPayment(PAYLOAD, REQUIREMENTS);

    expect(result).toEqual({ valid: false, error: 'Facilitator returned status 500' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/sdk-server && pnpm test`
Expected: FAIL — `verifyPayment` not exported.

- [ ] **Step 3: Write implementation**

Replace `packages/sdk-server/src/x402/verify.ts` with:

```typescript
import type { PaymentPayload, PaymentRequirements, VerifyResponse } from './types.js';

/**
 * Call the facilitator's POST /verify endpoint to validate a payment.
 */
export async function verifyPayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<VerifyResponse> {
  try {
    const res = await fetch(`${requirements.facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, requirements }),
    });

    if (!res.ok) {
      return { valid: false, error: `Facilitator returned status ${res.status}` };
    }

    return (await res.json()) as VerifyResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Verification failed: ${message}` };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/sdk-server && pnpm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk-server/src/x402/verify.ts packages/sdk-server/src/tests/verify.test.ts
git commit -m "feat(sdk-server): implement facilitator verify caller"
```

---

## Task 6: Settle Caller

**Files:**
- Modify: `packages/sdk-server/src/x402/settle.ts`
- Create: `packages/sdk-server/src/tests/settle.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/sdk-server/src/tests/settle.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { settlePayment } from '../x402/settle.js';
import type { PaymentPayload, PaymentRequirements } from '../x402/types.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const PAYLOAD: PaymentPayload = {
  scheme: 'x402',
  network: 'testnet',
  authEntry: 'base64xdr==',
  from: 'GABC1234567890123456789012345678901234567890123456789012',
};

const REQUIREMENTS: PaymentRequirements = {
  scheme: 'x402',
  network: 'testnet',
  maxAmountRequired: '0.001',
  asset: {
    code: 'USDC',
    issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    contractId: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  },
  payTo: 'GPAY1234567890123456789012345678901234567890123456789012',
  facilitatorUrl: 'http://localhost:4021',
  maxLedgerOffset: 12,
};

describe('settlePayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends POST to facilitator /settle and does not throw', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, receipt: { txHash: '0xabc' } }),
    });

    await settlePayment(PAYLOAD, REQUIREMENTS);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4021/settle',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: PAYLOAD, requirements: REQUIREMENTS }),
      }),
    );
  });

  it('does not throw when fetch fails (fire-and-forget)', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(settlePayment(PAYLOAD, REQUIREMENTS)).resolves.toBeUndefined();
  });

  it('does not throw when response is not ok (fire-and-forget)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(settlePayment(PAYLOAD, REQUIREMENTS)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/sdk-server && pnpm test`
Expected: FAIL — `settlePayment` not exported.

- [ ] **Step 3: Write implementation**

Replace `packages/sdk-server/src/x402/settle.ts` with:

```typescript
import type { PaymentPayload, PaymentRequirements } from './types.js';

/**
 * Call the facilitator's POST /settle endpoint.
 * This is fire-and-forget — errors are silently swallowed since
 * the API response has already been sent to the client.
 */
export async function settlePayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<void> {
  try {
    await fetch(`${requirements.facilitatorUrl}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, requirements }),
    });
  } catch {
    // Fire-and-forget: settlement errors are not surfaced to the client.
    // In production, this would log to an observability backend.
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/sdk-server && pnpm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk-server/src/x402/settle.ts packages/sdk-server/src/tests/settle.test.ts
git commit -m "feat(sdk-server): implement facilitator settle caller (fire-and-forget)"
```

---

## Task 7: Fastify Plugin

**Files:**
- Modify: `packages/sdk-server/src/middleware/fastify.ts`
- Create: `packages/sdk-server/src/tests/fastify.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/sdk-server/src/tests/fastify.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

vi.mock('../x402/verify.js', () => ({
  verifyPayment: vi.fn(),
}));

vi.mock('../x402/settle.js', () => ({
  settlePayment: vi.fn(),
}));

import { kovaPlugin } from '../middleware/fastify.js';
import { verifyPayment } from '../x402/verify.js';
import { settlePayment } from '../x402/settle.js';
import type { KovaServerOptions } from '../config.js';

const OPTIONS: KovaServerOptions = {
  facilitatorUrl: 'http://localhost:4021',
  payTo: 'GPAY1234567890123456789012345678901234567890123456789012',
  network: 'testnet',
  routes: [{ method: 'GET', path: '/api/weather', price: '$0.001' }],
};

describe('kovaPlugin (Fastify)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(kovaPlugin, OPTIONS);

    app.get('/api/weather', async () => ({ weather: 'sunny' }));
    app.get('/api/free', async () => ({ free: true }));

    await app.ready();
  });

  it('returns 402 when no X-PAYMENT header on protected route', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/weather' });

    expect(res.statusCode).toBe(402);
    const body = res.json();
    expect(body.error).toBe('payment_required');
    expect(body.requirements.maxAmountRequired).toBe('0.001');
  });

  it('passes through unprotected routes without payment', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/free' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ free: true });
  });

  it('returns 402 when verification fails', async () => {
    vi.mocked(verifyPayment).mockResolvedValue({ valid: false, error: 'Bad auth' });

    const payment = Buffer.from(JSON.stringify({
      scheme: 'x402',
      network: 'testnet',
      authEntry: 'base64==',
      from: 'GABC...',
    })).toString('base64');

    const res = await app.inject({
      method: 'GET',
      url: '/api/weather',
      headers: { 'x-payment': payment },
    });

    expect(res.statusCode).toBe(402);
    expect(res.json().error).toBe('payment_required');
  });

  it('passes through and settles when verification succeeds', async () => {
    vi.mocked(verifyPayment).mockResolvedValue({ valid: true });
    vi.mocked(settlePayment).mockResolvedValue(undefined);

    const payment = Buffer.from(JSON.stringify({
      scheme: 'x402',
      network: 'testnet',
      authEntry: 'base64==',
      from: 'GABC...',
    })).toString('base64');

    const res = await app.inject({
      method: 'GET',
      url: '/api/weather',
      headers: { 'x-payment': payment },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ weather: 'sunny' });
    expect(verifyPayment).toHaveBeenCalledOnce();
    expect(settlePayment).toHaveBeenCalledOnce();
  });

  it('returns 402 when X-PAYMENT header is not valid base64 JSON', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/weather',
      headers: { 'x-payment': 'not-valid-base64!!!' },
    });

    expect(res.statusCode).toBe(402);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/sdk-server && pnpm test`
Expected: FAIL — `kovaPlugin` not exported.

- [ ] **Step 3: Write implementation**

Replace `packages/sdk-server/src/middleware/fastify.ts` with:

```typescript
import type { FastifyPluginAsync } from 'fastify';
import type { KovaServerOptions } from '../config.js';
import type { PaymentPayload, PaymentRequirements } from '../x402/types.js';
import { matchRoute } from '../utils.js';
import { buildPaymentRequired } from '../x402/payment-required.js';
import { verifyPayment } from '../x402/verify.js';
import { settlePayment } from '../x402/settle.js';

function decodePaymentHeader(header: string): PaymentPayload | null {
  try {
    const json = Buffer.from(header, 'base64').toString('utf-8');
    return JSON.parse(json) as PaymentPayload;
  } catch {
    return null;
  }
}

export const kovaPlugin: FastifyPluginAsync<KovaServerOptions> = async (fastify, options) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const route = matchRoute(request.method, request.url, options.routes);
    if (!route) return;

    const body402 = buildPaymentRequired(route, options);
    const requirements: PaymentRequirements = body402.requirements;

    const paymentHeader = request.headers['x-payment'] as string | undefined;
    if (!paymentHeader) {
      return reply.status(402).send(body402);
    }

    const payload = decodePaymentHeader(paymentHeader);
    if (!payload) {
      return reply.status(402).send(body402);
    }

    const verification = await verifyPayment(payload, requirements);
    if (!verification.valid) {
      return reply.status(402).send(body402);
    }

    // Verification passed — settle after response (fire-and-forget)
    reply.then(() => {
      settlePayment(payload, requirements);
    });
  });
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/sdk-server && pnpm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk-server/src/middleware/fastify.ts packages/sdk-server/src/tests/fastify.test.ts
git commit -m "feat(sdk-server): implement Fastify x402 paywall plugin"
```

---

## Task 8: Express Middleware

**Files:**
- Modify: `packages/sdk-server/src/middleware/express.ts`
- Create: `packages/sdk-server/src/tests/express.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/sdk-server/src/tests/express.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../x402/verify.js', () => ({
  verifyPayment: vi.fn(),
}));

vi.mock('../x402/settle.js', () => ({
  settlePayment: vi.fn(),
}));

import { kovaMiddleware } from '../middleware/express.js';
import { verifyPayment } from '../x402/verify.js';
import { settlePayment } from '../x402/settle.js';
import type { KovaServerOptions } from '../config.js';

const OPTIONS: KovaServerOptions = {
  facilitatorUrl: 'http://localhost:4021',
  payTo: 'GPAY1234567890123456789012345678901234567890123456789012',
  network: 'testnet',
  routes: [{ method: 'GET', path: '/api/weather', price: '$0.001' }],
};

describe('kovaMiddleware (Express)', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(kovaMiddleware(OPTIONS));
    app.get('/api/weather', (_req, res) => { res.json({ weather: 'sunny' }); });
    app.get('/api/free', (_req, res) => { res.json({ free: true }); });
  });

  it('returns 402 when no X-PAYMENT header on protected route', async () => {
    const res = await request(app).get('/api/weather');

    expect(res.status).toBe(402);
    expect(res.body.error).toBe('payment_required');
    expect(res.body.requirements.maxAmountRequired).toBe('0.001');
  });

  it('passes through unprotected routes without payment', async () => {
    const res = await request(app).get('/api/free');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ free: true });
  });

  it('returns 402 when verification fails', async () => {
    vi.mocked(verifyPayment).mockResolvedValue({ valid: false, error: 'Bad auth' });

    const payment = Buffer.from(JSON.stringify({
      scheme: 'x402',
      network: 'testnet',
      authEntry: 'base64==',
      from: 'GABC...',
    })).toString('base64');

    const res = await request(app)
      .get('/api/weather')
      .set('X-PAYMENT', payment);

    expect(res.status).toBe(402);
  });

  it('passes through and settles when verification succeeds', async () => {
    vi.mocked(verifyPayment).mockResolvedValue({ valid: true });
    vi.mocked(settlePayment).mockResolvedValue(undefined);

    const payment = Buffer.from(JSON.stringify({
      scheme: 'x402',
      network: 'testnet',
      authEntry: 'base64==',
      from: 'GABC...',
    })).toString('base64');

    const res = await request(app)
      .get('/api/weather')
      .set('X-PAYMENT', payment);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ weather: 'sunny' });
    expect(verifyPayment).toHaveBeenCalledOnce();
    expect(settlePayment).toHaveBeenCalledOnce();
  });
});
```

Note: This task requires adding `supertest` and `@types/supertest` to devDependencies:

```bash
cd packages/sdk-server && pnpm add -D supertest @types/supertest
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/sdk-server && pnpm test`
Expected: FAIL — `kovaMiddleware` not exported.

- [ ] **Step 3: Write implementation**

Replace `packages/sdk-server/src/middleware/express.ts` with:

```typescript
import type { Request, Response, NextFunction } from 'express';
import type { KovaServerOptions } from '../config.js';
import type { PaymentPayload, PaymentRequirements } from '../x402/types.js';
import { matchRoute } from '../utils.js';
import { buildPaymentRequired } from '../x402/payment-required.js';
import { verifyPayment } from '../x402/verify.js';
import { settlePayment } from '../x402/settle.js';

function decodePaymentHeader(header: string): PaymentPayload | null {
  try {
    const json = Buffer.from(header, 'base64').toString('utf-8');
    return JSON.parse(json) as PaymentPayload;
  } catch {
    return null;
  }
}

/**
 * Express middleware that enforces x402 payment on configured routes.
 */
export function kovaMiddleware(options: KovaServerOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const route = matchRoute(req.method, req.path, options.routes);
    if (!route) {
      next();
      return;
    }

    const body402 = buildPaymentRequired(route, options);
    const requirements: PaymentRequirements = body402.requirements;

    const paymentHeader = req.headers['x-payment'] as string | undefined;
    if (!paymentHeader) {
      res.status(402).json(body402);
      return;
    }

    const payload = decodePaymentHeader(paymentHeader);
    if (!payload) {
      res.status(402).json(body402);
      return;
    }

    const verification = await verifyPayment(payload, requirements);
    if (!verification.valid) {
      res.status(402).json(body402);
      return;
    }

    // Settle after response finishes (fire-and-forget)
    res.on('finish', () => {
      settlePayment(payload, requirements);
    });

    next();
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/sdk-server && pnpm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk-server/src/middleware/express.ts packages/sdk-server/src/tests/express.test.ts packages/sdk-server/package.json
git commit -m "feat(sdk-server): implement Express x402 paywall middleware"
```

---

## Task 9: Public Exports

**Files:**
- Modify: `packages/sdk-server/src/index.ts`

- [ ] **Step 1: Write the barrel exports**

Replace `packages/sdk-server/src/index.ts` with:

```typescript
// Middleware
export { kovaPlugin } from './middleware/fastify.js';
export { kovaMiddleware } from './middleware/express.js';

// Config types
export type { KovaServerOptions, RouteConfig } from './config.js';

// x402 types (re-exported for consumers)
export type {
  PaymentScheme,
  StellarNetwork,
  AssetInfo,
  PaymentRequirements,
  PaymentPayload,
  PaymentRequiredBody,
} from './x402/types.js';
```

- [ ] **Step 2: Verify build produces correct output**

Run: `cd packages/sdk-server && pnpm build`
Expected: `dist/index.js` and `dist/index.d.ts` generated with all exports.

- [ ] **Step 3: Verify types are correct**

Run: `cd packages/sdk-server && pnpm lint`
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/sdk-server/src/index.ts
git commit -m "feat(sdk-server): wire public exports for kovaPlugin and kovaMiddleware"
```

---

## Task 10: Full Build + Test Verification

- [ ] **Step 1: Run all tests**

Run: `cd packages/sdk-server && pnpm test`
Expected: all test files pass (utils, payment-required, verify, settle, fastify, express).

- [ ] **Step 2: Run build**

Run: `cd packages/sdk-server && pnpm build`
Expected: clean build, `dist/` contains `index.js`, `index.d.ts`, source maps.

- [ ] **Step 3: Run lint**

Run: `cd packages/sdk-server && pnpm lint`
Expected: no TypeScript errors.

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -A packages/sdk-server/
git commit -m "chore(sdk-server): verify full build and test suite passes"
```

---

## Verification

1. **Unit tests:** `cd packages/sdk-server && pnpm test` — all 6 test files pass
2. **Type check:** `cd packages/sdk-server && pnpm lint` — no errors
3. **Build:** `cd packages/sdk-server && pnpm build` — produces ESM output with `.d.ts` declarations
4. **Integration smoke test:** Register `kovaPlugin` in the `examples/weather-api` Fastify server, hit `/api/weather` without `X-PAYMENT` header, confirm 402 response with correct `PaymentRequirements` body
