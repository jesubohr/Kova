# `@onkova/sdk-client` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `@onkova/sdk-client` — a fetch wrapper that auto-detects HTTP 402 paywalls, signs Soroban auth entries on Stellar, and retries with payment. Includes budget enforcement and spending tracking.

**Architecture:** Client sends normal `fetch` → gets 402 with `PaymentRequirements` → parses requirements → checks budget → signs Soroban `token.transfer` auth entry via `authorizeInvocation` → encodes as base64 `X-PAYMENT` header → retries request. Types mirror sdk-server/facilitator but are independently defined.

**Tech Stack:** TypeScript, `@stellar/stellar-sdk@13.1.0` (`authorizeInvocation`, `rpc.Server`, XDR), tsup (ESM), vitest@4.1.4 (TDD London School, mock-first)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/x402/types.ts` | x402 types — `PaymentRequirements`, `PaymentPayload`, `PaymentRequiredBody`, `StellarNetwork`, `AssetInfo` |
| `src/wallet/types.ts` | Wallet types — `WalletConfig`, `SignedAuthEntry` |
| `src/utils.ts` | `decimalToStroops()`, `encodePaymentHeader()`, `decodePaymentHeader()` |
| `src/x402/parse-402.ts` | Parse + validate 402 response body → `PaymentRequirements` |
| `src/x402/build-payment.ts` | Combine signed auth entry + requirements → `PaymentPayload` |
| `src/wallet/stellar.ts` | Keypair from secret, Soroban auth entry construction + signing via `authorizeInvocation` |
| `src/client.ts` | `KovaClient` class — `fetch()`, `fetchAll()`, `getSpending()`, budget enforcement |
| `src/index.ts` | Barrel exports (public API surface) |
| `src/tests/utils.test.ts` | Tests for decimal conversion and header encoding |
| `src/tests/parse-402.test.ts` | Tests for 402 parsing + validation |
| `src/tests/build-payment.test.ts` | Tests for payload builder |
| `src/tests/stellar-wallet.test.ts` | Tests for wallet (mock `rpc.Server`) |
| `src/tests/client.test.ts` | Tests for KovaClient (mock wallet, parse-402, build-payment, fetch) |
| `src/tests/budget.test.ts` | Tests for budget enforcement edge cases |

---

## Reusable Patterns

- **Type contracts:** `packages/facilitator/src/types.ts` — canonical `PaymentRequirements`, `PaymentPayload` shapes. Client defines own copies (no cross-package import).
- **Auth entry construction:** `packages/facilitator/src/tests/verify-auth.test.ts:13-65` — `buildAuthEntry()` helper shows exact XDR structure the facilitator expects.
- **Auth entry verification:** `packages/facilitator/src/stellar/verify-auth.ts` — what the facilitator validates (contract, function="transfer", 3 args, expiration > current ledger).
- **Amount conversion:** `packages/facilitator/src/utils.ts` — `decimalToStroops()` (7-decimal Stellar math).
- **Token addresses:** `packages/facilitator/src/stellar/tokens.ts` — USDC contract IDs per network.
- **SDK exports confirmed:** `authorizeInvocation` and `authorizeEntry` both exist in `@stellar/stellar-sdk@13.1.0`.

---

## Task 0: Test Infrastructure Setup

**Files:**
- Modify: `packages/sdk-client/package.json`

- [x] **Step 1: Add vitest to devDependencies and test script**

Add to `package.json`:
```jsonc
// scripts:
"test": "vitest run --passWithNoTests"

// devDependencies (add):
"vitest": "4.1.4"
```

- [x] **Step 2: Install and create test directory**

Run: `cd packages/sdk-client && pnpm install`
Run: `mkdir -p src/tests`

- [x] **Step 3: Verify test infra works**

Run: `cd packages/sdk-client && pnpm test`
Expected: "No test files found" or pass with no tests.

---

## Task 1: x402 Types

**Files:**
- Modify: `packages/sdk-client/src/x402/types.ts`

No tests needed — types only.

- [x] **Step 1: Define all x402 types**

```typescript
/** Network identifier */
export type StellarNetwork = "testnet" | "mainnet";

/** Scheme identifier */
export type PaymentScheme = "x402";

/** Asset descriptor */
export interface AssetInfo {
  code: string;
  issuer: string;
  contractId: string;
}

/** PaymentRequirements — included in HTTP 402 response body */
export interface PaymentRequirements {
  scheme: PaymentScheme;
  network: StellarNetwork;
  maxAmountRequired: string;
  asset: AssetInfo;
  payTo: string;
  facilitatorUrl: string;
  maxLedgerOffset: number;
}

/** PaymentPayload — sent in X-PAYMENT header (base64-encoded JSON) */
export interface PaymentPayload {
  scheme: PaymentScheme;
  network: StellarNetwork;
  /** base64-encoded XDR SorobanAuthorizationEntry */
  authEntry: string;
  /** G... address of the payer */
  from: string;
}

/** Full HTTP 402 response body shape */
export interface PaymentRequiredBody {
  error: "payment_required";
  requirements: PaymentRequirements;
}
```

- [x] **Step 2: Verify types compile**

Run: `cd packages/sdk-client && pnpm lint`
Expected: PASS

---

## Task 2: Wallet Types

**Files:**
- Modify: `packages/sdk-client/src/wallet/types.ts`

- [x] **Step 1: Define wallet types**

```typescript
import type { StellarNetwork } from "../x402/types.js";

/** Configuration for the Stellar wallet */
export interface WalletConfig {
  /** Stellar secret key (S... format) */
  stellarSecret: string;
  /** Network to operate on */
  network: StellarNetwork;
}

/** Result of signing a Soroban auth entry */
export interface SignedAuthEntry {
  /** base64-encoded XDR SorobanAuthorizationEntry */
  authEntryBase64: string;
  /** G... public key of the signer */
  publicKey: string;
}
```

- [x] **Step 2: Verify types compile**

Run: `cd packages/sdk-client && pnpm lint`
Expected: PASS

- [x] **Step 3: Commit types**

```bash
git add packages/sdk-client/src/x402/types.ts packages/sdk-client/src/wallet/types.ts
git commit -m "feat(sdk-client): define x402 and wallet type interfaces"
```

---

## Task 3: Utility Functions

**Files:**
- Modify: `packages/sdk-client/src/utils.ts`
- Create: `packages/sdk-client/src/tests/utils.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import {
  decimalToStroops,
  encodePaymentHeader,
  decodePaymentHeader,
} from "../utils.js";
import type { PaymentPayload } from "../x402/types.js";

describe("decimalToStroops", () => {
  it("converts '0.001' to 10_000n", () => {
    expect(decimalToStroops("0.001")).toBe(10_000n);
  });

  it("converts '1' to 10_000_000n", () => {
    expect(decimalToStroops("1")).toBe(10_000_000n);
  });

  it("converts '0.1234567' to 1_234_567n", () => {
    expect(decimalToStroops("0.1234567")).toBe(1_234_567n);
  });

  it("truncates beyond 7 decimal places", () => {
    expect(decimalToStroops("0.12345678")).toBe(1_234_567n);
  });

  it("converts '100.5' to 1_005_000_000n", () => {
    expect(decimalToStroops("100.5")).toBe(1_005_000_000n);
  });
});

describe("encodePaymentHeader / decodePaymentHeader", () => {
  const payload: PaymentPayload = {
    scheme: "x402",
    network: "testnet",
    authEntry: "base64xdr==",
    from: "GABC1234567890123456789012345678901234567890123456789012",
  };

  it("round-trips a PaymentPayload through base64", () => {
    const encoded = encodePaymentHeader(payload);
    const decoded = decodePaymentHeader(encoded);
    expect(decoded).toEqual(payload);
  });

  it("returns null for invalid base64", () => {
    expect(decodePaymentHeader("not-valid!!!")).toBeNull();
  });

  it("returns null for valid base64 but invalid JSON", () => {
    const notJson = Buffer.from("not json").toString("base64");
    expect(decodePaymentHeader(notJson)).toBeNull();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd packages/sdk-client && pnpm test`
Expected: FAIL — functions not exported.

- [x] **Step 3: Implement utils**

```typescript
import type { PaymentPayload } from "./x402/types.js";

/**
 * Convert decimal string (e.g. "0.001") to Stellar stroops (bigint, 7 decimals).
 */
export function decimalToStroops(decimal: string): bigint {
  const [whole, frac = ""] = decimal.split(".");
  const fracPadded = frac.padEnd(7, "0").slice(0, 7);
  return BigInt(whole) * 10_000_000n + BigInt(fracPadded);
}

/**
 * Encode a PaymentPayload as base64 string for X-PAYMENT header.
 */
export function encodePaymentHeader(payload: PaymentPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, "utf-8").toString("base64");
}

/**
 * Decode a base64 X-PAYMENT header back to PaymentPayload.
 * Returns null if decoding or parsing fails.
 */
export function decodePaymentHeader(header: string): PaymentPayload | null {
  try {
    const json = Buffer.from(header, "base64").toString("utf-8");
    return JSON.parse(json) as PaymentPayload;
  } catch {
    return null;
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd packages/sdk-client && pnpm test`
Expected: 8 tests PASS

- [x] **Step 5: Commit**

```bash
git add packages/sdk-client/src/utils.ts packages/sdk-client/src/tests/utils.test.ts
git commit -m "feat(sdk-client): add decimal conversion and header encoding utils"
```

---

## Task 4: Parse 402 Response

**Files:**
- Modify: `packages/sdk-client/src/x402/parse-402.ts`
- Create: `packages/sdk-client/src/tests/parse-402.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { parse402Response, Parse402Error } from "../x402/parse-402.js";
import type { PaymentRequiredBody } from "../x402/types.js";

const VALID_BODY: PaymentRequiredBody = {
  error: "payment_required",
  requirements: {
    scheme: "x402",
    network: "testnet",
    maxAmountRequired: "0.001",
    asset: {
      code: "USDC",
      issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      contractId: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    },
    payTo: "GPAY1234567890123456789012345678901234567890123456789012",
    facilitatorUrl: "http://localhost:4021",
    maxLedgerOffset: 12,
  },
};

describe("parse402Response", () => {
  it("extracts PaymentRequirements from valid 402 body", () => {
    const result = parse402Response(VALID_BODY);
    expect(result).toEqual(VALID_BODY.requirements);
  });

  it("throws Parse402Error when error field missing", () => {
    expect(() =>
      parse402Response({ requirements: VALID_BODY.requirements } as any)
    ).toThrow(Parse402Error);
  });

  it("throws Parse402Error when error field wrong value", () => {
    expect(() =>
      parse402Response({
        error: "not_found",
        requirements: VALID_BODY.requirements,
      } as any)
    ).toThrow(Parse402Error);
  });

  it("throws Parse402Error when requirements missing", () => {
    expect(() =>
      parse402Response({ error: "payment_required" } as any)
    ).toThrow(Parse402Error);
  });

  it("throws Parse402Error when scheme is not x402", () => {
    const bad = {
      ...VALID_BODY,
      requirements: { ...VALID_BODY.requirements, scheme: "other" },
    };
    expect(() => parse402Response(bad as any)).toThrow(Parse402Error);
  });

  it("throws Parse402Error when network invalid", () => {
    const bad = {
      ...VALID_BODY,
      requirements: { ...VALID_BODY.requirements, network: "devnet" },
    };
    expect(() => parse402Response(bad as any)).toThrow(Parse402Error);
  });

  it("throws Parse402Error when payTo empty", () => {
    const bad = {
      ...VALID_BODY,
      requirements: { ...VALID_BODY.requirements, payTo: "" },
    };
    expect(() => parse402Response(bad as any)).toThrow(Parse402Error);
  });

  it("throws Parse402Error when asset.contractId empty", () => {
    const bad = {
      ...VALID_BODY,
      requirements: {
        ...VALID_BODY.requirements,
        asset: { code: "USDC", issuer: "G...", contractId: "" },
      },
    };
    expect(() => parse402Response(bad as any)).toThrow(Parse402Error);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd packages/sdk-client && pnpm test`
Expected: FAIL

- [x] **Step 3: Implement parse-402**

```typescript
import type { PaymentRequirements } from "./types.js";

export class Parse402Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Parse402Error";
  }
}

/**
 * Parse and validate an HTTP 402 response body into PaymentRequirements.
 * Throws Parse402Error if body is malformed or has unsupported values.
 */
export function parse402Response(body: unknown): PaymentRequirements {
  if (!body || typeof body !== "object") {
    throw new Parse402Error("Invalid 402 body: not an object");
  }

  const obj = body as Record<string, unknown>;

  if (obj.error !== "payment_required") {
    throw new Parse402Error(
      `Invalid 402 body: expected error="payment_required", got "${String(obj.error)}"`
    );
  }

  if (!obj.requirements || typeof obj.requirements !== "object") {
    throw new Parse402Error("Invalid 402 body: missing requirements");
  }

  const req = obj.requirements as Record<string, unknown>;

  if (req.scheme !== "x402") {
    throw new Parse402Error(`Unsupported scheme: "${String(req.scheme)}"`);
  }

  if (req.network !== "testnet" && req.network !== "mainnet") {
    throw new Parse402Error(`Unsupported network: "${String(req.network)}"`);
  }

  if (!req.payTo || typeof req.payTo !== "string") {
    throw new Parse402Error("Missing or empty payTo address");
  }

  const asset = req.asset as Record<string, unknown> | undefined;
  if (!asset || !asset.contractId) {
    throw new Parse402Error("Missing or empty asset.contractId");
  }

  return obj.requirements as PaymentRequirements;
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd packages/sdk-client && pnpm test`
Expected: 8 tests PASS

- [x] **Step 5: Commit**

```bash
git add packages/sdk-client/src/x402/parse-402.ts packages/sdk-client/src/tests/parse-402.test.ts
git commit -m "feat(sdk-client): add 402 response parser with validation"
```

---

## Task 5: Build Payment Payload

**Files:**
- Modify: `packages/sdk-client/src/x402/build-payment.ts`
- Create: `packages/sdk-client/src/tests/build-payment.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { buildPaymentPayload } from "../x402/build-payment.js";
import type { PaymentRequirements } from "../x402/types.js";
import type { SignedAuthEntry } from "../wallet/types.js";

const REQUIREMENTS: PaymentRequirements = {
  scheme: "x402",
  network: "testnet",
  maxAmountRequired: "0.001",
  asset: {
    code: "USDC",
    issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    contractId: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  },
  payTo: "GPAY1234567890123456789012345678901234567890123456789012",
  facilitatorUrl: "http://localhost:4021",
  maxLedgerOffset: 12,
};

const SIGNED: SignedAuthEntry = {
  authEntryBase64: "AAAA_fake_xdr_base64==",
  publicKey: "GABC1234567890123456789012345678901234567890123456789012",
};

describe("buildPaymentPayload", () => {
  it("creates PaymentPayload from requirements and signed auth entry", () => {
    const payload = buildPaymentPayload(REQUIREMENTS, SIGNED);
    expect(payload).toEqual({
      scheme: "x402",
      network: "testnet",
      authEntry: "AAAA_fake_xdr_base64==",
      from: "GABC1234567890123456789012345678901234567890123456789012",
    });
  });

  it("uses scheme and network from requirements", () => {
    const mainnetReqs = { ...REQUIREMENTS, network: "mainnet" as const };
    const payload = buildPaymentPayload(mainnetReqs, SIGNED);
    expect(payload.network).toBe("mainnet");
    expect(payload.scheme).toBe("x402");
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd packages/sdk-client && pnpm test`
Expected: FAIL

- [x] **Step 3: Implement build-payment**

```typescript
import type { PaymentPayload, PaymentRequirements } from "./types.js";
import type { SignedAuthEntry } from "../wallet/types.js";

/**
 * Build a PaymentPayload from payment requirements and a signed auth entry.
 */
export function buildPaymentPayload(
  requirements: PaymentRequirements,
  signed: SignedAuthEntry
): PaymentPayload {
  return {
    scheme: requirements.scheme,
    network: requirements.network,
    authEntry: signed.authEntryBase64,
    from: signed.publicKey,
  };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd packages/sdk-client && pnpm test`
Expected: 2 tests PASS

- [x] **Step 5: Commit**

```bash
git add packages/sdk-client/src/x402/build-payment.ts packages/sdk-client/src/tests/build-payment.test.ts
git commit -m "feat(sdk-client): add payment payload builder"
```

---

## Task 6: Stellar Wallet

**Files:**
- Modify: `packages/sdk-client/src/wallet/stellar.ts`
- Create: `packages/sdk-client/src/tests/stellar-wallet.test.ts`

**Key insight:** Use `authorizeInvocation(keypair, validUntil, invocation, publicKey, networkPassphrase)` from `@stellar/stellar-sdk` — builds the full `SorobanAuthorizationEntry` with address credentials, nonce, expiration, and Ed25519 signature in one call. The facilitator's verify-auth.ts validates the resulting structure.

- [x] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Keypair, xdr, StrKey, Address } from "@stellar/stellar-sdk";

// Mock rpc.Server to avoid real network calls
vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    rpc: {
      ...mod.rpc,
      Server: vi.fn(),
    },
  };
});

import { createStellarWallet } from "../wallet/stellar.js";

const TEST_KP = Keypair.random();
const TEST_SECRET = TEST_KP.secret();
const TEST_PUBLIC = TEST_KP.publicKey();
const USDC_CONTRACT =
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const PAY_TO = Keypair.random().publicKey();
const CURRENT_LEDGER = 1_000_000;

describe("createStellarWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correct publicKey from secret", () => {
    const wallet = createStellarWallet({
      stellarSecret: TEST_SECRET,
      network: "testnet",
    });
    expect(wallet.publicKey).toBe(TEST_PUBLIC);
  });

  it("signAuthEntry produces valid base64 XDR", async () => {
    const mockGetLatestLedger = vi
      .fn()
      .mockResolvedValue({ sequence: CURRENT_LEDGER });
    const { rpc } = await import("@stellar/stellar-sdk");
    vi.mocked(rpc.Server).mockImplementation(
      () => ({ getLatestLedger: mockGetLatestLedger }) as any
    );

    const wallet = createStellarWallet({
      stellarSecret: TEST_SECRET,
      network: "testnet",
    });

    const result = await wallet.signAuthEntry({
      contractId: USDC_CONTRACT,
      payTo: PAY_TO,
      amount: 10_000n,
      maxLedgerOffset: 12,
    });

    expect(result.publicKey).toBe(TEST_PUBLIC);
    expect(result.authEntryBase64).toBeTruthy();

    // Decode and verify structure matches what facilitator expects
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(
      result.authEntryBase64,
      "base64"
    );
    const creds = entry.credentials();
    expect(creds.switch()).toEqual(
      xdr.SorobanCredentialsType.sorobanCredentialsAddress()
    );

    const addrCreds = creds.address();
    expect(addrCreds.signatureExpirationLedger()).toBe(CURRENT_LEDGER + 12);

    const invocation = entry.rootInvocation();
    const contractFn = invocation.function().contractFn();
    const actualContractId = StrKey.encodeContract(
      contractFn.contractAddress().contractId()
    );
    expect(actualContractId).toBe(USDC_CONTRACT);
    expect(contractFn.functionName().toString()).toBe("transfer");

    const args = contractFn.args();
    expect(args.length).toBe(3);
    expect(Address.fromScVal(args[0]).toString()).toBe(TEST_PUBLIC);
    expect(Address.fromScVal(args[1]).toString()).toBe(PAY_TO);
  });

  it("throws if stellarSecret is invalid", () => {
    expect(() =>
      createStellarWallet({ stellarSecret: "INVALID", network: "testnet" })
    ).toThrow();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd packages/sdk-client && pnpm test`
Expected: FAIL

- [x] **Step 3: Implement stellar wallet**

```typescript
import {
  Keypair,
  xdr,
  StrKey,
  Address,
  Networks,
  nativeToScVal,
  authorizeInvocation,
  rpc,
} from "@stellar/stellar-sdk";
import type { WalletConfig, SignedAuthEntry } from "./types.js";
import type { StellarNetwork } from "../x402/types.js";

const RPC_URLS: Record<StellarNetwork, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://soroban.stellar.org",
};

const NETWORK_PASSPHRASE: Record<StellarNetwork, string> = {
  testnet: Networks.TESTNET,
  mainnet: Networks.PUBLIC,
};

export interface SignAuthEntryOptions {
  contractId: string;
  payTo: string;
  amount: bigint;
  maxLedgerOffset: number;
}

export interface StellarWallet {
  publicKey: string;
  signAuthEntry(opts: SignAuthEntryOptions): Promise<SignedAuthEntry>;
}

/**
 * Create a Stellar wallet from a secret key.
 * Provides auth entry signing for Soroban token.transfer invocations.
 */
export function createStellarWallet(config: WalletConfig): StellarWallet {
  const keypair = Keypair.fromSecret(config.stellarSecret);
  const publicKey = keypair.publicKey();
  const networkPassphrase = NETWORK_PASSPHRASE[config.network];
  const server = new rpc.Server(RPC_URLS[config.network], {
    allowHttp: false,
  });

  async function signAuthEntry(
    opts: SignAuthEntryOptions
  ): Promise<SignedAuthEntry> {
    const { contractId, payTo, amount, maxLedgerOffset } = opts;

    // Get current ledger from Soroban RPC
    const { sequence: currentLedger } = await server.getLatestLedger();
    const validUntil = currentLedger + maxLedgerOffset;

    // Build invocation tree for token.transfer(from, to, amount)
    const contractIdBytes = StrKey.decodeContract(contractId);
    const contractAddr = xdr.ScAddress.scAddressTypeContract(contractIdBytes);

    const fromScVal = new Address(publicKey).toScVal();
    const toScVal = new Address(payTo).toScVal();
    const amountScVal = nativeToScVal(amount, { type: "i128" });

    const invocation = new xdr.SorobanAuthorizedInvocation({
      function:
        xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
          new xdr.InvokeContractArgs({
            contractAddress: contractAddr,
            functionName: "transfer",
            args: [fromScVal, toScVal, amountScVal],
          })
        ),
      subInvocations: [],
    });

    // authorizeInvocation builds full SorobanAuthorizationEntry with
    // address credentials, nonce, expiration, and Ed25519 signature
    const entry = await authorizeInvocation(
      keypair,
      validUntil,
      invocation,
      undefined,
      networkPassphrase
    );

    return {
      authEntryBase64: entry.toXDR("base64"),
      publicKey,
    };
  }

  return { publicKey, signAuthEntry };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd packages/sdk-client && pnpm test`
Expected: 3 tests PASS

- [x] **Step 5: Commit**

```bash
git add packages/sdk-client/src/wallet/stellar.ts packages/sdk-client/src/tests/stellar-wallet.test.ts
git commit -m "feat(sdk-client): add Stellar wallet with Soroban auth entry signing"
```

---

## Task 7: KovaClient Class

**Files:**
- Modify: `packages/sdk-client/src/client.ts`
- Create: `packages/sdk-client/src/tests/client.test.ts`

This is the core orchestrator. London School: mock all deps (wallet, parse-402, build-payment, utils, global fetch).

- [x] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../wallet/stellar.js", () => ({
  createStellarWallet: vi.fn(),
}));
vi.mock("../x402/parse-402.js", () => ({
  parse402Response: vi.fn(),
  Parse402Error: class extends Error {
    name = "Parse402Error";
  },
}));
vi.mock("../x402/build-payment.js", () => ({
  buildPaymentPayload: vi.fn(),
}));
vi.mock("../utils.js", () => ({
  decimalToStroops: vi.fn(),
  encodePaymentHeader: vi.fn(),
}));

import { KovaClient, BudgetExceededError } from "../client.js";
import { createStellarWallet } from "../wallet/stellar.js";
import { parse402Response } from "../x402/parse-402.js";
import { buildPaymentPayload } from "../x402/build-payment.js";
import { decimalToStroops, encodePaymentHeader } from "../utils.js";
import type { PaymentRequirements, PaymentPayload } from "../x402/types.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const REQUIREMENTS: PaymentRequirements = {
  scheme: "x402",
  network: "testnet",
  maxAmountRequired: "0.001",
  asset: {
    code: "USDC",
    issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    contractId: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  },
  payTo: "GPAY1234567890123456789012345678901234567890123456789012",
  facilitatorUrl: "http://localhost:4021",
  maxLedgerOffset: 12,
};

const PAYLOAD: PaymentPayload = {
  scheme: "x402",
  network: "testnet",
  authEntry: "signed_xdr_base64",
  from: "GFROM...",
};

describe("KovaClient", () => {
  let mockWallet: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWallet = {
      publicKey: "GFROM...",
      signAuthEntry: vi.fn().mockResolvedValue({
        authEntryBase64: "signed_xdr_base64",
        publicKey: "GFROM...",
      }),
    };
    vi.mocked(createStellarWallet).mockReturnValue(mockWallet);
    vi.mocked(parse402Response).mockReturnValue(REQUIREMENTS);
    vi.mocked(buildPaymentPayload).mockReturnValue(PAYLOAD);
    vi.mocked(decimalToStroops).mockReturnValue(10_000n);
    vi.mocked(encodePaymentHeader).mockReturnValue("base64encodedpayment");
  });

  it("passes through non-402 responses without payment", async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true });

    const client = new KovaClient({
      stellarSecret: "STEST...",
      network: "testnet",
    });
    const res = await client.fetch("https://api.example.com/data");

    expect(res.status).toBe(200);
    expect(mockWallet.signAuthEntry).not.toHaveBeenCalled();
  });

  it("auto-pays 402 and retries with X-PAYMENT header", async () => {
    const r402 = {
      status: 402,
      ok: false,
      json: () =>
        Promise.resolve({
          error: "payment_required",
          requirements: REQUIREMENTS,
        }),
    };
    const r200 = { status: 200, ok: true };
    mockFetch.mockResolvedValueOnce(r402).mockResolvedValueOnce(r200);

    const client = new KovaClient({
      stellarSecret: "STEST...",
      network: "testnet",
    });
    const res = await client.fetch("https://api.example.com/weather");

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][1].headers["X-PAYMENT"]).toBe(
      "base64encodedpayment"
    );
  });

  it("tracks spending after successful payment", async () => {
    const r402 = {
      status: 402,
      ok: false,
      json: () =>
        Promise.resolve({
          error: "payment_required",
          requirements: REQUIREMENTS,
        }),
    };
    const r200 = { status: 200, ok: true };
    mockFetch.mockResolvedValueOnce(r402).mockResolvedValueOnce(r200);

    const client = new KovaClient({
      stellarSecret: "STEST...",
      network: "testnet",
    });
    await client.fetch("https://api.example.com/weather");

    const spending = client.getSpending();
    expect(spending.requestsCount).toBe(1);
    expect(spending.totalSpent).toBe("0.001");
  });

  it("throws BudgetExceededError when maxPerRequest exceeded", async () => {
    const r402 = {
      status: 402,
      ok: false,
      json: () =>
        Promise.resolve({
          error: "payment_required",
          requirements: { ...REQUIREMENTS, maxAmountRequired: "0.01" },
        }),
    };
    mockFetch.mockResolvedValue(r402);
    vi.mocked(parse402Response).mockReturnValue({
      ...REQUIREMENTS,
      maxAmountRequired: "0.01",
    });
    vi.mocked(decimalToStroops)
      .mockReturnValueOnce(50_000n)   // maxPerRequest = 0.005
      .mockReturnValueOnce(100_000n); // requested = 0.01

    const client = new KovaClient({
      stellarSecret: "STEST...",
      network: "testnet",
      budget: { maxPerRequest: "0.005" },
    });

    await expect(
      client.fetch("https://api.example.com/expensive")
    ).rejects.toThrow(BudgetExceededError);
  });

  it("fetchAll sends concurrent requests", async () => {
    const r200 = { status: 200, ok: true };
    mockFetch.mockResolvedValue(r200);

    const client = new KovaClient({
      stellarSecret: "STEST...",
      network: "testnet",
    });
    const results = await client.fetchAll([
      "https://api.example.com/a",
      "https://api.example.com/b",
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe(200);
    expect(results[1].status).toBe(200);
  });

  it("getSpending returns zeroes before any requests", () => {
    const client = new KovaClient({
      stellarSecret: "STEST...",
      network: "testnet",
    });
    const spending = client.getSpending();
    expect(spending.totalSpent).toBe("0");
    expect(spending.requestsCount).toBe(0);
    expect(spending.lastPayment).toBeNull();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd packages/sdk-client && pnpm test`
Expected: FAIL

- [x] **Step 3: Implement KovaClient**

```typescript
import type { StellarNetwork, PaymentRequirements } from "./x402/types.js";
import { parse402Response } from "./x402/parse-402.js";
import { buildPaymentPayload } from "./x402/build-payment.js";
import {
  createStellarWallet,
  type StellarWallet,
} from "./wallet/stellar.js";
import { decimalToStroops, encodePaymentHeader } from "./utils.js";

/** Budget configuration for spending limits */
export interface BudgetConfig {
  /** Max amount (decimal string) per single request */
  maxPerRequest?: string;
  /** Max total amount (decimal string) per hour */
  maxPerHour?: string;
  /** Max total amount (decimal string) per day */
  maxPerDay?: string;
  /** Callback invoked when budget limit exceeded */
  onBudgetExceeded?: (info: {
    limit: string;
    requested: string;
    type: string;
  }) => void;
}

/** Options for creating a KovaClient */
export interface KovaClientOptions {
  /** Stellar secret key (S... format) */
  stellarSecret: string;
  /** Stellar network */
  network: StellarNetwork;
  /** Budget spending limits */
  budget?: BudgetConfig;
}

/** Spending record for single payment */
interface PaymentRecord {
  amount: string;
  url: string;
  timestamp: number;
}

/** Summary of spending activity */
export interface SpendingSummary {
  totalSpent: string;
  requestsCount: number;
  lastPayment: PaymentRecord | null;
}

/** Error thrown when budget limit exceeded */
export class BudgetExceededError extends Error {
  constructor(
    public readonly limitType: string,
    public readonly limit: string,
    public readonly requested: string
  ) {
    super(
      `Budget exceeded: ${limitType} limit is ${limit}, requested ${requested}`
    );
    this.name = "BudgetExceededError";
  }
}

/**
 * KovaClient — fetch wrapper that auto-pays x402 paywalls on Stellar.
 */
export class KovaClient {
  private readonly wallet: StellarWallet;
  private readonly network: StellarNetwork;
  private readonly budget?: BudgetConfig;
  private readonly payments: PaymentRecord[] = [];

  constructor(options: KovaClientOptions) {
    this.network = options.network;
    this.budget = options.budget;
    this.wallet = createStellarWallet({
      stellarSecret: options.stellarSecret,
      network: options.network,
    });
  }

  /**
   * Fetch a URL, auto-detecting and paying x402 paywalls.
   * If server returns 402, signs Soroban auth entry and retries.
   */
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    const response = await fetch(url, options);

    if (response.status !== 402) {
      return response;
    }

    const body = await response.json();
    const requirements = parse402Response(body);

    this.checkBudget(requirements);

    const amount = decimalToStroops(requirements.maxAmountRequired);
    const signed = await this.wallet.signAuthEntry({
      contractId: requirements.asset.contractId,
      payTo: requirements.payTo,
      amount,
      maxLedgerOffset: requirements.maxLedgerOffset,
    });

    const payload = buildPaymentPayload(requirements, signed);
    const paymentHeader = encodePaymentHeader(payload);

    const retryHeaders: Record<string, string> = {
      ...Object.fromEntries(
        new Headers(options?.headers).entries()
      ),
      "X-PAYMENT": paymentHeader,
    };

    const retryResponse = await fetch(url, {
      ...options,
      headers: retryHeaders,
    });

    this.payments.push({
      amount: requirements.maxAmountRequired,
      url,
      timestamp: Date.now(),
    });

    return retryResponse;
  }

  /**
   * Fetch multiple URLs concurrently, auto-paying any 402 paywalls.
   */
  async fetchAll(
    urls: string[],
    options?: RequestInit
  ): Promise<Response[]> {
    return Promise.all(urls.map((url) => this.fetch(url, options)));
  }

  /**
   * Get a summary of spending activity.
   */
  getSpending(): SpendingSummary {
    const totalStroops = this.payments.reduce(
      (sum, p) => sum + decimalToStroops(p.amount),
      0n
    );

    return {
      totalSpent: this.stroopsToDecimal(totalStroops),
      requestsCount: this.payments.length,
      lastPayment:
        this.payments.length > 0
          ? this.payments[this.payments.length - 1]
          : null,
    };
  }

  private checkBudget(requirements: PaymentRequirements): void {
    if (!this.budget) return;

    const requestedAmount = decimalToStroops(
      requirements.maxAmountRequired
    );

    if (this.budget.maxPerRequest) {
      const limit = decimalToStroops(this.budget.maxPerRequest);
      if (requestedAmount > limit) {
        this.budget.onBudgetExceeded?.({
          limit: this.budget.maxPerRequest,
          requested: requirements.maxAmountRequired,
          type: "maxPerRequest",
        });
        throw new BudgetExceededError(
          "maxPerRequest",
          this.budget.maxPerRequest,
          requirements.maxAmountRequired
        );
      }
    }

    const now = Date.now();

    if (this.budget.maxPerHour) {
      const hourAgo = now - 3_600_000;
      const hourlySpent = this.payments
        .filter((p) => p.timestamp > hourAgo)
        .reduce((sum, p) => sum + decimalToStroops(p.amount), 0n);
      const limit = decimalToStroops(this.budget.maxPerHour);
      if (hourlySpent + requestedAmount > limit) {
        this.budget.onBudgetExceeded?.({
          limit: this.budget.maxPerHour,
          requested: requirements.maxAmountRequired,
          type: "maxPerHour",
        });
        throw new BudgetExceededError(
          "maxPerHour",
          this.budget.maxPerHour,
          requirements.maxAmountRequired
        );
      }
    }

    if (this.budget.maxPerDay) {
      const dayAgo = now - 86_400_000;
      const dailySpent = this.payments
        .filter((p) => p.timestamp > dayAgo)
        .reduce((sum, p) => sum + decimalToStroops(p.amount), 0n);
      const limit = decimalToStroops(this.budget.maxPerDay);
      if (dailySpent + requestedAmount > limit) {
        this.budget.onBudgetExceeded?.({
          limit: this.budget.maxPerDay,
          requested: requirements.maxAmountRequired,
          type: "maxPerDay",
        });
        throw new BudgetExceededError(
          "maxPerDay",
          this.budget.maxPerDay,
          requirements.maxAmountRequired
        );
      }
    }
  }

  private stroopsToDecimal(stroops: bigint): string {
    if (stroops === 0n) return "0";
    const whole = stroops / 10_000_000n;
    const frac = stroops % 10_000_000n;
    if (frac === 0n) return whole.toString();
    const fracStr = frac
      .toString()
      .padStart(7, "0")
      .replace(/0+$/, "");
    return `${whole}.${fracStr}`;
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd packages/sdk-client && pnpm test`
Expected: 6 tests PASS

- [x] **Step 5: Commit**

```bash
git add packages/sdk-client/src/client.ts packages/sdk-client/src/tests/client.test.ts
git commit -m "feat(sdk-client): add KovaClient with auto-pay, budget, and spending tracking"
```

---

## Task 8: Budget Edge Case Tests

**Files:**
- Create: `packages/sdk-client/src/tests/budget.test.ts`

- [x] **Step 1: Write budget edge case tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../wallet/stellar.js", () => ({
  createStellarWallet: vi.fn(),
}));
vi.mock("../x402/parse-402.js", () => ({
  parse402Response: vi.fn(),
  Parse402Error: class extends Error {},
}));
vi.mock("../x402/build-payment.js", () => ({
  buildPaymentPayload: vi.fn(),
}));
vi.mock("../utils.js", () => ({
  decimalToStroops: vi.fn(),
  encodePaymentHeader: vi.fn(),
}));

import { KovaClient, BudgetExceededError } from "../client.js";
import { createStellarWallet } from "../wallet/stellar.js";
import { parse402Response } from "../x402/parse-402.js";
import { buildPaymentPayload } from "../x402/build-payment.js";
import { decimalToStroops, encodePaymentHeader } from "../utils.js";
import type { PaymentRequirements } from "../x402/types.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const REQUIREMENTS: PaymentRequirements = {
  scheme: "x402",
  network: "testnet",
  maxAmountRequired: "0.001",
  asset: {
    code: "USDC",
    issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    contractId: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  },
  payTo: "GPAY1234567890123456789012345678901234567890123456789012",
  facilitatorUrl: "http://localhost:4021",
  maxLedgerOffset: 12,
};

function setupMocks() {
  const mockWallet = {
    publicKey: "GFROM...",
    signAuthEntry: vi.fn().mockResolvedValue({
      authEntryBase64: "signed_xdr_base64",
      publicKey: "GFROM...",
    }),
  };
  vi.mocked(createStellarWallet).mockReturnValue(mockWallet);
  vi.mocked(parse402Response).mockReturnValue(REQUIREMENTS);
  vi.mocked(buildPaymentPayload).mockReturnValue({
    scheme: "x402",
    network: "testnet",
    authEntry: "signed_xdr_base64",
    from: "GFROM...",
  });
  vi.mocked(encodePaymentHeader).mockReturnValue("encoded");
  return mockWallet;
}

describe("BudgetExceededError", () => {
  it("includes limitType, limit, and requested in message", () => {
    const err = new BudgetExceededError("maxPerRequest", "0.005", "0.01");
    expect(err.name).toBe("BudgetExceededError");
    expect(err.limitType).toBe("maxPerRequest");
    expect(err.limit).toBe("0.005");
    expect(err.requested).toBe("0.01");
    expect(err.message).toContain("maxPerRequest");
  });
});

describe("KovaClient budget — onBudgetExceeded callback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invokes onBudgetExceeded callback before throwing", async () => {
    setupMocks();
    const highReqs = { ...REQUIREMENTS, maxAmountRequired: "1.0" };
    vi.mocked(parse402Response).mockReturnValue(highReqs);
    vi.mocked(decimalToStroops)
      .mockReturnValueOnce(50_000n)     // maxPerRequest = 0.005
      .mockReturnValueOnce(10_000_000n); // requested = 1.0

    mockFetch.mockResolvedValue({
      status: 402,
      ok: false,
      json: () =>
        Promise.resolve({
          error: "payment_required",
          requirements: highReqs,
        }),
    });

    const onBudgetExceeded = vi.fn();
    const client = new KovaClient({
      stellarSecret: "STEST...",
      network: "testnet",
      budget: { maxPerRequest: "0.005", onBudgetExceeded },
    });

    await expect(
      client.fetch("https://api.example.com/expensive")
    ).rejects.toThrow(BudgetExceededError);

    expect(onBudgetExceeded).toHaveBeenCalledWith({
      limit: "0.005",
      requested: "1.0",
      type: "maxPerRequest",
    });
  });
});
```

- [x] **Step 2: Run tests to verify they pass**

Run: `cd packages/sdk-client && pnpm test`
Expected: All tests PASS

- [x] **Step 3: Commit**

```bash
git add packages/sdk-client/src/tests/budget.test.ts
git commit -m "test(sdk-client): add budget enforcement edge case tests"
```

---

## Task 9: Barrel Exports

**Files:**
- Modify: `packages/sdk-client/src/index.ts`

- [x] **Step 1: Write barrel exports**

```typescript
// Client
export { KovaClient, BudgetExceededError } from "./client.js";
export type {
  KovaClientOptions,
  BudgetConfig,
  SpendingSummary,
} from "./client.js";

// x402 types (re-exported for consumers)
export type {
  PaymentScheme,
  StellarNetwork,
  AssetInfo,
  PaymentRequirements,
  PaymentPayload,
  PaymentRequiredBody,
} from "./x402/types.js";

// Errors
export { Parse402Error } from "./x402/parse-402.js";

// Wallet types
export type { WalletConfig, SignedAuthEntry } from "./wallet/types.js";
```

- [x] **Step 2: Verify build succeeds**

Run: `cd packages/sdk-client && pnpm build`
Expected: `dist/index.js` and `dist/index.d.ts` produced with correct exports.

- [x] **Step 3: Verify lint passes**

Run: `cd packages/sdk-client && pnpm lint`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add packages/sdk-client/src/index.ts
git commit -m "feat(sdk-client): add barrel exports for public API"
```

---

## Task 10: Full Build & Test Verification

- [x] **Step 1: Run all tests**

Run: `cd packages/sdk-client && pnpm test`
Expected: ~29 assertions across 6 test files, all PASS.

- [x] **Step 2: Run build**

Run: `cd packages/sdk-client && pnpm build`
Expected: `dist/` has `index.js`, `index.d.ts`, source maps.

- [x] **Step 3: Verify type exports**

Run: `cd packages/sdk-client && node -e "import('./dist/index.js').then(m => console.log(Object.keys(m)))"`
Expected: Prints `['KovaClient', 'BudgetExceededError', 'Parse402Error']`

- [x] **Step 4: Run lint**

Run: `cd packages/sdk-client && pnpm lint`
Expected: PASS

- [x] **Step 5: Update TASKS.md — mark sdk-client tasks complete**

---

## Dependency Graph

```
Task 0: Test infra (no deps)
Task 1: x402/types.ts (no deps)
Task 2: wallet/types.ts (depends on Task 1)
  └── commit after Task 2

Task 3: utils.ts + tests (depends on Task 1)     ← parallel
Task 4: parse-402.ts + tests (depends on Task 1)  ← parallel
Task 5: build-payment.ts + tests (depends on Tasks 1, 2) ← parallel
Task 6: wallet/stellar.ts + tests (depends on Tasks 1, 2) ← parallel

Task 7: client.ts + tests (depends on Tasks 3-6)
Task 8: budget tests (depends on Task 7)
Task 9: index.ts exports (depends on Tasks 1-7)
Task 10: full verification (depends on all)
```

Tasks 3, 4, 5, 6 can run in parallel. Tasks 7-10 sequential.

---

## Verification

1. `pnpm test` — all 29+ assertions pass
2. `pnpm build` — produces `dist/index.js` + `dist/index.d.ts`
3. `pnpm lint` — no type errors
4. Runtime smoke: `node -e "import('./dist/index.js').then(m => console.log(Object.keys(m)))"` prints exports
5. Cross-package: from `examples/agent-consumer`, import `KovaClient` and verify types resolve
