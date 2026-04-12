import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { settleRoute } from '../routes/settle.js';

vi.mock('../stellar/verify-auth.js', () => ({
  verifyAuthEntry: vi.fn(),
  AuthVerificationError: class AuthVerificationError extends Error {
    constructor(msg: string) { super(msg); this.name = 'AuthVerificationError'; }
  },
}));

vi.mock('../stellar/submit-tx.js', () => ({
  submitTx: vi.fn(),
}));

vi.mock('../stellar/client.js', () => ({
  getRpcServer: vi.fn(() => ({
    getLatestLedger: vi.fn().mockResolvedValue({ sequence: 1_000_000 }),
  })),
}));

vi.mock('../config.js', () => ({
  config: {
    stellarSecret: 'SAEWWRK5IMZXDYQKOPXZ7UUC6LMKBR5WIV2DYJ2AF6TPBQ5YCK3V7AP3',
    port: 4021,
    network: 'testnet',
    feePercent: 1.5,
    treasuryAddress: 'GTREASURY1234567890123456789012345678901234567890123456',
  },
}));

vi.mock('@stellar/stellar-sdk', async () => {
  const actual = await vi.importActual<typeof import('@stellar/stellar-sdk')>('@stellar/stellar-sdk');
  return {
    ...actual,
    Keypair: {
      ...actual.Keypair,
      fromSecret: vi.fn().mockReturnValue({ publicKey: vi.fn().mockReturnValue('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAV') }),
    },
  };
});

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

    app = Fastify();
    await app.register(settleRoute);
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