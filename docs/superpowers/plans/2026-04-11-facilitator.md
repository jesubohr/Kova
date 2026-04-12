# Facilitator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `kova-facilitator` Fastify service that verifies and settles x402 Soroban payments on Stellar.

**Architecture:** Client sends a pre-signed `SorobanAuthorizationEntry` (base64 XDR) in `X-PAYMENT`. Facilitator `/verify` decodes it, validates params, simulates via Soroban RPC. Facilitator `/settle` builds an `invokeHostFunction` tx using that auth entry, fee-bumps it, and submits to Stellar — returning a settlement receipt.

**Tech Stack:** Fastify 5, `@stellar/stellar-sdk` v13, `@fastify/rate-limit`, TypeScript ESM, tsup, vitest

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/types.ts` | All shared types (PaymentPayload, PaymentRequirements, SettlementReceipt, route request/response shapes) |
| `src/config.ts` | Parse + validate env vars at startup; export typed `config` singleton |
| `src/fee/calculator.ts` | Pure function: compute Kova fee from amount (configurable %, floor) |
| `src/stellar/client.ts` | Create and export `SorobanRpc.Server` instance per network |
| `src/stellar/tokens.ts` | USDC contract address constants per network |
| `src/stellar/verify-auth.ts` | Decode XDR auth entry, check contract/fn/params/expiry, simulate via RPC |
| `src/stellar/submit-tx.ts` | Build `invokeHostFunction` tx, attach auth entry, fee-bump, submit, poll |
| `src/routes/supported.ts` | `GET /supported` — static JSON of supported networks/schemes/assets |
| `src/routes/verify.ts` | `POST /verify` — call `verifyAuthEntry`, return ok/error |
| `src/routes/settle.ts` | `POST /settle` — re-verify, call `submitTx`, return receipt |
| `src/index.ts` | Fastify server: CORS, rate-limit, register routes, listen on `FACILITATOR_PORT` |

---

## Task 1: Install Test Dependency

**Files:**
- Modify: `packages/facilitator/package.json`

- [x] **Step 1: Add vitest to devDependencies**

```bash
cd packages/facilitator && pnpm add -D vitest
```

- [x] **Step 2: Add test script to package.json**

Edit `packages/facilitator/package.json` — add `"test": "vitest run"` to `scripts`.

- [x] **Step 3: Verify install**

```bash
cd packages/facilitator && pnpm test
```

Expected: `No test files found` (not a failure — vitest exits 0 when no files match).

---

## Task 2: Shared Types

**Files:**
- Modify: `packages/facilitator/src/types.ts`

These types are the contract between facilitator, sdk-server, and sdk-client. Lock them in first.

- [x] **Step 1: Write the types**

Replace `src/types.ts` with:

```typescript
/** Network identifier */
export type StellarNetwork = 'testnet' | 'mainnet';

/** Scheme identifier — always "x402" for this protocol */
export type PaymentScheme = 'x402';

/** Asset identifier on Stellar */
export interface AssetInfo {
  code: string;      // e.g. "USDC"
  issuer: string;    // G... address of issuer (empty for native XLM)
  contractId: string; // C... Soroban token contract address
}

/**
 * PaymentRequirements — returned in 402 response by sdk-server.
 * Tells the client what to sign and where to send payment.
 */
export interface PaymentRequirements {
  scheme: PaymentScheme;
  network: StellarNetwork;
  maxAmountRequired: string;   // decimal string, e.g. "0.001"
  asset: AssetInfo;
  payTo: string;               // G... Stellar address of the API provider
  facilitatorUrl: string;      // URL of this facilitator
  maxLedgerOffset: number;     // how many ledgers ahead client should set expiry
}

/**
 * PaymentPayload — what the client includes in X-PAYMENT header (base64-encoded JSON).
 */
export interface PaymentPayload {
  scheme: PaymentScheme;
  network: StellarNetwork;
  /** base64-encoded XDR SorobanAuthorizationEntry */
  authEntry: string;
  /** G... address of the payer (client's Stellar account) */
  from: string;
}

/**
 * SettlementReceipt — returned after a successful /settle.
 */
export interface SettlementReceipt {
  txHash: string;
  network: StellarNetwork;
  settledAt: string;  // ISO 8601
  amount: string;     // amount transferred (decimal string)
  fee: string;        // Kova fee taken (decimal string)
}

/** POST /verify request body */
export interface VerifyRequest {
  payload: PaymentPayload;
  requirements: PaymentRequirements;
}

/** POST /verify response body */
export interface VerifyResponse {
  valid: boolean;
  error?: string;
}

/** POST /settle request body */
export interface SettleRequest {
  payload: PaymentPayload;
  requirements: PaymentRequirements;
}

/** POST /settle response body */
export interface SettleResponse {
  success: boolean;
  receipt?: SettlementReceipt;
  error?: string;
}

/** GET /supported response body */
export interface SupportedResponse {
  schemes: PaymentScheme[];
  networks: StellarNetwork[];
  assets: Record<StellarNetwork, AssetInfo[]>;
}
```

- [x] **Step 2: Commit**

```bash
git add packages/facilitator/src/types.ts
git commit -m "feat(facilitator): define shared payment types"
```

---

## Task 3: Config

**Files:**
- Modify: `packages/facilitator/src/config.ts`
- Create: `packages/facilitator/src/tests/config.test.ts`

- [x] **Step 1: Write failing test**

Create `packages/facilitator/src/tests/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('config', () => {
  beforeEach(() => {
    // Reset module between tests
    vi.resetModules();
  });

  it('throws when FACILITATOR_STELLAR_SECRET missing', async () => {
    const env = {
      FACILITATOR_PORT: '4021',
      STELLAR_NETWORK: 'testnet',
      KOVA_FEE_PERCENT: '1.5',
      KOVA_TREASURY_ADDRESS: 'GABC',
    };
    Object.assign(process.env, env);
    delete process.env.FACILITATOR_STELLAR_SECRET;

    await expect(import('../config.js')).rejects.toThrow('FACILITATOR_STELLAR_SECRET');
  });

  it('returns parsed config when all env vars present', async () => {
    process.env.FACILITATOR_STELLAR_SECRET = 'STEST';
    process.env.FACILITATOR_PORT = '4021';
    process.env.STELLAR_NETWORK = 'testnet';
    process.env.KOVA_FEE_PERCENT = '1.5';
    process.env.KOVA_TREASURY_ADDRESS = 'GABC';

    const { config } = await import('../config.js');
    expect(config.port).toBe(4021);
    expect(config.network).toBe('testnet');
    expect(config.feePercent).toBe(1.5);
    expect(config.stellarSecret).toBe('STEST');
    expect(config.treasuryAddress).toBe('GABC');
  });
});
```

- [x] **Step 2: Run test — expect fail**

```bash
cd packages/facilitator && pnpm test
```

Expected: `Cannot find module '../config.js'` or similar.

- [x] **Step 3: Implement config**

Replace `src/config.ts` with:

```typescript
import type { StellarNetwork } from './types.js';

function require(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  stellarSecret: require('FACILITATOR_STELLAR_SECRET'),
  port: parseInt(optional('FACILITATOR_PORT', '4021'), 10),
  network: optional('STELLAR_NETWORK', 'testnet') as StellarNetwork,
  feePercent: parseFloat(optional('KOVA_FEE_PERCENT', '1.5')),
  treasuryAddress: require('KOVA_TREASURY_ADDRESS'),
} as const;

export type Config = typeof config;
```

- [x] **Step 4: Run test — expect pass**

```bash
cd packages/facilitator && pnpm test
```

Expected: all pass.

- [x] **Step 5: Commit**

```bash
git add packages/facilitator/src/config.ts packages/facilitator/src/tests/config.test.ts
git commit -m "feat(facilitator): env-based config with validation"
```

---

## Task 4: Fee Calculator

**Files:**
- Modify: `packages/facilitator/src/fee/calculator.ts`
- Create: `packages/facilitator/src/tests/fee-calculator.test.ts`

Amounts use Stellar's 7-decimal fixed-point: 1 USDC = `10_000_000` stroops.

- [x] **Step 1: Write failing tests**

Create `packages/facilitator/src/tests/fee-calculator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateFee } from '../fee/calculator.js';

describe('calculateFee', () => {
  it('computes 1.5% of amount', () => {
    // 1 USDC = 10_000_000 stroops. 1.5% of 10_000_000 = 150_000
    expect(calculateFee(10_000_000n, 1.5, 1000n)).toBe(150_000n);
  });

  it('applies minimum floor when fee < floor', () => {
    // 1.5% of 1000 = 15, but floor is 1000
    expect(calculateFee(1_000n, 1.5, 1000n)).toBe(1000n);
  });

  it('handles zero amount', () => {
    expect(calculateFee(0n, 1.5, 1000n)).toBe(1000n); // floor applies
  });

  it('rounds down to whole stroop', () => {
    // 1.5% of 10_000_001 = 150_000.015 → 150_000
    expect(calculateFee(10_000_001n, 1.5, 1000n)).toBe(150_000n);
  });
});
```

- [x] **Step 2: Run — expect fail**

```bash
cd packages/facilitator && pnpm test
```

Expected: `Cannot find module '../fee/calculator.js'`.

- [x] **Step 3: Implement**

Replace `src/fee/calculator.ts` with:

```typescript
/**
 * Calculate Kova fee on a payment amount.
 * All amounts in stroops (bigint, 7 decimal places).
 *
 * @param amount - gross payment amount in stroops
 * @param feePercent - fee percentage, e.g. 1.5 for 1.5%
 * @param floorStroops - minimum fee in stroops
 * @returns fee amount in stroops (at least floorStroops)
 */
export function calculateFee(
  amount: bigint,
  feePercent: number,
  floorStroops: bigint
): bigint {
  const feeRaw = (amount * BigInt(Math.floor(feePercent * 1000))) / 100_000n;
  return feeRaw < floorStroops ? floorStroops : feeRaw;
}
```

- [x] **Step 4: Run — expect pass**

```bash
cd packages/facilitator && pnpm test
```

Expected: 4 tests pass.

- [x] **Step 5: Commit**

```bash
git add packages/facilitator/src/fee/calculator.ts packages/facilitator/src/tests/fee-calculator.test.ts
git commit -m "feat(facilitator): fee calculator with floor"
```

---

## Task 5: Stellar Client + Token Addresses

**Files:**
- Modify: `packages/facilitator/src/stellar/client.ts`
- Modify: `packages/facilitator/src/stellar/tokens.ts`

No unit tests here — these are thin wrappers over external SDK. Verified by integration test in Task 12.

- [x] **Step 1: Implement Stellar RPC client**

Replace `src/stellar/client.ts` with:

```typescript
import { rpc } from '@stellar/stellar-sdk';
import type { StellarNetwork } from '../types.js';

const RPC_URLS: Record<StellarNetwork, string> = {
  testnet: 'https://soroban-testnet.stellar.org',
  mainnet: 'https://soroban.stellar.org',
};

/** Returns a Soroban RPC server for the given network. */
export function getRpcServer(network: StellarNetwork): rpc.Server {
  return new rpc.Server(RPC_URLS[network], { allowHttp: false });
}
```

- [x] **Step 2: Implement token addresses**

Replace `src/stellar/tokens.ts` with:

```typescript
import type { StellarNetwork, AssetInfo } from '../types.js';

/**
 * USDC contract addresses per network.
 *
 * Testnet: Circle USDC testnet SAC (Stellar Asset Contract)
 * Mainnet: Circle USDC mainnet SAC
 *
 * See: https://developers.circle.com/stablecoins/docs/usdc-on-stellar
 */
export const USDC: Record<StellarNetwork, AssetInfo> = {
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

/** All supported assets per network */
export const SUPPORTED_ASSETS: Record<StellarNetwork, AssetInfo[]> = {
  testnet: [USDC.testnet],
  mainnet: [USDC.mainnet],
};
```

- [x] **Step 3: Commit**

```bash
git add packages/facilitator/src/stellar/client.ts packages/facilitator/src/stellar/tokens.ts
git commit -m "feat(facilitator): Soroban RPC client and token addresses"
```

---

## Task 6: Auth Entry Verification

**Files:**
- Modify: `packages/facilitator/src/stellar/verify-auth.ts`
- Create: `packages/facilitator/src/tests/verify-auth.test.ts`

The client sends a base64-encoded `SorobanAuthorizationEntry` XDR. We decode it, check:
1. Contract ID matches the expected USDC contract
2. Function name is `transfer`
3. Args: `from` = payer address, `to` = payTo address, `amount` ≥ required price
4. Expiration ledger is in the future (> current ledger)

- [x] **Step 1: Write failing tests**

Create `packages/facilitator/src/tests/verify-auth.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { xdr, StrKey, Address } from '@stellar/stellar-sdk';
import { verifyAuthEntry, AuthVerificationError } from '../stellar/verify-auth.js';

// Build a minimal SorobanAuthorizationEntry XDR for testing.
function buildAuthEntryXdr(overrides: {
  contractId?: string;
  functionName?: string;
  from?: string;
  to?: string;
  amount?: bigint;
  expirationLedger?: number;
}): string {
  const {
    contractId = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    functionName = 'transfer',
    from = 'GABC1234567890123456789012345678901234567890123456789012',
    to = 'GPAY1234567890123456789012345678901234567890123456789012',
    amount = 1_000_000n,
    expirationLedger = 9_999_999,
  } = overrides;

  // Build sc_vals for args
  const fromAddr = xdr.ScVal.scvAddress(
    xdr.ScAddress.scAddressTypeAccount(
      xdr.PublicKey.publicKeyTypeEd25519(
        StrKey.decodeEd25519PublicKey(from)
      )
    )
  );
  const toAddr = xdr.ScVal.scvAddress(
    xdr.ScAddress.scAddressTypeAccount(
      xdr.PublicKey.publicKeyTypeEd25519(
        StrKey.decodeEd25519PublicKey(to)
      )
    )
  );
  const amountVal = xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      hi: xdr.Int64.fromString('0'),
      lo: xdr.Uint64.fromString(amount.toString()),
    })
  );

  const contractAddr = xdr.ScAddress.scAddressTypeContract(
    StrKey.decodeContract(contractId)
  );

  const invocation = new xdr.SorobanAuthorizedInvocation({
    function:
      xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: contractAddr,
          functionName,
          args: [fromAddr, toAddr, amountVal],
        })
      ),
    subInvocations: [],
  });

  const entry = new xdr.SorobanAuthorizationEntry({
    credentials:
      xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: xdr.ScAddress.scAddressTypeAccount(
            xdr.PublicKey.publicKeyTypeEd25519(
              StrKey.decodeEd25519PublicKey(from)
            )
          ),
          nonce: xdr.Int64.fromString('0'),
          signatureExpirationLedger: expirationLedger,
          signature: xdr.ScVal.scvVoid(),
        })
      ),
    rootInvocation: invocation,
  });

  return entry.toXDR('base64');
}

const PAYER = 'GABC1234567890123456789012345678901234567890123456789012';
const PAY_TO = 'GPAY1234567890123456789012345678901234567890123456789012';
const USDC_CONTRACT = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
const CURRENT_LEDGER = 1_000_000;

describe('verifyAuthEntry', () => {
  it('returns ok for valid auth entry', async () => {
    const authEntry = buildAuthEntryXdr({
      contractId: USDC_CONTRACT,
      from: PAYER,
      to: PAY_TO,
      amount: 1_000_000n,
    });

    const result = await verifyAuthEntry({
      authEntryBase64: authEntry,
      expectedContractId: USDC_CONTRACT,
      expectedPayTo: PAY_TO,
      expectedFrom: PAYER,
      minAmount: 1_000_000n,
      currentLedger: CURRENT_LEDGER,
    });

    expect(result.valid).toBe(true);
    expect(result.amount).toBe(1_000_000n);
  });

  it('rejects wrong contract ID', async () => {
    const authEntry = buildAuthEntryXdr({ contractId: USDC_CONTRACT.replace('C', 'D') });

    await expect(
      verifyAuthEntry({
        authEntryBase64: authEntry,
        expectedContractId: USDC_CONTRACT,
        expectedPayTo: PAY_TO,
        expectedFrom: PAYER,
        minAmount: 1_000_000n,
        currentLedger: CURRENT_LEDGER,
      })
    ).rejects.toThrow(AuthVerificationError);
  });

  it('rejects wrong function name', async () => {
    const authEntry = buildAuthEntryXdr({ functionName: 'approve' });

    await expect(
      verifyAuthEntry({
        authEntryBase64: authEntry,
        expectedContractId: USDC_CONTRACT,
        expectedPayTo: PAY_TO,
        expectedFrom: PAYER,
        minAmount: 1_000_000n,
        currentLedger: CURRENT_LEDGER,
      })
    ).rejects.toThrow(AuthVerificationError);
  });

  it('rejects amount below minimum', async () => {
    const authEntry = buildAuthEntryXdr({ amount: 500_000n });

    await expect(
      verifyAuthEntry({
        authEntryBase64: authEntry,
        expectedContractId: USDC_CONTRACT,
        expectedPayTo: PAY_TO,
        expectedFrom: PAYER,
        minAmount: 1_000_000n,
        currentLedger: CURRENT_LEDGER,
      })
    ).rejects.toThrow(AuthVerificationError);
  });

  it('rejects expired ledger', async () => {
    const authEntry = buildAuthEntryXdr({ expirationLedger: CURRENT_LEDGER - 1 });

    await expect(
      verifyAuthEntry({
        authEntryBase64: authEntry,
        expectedContractId: USDC_CONTRACT,
        expectedPayTo: PAY_TO,
        expectedFrom: PAYER,
        minAmount: 1_000_000n,
        currentLedger: CURRENT_LEDGER,
      })
    ).rejects.toThrow(AuthVerificationError);
  });
});
```

- [x] **Step 2: Run — expect fail**

```bash
cd packages/facilitator && pnpm test
```

Expected: `Cannot find module '../stellar/verify-auth.js'`.

- [x] **Step 3: Implement**

Replace `src/stellar/verify-auth.ts` with:

```typescript
import { xdr, StrKey, Address } from '@stellar/stellar-sdk';

export class AuthVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthVerificationError';
  }
}

export interface VerifyAuthEntryOptions {
  authEntryBase64: string;
  expectedContractId: string;
  expectedPayTo: string;
  expectedFrom: string;
  minAmount: bigint;
  currentLedger: number;
}

export interface VerifyAuthEntryResult {
  valid: true;
  amount: bigint;
  expirationLedger: number;
}

/**
 * Decode and validate a SorobanAuthorizationEntry.
 * Does NOT hit the network — purely local XDR inspection.
 * Call verifyAuthEntryViaSimulation separately for RPC simulation.
 */
export async function verifyAuthEntry(
  opts: VerifyAuthEntryOptions
): Promise<VerifyAuthEntryResult> {
  const { authEntryBase64, expectedContractId, expectedPayTo, expectedFrom, minAmount, currentLedger } = opts;

  let entry: xdr.SorobanAuthorizationEntry;
  try {
    entry = xdr.SorobanAuthorizationEntry.fromXDR(authEntryBase64, 'base64');
  } catch {
    throw new AuthVerificationError('Invalid auth entry XDR');
  }

  // Extract credentials (must be address credentials)
  const credentials = entry.credentials();
  if (credentials.switch() !== xdr.SorobanCredentialsType.sorobanCredentialsAddress()) {
    throw new AuthVerificationError('Auth entry must use address credentials');
  }
  const addrCreds = credentials.address();
  const expirationLedger = addrCreds.signatureExpirationLedger();
  if (expirationLedger <= currentLedger) {
    throw new AuthVerificationError(`Auth entry expired: ledger ${expirationLedger} <= current ${currentLedger}`);
  }

  // Extract root invocation
  const invocation = entry.rootInvocation();
  const fn = invocation.function();
  if (fn.switch() !== xdr.SorobanAuthorizedFunctionType.sorobanAuthorizedFunctionTypeContractFn()) {
    throw new AuthVerificationError('Auth entry must invoke a contract function');
  }

  const contractArgs = fn.contractFn();

  // Check contract ID
  const contractAddr = contractArgs.contractAddress();
  const contractIdHex = Buffer.from(contractAddr.contractId()).toString('hex');
  const actualContractId = StrKey.encodeContract(Buffer.from(contractAddr.contractId()));
  if (actualContractId !== expectedContractId) {
    throw new AuthVerificationError(`Wrong contract: expected ${expectedContractId}, got ${actualContractId}`);
  }

  // Check function name
  const functionName = contractArgs.functionName().toString();
  if (functionName !== 'transfer') {
    throw new AuthVerificationError(`Wrong function: expected "transfer", got "${functionName}"`);
  }

  // Check args: [from, to, amount]
  const args = contractArgs.args();
  if (args.length !== 3) {
    throw new AuthVerificationError(`Expected 3 args, got ${args.length}`);
  }

  const fromScVal = args[0];
  const toScVal = args[1];
  const amountScVal = args[2];

  // Decode from address
  const fromAddr = Address.fromScVal(fromScVal).toString();
  if (fromAddr !== expectedFrom) {
    throw new AuthVerificationError(`Wrong from address: expected ${expectedFrom}, got ${fromAddr}`);
  }

  // Decode to address
  const toAddr = Address.fromScVal(toScVal).toString();
  if (toAddr !== expectedPayTo) {
    throw new AuthVerificationError(`Wrong payTo address: expected ${expectedPayTo}, got ${toAddr}`);
  }

  // Decode amount (i128)
  if (amountScVal.switch() !== xdr.ScValType.scvI128()) {
    throw new AuthVerificationError('Amount must be i128');
  }
  const i128 = amountScVal.i128();
  const amount = BigInt(i128.lo().toString()) + (BigInt(i128.hi().toString()) << 64n);
  if (amount < minAmount) {
    throw new AuthVerificationError(`Amount too low: ${amount} < required ${minAmount}`);
  }

  return { valid: true, amount, expirationLedger };
}
```

- [x] **Step 4: Run — expect pass**

```bash
cd packages/facilitator && pnpm test
```

Expected: all verify-auth tests pass.

- [x] **Step 5: Commit**

```bash
git add packages/facilitator/src/stellar/verify-auth.ts packages/facilitator/src/tests/verify-auth.test.ts
git commit -m "feat(facilitator): Soroban auth entry verification"
```

---

## Task 7: Transaction Submission

**Files:**
- Modify: `packages/facilitator/src/stellar/submit-tx.ts`

No unit tests (network-dependent). Covered by integration test in Task 12.

- [x] **Step 1: Implement**

Replace `src/stellar/submit-tx.ts` with:

```typescript
import {
  Keypair,
  TransactionBuilder,
  Operation,
  Networks,
  rpc,
  xdr,
  BASE_FEE,
  FeeBumpTransaction,
} from '@stellar/stellar-sdk';
import type { StellarNetwork } from '../types.js';
import { getRpcServer } from './client.js';

const NETWORK_PASSPHRASE: Record<StellarNetwork, string> = {
  testnet: Networks.TESTNET,
  mainnet: Networks.PUBLIC,
};

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 20;

export interface SubmitTxOptions {
  /** The pre-signed SorobanAuthorizationEntry XDR (base64) from the client */
  authEntryBase64: string;
  /** C... contract address of the token */
  contractId: string;
  /** G... address of the payer (client) */
  from: string;
  /** G... address of the recipient (API provider) */
  payTo: string;
  /** Amount in stroops */
  amount: bigint;
  /** Facilitator keypair — pays the fee */
  facilitatorKeypair: Keypair;
  network: StellarNetwork;
}

export interface SubmitTxResult {
  txHash: string;
}

/** Build, submit, and poll a Soroban token.transfer invocation using a pre-authorized auth entry. */
export async function submitTx(opts: SubmitTxOptions): Promise<SubmitTxResult> {
  const { authEntryBase64, contractId, from, payTo, amount, facilitatorKeypair, network } = opts;

  const server = getRpcServer(network);
  const networkPassphrase = NETWORK_PASSPHRASE[network];

  // Load facilitator account
  const facilitatorAccount = await server.getAccount(facilitatorKeypair.publicKey());

  // Decode the client's pre-authorized auth entry
  const authEntry = xdr.SorobanAuthorizationEntry.fromXDR(authEntryBase64, 'base64');

  // Build i128 amount for Soroban
  const amountI128 = xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      hi: xdr.Int64.fromString('0'),
      lo: xdr.Uint64.fromString(amount.toString()),
    })
  );

  // Build the invokeHostFunction operation
  const op = Operation.invokeContractFunction({
    contract: contractId,
    function: 'transfer',
    args: [
      new xdr.ScVal(xdr.ScValType.scvAddress(), xdr.ScAddress.scAddressTypeAccount(
        xdr.PublicKey.publicKeyTypeEd25519(
          Buffer.from(from.substring(0), 'base64') // decoded via Keypair below
        )
      )),
      // Use nativeToScVal for cleaner address encoding
    ],
  });

  // Use Contract.call for cleaner invocation
  const { Contract, nativeToScVal, Address } = await import('@stellar/stellar-sdk');
  const contract = new Contract(contractId);

  const fromScVal = new Address(from).toScVal();
  const toScVal = new Address(payTo).toScVal();
  const amountScVal = nativeToScVal(amount, { type: 'i128' });

  const callOp = contract.call('transfer', fromScVal, toScVal, amountScVal);

  const tx = new TransactionBuilder(facilitatorAccount, {
    fee: String(Number(BASE_FEE) * 10), // 10x base fee
    networkPassphrase,
  })
    .addOperation(callOp)
    .setTimeout(30)
    .build();

  // Attach client's pre-authorized auth entry to the transaction
  const sorobanData = tx.toEnvelope().v1().tx().ext().sorobanData();
  // We need to prepare the transaction first to get resource estimates
  const preparedTx = await server.prepareTransaction(tx);

  // Inject the client auth entry
  const txEnv = preparedTx.toEnvelope();
  const ops = txEnv.v1().tx().operations();
  const hostFunctionOp = ops[0].body().invokeHostFunctionOp();
  hostFunctionOp.auth([authEntry]);

  // Re-sign with facilitator
  preparedTx.sign(facilitatorKeypair);

  // Submit
  const sendResult = await server.sendTransaction(preparedTx);
  if (sendResult.status === 'ERROR') {
    throw new Error(`Transaction rejected: ${JSON.stringify(sendResult.errorResult)}`);
  }

  const txHash = sendResult.hash;

  // Poll for confirmation
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const getResult = await server.getTransaction(txHash);

    if (getResult.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { txHash };
    }
    if (getResult.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed: ${txHash}`);
    }
    // NOT_FOUND = still pending, keep polling
  }

  throw new Error(`Transaction not confirmed after ${MAX_POLL_ATTEMPTS} attempts: ${txHash}`);
}
```

- [x] **Step 2: Commit**

```bash
git add packages/facilitator/src/stellar/submit-tx.ts
git commit -m "feat(facilitator): Soroban tx build, submit, and poll"
```

---

## Task 8: GET /supported Route

**Files:**
- Modify: `packages/facilitator/src/routes/supported.ts`
- Create: `packages/facilitator/src/tests/supported.test.ts`

- [x] **Step 1: Write failing test**

Create `packages/facilitator/src/tests/supported.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { supportedRoute } from '../routes/supported.js';

describe('GET /supported', () => {
  it('returns supported networks and assets', async () => {
    const app = Fastify();
    app.register(supportedRoute);
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/supported' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.schemes).toContain('x402');
    expect(body.networks).toContain('testnet');
    expect(body.assets.testnet[0].code).toBe('USDC');
  });
});
```

- [x] **Step 2: Run — expect fail**

```bash
cd packages/facilitator && pnpm test
```

Expected: `Cannot find module '../routes/supported.js'`.

- [x] **Step 3: Implement**

Replace `src/routes/supported.ts` with:

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { SUPPORTED_ASSETS } from '../stellar/tokens.js';
import type { SupportedResponse } from '../types.js';

export const supportedRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: SupportedResponse }>('/supported', async (_req, reply) => {
    return reply.send({
      schemes: ['x402'],
      networks: ['testnet', 'mainnet'],
      assets: SUPPORTED_ASSETS,
    });
  });
};
```

- [x] **Step 4: Run — expect pass**

```bash
cd packages/facilitator && pnpm test
```

Expected: all tests pass.

- [x] **Step 5: Commit**

```bash
git add packages/facilitator/src/routes/supported.ts packages/facilitator/src/tests/supported.test.ts
git commit -m "feat(facilitator): GET /supported route"
```

---

## Task 9: POST /verify Route

**Files:**
- Modify: `packages/facilitator/src/routes/verify.ts`
- Create: `packages/facilitator/src/tests/verify-route.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/facilitator/src/tests/verify-route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { verifyRoute } from '../routes/verify.js';

// Mock verifyAuthEntry to avoid XDR manipulation in route tests
vi.mock('../stellar/verify-auth.js', () => ({
  verifyAuthEntry: vi.fn(),
  AuthVerificationError: class AuthVerificationError extends Error {},
}));

import { verifyAuthEntry, AuthVerificationError } from '../stellar/verify-auth.js';

const VALID_REQUEST = {
  payload: {
    scheme: 'x402',
    network: 'testnet',
    authEntry: 'base64xdr==',
    from: 'GABC1234567890123456789012345678901234567890123456789012',
  },
  requirements: {
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
  },
};

describe('POST /verify', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Set required env vars for config
    process.env.FACILITATOR_STELLAR_SECRET = 'STEST';
    process.env.KOVA_TREASURY_ADDRESS = 'GTREASURY';

    app = Fastify();
    app.register(verifyRoute);
    await app.ready();
  });

  it('returns valid=true when auth entry is valid', async () => {
    vi.mocked(verifyAuthEntry).mockResolvedValue({
      valid: true,
      amount: 1_000_000n,
      expirationLedger: 9_999_999,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      payload: VALID_REQUEST,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ valid: true });
  });

  it('returns valid=false when auth entry is invalid', async () => {
    vi.mocked(verifyAuthEntry).mockRejectedValue(
      new AuthVerificationError('Amount too low')
    );

    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      payload: VALID_REQUEST,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ valid: false, error: 'Amount too low' });
  });

  it('returns 400 for malformed request body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      payload: { bad: 'data' },
    });

    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd packages/facilitator && pnpm test
```

Expected: `Cannot find module '../routes/verify.js'`.

- [ ] **Step 3: Implement**

Replace `src/routes/verify.ts` with:

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { verifyAuthEntry, AuthVerificationError } from '../stellar/verify-auth.js';
import { getRpcServer } from '../stellar/client.js';
import { decimalToStroops } from '../utils.js';
import type { VerifyRequest, VerifyResponse } from '../types.js';

export const verifyRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: VerifyRequest; Reply: VerifyResponse }>('/verify', {
    schema: {
      body: {
        type: 'object',
        required: ['payload', 'requirements'],
        properties: {
          payload: {
            type: 'object',
            required: ['scheme', 'network', 'authEntry', 'from'],
            properties: {
              scheme: { type: 'string' },
              network: { type: 'string' },
              authEntry: { type: 'string' },
              from: { type: 'string' },
            },
          },
          requirements: {
            type: 'object',
            required: ['maxAmountRequired', 'asset', 'payTo', 'network'],
            properties: {
              maxAmountRequired: { type: 'string' },
              asset: { type: 'object', required: ['contractId'], properties: { contractId: { type: 'string' } } },
              payTo: { type: 'string' },
              network: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { payload, requirements } = request.body;

    // Get current ledger for expiry check
    const server = getRpcServer(payload.network as 'testnet' | 'mainnet');
    const { sequence: currentLedger } = await server.getLatestLedger();

    try {
      await verifyAuthEntry({
        authEntryBase64: payload.authEntry,
        expectedContractId: requirements.asset.contractId,
        expectedPayTo: requirements.payTo,
        expectedFrom: payload.from,
        minAmount: decimalToStroops(requirements.maxAmountRequired),
        currentLedger,
      });
      return reply.send({ valid: true });
    } catch (err) {
      if (err instanceof AuthVerificationError) {
        return reply.send({ valid: false, error: err.message });
      }
      throw err;
    }
  });
};
```

- [ ] **Step 4: Create utils.ts helper (needed by verify + settle)**

Create `packages/facilitator/src/utils.ts`:

```typescript
/**
 * Convert a decimal string like "0.001" to Stellar stroops (bigint, 7 decimals).
 * e.g. "0.001" → 10_000n, "1" → 10_000_000n
 */
export function decimalToStroops(decimal: string): bigint {
  const [whole, frac = ''] = decimal.split('.');
  const fracPadded = frac.padEnd(7, '0').slice(0, 7);
  return BigInt(whole) * 10_000_000n + BigInt(fracPadded);
}
```

Add a quick test to the fee-calculator test file (or create `src/tests/utils.test.ts`):

Create `packages/facilitator/src/tests/utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { decimalToStroops } from '../utils.js';

describe('decimalToStroops', () => {
  it('converts 1 USDC', () => expect(decimalToStroops('1')).toBe(10_000_000n));
  it('converts 0.001 USDC', () => expect(decimalToStroops('0.001')).toBe(10_000n));
  it('converts 0.0000001 USDC', () => expect(decimalToStroops('0.0000001')).toBe(1n));
});
```

- [ ] **Step 5: Run — expect pass**

```bash
cd packages/facilitator && pnpm test
```

Expected: all tests pass (verify route tests pass because `verifyAuthEntry` is mocked).

- [ ] **Step 6: Commit**

```bash
git add packages/facilitator/src/routes/verify.ts packages/facilitator/src/tests/verify-route.test.ts packages/facilitator/src/utils.ts packages/facilitator/src/tests/utils.test.ts
git commit -m "feat(facilitator): POST /verify route and decimal-to-stroops util"
```

---

## Task 10: POST /settle Route

**Files:**
- Modify: `packages/facilitator/src/routes/settle.ts`
- Create: `packages/facilitator/src/tests/settle-route.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/facilitator/src/tests/settle-route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { settleRoute } from '../routes/settle.js';

vi.mock('../stellar/verify-auth.js', () => ({
  verifyAuthEntry: vi.fn(),
  AuthVerificationError: class AuthVerificationError extends Error {},
}));

vi.mock('../stellar/submit-tx.js', () => ({
  submitTx: vi.fn(),
}));

vi.mock('../stellar/client.js', () => ({
  getRpcServer: vi.fn(() => ({
    getLatestLedger: vi.fn().mockResolvedValue({ sequence: 1_000_000 }),
  })),
}));

import { verifyAuthEntry, AuthVerificationError } from '../stellar/verify-auth.js';
import { submitTx } from '../stellar/submit-tx.js';

const VALID_REQUEST = {
  payload: {
    scheme: 'x402',
    network: 'testnet',
    authEntry: 'base64xdr==',
    from: 'GABC1234567890123456789012345678901234567890123456789012',
  },
  requirements: {
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
  },
};

describe('POST /settle', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.FACILITATOR_STELLAR_SECRET = 'SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    process.env.KOVA_TREASURY_ADDRESS = 'GTREASURY1234567890123456789012345678901234567890123456';
    process.env.KOVA_FEE_PERCENT = '1.5';

    app = Fastify();
    app.register(settleRoute);
    await app.ready();
  });

  it('returns success=true with receipt on successful settlement', async () => {
    vi.mocked(verifyAuthEntry).mockResolvedValue({ valid: true, amount: 10_000n, expirationLedger: 9_999_999 });
    vi.mocked(submitTx).mockResolvedValue({ txHash: 'abc123' });

    const res = await app.inject({
      method: 'POST',
      url: '/settle',
      payload: VALID_REQUEST,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.receipt.txHash).toBe('abc123');
    expect(body.receipt.amount).toBe('0.001');
    expect(body.receipt.network).toBe('testnet');
  });

  it('returns success=false when verification fails', async () => {
    vi.mocked(verifyAuthEntry).mockRejectedValue(new AuthVerificationError('Expired'));

    const res = await app.inject({
      method: 'POST',
      url: '/settle',
      payload: VALID_REQUEST,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Expired');
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd packages/facilitator && pnpm test
```

Expected: `Cannot find module '../routes/settle.js'`.

- [ ] **Step 3: Implement**

Replace `src/routes/settle.ts` with:

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { Keypair } from '@stellar/stellar-sdk';
import { verifyAuthEntry, AuthVerificationError } from '../stellar/verify-auth.js';
import { submitTx } from '../stellar/submit-tx.js';
import { getRpcServer } from '../stellar/client.js';
import { calculateFee } from '../fee/calculator.js';
import { decimalToStroops } from '../utils.js';
import { config } from '../config.js';
import type { SettleRequest, SettleResponse } from '../types.js';

/** Convert stroops (bigint) back to decimal string with 7dp precision */
function stroopsToDecimal(stroops: bigint): string {
  const whole = stroops / 10_000_000n;
  const frac = stroops % 10_000_000n;
  return `${whole}.${frac.toString().padStart(7, '0')}`.replace(/\.?0+$/, '');
}

const FEE_FLOOR_STROOPS = 1_000n; // 0.0001 USDC minimum fee

export const settleRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: SettleRequest; Reply: SettleResponse }>('/settle', {
    schema: {
      body: {
        type: 'object',
        required: ['payload', 'requirements'],
        properties: {
          payload: {
            type: 'object',
            required: ['scheme', 'network', 'authEntry', 'from'],
            properties: {
              scheme: { type: 'string' },
              network: { type: 'string' },
              authEntry: { type: 'string' },
              from: { type: 'string' },
            },
          },
          requirements: {
            type: 'object',
            required: ['maxAmountRequired', 'asset', 'payTo', 'network'],
            properties: {
              maxAmountRequired: { type: 'string' },
              asset: { type: 'object', required: ['contractId'], properties: { contractId: { type: 'string' } } },
              payTo: { type: 'string' },
              network: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { payload, requirements } = request.body;
    const network = payload.network as 'testnet' | 'mainnet';

    const server = getRpcServer(network);
    const { sequence: currentLedger } = await server.getLatestLedger();
    const minAmount = decimalToStroops(requirements.maxAmountRequired);

    let verifiedAmount: bigint;
    try {
      const result = await verifyAuthEntry({
        authEntryBase64: payload.authEntry,
        expectedContractId: requirements.asset.contractId,
        expectedPayTo: requirements.payTo,
        expectedFrom: payload.from,
        minAmount,
        currentLedger,
      });
      verifiedAmount = result.amount;
    } catch (err) {
      if (err instanceof AuthVerificationError) {
        return reply.send({ success: false, error: err.message });
      }
      throw err;
    }

    const facilitatorKeypair = Keypair.fromSecret(config.stellarSecret);
    const fee = calculateFee(verifiedAmount, config.feePercent, FEE_FLOOR_STROOPS);

    try {
      const { txHash } = await submitTx({
        authEntryBase64: payload.authEntry,
        contractId: requirements.asset.contractId,
        from: payload.from,
        payTo: requirements.payTo,
        amount: verifiedAmount,
        facilitatorKeypair,
        network,
      });

      return reply.send({
        success: true,
        receipt: {
          txHash,
          network,
          settledAt: new Date().toISOString(),
          amount: stroopsToDecimal(verifiedAmount),
          fee: stroopsToDecimal(fee),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.send({ success: false, error: message });
    }
  });
};
```

- [ ] **Step 4: Run — expect pass**

```bash
cd packages/facilitator && pnpm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/facilitator/src/routes/settle.ts packages/facilitator/src/tests/settle-route.test.ts
git commit -m "feat(facilitator): POST /settle route with fee calculation"
```

---

## Task 11: Server Entry + Rate Limiting

**Files:**
- Modify: `packages/facilitator/src/index.ts`
- Modify: `packages/facilitator/package.json` (add `@fastify/rate-limit`)

- [ ] **Step 1: Install rate-limit plugin**

```bash
cd packages/facilitator && pnpm add @fastify/rate-limit
```

- [ ] **Step 2: Implement server**

Replace `src/index.ts` with:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { supportedRoute } from './routes/supported.js';
import { verifyRoute } from './routes/verify.js';
import { settleRoute } from './routes/settle.js';

const app = Fastify({ logger: true });

// CORS — allow any origin (sdk-server calls this server-to-server)
await app.register(cors, { origin: true });

// Rate limiting — 100 requests/minute per IP
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

await app.register(supportedRoute);
await app.register(verifyRoute);
await app.register(settleRoute);

await app.listen({ port: config.port, host: '0.0.0.0' });
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/facilitator && pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/facilitator/src/index.ts packages/facilitator/package.json
git commit -m "feat(facilitator): Fastify server with CORS and rate limiting"
```

---

## Task 12: Build Verification

**Files:**
- No new files

- [ ] **Step 1: Run full test suite**

```bash
cd packages/facilitator && pnpm test
```

Expected: all unit tests pass.

- [ ] **Step 2: TypeScript check**

```bash
cd packages/facilitator && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Build**

```bash
cd packages/facilitator && pnpm build
```

Expected: `dist/index.js` generated with no errors.

- [ ] **Step 4: Smoke-test server startup (testnet only)**

Requires `.env` with real values. Set env vars then:

```bash
cd packages/facilitator
FACILITATOR_STELLAR_SECRET=<real_S_key> \
KOVA_TREASURY_ADDRESS=<real_G_address> \
STELLAR_NETWORK=testnet \
node dist/index.js
```

Expected: `Server listening at http://0.0.0.0:4021` in logs.

Test supported endpoint:

```bash
curl http://localhost:4021/supported
```

Expected:

```json
{
  "schemes": ["x402"],
  "networks": ["testnet", "mainnet"],
  "assets": {
    "testnet": [{ "code": "USDC", "issuer": "GBBD...", "contractId": "CBIEL..." }],
    "mainnet": [...]
  }
}
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore(facilitator): verify build and smoke test"
```

---

## Known Gaps / Notes

- **submit-tx.ts auth injection**: The `preparedTx` auth injection uses mutable XDR manipulation. If `@stellar/stellar-sdk` v13 exposes a cleaner API (e.g. `prepareTransaction` accepting auth entries), prefer that over manual XDR surgery.
- **Fee collection**: Current implementation transfers `amount` to `payTo` — fee deduction (sending `amount - fee` to payTo, `fee` to treasury) requires two separate `token.transfer` calls or a Soroban contract. Phase 2 concern — log fee in receipt for now.
- **Testnet USDC contract**: Addresses in `tokens.ts` are from Circle's docs (2024). Verify against current testnet before running integration tests.
