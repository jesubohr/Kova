import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

// Mock before importing route
vi.mock('../stellar/verify-auth.js', () => ({
  verifyAuthEntry: vi.fn(),
  AuthVerificationError: class AuthVerificationError extends Error {
    constructor(msg: string) { super(msg); this.name = 'AuthVerificationError'; }
  },
}));

vi.mock('../stellar/client.js', () => ({
  getRpcServer: vi.fn(() => ({
    getLatestLedger: vi.fn().mockResolvedValue({ sequence: 1_000_000 }),
  })),
}));

import { verifyRoute } from '../routes/verify.js';
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
    app = Fastify();
    await app.register(verifyRoute);
    await app.ready();
  });

  it('returns valid=true when auth entry is valid', async () => {
    vi.mocked(verifyAuthEntry).mockResolvedValue({
      valid: true,
      amount: 10_000n,
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

  it('returns valid=false with error when auth entry invalid', async () => {
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

  it('returns 400 for missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      payload: { bad: 'data' },
    });

    expect(res.statusCode).toBe(400);
  });
});
